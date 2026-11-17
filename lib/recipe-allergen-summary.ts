// ============================================================
// lib/recipe-allergen-summary.ts - レシピごとのアレルゲン集計（一覧表・POP共用）（2026-11新設）
// ============================================================
// アレルゲン一覧表（/api/recipes/allergen-table）と POP・プライスカード（/api/recipes/pop）で使う。
// 集約はラベル・レシピ一覧と同じ collectRecipeAllergens（lib/allergen.ts）。独自の判定はしないこと。

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { collectRecipeAllergens, REQUIRED_ALLERGENS, OPTIONAL_ALLERGENS } from '@/lib/allergen';
import { getCompositeOverrides, resolveComposite } from '@/lib/generic-name-overrides';

export const KNOWN_ALLERGENS = [...Object.keys(REQUIRED_ALLERGENS), ...Object.keys(OPTIONAL_ALLERGENS)];

export interface RecipeAllergenSummary {
  id: string; name: string; nameKana: string | null; variationName: string | null; nameEn: string | null;
  categoryId: string | null; categoryName: string | null; categorySort: number;
  salePrice: number | null;
  allergens: string[];        // 28品目のうち含むもの
  otherAllergens: string[];   // 28品目以外の自由入力のアレルゲン
  ingredientCount: number;
}

export async function getRecipeAllergenSummaries(
  userId: string,
  where: Prisma.RecipeWhereInput,
  take = 1000,
): Promise<RecipeAllergenSummary[]> {
  const recipes = await prisma.recipe.findMany({
    where: { ...where, userId },
    take,
    orderBy: [{ name: 'asc' }],
    select: {
      id: true, name: true, nameKana: true, variationName: true, nameEn: true, categoryId: true, salePrice: true,
      category:    { select: { name: true, sortOrder: true } },
      ingredients: { select: { ingredientId: true, allergenOverride: true, ingredientNameOverride: true, ingredient: { select: { allergens: true, name: true, compositeIngredients: true, compositeAdditives: true } } } },
    },
  });

  const compositeOverrides = await getCompositeOverrides(userId, recipes.flatMap(r => r.ingredients.map(i => i.ingredientId)));
  const known = new Set(KNOWN_ALLERGENS);

  return recipes.map(r => {
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
      id:              r.id,
      name:            r.name,
      nameKana:        r.nameKana,
      variationName:   (r as any).variationName ?? null,
      nameEn:          (r as any).nameEn ?? null,
      categoryId:      r.categoryId,
      categoryName:    r.category?.name ?? null,
      categorySort:    r.category?.sortOrder ?? 9999,
      salePrice:       r.salePrice != null ? Number(r.salePrice) : null,
      allergens:       info.all.filter(a => known.has(a)),
      otherAllergens:  info.all.filter(a => !known.has(a)),
      ingredientCount: r.ingredients.length,
    };
  });
}
