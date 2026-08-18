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
      // ingredientCategoryId が空文字や不正な形式（UUIDでない）のレコードが1件でも混ざっていると、
      // ::uuid キャストがその行でエラーになりクエリ全体が失敗する（Postgresは1行のエラーで
      // クエリ全体を中断する）。その結果、catch で握りつぶされて categoryMap が空のまま返り、
      // 実際にはカテゴリが設定されている食材も含めて「一覧に含まれる食材全部が未設定」に
      // 見えてしまう不具合があった（承認待ち一覧で報告されたのはこれ）。
      // CASE式で「正規のUUID形式に一致する行だけ」キャストするようにし、それ以外の行は
      // （エラーにせず）その行だけカテゴリなし扱いにすることで、1件の不正データが他の
      // 正常なデータの表示まで巻き込まないようにしている。
      const catRows = await prisma.$queryRaw`
        SELECT i.id::text as ingredient_id, ic.name as cat_name
        FROM ingredients i
        LEFT JOIN ingredient_categories ic ON ic.id = (
          CASE WHEN i."ingredientCategoryId" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
               THEN i."ingredientCategoryId"::uuid END
        )
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
