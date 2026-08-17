// app/api/ingredients/[id]/route.ts - 食材更新・削除
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toFullWidth } from '@/lib/excel-import-export';
import { detectAllergens } from '@/lib/allergen';

type Params = { params: { id: string } };

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const ing = await prisma.ingredient.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!ing) return NextResponse.json({ success: false, error: '食材が見つかりません' }, { status: 404 });

  const body = await request.json();
  const name = body.name ? toFullWidth(body.name).trim() : ing.name;

  // このAPIは (1) 食材マスタ編集モーダル（全項目を送る。空にした項目はnullで明示的に送られてくる）と
  // (2) ラベル印刷画面の一般名クイック編集（{ genericName } だけを送る部分更新）の2箇所から呼ばれる。
  // そのため「キーが無い＝undefined」は必ず「今回は触らない」と解釈し、
  // 「キーはあるが値がnull／空＝明示的にクリアされた」だけを更新するようにする（?? ではなく !== undefined で判定）。
  const nameKana = body.nameKana !== undefined ? body.nameKana : ing.nameKana;

  // purchasePrice/unitPrice はPrismaのDecimal型なので、既存値をフォールバックに使う際は
  // Number()で通常の数値に変換する（Decimalのまま演算・代入しようとすると型エラーになるため）。
  const purchaseTouched = body.purchaseUnitG !== undefined || body.purchasePrice !== undefined;
  const purchaseUnitG = body.purchaseUnitG !== undefined ? body.purchaseUnitG : ing.purchaseUnitG;
  const purchasePrice = body.purchasePrice !== undefined
    ? body.purchasePrice
    : (ing.purchasePrice != null ? Number(ing.purchasePrice) : null);
  let unitPrice: number | null | undefined;
  if (purchaseUnitG && purchasePrice) {
    unitPrice = purchasePrice / purchaseUnitG;
  } else if (purchaseTouched) {
    unitPrice = null; // 単価を計算できなくなった（どちらかがクリアされた）ので単価もクリア
  } else {
    unitPrice = ing.unitPrice != null ? Number(ing.unitPrice) : null;
  }

  // 編集モーダルは常に allergens: [] を含む形で送ってくる（空配列＝ユーザーがすべて手動で消した、を意味する）。
  // そのため他の項目と同様「配列の長さ」ではなく「キーが送られてきたかどうか」で判定する必要がある。
  // ?.length で判定していると、誤検出（例:「すいか」に含まれる「いか」）をユーザーが手動で削除して
  // 空にしても、保存のたびに自動判定が走って復活してしまうバグになる。
  const allergens = body.allergens !== undefined
    ? body.allergens
    : detectAllergens(name);

  await prisma.ingredient.update({
    where: { id: params.id },
    data: {
      name,
      nameKana,
      nameSearch:      `${name}${nameKana ?? ''}`,
      genericName:          body.genericName !== undefined ? (body.genericName || null) : (ing as any).genericName,
      // ユーザーが画面から明示的に一般名を触ったら「確定済み」扱いにする（自動仮入力の要確認フラグを解除）
      genericNameConfirmed: body.genericName !== undefined ? true : (ing as any).genericNameConfirmed,
      alwaysHideFromLabel: body.alwaysHideFromLabel !== undefined ? body.alwaysHideFromLabel : (ing as any).alwaysHideFromLabel,
      nutritionId:     body.nutritionId     !== undefined ? body.nutritionId : ing.nutritionId,
      nutritionVariant: body.nutritionVariant ?? ing.nutritionVariant,
      purchaseUnitG,
      purchasePrice,
      unitPrice,
      storage:         body.storage         ?? ing.storage,
      supplier:        body.supplier        !== undefined ? body.supplier : ing.supplier,
      productCode:     body.productCode     ?? ing.productCode,
      originCountry:   body.originCountry   !== undefined ? (body.originCountry || null) : (ing as any).originCountry,
      allergens:       allergens,
      isPublic:        body.isPublic        ?? ing.isPublic,
      isApproved:      body.isPublic === false ? true : (body.isPublic ? false : ing.isApproved),
      energyKcalManual:    body.energyKcalManual    !== undefined ? body.energyKcalManual : ing.energyKcalManual,
      proteinManual:       body.proteinManual       !== undefined ? body.proteinManual : ing.proteinManual,
      fatManual:           body.fatManual           !== undefined ? body.fatManual : ing.fatManual,
      carbohydrateManual:  body.carbohydrateManual  !== undefined ? body.carbohydrateManual : ing.carbohydrateManual,
      sodiumManual:        body.sodiumManual        ?? ing.sodiumManual,
      saltEquivalentManual: body.saltEquivalentManual !== undefined ? body.saltEquivalentManual : ing.saltEquivalentManual,
      // 食物繊維・糖質・コレステロールは食材編集モーダルの任意項目として追加したため、
      // 他の手入力項目と同様に「キーが送られてきた（null含む）ら明示的に更新」する必要がある。
      dietaryFiberManual:  body.dietaryFiberManual  !== undefined ? body.dietaryFiberManual : ing.dietaryFiberManual,
      sugarManual:         body.sugarManual         !== undefined ? body.sugarManual        : ing.sugarManual,
      cholesterolManual:   body.cholesterolManual   !== undefined ? body.cholesterolManual   : ing.cholesterolManual,
    },
  });

  // ingredientCategoryId はRaw SQLで更新（Prismaクライアント未生成対応）
  if (body.ingredientCategoryId !== undefined) {
    try {
      const catId = body.ingredientCategoryId || null;
      // 注意：WHERE句のidにも::uuidキャストが必要。無いとPostgresが
      // 「operator does not exist: uuid = text」で例外を投げ、下のcatchで黙って
      // 握りつぶされてしまう（＝保存成功のトーストは出るのにカテゴリだけ実際には
      // 保存されない、というバグの原因になっていた）。
      if (catId) {
        await prisma.$executeRaw`UPDATE ingredients SET "ingredientCategoryId" = ${catId}::uuid WHERE id = ${params.id}::uuid`;
      } else {
        await prisma.$executeRaw`UPDATE ingredients SET "ingredientCategoryId" = NULL WHERE id = ${params.id}::uuid`;
      }
    } catch (e) { console.warn('ingredientCategoryId update skipped:', e); }
  }
  return NextResponse.json({ success: true, message: '食材を更新しました' });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const ing = await prisma.ingredient.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!ing) return NextResponse.json({ success: false, error: '食材が見つかりません' }, { status: 404 });

  await prisma.ingredient.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
