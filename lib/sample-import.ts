// ============================================================
// lib/sample-import.ts - サンプルレシピの取り込み（2026-09-30新設）
// ============================================================
// サンプル（lib/sample-recipes.ts）を、利用者自身のレシピ・食材としてコピー登録する。
// ・材料は利用者の「自分の食材」として登録する（同名の自分の食材があれば再利用）。
//   食品番号がDBにあればnutritionIdで紐づけ（栄養値は食品成分表から）、無ければ同梱の値を手入力値として登録。
//   一般名（ラベル表示名）は確定済みで入れるので、そのままラベル印刷できる。
// ・カテゴリはジャンル名（無ければ作成）。
// ・通常のレシピと同じ扱いなので、フリープランのレシピ上限（件数）に含まれる。

import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';
import { SAMPLE_RECIPES, SAMPLE_INGREDIENTS, type SampleRecipeDef } from '@/lib/sample-recipes';
import { createRecipeRecord, type RecipeCreateInput } from '@/lib/recipe-create';

export const SAMPLE_NOTE =
  'サンプルレシピです。分量・工程・賞味期限・保存方法は参考例のため、実際の商品に合わせて必ず修正してください。';

/** まだ取り込める件数（Infinity＝無制限） */
export async function getRemainingRecipeSlots(userId: string, plan: string): Promise<number> {
  const limits = getPlanLimits(plan);
  if (limits.maxRecipes === Infinity) return Infinity;
  const count = await prisma.recipe.count({ where: { userId, isActive: true } });
  return Math.max(0, limits.maxRecipes - count);
}

/** 既に取り込み済み（同名のレシピがある）サンプルのkey一覧 */
export async function getImportedSampleKeys(userId: string): Promise<Set<string>> {
  const names = SAMPLE_RECIPES.map(r => r.name);
  const existing = await prisma.recipe.findMany({
    where:  { userId, name: { in: names } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map(e => e.name));
  return new Set(SAMPLE_RECIPES.filter(r => existingNames.has(r.name)).map(r => r.key));
}

async function resolveIngredientId(userId: string, key: string, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(key);
  if (cached) return cached;
  const def = SAMPLE_INGREDIENTS[key];
  if (!def) throw new Error(`unknown sample ingredient: ${key}`);

  const own = await prisma.ingredient.findFirst({
    where:  { userId, name: def.name, isActive: true },
    select: { id: true },
  });
  if (own) { cache.set(key, own.id); return own.id; }

  const hasTable = def.foodId != null
    ? !!(await prisma.nutritionData.findUnique({ where: { id: def.foodId }, select: { id: true } }))
    : false;
  const p = def.per100g;

  const created = await prisma.ingredient.create({
    data: {
      userId,
      name:                 def.name,
      nameKana:             '',
      allergens:            def.allergens,
      genericName:          def.labelName,
      genericNameConfirmed: true,
      alwaysHideFromLabel:  def.alwaysHideFromLabel,
      isActive:             true,
      ...(hasTable
        ? { nutritionId: def.foodId! }
        : {
            energyKcalManual:     p.energyKcal,
            proteinManual:        p.protein,
            fatManual:            p.fat,
            carbohydrateManual:   p.carbohydrate,
            sodiumManual:         p.sodium,
            saltEquivalentManual: p.saltEquivalent,
            dietaryFiberManual:   p.dietaryFiber,
            cholesterolManual:    p.cholesterol,
          }),
    },
    select: { id: true },
  });
  cache.set(key, created.id);
  return created.id;
}

async function resolveCategoryId(userId: string, genre: string, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(genre);
  if (cached) return cached;
  const found = await prisma.category.findFirst({ where: { userId, name: genre, isActive: true }, select: { id: true } });
  const id = found?.id ?? (await prisma.category.create({ data: { userId, name: genre }, select: { id: true } })).id;
  cache.set(genre, id);
  return id;
}

function toInput(def: SampleRecipeDef, ingredientIds: string[], categoryId: string): RecipeCreateInput {
  // 最も重量の多い材料に原産地を付ける（ラベルの原料原産地表示用）
  const heaviestIdx = def.ingredients.reduce((best, cur, i, arr) => (cur.amount > arr[best].amount ? i : best), 0);
  return {
    name:          def.name,
    categoryId,
    unitCount:     def.unitCount,
    wasteRatio:    0,
    shelfLifeDays: def.shelfLifeDays,
    shelfLifeType: def.shelfLifeType,
    contentAmount: def.contentAmount,
    storageMethod: def.storageMethod,
    notes:         SAMPLE_NOTE,
    bakingConditions: def.bakingConditions.length ? def.bakingConditions.map(b => ({
      topHeat: b.topHeat ?? null, bottomHeat: b.bottomHeat ?? null, timeMin: b.timeMin ?? null, steam: b.steam ?? null,
    })) : undefined,
    ingredients: def.ingredients.map((ing, idx) => ({
      ingredientId:  ingredientIds[idx],
      amount:        ing.amount,
      unit:          'g',
      displayOrder:  idx,
      sortByWeight:  true,
      isAdditive:    SAMPLE_INGREDIENTS[ing.ing].isAdditive,
      hideFromLabel: false,
      ...(idx === heaviestIdx && def.originCountry ? { originCountry: def.originCountry } : {}),
    })),
    steps: def.steps,
  };
}

export type SampleImportResult = { imported: string[]; skippedExisting: string[]; skippedLimit: string[] };

export async function importSampleRecipes(userId: string, plan: string, keys: string[]): Promise<SampleImportResult> {
  const wanted = SAMPLE_RECIPES.filter(r => keys.includes(r.key));
  const already = await getImportedSampleKeys(userId);
  let remaining = await getRemainingRecipeSlots(userId, plan);

  const result: SampleImportResult = { imported: [], skippedExisting: [], skippedLimit: [] };
  const ingCache = new Map<string, string>();
  const catCache = new Map<string, string>();

  for (const def of wanted) {
    if (already.has(def.key)) { result.skippedExisting.push(def.name); continue; }
    if (remaining <= 0)       { result.skippedLimit.push(def.name);    continue; }

    const ingredientIds: string[] = [];
    for (const ing of def.ingredients) ingredientIds.push(await resolveIngredientId(userId, ing.ing, ingCache));
    const categoryId = await resolveCategoryId(userId, def.genre, catCache);

    await createRecipeRecord(userId, toInput(def, ingredientIds, categoryId));
    result.imported.push(def.name);
    remaining -= 1;
  }
  return result;
}
