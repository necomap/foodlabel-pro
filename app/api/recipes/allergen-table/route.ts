// ============================================================
// app/api/recipes/allergen-table/route.ts - アレルゲン一覧表用のデータ取得API（2026-11新設）
// ============================================================
// 表示中（isActive=true）の全レシピについて、特定原材料等28品目のどれを含むかを返す。
// 店頭掲示・問い合わせ対応用の一覧表（app/dashboard/allergen-table/page.tsx）で使う。
//
// アレルゲンの集約はラベル・レシピ一覧・レシピ詳細と同じ collectRecipeAllergens（lib/allergen.ts）を使う。
// 食材マスタに紐づく材料はマスタのアレルゲンのみ、複合原材料の内訳（自分専用の上書き優先）からも拾う。
// ラベルと結果がずれないよう、ここで独自の判定は一切しないこと。

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { collectRecipeAllergens, REQUIRED_ALLERGENS, OPTIONAL_ALLERGENS } from '@/lib/allergen';
import { getCompositeOverrides, resolveComposite } from '@/lib/generic-name-overrides';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('category') ?? '';

  const recipes = await prisma.recipe.findMany({
    where: {
      userId:   session.user.id,
      isActive: true,
      ...(categoryId && { categoryId }),
    },
    // 件数が多いユーザー（Pro・無制限）でも一覧表として扱える範囲に抑える
    take: 1000,
    orderBy: [{ name: 'asc' }],
    select: {
      id: true, name: true, nameKana: true, variationName: true, categoryId: true,
      category:    { select: { name: true, sortOrder: true } },
      ingredients: { select: { ingredientId: true, allergenOverride: true, ingredientNameOverride: true, ingredient: { select: { allergens: true, name: true, compositeIngredients: true, compositeAdditives: true } } } },
    },
  });

  const compositeOverrides = await getCompositeOverrides(
    session.user.id,
    recipes.flatMap(r => r.ingredients.map(i => i.ingredientId)),
  );

  const known = new Set([...Object.keys(REQUIRED_ALLERGENS), ...Object.keys(OPTIONAL_ALLERGENS)]);

  const items = recipes.map(r => {
    const info = collectRecipeAllergens(
      r.ingredients.map(ing => {
        const comp = resolveComposite(compositeOverrides, ing.ingredientId, ing.ingredient as any);
        return {
          allergens:         ing.ingredient?.allergens ?? [],
          allergenOverride:  ing.allergenOverride,
          ingredientName:    ing.ingredient?.name || ing.ingredientNameOverride || '',
          hasIngredientLink: !!ing.ingredientId,
          compositeText:     [comp.compositeIngredients, comp.compositeAdditives].filter(Boolean).join('、'),
        };
      })
    );
    return {
      id:            r.id,
      name:          r.name,
      nameKana:      r.nameKana,
      variationName: r.variationName ?? null,
      categoryId:    r.categoryId,
      categoryName:  r.category?.name ?? null,
      categorySort:  r.category?.sortOrder ?? 9999,
      allergens:     info.all.filter(a => known.has(a)),
      // 28品目の名前に寄せられなかった自由入力のアレルゲン（ラベルにはそのまま表示されるもの）
      otherAllergens: info.all.filter(a => !known.has(a)),
      ingredientCount: r.ingredients.length,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      items,
      required: Object.keys(REQUIRED_ALLERGENS),
      optional: Object.keys(OPTIONAL_ALLERGENS),
      truncated: recipes.length >= 1000,
    },
  });
}
