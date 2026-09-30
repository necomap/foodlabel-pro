// ============================================================
// lib/recipe-create.ts - レシピ新規作成の共通処理
// ============================================================
// 2026-09-30: app/api/recipes/route.ts（POST）の計算・保存処理をそのまま切り出したもの。
// サンプルレシピ取り込み（lib/sample-import.ts）からも同じ計算で登録するために共通化した。
// 呼び出し側で、プラン上限・食材の利用可否（lib/ingredient-access.ts）のチェックを済ませてから呼ぶこと。

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { calcNutritionForAmount, sumNutrition, calcPerUnit, calcCostRate, toGrams, resolveIngredientNutritionPer100g } from '@/lib/nutrition';
import { detectAllergens } from '@/lib/allergen';
import type { NutritionValues } from '@/types';

export const ingredientSchema = z.object({
  ingredientId:           z.string().optional(),
  ingredientNameOverride: z.string().optional(),
  amount:                 z.number().positive(),
  unit:                   z.string().default('g'),
  displayOrder:           z.number().default(0),
  sortByWeight:           z.boolean().default(true),
  originCountry:          z.string().optional(),
  isAdditive:             z.boolean().default(false),
  additiveReason:         z.string().optional(),
  hideFromLabel:          z.boolean().default(false),
  processLabel:           z.string().max(50).optional(),
  costPrice:              z.number().optional(),
  allergenOverride:       z.array(z.string()).optional(),
});

export const recipeSchema = z.object({
  name:             z.string().min(1, '品名を入力してください').max(200),
  nameKana:         z.string().max(200).optional(),
  variationName:    z.string().max(100).optional(),
  categoryId:       z.string().optional(),
  unitCount:        z.number().int().positive().default(1),
  moldType:         z.string().max(50).optional(),
  wasteAmountG:     z.number().min(0).optional(),
  wasteRatio:       z.number().min(0).max(100).default(0),
  salePrice:        z.number().optional(),
  shelfLifeDays:    z.number().int().min(0).optional(),
  shelfLifeType:    z.enum(['BEST_BEFORE', 'USE_BY']).default('BEST_BEFORE'),
  contentAmount:    z.string().max(50).optional(),
  storageMethod:    z.string().optional(),
  barcode:           z.string().optional(),
  notes:            z.string().optional(),
  printComment:     z.string().optional(),
  qualityControl:   z.string().optional(),
  bakingConditions: z.array(z.object({
    steam:      z.enum(['ON', 'OFF']).nullable().optional(),
    topHeat:    z.number().nullable().optional(),
    bottomHeat: z.number().nullable().optional(),
    timeMin:    z.number().nullable().optional(),
    label:      z.string().optional(),
  })).optional(),
  ingredients: z.array(ingredientSchema).min(1, '材料を1つ以上入力してください'),
  steps:       z.array(z.string()).optional(),
});

export type RecipeCreateInput = z.infer<typeof recipeSchema>;

export async function createRecipeRecord(userId: string, data: RecipeCreateInput) {
    // 各材料の栄養成分を計算
    const ingredientDetails = await Promise.all(
      data.ingredients.map(async (ing) => {
        let nutritionPer100g: Partial<NutritionValues> = {};
        let ingredientAllergens: string[] = ing.allergenOverride ?? [];
        let unitPrice = ing.costPrice ?? null;
        let nutritionUnconfirmed = false;
        let isPrimary = false;

        if (ing.ingredientId) {
          const ingRecord = await prisma.ingredient.findUnique({
            where: { id: ing.ingredientId },
            include: { nutritionData: true },
          });
          if (ingRecord) {
            // 栄養成分（手動入力 or 成分表から）。判定ロジックはレシピ詳細・ラベル生成と共通化
            // （以前は独自実装で、手入力が熱量以外だけのケース等で「未確認」判定が食い違っていた）
            const resolved = resolveIngredientNutritionPer100g(ingRecord as any);
            nutritionPer100g = resolved.per100g;
            nutritionUnconfirmed = resolved.unconfirmed;
            if (!ing.allergenOverride?.length) {
              ingredientAllergens = ingRecord.allergens;
            }
            if (!unitPrice && ingRecord.unitPrice) {
              unitPrice = Number(ingRecord.unitPrice);
            }
          }
        } else {
          // 手入力食材：成分未確認
          nutritionUnconfirmed = true;
          if (!ing.allergenOverride?.length) {
            ingredientAllergens = detectAllergens(ing.ingredientNameOverride ?? '');
          }
        }

        // 重量に換算できる単位（g・kg・ml・cc・L）の場合のみ栄養成分を計算（lib/nutrition.ts toGrams）
        const amountG = toGrams(ing.amount, ing.unit) ?? 0;
        const nutrition = amountG > 0
          ? calcNutritionForAmount(nutritionPer100g, amountG)
          : { energyKcal: null, protein: null, fat: null, carbohydrate: null, sodium: null, saltEquivalent: null, dietaryFiber: null, sugar: null, cholesterol: null };

        // 原価＝単価×数量（編集画面・更新APIと同じ。以前はg/ml以外の単位だと原価0になっていた）
        const costTotal = unitPrice && ing.amount ? Math.round(unitPrice * ing.amount * 100) / 100 : null;

        return {
          ...ing,
          allergenOverride: ingredientAllergens,
          nutrition,
          nutritionUnconfirmed,
          isPrimary,
          costTotal,
        };
      })
    );

    // 最も重量が多い食材に isPrimary フラグ
    const gIngredients = ingredientDetails.filter(i => toGrams(i.amount, i.unit) != null);
    if (gIngredients.length > 0) {
      const maxIdx = ingredientDetails.indexOf(
        gIngredients.reduce((a, b) => (toGrams(b.amount, b.unit) ?? 0) > (toGrams(a.amount, a.unit) ?? 0) ? b : a)
      );
      ingredientDetails[maxIdx].isPrimary = true;
    }

    // レシピ全体の栄養成分合計
    const totalNutrition = sumNutrition(ingredientDetails.map(i => ({ nutrition: i.nutrition })));

    // 合計原価
    const totalCost   = ingredientDetails.reduce((s, i) => s + (i.costTotal ?? 0), 0);
    const unitCost    = data.unitCount > 0 ? totalCost / data.unitCount : totalCost;
    const costRate    = data.salePrice ? calcCostRate(unitCost, data.salePrice) : null;
    const totalWeightG = ingredientDetails
      .reduce((s, i) => s + (toGrams(i.amount, i.unit) ?? 0), 0);
    const wasteAmountG = data.wasteAmountG ?? 0;
    const wasteRatio = (totalWeightG > 0 && wasteAmountG > 0)
      ? Math.round((wasteAmountG / totalWeightG) * 100 * 100) / 100
      : 0;
    const perUnitNutrition = calcPerUnit(totalNutrition, data.unitCount, wasteRatio);

    // DB保存
    const recipe = await prisma.recipe.create({
      data: {
        userId:         userId,
        categoryId:     data.categoryId,
        name:           data.name,
        nameKana:       data.nameKana,
        variationName:  data.variationName ?? null,
        unitCount:      data.unitCount,
        moldType:       data.moldType ?? null,
        wasteAmountG:   wasteAmountG || null,
        wasteRatio:     wasteRatio,
        salePrice:      data.salePrice,
        shelfLifeDays:  data.shelfLifeDays,
        shelfLifeType:  data.shelfLifeType,
        contentAmount:  data.contentAmount,
        storageMethod:  data.storageMethod,
        notes:          data.notes,
          barcode:            data.barcode ?? null,
        printComment:   data.printComment,
        qualityControl: data.qualityControl,
        bakingConditions: data.bakingConditions ? JSON.stringify(data.bakingConditions) : undefined,
        // キャッシュ
        totalCost:      totalCost || null,
        unitCost:       unitCost  || null,
        costRate,
        totalWeightG:   totalWeightG || null,
        energyKcal:     totalNutrition.energyKcal,
        protein:        totalNutrition.protein,
        fat:            totalNutrition.fat,
        carbohydrate:   totalNutrition.carbohydrate,
        sodium:         totalNutrition.sodium,
        saltEquivalent: totalNutrition.saltEquivalent,
        dietaryFiber:   totalNutrition.dietaryFiber,
        sugar:          totalNutrition.sugar,
        cholesterol:    totalNutrition.cholesterol,
        // リレーション
        ingredients: {
          create: ingredientDetails.map((ing, idx) => ({
            ingredientId:           ing.ingredientId,
            ingredientNameOverride: ing.ingredientNameOverride,
            amount:                 ing.amount,
            unit:                   ing.unit,
            displayOrder:           ing.displayOrder ?? idx,
            sortByWeight:           ing.sortByWeight,
            originCountry:          ing.originCountry,
          isAdditive:             ing.isAdditive ?? false,
          additiveReason:         ing.additiveReason,
            hideFromLabel:          ing.hideFromLabel ?? false,
            processLabel:           ing.processLabel || null,
            costPrice:              ing.costPrice,
            costTotal:              ing.costTotal,
            allergenOverride:       ing.allergenOverride,
            isPrimaryIngredient:    ing.isPrimary,
            nutritionUnconfirmed:   ing.nutritionUnconfirmed,
            energyKcal:             ing.nutrition.energyKcal,
            protein:                ing.nutrition.protein,
            fat:                    ing.nutrition.fat,
            carbohydrate:           ing.nutrition.carbohydrate,
            sodium:                 ing.nutrition.sodium,
            saltEquivalent:         ing.nutrition.saltEquivalent,
            dietaryFiber:           ing.nutrition.dietaryFiber,
            sugar:                  ing.nutrition.sugar,
            cholesterol:            ing.nutrition.cholesterol,
          })),
        },
        steps: {
          create: (data.steps ?? [])
            .filter(s => s.trim())
            .map((instruction, idx) => ({
              stepNumber:  idx + 1,
              instruction,
            })),
        },
      },
    });


  return { recipe, perUnitNutrition };
}
