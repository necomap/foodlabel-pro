// ============================================================
// app/api/recipes/[id]/route.ts - レシピ詳細・更新・削除API
// ============================================================

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildIngredientsLabel, collectRecipeAllergens } from '@/lib/allergen';
import { calcPerUnit, roundForDisplay } from '@/lib/nutrition';
import type { BakingStep } from '@/types';

type Params = { params: { id: string } };

// ============================================================
// GET /api/recipes/[id] - レシピ詳細
// ============================================================
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const recipe = await prisma.recipe.findFirst({
    where:   { id: params.id, userId: session.user.id },
    include: {
      category:    { select: { id: true, name: true } },
      ingredients: {
        orderBy: { displayOrder: 'asc' },
        include: {
          ingredient: { select: { id: true, name: true, allergens: true, unitPrice: true } },
        },
      },
      steps: { orderBy: { stepNumber: 'asc' } },
    },
  });

  if (!recipe) {
    return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });
  }

  // 材料を重量順にソート（sortByWeight = true の場合）
  const sortedIngredients = [...recipe.ingredients].sort((a, b) => {
    if (a.sortByWeight && a.unit === 'g') return Number(b.amount) - Number(a.amount);
    return a.displayOrder - b.displayOrder;
  });

  // アレルゲン集約
  const allergenInfo = collectRecipeAllergens(
    sortedIngredients.map(ing => ({
      allergens:        ing.ingredient?.allergens ?? [],
      allergenOverride: ing.allergenOverride,
      ingredientName:   ing.ingredient?.name ?? ing.ingredientNameOverride ?? '',
    }))
  );

  // 原材料表示テキスト
  const ingredientsLabel = buildIngredientsLabel(
    sortedIngredients.map(ing => ({
      ingredientName: ing.ingredient?.name ?? ing.ingredientNameOverride ?? '',
      amount:         Number(ing.amount),
      unit:           ing.unit,
    })),
    allergenInfo.all
  );

  // 栄養成分
  const totalNutrition = {
    energyKcal:     recipe.energyKcal    ? Number(recipe.energyKcal)     : null,
    protein:        recipe.protein       ? Number(recipe.protein)        : null,
    fat:            recipe.fat           ? Number(recipe.fat)            : null,
    carbohydrate:   recipe.carbohydrate  ? Number(recipe.carbohydrate)   : null,
    sodium:         recipe.sodium        ? Number(recipe.sodium)         : null,
    saltEquivalent: recipe.saltEquivalent ? Number(recipe.saltEquivalent) : null,
    dietaryFiber:   recipe.dietaryFiber  ? Number(recipe.dietaryFiber)   : null,
    sugar:          recipe.sugar         ? Number(recipe.sugar)          : null,
    cholesterol:    recipe.cholesterol   ? Number(recipe.cholesterol)    : null,
  };

  return NextResponse.json({
    success: true,
    data: {
      id:             recipe.id,
      name:           recipe.name,
      nameKana:       recipe.nameKana,
      categoryId:     recipe.category?.id ?? null,
      categoryName:   recipe.category?.name ?? null,
      unitCount:      recipe.unitCount,
      wasteRatio:     Number(recipe.wasteRatio),
      salePrice:      recipe.salePrice ? Number(recipe.salePrice) : null,
      shelfLifeDays:  recipe.shelfLifeDays,
      shelfLifeType:  recipe.shelfLifeType,
      contentAmount:  recipe.contentAmount,
      storageMethod:  recipe.storageMethod,
      notes:          recipe.notes,
      printComment:   recipe.printComment,
      qualityControl: recipe.qualityControl,
      bakingConditions: recipe.bakingConditions as unknown as BakingStep[] | null,
      totalCost:      recipe.totalCost  ? Number(recipe.totalCost)  : null,
      unitCost:       recipe.unitCost   ? Number(recipe.unitCost)   : null,
      costRate:       recipe.costRate   ? Number(recipe.costRate)   : null,
      totalWeightG:   recipe.totalWeightG ? Number(recipe.totalWeightG) : null,
      nutrition:      totalNutrition,
      nutritionPerUnit: roundForDisplay(calcPerUnit(totalNutrition, recipe.unitCount)),
      ingredientsLabel,
      allergensLabel: allergenInfo.all.join('・'),
      allergens:      allergenInfo,
      isActive:       recipe.isActive,
      createdAt:      recipe.createdAt,
      updatedAt:      recipe.updatedAt,
      ingredients: sortedIngredients.map(ing => ({
        id:                     ing.id,
        ingredientId:           ing.ingredientId,
        ingredientName:         ing.ingredient?.name ?? ing.ingredientNameOverride ?? '',
        ingredientNameOverride: ing.ingredientNameOverride,
        amount:                 Number(ing.amount),
        unit:                   ing.unit,
        displayOrder:           ing.displayOrder,
        sortByWeight:           ing.sortByWeight,
        originCountry:          ing.originCountry,
        costPrice:              ing.costPrice  ? Number(ing.costPrice)  : null,
        costTotal:              ing.costTotal  ? Number(ing.costTotal)  : null,
        allergenOverride:       ing.allergenOverride,
        isPrimaryIngredient:    ing.isPrimaryIngredient,
        nutritionUnconfirmed:   ing.nutritionUnconfirmed,
        nutrition: {
          energyKcal:     ing.energyKcal    ? Number(ing.energyKcal)     : null,
          protein:        ing.protein       ? Number(ing.protein)        : null,
          fat:            ing.fat           ? Number(ing.fat)            : null,
          carbohydrate:   ing.carbohydrate  ? Number(ing.carbohydrate)   : null,
          sodium:         ing.sodium        ? Number(ing.sodium)         : null,
          saltEquivalent: ing.saltEquivalent ? Number(ing.saltEquivalent) : null,
          dietaryFiber:   ing.dietaryFiber  ? Number(ing.dietaryFiber)   : null,
          sugar:          ing.sugar         ? Number(ing.sugar)          : null,
          cholesterol:    ing.cholesterol   ? Number(ing.cholesterol)    : null,
        },
      })),
      steps: recipe.steps.map(s => s.instruction),
    },
  });
}

// ============================================================
// PUT /api/recipes/[id] - レシピ更新
// ============================================================
export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const existing = await prisma.recipe.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });

  const body = await request.json();

  try {
    // 既存の材料・手順を削除
    await prisma.$transaction([
      prisma.recipeIngredient.deleteMany({ where: { recipeId: params.id } }),
      prisma.recipeStep.deleteMany({ where: { recipeId: params.id } }),
    ]);

    // 材料の栄養計算
    const { calcNutritionForAmount, sumNutrition, calcPerUnit, calcCostRate } = await import('@/lib/nutrition');
    const { buildIngredientsLabel: bil, collectRecipeAllergens: car } = await import('@/lib/allergen');

    const ingredients = body.ingredients ?? [];
    const ingredientDetails = await Promise.all(
      ingredients.map(async (ing: any) => {
        let nutritionPer100g: any = {};
        let allergens: string[] = ing.allergenOverride ?? [];
        let nutritionUnconfirmed = false;

        if (ing.ingredientId) {
          const rec = await prisma.ingredient.findUnique({
            where: { id: ing.ingredientId },
            include: { nutritionData: true },
          });
          if (rec) {
            allergens = ing.allergenOverride?.length ? ing.allergenOverride : rec.allergens;
            if (rec.nutritionData || rec.energyKcalManual != null) {
              nutritionPer100g = {
                energyKcal:     rec.energyKcalManual != null ? Number(rec.energyKcalManual) : (rec.nutritionData?.energyKcal != null ? Number(rec.nutritionData.energyKcal) : null),
                protein:        rec.proteinManual != null ? Number(rec.proteinManual) : (rec.nutritionData?.protein != null ? Number(rec.nutritionData.protein) : null),
                fat:            rec.fatManual != null ? Number(rec.fatManual) : (rec.nutritionData?.fat != null ? Number(rec.nutritionData.fat) : null),
                carbohydrate:   rec.carbohydrateManual != null ? Number(rec.carbohydrateManual) : (rec.nutritionData?.carbohydrate != null ? Number(rec.nutritionData.carbohydrate) : null),
                sodium:         rec.sodiumManual != null ? Number(rec.sodiumManual) : (rec.nutritionData?.sodium != null ? Number(rec.nutritionData.sodium) : null),
                saltEquivalent: rec.saltEquivalentManual != null ? Number(rec.saltEquivalentManual) : (rec.nutritionData?.saltEquivalent != null ? Number(rec.nutritionData.saltEquivalent) : null),
                dietaryFiber:   rec.dietaryFiberManual != null ? Number(rec.dietaryFiberManual) : (rec.nutritionData?.dietaryFiber != null ? Number(rec.nutritionData.dietaryFiber) : null),
                sugar:          rec.sugarManual != null ? Number(rec.sugarManual) : (rec.nutritionData?.sugar != null ? Number(rec.nutritionData.sugar) : null),
                cholesterol:    rec.cholesterolManual != null ? Number(rec.cholesterolManual) : (rec.nutritionData?.cholesterol != null ? Number(rec.nutritionData.cholesterol) : null),
              };
            } else { nutritionUnconfirmed = true; }
          }
        }
        const amount = Number(ing.amount);
        const nutrition = calcNutritionForAmount(nutritionPer100g, amount);
        const costTotal = ing.costPrice && amount ? Number(ing.costPrice) * amount : null;
        return { ing, allergens, nutrition, nutritionUnconfirmed, costTotal };
      })
    );

    const allergenInfo = car(ingredientDetails.map(d => ({
      allergens: d.allergens, allergenOverride: d.ing.allergenOverride ?? [],
      ingredientName: d.ing.name ?? '',
    })));
    const totalNutrition = sumNutrition(ingredientDetails.map(d => ({ nutrition: d.nutrition })));
    const totalCost = ingredientDetails.reduce((s, d) => s + (d.costTotal ?? 0), 0);
    const totalWeightG = ingredients.reduce((s: number, ing: any) => s + (ing.unit === 'g' || ing.unit === 'ml' ? Number(ing.amount) : 0), 0);
    const unitCount = body.unitCount ?? 1;
    const ingredientsLabel = bil(
      ingredientDetails.map(d => ({ ingredientName: d.ing.name, amount: Number(d.ing.amount), unit: d.ing.unit })).sort((a,b) => b.amount - a.amount),
      allergenInfo.all
    );

    // レシピ更新
    await prisma.recipe.update({
      where: { id: params.id },
      data: {
        categoryId:      body.categoryId || null,
        name:            body.name,
        nameKana:        body.nameKana,
        unitCount:       unitCount,
        salePrice:       body.salePrice ? Number(body.salePrice) : null,
        shelfLifeDays:   body.shelfLifeDays ? Number(body.shelfLifeDays) : null,
        shelfLifeType:   body.shelfLifeType ?? 'USE_BY',
        contentAmount:   body.contentAmount,
        storageMethod:   body.storageMethod,
        notes:           body.notes,
        printComment:    body.printComment,
        qualityControl:  body.qualityControl,
        bakingConditions: body.bakingConditions ? JSON.stringify(body.bakingConditions) : undefined,
        totalCost:       totalCost || null,
        unitCost:        totalCost ? totalCost / unitCount : null,
        costRate:        calcCostRate(totalCost / unitCount, body.salePrice ? Number(body.salePrice) : null),
        totalWeightG:    totalWeightG || null,
        energyKcal:      totalNutrition.energyKcal,
        protein:         totalNutrition.protein,
        fat:             totalNutrition.fat,
        carbohydrate:    totalNutrition.carbohydrate,
        sodium:          totalNutrition.sodium,
        saltEquivalent:  totalNutrition.saltEquivalent,
        dietaryFiber:    totalNutrition.dietaryFiber,
        sugar:           totalNutrition.sugar,
        cholesterol:     totalNutrition.cholesterol,
        updatedAt:       new Date(),
      },
    });

    // 材料・手順を再作成
    if (ingredientDetails.length > 0) {
      await prisma.recipeIngredient.createMany({
        data: ingredientDetails.map((d, idx) => ({
          recipeId:              params.id,
          ingredientId:          d.ing.ingredientId || null,
          ingredientNameOverride: d.ing.name,
          amount:                Number(d.ing.amount),
          unit:                  d.ing.unit ?? 'g',
          displayOrder:          idx,
          sortByWeight:          true,
          costPrice:             d.ing.costPrice ? Number(d.ing.costPrice) : null,
          costTotal:             d.costTotal,
          allergenOverride:      d.allergens,
          nutritionUnconfirmed:  d.nutritionUnconfirmed,
          energyKcal:            d.nutrition.energyKcal,
          protein:               d.nutrition.protein,
          fat:                   d.nutrition.fat,
          carbohydrate:          d.nutrition.carbohydrate,
          sodium:                d.nutrition.sodium,
          saltEquivalent:        d.nutrition.saltEquivalent,
          dietaryFiber:          d.nutrition.dietaryFiber,
          sugar:                 d.nutrition.sugar,
          cholesterol:           d.nutrition.cholesterol,
        })),
      });
    }

    const steps = body.steps ?? [];
    if (steps.length > 0) {
      await prisma.recipeStep.createMany({
        data: steps.map((s: string, idx: number) => ({
          recipeId: params.id, stepNumber: idx + 1, instruction: s,
        })),
      });
    }

    return NextResponse.json({ success: true, message: 'レシピを更新しました' });
  } catch (err) {
    console.error('recipe update error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/recipes/[id] - レシピ削除（論理削除）
// ============================================================
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const existing = await prisma.recipe.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });

  await prisma.recipe.update({
    where: { id: params.id },
    data:  { isActive: false },
  });

  return NextResponse.json({ success: true, message: 'レシピを削除しました' });
}
