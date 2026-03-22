// ============================================================
// app/api/recipes/route.ts - レシピ一覧取得・新規作成API
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calcNutritionForAmount, sumNutrition, calcPerUnit, calcCostRate } from '@/lib/nutrition';
import { getPlanLimits } from '@/lib/plan-limits';
import { detectAllergens } from '@/lib/allergen';
import type { NutritionValues } from '@/types';

// ============================================================
// GET /api/recipes - レシピ一覧
// ============================================================
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page       = parseInt(searchParams.get('page')     ?? '1');
  const perPage    = parseInt(searchParams.get('perPage')  ?? '20');
  const search     = searchParams.get('search')  ?? '';
  const categoryId = searchParams.get('category') ?? '';
  const activeOnly = searchParams.get('active') !== 'false';

  const hiddenOnly = searchParams.get('hiddenOnly') === 'true';
  const where = {
    userId:   session.user.id,
    isActive: hiddenOnly ? false : (activeOnly ? true : undefined),
    ...(search     && { name: { contains: search, mode: 'insensitive' as const } }),
    ...(categoryId && { categoryId }),
  };

  const [total, recipes] = await Promise.all([
    prisma.recipe.count({ where }),
    prisma.recipe.findMany({
      where,
      skip:    (page - 1) * perPage,
      take:    perPage,
      orderBy: { updatedAt: 'desc' },
      include: {
        category:    { select: { name: true } },
        ingredients: { select: { allergenOverride: true, ingredientNameOverride: true, ingredient: { select: { allergens: true, name: true } }, nutritionUnconfirmed: true } },
      },
    }),
  ]);

  const items = recipes.map(r => {
    // アレルゲン集約
    const allergens = new Set<string>();
    for (const ing of r.ingredients) {
      const src = ing.allergenOverride?.length
        ? ing.allergenOverride
        : ing.ingredient?.allergens ?? detectAllergens(ing.ingredient?.name ?? ing.ingredientNameOverride ?? '');
      src.forEach(a => allergens.add(a));
    }

    return {
      id:             r.id,
      name:           r.name,
      nameKana:       r.nameKana,
      categoryName:   r.category?.name ?? null,
      unitCount:      r.unitCount,
      shelfLifeDays:  r.shelfLifeDays,
      shelfLifeType:  r.shelfLifeType,
      salePrice:      r.salePrice ? Number(r.salePrice) : null,
      unitCost:       r.unitCost  ? Number(r.unitCost)  : null,
      costRate:       r.costRate  ? Number(r.costRate)  : null,
      energyKcal:     r.energyKcal     ? Number(r.energyKcal)     : null,
      totalWeightG:   r.totalWeightG   ? Number(r.totalWeightG)   : null,
      saltEquivalent: r.saltEquivalent ? Number(r.saltEquivalent) : null,
      allergens:      Array.from(allergens),
      hasUnconfirmedNutrition: r.ingredients.some(i => i.nutritionUnconfirmed),
      isActive:       r.isActive,
      createdAt:      r.createdAt,
      updatedAt:      r.updatedAt,
    };
  });

  return NextResponse.json({
    success: true,
    data:    { items, total, page, perPage, hasMore: page * perPage < total },
  });
}

// ============================================================
// POST /api/recipes - レシピ新規作成
// ============================================================
const ingredientSchema = z.object({
  ingredientId:           z.string().optional(),
  ingredientNameOverride: z.string().optional(),
  amount:                 z.number().positive(),
  unit:                   z.string().default('g'),
  displayOrder:           z.number().default(0),
  sortByWeight:           z.boolean().default(true),
  originCountry:          z.string().optional(),
  costPrice:              z.number().optional(),
  allergenOverride:       z.array(z.string()).optional(),
});

const recipeSchema = z.object({
  name:             z.string().min(1, '品名を入力してください').max(200),
  nameKana:         z.string().max(200).optional(),
  categoryId:       z.string().optional(),
  unitCount:        z.number().int().positive().default(1),
  wasteRatio:       z.number().min(0).max(100).default(0),
  salePrice:        z.number().optional(),
  shelfLifeDays:    z.number().int().min(0).optional(),
  shelfLifeType:    z.enum(['BEST_BEFORE', 'USE_BY']).default('BEST_BEFORE'),
  contentAmount:    z.string().max(50).optional(),
  storageMethod:    z.string().optional(),
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

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  // プラン制限チェック
  const limits = getPlanLimits(session.user.plan ?? 'free');
  if (limits.maxRecipes !== Infinity) {
    const recipeCount = await prisma.recipe.count({ where: { userId: session.user.id, isActive: true } });
    if (recipeCount >= limits.maxRecipes) {
      return NextResponse.json({
        success: false,
        error: `フリープランのレシピ上限（${limits.maxRecipes}件）に達しました。プレミアムプランにアップグレードしてください。`,
        upgradeRequired: true,
      }, { status: 403 });
    }
  }

  try {
    const body   = await request.json();
    const result = recipeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.errors[0].message },
        { status: 400 }
      );
    }
    const data = result.data;

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
            // 栄養成分（手動入力 or 成分表から）
            if (ingRecord.nutritionData) {
              nutritionPer100g = {
                energyKcal:     ingRecord.energyKcalManual    != null ? Number(ingRecord.energyKcalManual)    : (ingRecord.nutritionData.energyKcal     != null ? Number(ingRecord.nutritionData.energyKcal)     : null),
                protein:        ingRecord.proteinManual       != null ? Number(ingRecord.proteinManual)       : (ingRecord.nutritionData.protein         != null ? Number(ingRecord.nutritionData.protein)        : null),
                fat:            ingRecord.fatManual           != null ? Number(ingRecord.fatManual)           : (ingRecord.nutritionData.fat             != null ? Number(ingRecord.nutritionData.fat)            : null),
                carbohydrate:   ingRecord.carbohydrateManual  != null ? Number(ingRecord.carbohydrateManual)  : (ingRecord.nutritionData.carbohydrate     != null ? Number(ingRecord.nutritionData.carbohydrate)   : null),
                sodium:         ingRecord.sodiumManual        != null ? Number(ingRecord.sodiumManual)        : (ingRecord.nutritionData.sodium          != null ? Number(ingRecord.nutritionData.sodium)         : null),
                saltEquivalent: ingRecord.saltEquivalentManual != null ? Number(ingRecord.saltEquivalentManual) : (ingRecord.nutritionData.saltEquivalent  != null ? Number(ingRecord.nutritionData.saltEquivalent) : null),
                dietaryFiber:   ingRecord.dietaryFiberManual  != null ? Number(ingRecord.dietaryFiberManual)  : (ingRecord.nutritionData.dietaryFiber    != null ? Number(ingRecord.nutritionData.dietaryFiber)   : null),
                sugar:          ingRecord.sugarManual         != null ? Number(ingRecord.sugarManual)         : (ingRecord.nutritionData.sugar           != null ? Number(ingRecord.nutritionData.sugar)          : null),
                cholesterol:    ingRecord.cholesterolManual   != null ? Number(ingRecord.cholesterolManual)   : (ingRecord.nutritionData.cholesterol      != null ? Number(ingRecord.nutritionData.cholesterol)    : null),
              };
            } else {
              // 手動入力のみ
              nutritionPer100g = {
                energyKcal:     ingRecord.energyKcalManual    != null ? Number(ingRecord.energyKcalManual)    : null,
                protein:        ingRecord.proteinManual       != null ? Number(ingRecord.proteinManual)       : null,
                fat:            ingRecord.fatManual           != null ? Number(ingRecord.fatManual)           : null,
                carbohydrate:   ingRecord.carbohydrateManual  != null ? Number(ingRecord.carbohydrateManual)  : null,
                sodium:         ingRecord.sodiumManual        != null ? Number(ingRecord.sodiumManual)        : null,
                saltEquivalent: ingRecord.saltEquivalentManual != null ? Number(ingRecord.saltEquivalentManual) : null,
                dietaryFiber:   ingRecord.dietaryFiberManual  != null ? Number(ingRecord.dietaryFiberManual)  : null,
                sugar:          ingRecord.sugarManual         != null ? Number(ingRecord.sugarManual)         : null,
                cholesterol:    ingRecord.cholesterolManual   != null ? Number(ingRecord.cholesterolManual)   : null,
              };
              nutritionUnconfirmed = Object.values(nutritionPer100g).every(v => v == null);
            }
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

        // gまたはml単位の場合に栄養成分を計算
        const amountG = ['g', 'ml'].includes(ing.unit) ? ing.amount : 0;
        const nutrition = amountG > 0
          ? calcNutritionForAmount(nutritionPer100g, amountG)
          : { energyKcal: null, protein: null, fat: null, carbohydrate: null, sodium: null, saltEquivalent: null, dietaryFiber: null, sugar: null, cholesterol: null };

        const costTotal = unitPrice && amountG ? unitPrice * amountG : null;

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
    const gIngredients = ingredientDetails.filter(i => i.unit === 'g' || i.unit === 'ml');
    if (gIngredients.length > 0) {
      const maxIdx = ingredientDetails.indexOf(
        gIngredients.reduce((a, b) => b.amount > a.amount ? b : a)
      );
      ingredientDetails[maxIdx].isPrimary = true;
    }

    // レシピ全体の栄養成分合計
    const totalNutrition = sumNutrition(ingredientDetails.map(i => ({ nutrition: i.nutrition })));
    const perUnitNutrition = calcPerUnit(totalNutrition, data.unitCount);

    // 合計原価
    const totalCost   = ingredientDetails.reduce((s, i) => s + (i.costTotal ?? 0), 0);
    const unitCost    = data.unitCount > 0 ? totalCost / data.unitCount : totalCost;
    const costRate    = data.salePrice ? calcCostRate(unitCost, data.salePrice) : null;
    const totalWeightG = ingredientDetails
      .filter(i => i.unit === 'g' || i.unit === 'ml')
      .reduce((s, i) => s + i.amount, 0);

    // DB保存
    const recipe = await prisma.recipe.create({
      data: {
        userId:         session.user.id,
        categoryId:     data.categoryId,
        name:           data.name,
        nameKana:       data.nameKana,
        unitCount:      data.unitCount,
        wasteRatio:     data.wasteRatio,
        salePrice:      data.salePrice,
        shelfLifeDays:  data.shelfLifeDays,
        shelfLifeType:  data.shelfLifeType,
        contentAmount:  data.contentAmount,
        storageMethod:  data.storageMethod,
        notes:          data.notes,
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

    return NextResponse.json({ success: true, data: { id: recipe.id, perUnitNutrition } });

  } catch (err) {
    console.error('Recipe create error:', err);
    return NextResponse.json({ success: false, error: 'レシピ保存中にエラーが発生しました' }, { status: 500 });
  }
}
