// ============================================================
// lib/nutrition.ts - 栄養成分計算ロジック
// ============================================================

import type { NutritionValues, RecipeIngredientDetail } from '@/types';

/**
 * 食材の使用量と100gあたり栄養成分から、実際の栄養成分を計算する
 * @param nutritionPer100g - 100gあたりの栄養成分
 * @param amountG - 使用量（g）
 * @returns 使用量に対応した栄養成分
 */
export function calcNutritionForAmount(
  nutritionPer100g: Partial<NutritionValues>,
  amountG: number
): NutritionValues {
  const ratio = amountG / 100;
  const calc = (val: number | null | undefined) =>
    val != null ? Math.round(val * ratio * 100) / 100 : null;

  return {
    energyKcal:     calc(nutritionPer100g.energyKcal),
    protein:        calc(nutritionPer100g.protein),
    fat:            calc(nutritionPer100g.fat),
    carbohydrate:   calc(nutritionPer100g.carbohydrate),
    sodium:         calc(nutritionPer100g.sodium),
    saltEquivalent: calc(nutritionPer100g.saltEquivalent),
    dietaryFiber:   calc(nutritionPer100g.dietaryFiber),
    sugar:          calc(nutritionPer100g.sugar),
    cholesterol:    calc(nutritionPer100g.cholesterol),
  };
}

/**
 * レシピ全体の栄養成分を合計する（全材料の合算）
 * @param ingredients - 材料明細リスト（各材料の栄養成分キャッシュ済み）
 * @returns 全体の栄養成分合計
 */
export function sumNutrition(
  ingredients: Pick<RecipeIngredientDetail, 'nutrition'>[]
): NutritionValues {
  const sum: NutritionValues = {
    energyKcal:     0,
    protein:        0,
    fat:            0,
    carbohydrate:   0,
    sodium:         0,
    saltEquivalent: 0,
    dietaryFiber:   0,
    sugar:          0,
    cholesterol:    0,
  };

  for (const ing of ingredients) {
    const n = ing.nutrition;
    sum.energyKcal     += n.energyKcal     ?? 0;
    sum.protein        += n.protein        ?? 0;
    sum.fat            += n.fat            ?? 0;
    sum.carbohydrate   += n.carbohydrate   ?? 0;
    sum.sodium         += n.sodium         ?? 0;
    sum.saltEquivalent += n.saltEquivalent ?? 0;
    sum.dietaryFiber   += n.dietaryFiber   ?? 0;
    sum.sugar          += n.sugar          ?? 0;
    sum.cholesterol    += n.cholesterol    ?? 0;
  }

  // 小数点2桁に丸める
  for (const key of Object.keys(sum) as (keyof NutritionValues)[]) {
    const v = sum[key];
    if (v !== null) {
      (sum[key] as number) = Math.round(v * 100) / 100;
    }
  }

  return sum;
}

/**
 * 全体栄養成分を1個あたりに換算する
 * @param total - 全体栄養成分
 * @param unitCount - 仕上げ数量
 * @returns 1個あたり栄養成分
 */
export function calcPerUnit(
  total: NutritionValues,
  unitCount: number
): NutritionValues {
  if (unitCount <= 0) return total;
  const result: NutritionValues = {} as NutritionValues;
  for (const key of Object.keys(total) as (keyof NutritionValues)[]) {
    const v = total[key];
    (result[key] as number | null) = v != null
      ? Math.round((v / unitCount) * 100) / 100
      : null;
  }
  return result;
}

/**
 * ナトリウム量（mg）から食塩相当量（g）を計算する
 * 食塩相当量 = ナトリウム(mg) × 2.54 / 1000
 */
export function sodiumToSaltEquivalent(sodiumMg: number): number {
  return Math.round(sodiumMg * 2.54 / 1000 * 100) / 100;
}

/**
 * 栄養成分表示用に値を丸める（食品表示基準）
 * - 熱量: 整数
 * - たんぱく質・脂質・炭水化物・食塩相当量: 小数第1位
 */
export function roundForDisplay(nutrition: NutritionValues): NutritionValues {
  return {
    energyKcal:     nutrition.energyKcal     != null ? Math.round(nutrition.energyKcal)             : null,
    protein:        nutrition.protein        != null ? Math.round(nutrition.protein        * 10) / 10 : null,
    fat:            nutrition.fat            != null ? Math.round(nutrition.fat            * 10) / 10 : null,
    carbohydrate:   nutrition.carbohydrate   != null ? Math.round(nutrition.carbohydrate  * 10) / 10 : null,
    sodium:         nutrition.sodium         != null ? Math.round(nutrition.sodium)                   : null,
    saltEquivalent: nutrition.saltEquivalent != null ? Math.round(nutrition.saltEquivalent * 10) / 10 : null,
    dietaryFiber:   nutrition.dietaryFiber   != null ? Math.round(nutrition.dietaryFiber  * 10) / 10 : null,
    sugar:          nutrition.sugar          != null ? Math.round(nutrition.sugar          * 10) / 10 : null,
    cholesterol:    nutrition.cholesterol    != null ? Math.round(nutrition.cholesterol)              : null,
  };
}

/**
 * 原価率を計算する
 * @param cost - 原価（円）
 * @param salePrice - 販売価格（円）
 * @returns 原価率（0.0〜1.0）
 */
export function calcCostRate(cost: number, salePrice: number): number {
  if (salePrice <= 0) return 0;
  return Math.round((cost / salePrice) * 1000) / 1000;
}

/**
 * 原価率から推奨販売価格を計算する
 * @param cost - 原価（円）
 * @param targetCostRate - 目標原価率（例: 0.3 = 30%）
 * @returns 推奨販売価格（円、10円単位に切り上げ）
 */
export function calcRecommendedSalePrice(
  cost: number,
  targetCostRate: number = 0.3
): number {
  if (targetCostRate <= 0) return 0;
  const raw = cost / targetCostRate;
  // 10円単位に切り上げ
  return Math.ceil(raw / 10) * 10;
}
