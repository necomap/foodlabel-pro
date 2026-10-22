// ============================================================
// lib/recipe-as-ingredient.ts - レシピを「中間品」の食材として使う（2026-10-22新設）
// ============================================================
// 自家製のカスタード・ガナッシュ・パン生地などを1つのレシピとして登録しておき、
// 食材マスタの「自分の食材」として他のレシピの材料に使えるようにする。
//
// 仕組み: 元レシピから次の値を計算して、食材マスタ（Ingredient、sourceRecipeId=元レシピ）に保存する。
//   ・栄養成分（100gあたり、手入力値の欄に保存）… 材料の合計 ÷ 仕上がり重量 × 100
//   ・アレルゲン … 元レシピの全材料のアレルゲン
//   ・複合原材料の内訳 … 元レシピの原材料表示（重量順）。添加物は compositeAdditives に分ける
//   ・仕入単価（1gあたり）… 元レシピの原価合計 ÷ 仕上がり重量
// 仕上がり重量は「材料の合計重量 − 廃棄数量」を使う（加熱で水分が飛ぶ分は考慮しない概算）。
//
// 中間品を使う側のレシピは、ラベル生成・レシピ詳細のたびに食材マスタの最新値で計算し直すため、
// 元レシピを保存し直す（＝この食材が更新される）だけで、使う側のラベルにも反映される。
import { prisma } from '@/lib/db';
import { buildIngredientsLabel, collectRecipeAllergens, prepareIngredientsForLabel } from '@/lib/allergen';
import { computeLiveRecipeNutrition, toGrams } from '@/lib/nutrition';
import { getGenericNameOverrides, getCompositeOverrides, resolveComposite } from '@/lib/generic-name-overrides';
import { toFullWidth } from '@/lib/excel-import-export';

const NUTRITION_SELECT = {
  energyKcalManual: true, proteinManual: true, fatManual: true, carbohydrateManual: true,
  sodiumManual: true, saltEquivalentManual: true, dietaryFiberManual: true, sugarManual: true, cholesterolManual: true,
  nutritionData: { select: { energyKcal: true, protein: true, fat: true, carbohydrate: true, sodium: true, saltEquivalent: true, dietaryFiber: true, sugar: true, cholesterol: true } },
} as const;

type Computed = {
  name: string;
  allergens: string[];
  compositeIngredients: string | null;
  compositeAdditives: string | null;
  per100g: Record<string, number | null>;
  unitPrice: number | null;
  weightG: number;
  unconfirmedCount: number;
};

async function computeFromRecipe(userId: string, recipeId: string): Promise<Computed | { error: string }> {
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, userId },
    include: {
      ingredients: {
        include: {
          ingredient: {
            select: {
              id: true, name: true, allergens: true, unitPrice: true, genericName: true, alwaysHideFromLabel: true,
              originCountry: true, compositeIngredients: true, compositeAdditives: true, sourceRecipeId: true,
              ...NUTRITION_SELECT,
            },
          },
        },
      },
    },
  });
  if (!recipe) return { error: 'レシピが見つかりません' };
  if (recipe.ingredients.some(i => i.ingredient?.sourceRecipeId === recipeId)) {
    return { error: 'このレシピの材料に、このレシピ自身から作った食材が入っています' };
  }

  const weighable = recipe.ingredients.map(i => toGrams(Number(i.amount), i.unit) ?? 0);
  const rawWeight = weighable.reduce((s, g) => s + g, 0);
  const weightG = rawWeight - Number((recipe as any).wasteAmountG ?? 0);
  if (!(weightG > 0)) return { error: '材料の重量（g・kg・ml・L）が入っていないため、100gあたりの値を計算できません' };

  const ids = recipe.ingredients.map(i => i.ingredientId);
  const genericOverrides = await getGenericNameOverrides(userId, ids);
  const compositeOverrides = await getCompositeOverrides(userId, ids);
  const labelName = (i: typeof recipe.ingredients[number]) =>
    (i.ingredientId && genericOverrides.get(i.ingredientId)) || i.ingredient?.genericName || i.ingredient?.name || i.ingredientNameOverride || '';

  const allergenInfo = collectRecipeAllergens(recipe.ingredients.map(i => ({
    allergens: i.ingredient?.allergens ?? [],
    allergenOverride: i.allergenOverride,
    ingredientName: labelName(i),
    hasIngredientLink: !!i.ingredientId,
    compositeText: (() => { const c = resolveComposite(compositeOverrides, i.ingredientId, i.ingredient as any); return [c.compositeIngredients, c.compositeAdditives].filter(Boolean).join('、'); })(),
  })));

  // 原材料表示（アレルゲン表記なし）を作り、「/」の前を原材料、後ろを添加物に分ける
  const labelText = buildIngredientsLabel(
    prepareIngredientsForLabel(recipe.ingredients.map(i => ({
      ingredientName: labelName(i),
      amount: Number(i.amount),
      unit: i.unit,
      displayOrder: i.displayOrder,
      sortByWeight: i.sortByWeight,
      isAdditive: i.isAdditive ?? false,
      additiveReason: i.additiveReason ?? undefined,
      hideFromLabel: (i as any).hideFromLabel ?? false,
      ingredientAlwaysHideFromLabel: i.ingredient?.alwaysHideFromLabel ?? false,
      ...resolveComposite(compositeOverrides, i.ingredientId, i.ingredient as any),
    }))),
    [],
  );
  const slash = labelText.indexOf('/');
  const compositeIngredients = (slash >= 0 ? labelText.slice(0, slash) : labelText).trim() || null;
  const compositeAdditives = slash >= 0 ? (labelText.slice(slash + 1).trim() || null) : null;

  const live = computeLiveRecipeNutrition(recipe.ingredients as any);
  const per100g: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(live.total)) {
    per100g[k] = v != null ? Math.round((Number(v) / weightG) * 100 * 100) / 100 : null;
  }

  // 原価：材料行の原価単価 → 無ければ食材マスタの仕入単価（レシピ詳細APIと同じ考え方）
  let totalCost = 0;
  let hasCost = false;
  for (const i of recipe.ingredients) {
    const price = i.costPrice != null ? Number(i.costPrice) : (i.ingredient?.unitPrice != null ? Number(i.ingredient.unitPrice) : null);
    if (price != null) { totalCost += price * Number(i.amount); hasCost = true; }
  }

  const variation = (recipe as any).variationName ? ` ${(recipe as any).variationName}` : '';
  return {
    name: toFullWidth(`${recipe.name}${variation}`).trim(),
    allergens: allergenInfo.all,
    compositeIngredients,
    compositeAdditives,
    per100g,
    unitPrice: hasCost ? Math.round((totalCost / weightG) * 10000) / 10000 : null,
    weightG,
    unconfirmedCount: live.perIngredient.filter(p => p.unconfirmed).length,
  };
}

function toIngredientData(c: Computed) {
  return {
    allergens:            c.allergens,
    compositeIngredients: c.compositeIngredients,
    compositeAdditives:   c.compositeAdditives,
    energyKcalManual:     c.per100g.energyKcal,
    proteinManual:        c.per100g.protein,
    fatManual:            c.per100g.fat,
    carbohydrateManual:   c.per100g.carbohydrate,
    sodiumManual:         c.per100g.sodium,
    saltEquivalentManual: c.per100g.saltEquivalent,
    dietaryFiberManual:   c.per100g.dietaryFiber,
    sugarManual:          c.per100g.sugar,
    cholesterolManual:    c.per100g.cholesterol,
    unitPrice:            c.unitPrice,
    // 仕入単価は1gあたりで直接持つ（仕入れ単位・価格の欄は使わない）
    purchaseUnitG:        null,
    purchasePrice:        null,
  };
}

/** レシピから中間品の食材を作る（既にあれば最新の内容で更新する） */
export async function upsertIngredientFromRecipe(userId: string, recipeId: string) {
  const c = await computeFromRecipe(userId, recipeId);
  if ('error' in c) return { success: false as const, error: c.error };

  const existing = await prisma.ingredient.findFirst({ where: { userId, sourceRecipeId: recipeId, isActive: true } });
  if (existing) {
    await prisma.ingredient.update({ where: { id: existing.id }, data: toIngredientData(c) });
    return { success: true as const, ingredientId: existing.id, created: false, computed: c };
  }
  const created = await prisma.ingredient.create({
    data: {
      userId,
      name:                 c.name,
      nameSearch:           c.name,
      genericName:          c.name,
      genericNameConfirmed: true,
      sourceRecipeId:       recipeId,
      isPublic:             false,
      isApproved:           true,
      ...toIngredientData(c),
    },
  });
  return { success: true as const, ingredientId: created.id, created: true, computed: c };
}

/** 元レシピを保存したときに呼ぶ：このレシピから作った食材があれば内容を更新する（無ければ何もしない） */
export async function syncIngredientFromRecipe(userId: string, recipeId: string): Promise<void> {
  try {
    const linked = await prisma.ingredient.findFirst({ where: { userId, sourceRecipeId: recipeId, isActive: true }, select: { id: true } });
    if (!linked) return;
    const c = await computeFromRecipe(userId, recipeId);
    if ('error' in c) { console.warn('[recipe-as-ingredient] sync skipped:', c.error); return; }
    await prisma.ingredient.update({ where: { id: linked.id }, data: toIngredientData(c) });
  } catch (e) {
    console.warn('[recipe-as-ingredient] sync error:', e);
  }
}
