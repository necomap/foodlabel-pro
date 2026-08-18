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

  const ing = await prisma.ingredient.findUnique({ where: { id: params.id } });
  if (!ing) return NextResponse.json({ success: false, error: '食材が見つかりません' }, { status: 404 });

  // 編集できるのは (1) 自分が登録した食材、または (2) 管理者による「食品成分表から自動生成した
  // システム所有食材（userId: null）」の編集・一般名確定作業のみ。他ユーザーが登録した食材
  // （userIdが自分以外で設定されている）は、管理者であっても本人以外は編集できない
  // （無断で他ユーザーの共有食材の内容を書き換えられてしまうのを防ぐため）。
  const isAdmin = (session.user as any).plan === 'admin';
  const canEdit = ing.userId === session.user.id || (isAdmin && ing.userId === null);
  if (!canEdit) return NextResponse.json({ success: false, error: 'この食材を編集する権限がありません' }, { status: 403 });

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

  // 「常にラベル除外」は、この食材を使う全ユーザーのラベルに一律で影響する強い設定。共有食材で
  // 使う場面は実質「水」くらいしかなく、それ以外で誤ってONのまま共有されると、承認する管理者が
  // 見落とした場合に他ユーザーの原材料表示が意図せず欠落する（表示義務違反になりうる）リスクが
  // ある。そのためコミュニティ共有中（isPublicがtrueになる）は、リクエストの値に関わらず強制的に
  // OFFにする。個別のレシピで水などを非表示にしたい場合は、レシピ編集画面の材料ごとの
  // 「ラベル非表示」チェック（hideFromLabel）を使ってもらう（そちらはユーザー・レシピ単位の設定
  // なので、共有食材であってもこの安全策の影響を受けない）。
  const resolvedIsPublic = body.isPublic ?? ing.isPublic;
  // isPublicの状態を明示的に変更した（=非公開にした／公開申請し直した）タイミングでは、
  // 古い却下通知（rejectionReason等）を必ずクリアする。以前はここが漏れており、
  // 却下→ユーザーが修正して再申請→管理者が承認、という流れの途中で「もう解決済みのはずの
  // 却下通知」が残り続け、承認直後でも古い却下通知が表示されてしまう不具合の原因だった。
  const isPublicTouched = body.isPublic !== undefined;
  const resolvedAlwaysHideFromLabel = resolvedIsPublic
    ? false
    : (body.alwaysHideFromLabel !== undefined ? body.alwaysHideFromLabel : (ing as any).alwaysHideFromLabel);

  await prisma.ingredient.update({
    where: { id: params.id },
    data: {
      name,
      nameKana,
      nameSearch:      `${name}${nameKana ?? ''}`,
      genericName:          body.genericName !== undefined ? (body.genericName || null) : (ing as any).genericName,
      // ユーザーが画面から明示的に一般名を触ったら「確定済み」扱いにする（自動仮入力の要確認フラグを解除）
      genericNameConfirmed: body.genericName !== undefined ? true : (ing as any).genericNameConfirmed,
      alwaysHideFromLabel: resolvedAlwaysHideFromLabel,
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
      isPublic:        resolvedIsPublic,
      isApproved:      body.isPublic === false ? true : (body.isPublic ? false : ing.isApproved),
      rejectionReason: isPublicTouched ? null  : ing.rejectionReason,
      rejectionNote:   isPublicTouched ? null  : ing.rejectionNote,
      rejectedAt:      isPublicTouched ? null  : ing.rejectedAt,
      rejectionSeen:   isPublicTouched ? true  : ing.rejectionSeen,
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
      // 注意：id / ingredientCategoryId は Prisma上 String（実体はPostgresの text型）で、
      // ネイティブの uuid 型ではない。以前ここに付いていた ::uuid キャストは「無いとエラーになる」
      // という誤った想定で追加されたものだが、実際には逆で、text型のカラムをuuidにキャストした値と
      // 比較・代入しようとすると Postgres が「operator does not exist: text = uuid」で例外を投げる。
      // このtry/catchで例外が握りつぶされ、フロントには保存成功のトーストが出るのに、
      // 実際にはカテゴリだけ一度も保存されていない、という不具合の直接原因だった。
      // 素の文字列のまま（キャストなし）で比較・代入すれば text = text / text への代入になり正しく動く。
      if (catId) {
        await prisma.$executeRaw`UPDATE ingredients SET "ingredientCategoryId" = ${catId} WHERE id = ${params.id}`;
      } else {
        await prisma.$executeRaw`UPDATE ingredients SET "ingredientCategoryId" = NULL WHERE id = ${params.id}`;
      }
    } catch (e) { console.warn('ingredientCategoryId update skipped:', e); }
  }
  return NextResponse.json({ success: true, message: '食材を更新しました' });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const ing = await prisma.ingredient.findUnique({ where: { id: params.id } });
  if (!ing) return NextResponse.json({ success: false, error: '食材が見つかりません' }, { status: 404 });

  const isAdmin = (session.user as any).plan === 'admin';
  const canEdit = ing.userId === session.user.id || (isAdmin && ing.userId === null);
  if (!canEdit) return NextResponse.json({ success: false, error: 'この食材を削除する権限がありません' }, { status: 403 });

  await prisma.ingredient.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
