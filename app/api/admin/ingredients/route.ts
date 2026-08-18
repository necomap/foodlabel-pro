// app/api/admin/ingredients/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const where = status === 'pending'
    ? { isPublic: true, isApproved: false, isActive: true }
    : { isActive: true };

  const ingredients = await prisma.ingredient.findMany({
    where,
    include: {
      user: { select: { email: true } },
      nutritionData: {
        select: {
          foodName: true,
          energyKcal: true, protein: true, fat: true,
          carbohydrate: true, saltEquivalent: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // 承認前に食材カテゴリ名も確認できるようにraw queryで取得
  const ingIds = ingredients.map((i: any) => i.id);
  let categoryMap: Record<string, string> = {};
  if (ingIds.length > 0) {
    try {
      // id / ingredientCategoryId はPrisma上String（実体はPostgresのtext型）でネイティブuuid型では
      // ないため、以前ここにあった「CASE式で正規UUID形式の行だけ::uuidキャストする」実装は、
      // キャストに成功した行こそが「text型のic.id」と「uuid型にキャストした値」の比較になり、
      // Postgresが「operator does not exist: text = uuid」で例外を投げていた（キャストに失敗する
      // 不正な値の行を守るための対策のはずが、キャストに成功する正常な値の行の方を毎回壊していた）。
      // catchで握りつぶされてcategoryMapが空のまま返り、一覧の食材全部が「未設定」に見える不具合の
      // 直接原因だった。text同士の単純比較にすれば、不正な値の行も単に一致せずnullになるだけで
      // エラーにならないため、CASE式やキャスト自体が不要。
      const catRows = await prisma.$queryRaw`
        SELECT i.id::text as ingredient_id, ic.name as cat_name
        FROM ingredients i
        LEFT JOIN ingredient_categories ic ON ic.id = i."ingredientCategoryId"
        WHERE i.id::text = ANY(${ingIds})
      ` as Array<{ ingredient_id: string; cat_name: string | null }>;
      for (const row of catRows) if (row.cat_name) categoryMap[row.ingredient_id] = row.cat_name;
    } catch (e) {
      console.warn('admin ingredients categoryMap lookup skipped:', e);
    }
  }

  return NextResponse.json({
    success: true,
    data: ingredients.map((i: any) => {
      const hasManual = [
        i.energyKcalManual, i.proteinManual, i.fatManual, i.carbohydrateManual, i.saltEquivalentManual,
      ].some((v: any) => v != null);
      return {
        id:              i.id,
        name:            i.name,
        genericName:     i.genericName ?? null,
        userId:          i.userId,
        userEmail:       i.user?.email,
        allergens:       i.allergens,
        categoryName:    categoryMap[i.id] ?? null,
        // 承認すると他ユーザーにも共有される項目のうち、以前ここに出ていなかった2つ。
        // 特にalwaysHideFromLabelは誤ってtrueのまま承認すると、この食材を使う全ユーザーの
        // ラベル原材料表示から該当原材料が消えてしまう（表示義務違反になりうる）ため、
        // 承認前に必ず目視確認できるようにする。
        originCountry:       (i as any).originCountry ?? null,
        alwaysHideFromLabel: (i as any).alwaysHideFromLabel ?? false,
        createdAt:       i.createdAt,
        nutritionSource: i.nutritionData ? '成分表リンク' : (hasManual ? '手入力' : '未設定'),
        nutritionLinkedFoodName: i.nutritionData?.foodName ?? null,
        nutrition: (i.nutritionData || hasManual) ? {
          energyKcal:     i.energyKcalManual    != null ? Number(i.energyKcalManual)    : (i.nutritionData?.energyKcal     != null ? Number(i.nutritionData.energyKcal)     : null),
          protein:        i.proteinManual       != null ? Number(i.proteinManual)       : (i.nutritionData?.protein        != null ? Number(i.nutritionData.protein)        : null),
          fat:            i.fatManual           != null ? Number(i.fatManual)           : (i.nutritionData?.fat            != null ? Number(i.nutritionData.fat)            : null),
          carbohydrate:   i.carbohydrateManual  != null ? Number(i.carbohydrateManual)  : (i.nutritionData?.carbohydrate   != null ? Number(i.nutritionData.carbohydrate)   : null),
          saltEquivalent: i.saltEquivalentManual != null ? Number(i.saltEquivalentManual) : (i.nutritionData?.saltEquivalent != null ? Number(i.nutritionData.saltEquivalent) : null),
        } : null,
      };
    }),
  });
}
