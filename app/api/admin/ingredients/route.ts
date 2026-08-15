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
      // ingredientCategoryId が空文字（NULLではない）のレコードが混ざっていると ::uuid キャストが
      // 失敗してクエリ全体がエラーになり、結果として全件「未設定」になってしまう。
      // NULLIF で空文字をNULLに正規化してから比較することで、そのレコードだけ「カテゴリなし」扱いにする。
      const catRows = await prisma.$queryRaw`
        SELECT i.id::text as ingredient_id, ic.name as cat_name
        FROM ingredients i
        LEFT JOIN ingredient_categories ic ON ic.id = NULLIF(i."ingredientCategoryId", '')::uuid
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
