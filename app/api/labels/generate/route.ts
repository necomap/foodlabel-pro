// ============================================================
// app/api/labels/generate/route.ts - シール生成API
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateLabelContent, generateLabelHtml, getDefaultDisplaySettings } from '@/lib/label';
import { buildIngredientsLabel, collectRecipeAllergens } from '@/lib/allergen';
import { calcPerUnit, roundForDisplay } from '@/lib/nutrition';
import type { RecipeDetail, LabelConfig, BakingStep } from '@/types';

const labelConfigSchema = z.object({
  recipeId:        z.string(),
  shopId:          z.string().optional(),
  manufactureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shelfLifeDays:   z.number().int().min(0).optional(),
  printCount:      z.number().int().positive().default(1),
  fontSizePt:      z.number().min(6).max(12).default(8),
  deviceType:      z.enum(['LABEL_PRINTER', 'A4_PRINTER', 'OTHER']).default('LABEL_PRINTER'),
  labelWidthMm:    z.number().positive().optional(),
  labelHeightMm:   z.number().positive().optional(),
  isPrecut:        z.boolean().optional(),
  cutMarginMm:     z.number().optional(),
  a4Cols:          z.number().int().positive().optional(),
  a4Rows:          z.number().int().positive().optional(),
  marginTopMm:     z.number().optional(),
  marginBottomMm:  z.number().optional(),
  marginLeftMm:    z.number().optional(),
  marginRightMm:   z.number().optional(),
  startPosition:   z.number().int().positive().optional(),
  displaySettings: z.object({
    showPhone:          z.boolean().default(true),
    showRepresentative: z.boolean().default(false),
    showEmail:          z.boolean().default(false),
    showNutrition:      z.boolean().default(true),
    showDietaryFiber:   z.boolean().default(true),
    showSugar:          z.boolean().default(true),
    showCholesterol:    z.boolean().default(false),
    showQualityControl: z.boolean().default(true),
    showComment:        z.boolean().default(true),
    nutritionNote:      z.string().default('※推定値'),
  }).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const body   = await request.json();
  const result = labelConfigSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.errors[0].message },
      { status: 400 }
    );
  }
  const config = result.data;

  // レシピ取得
  const recipe = await prisma.recipe.findFirst({
    where:   { id: config.recipeId, userId: session.user.id },
    include: {
      category:    { select: { name: true } },
      ingredients: {
        orderBy: [{ sortByWeight: 'desc' }, { displayOrder: 'asc' }],
        include: { ingredient: { select: { name: true, allergens: true } } },
      },
      steps: { orderBy: { stepNumber: 'asc' } },
    },
  });

  if (!recipe) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });

  // 未確認成分の警告収集
  const warnings = recipe.ingredients
    .filter(i => i.nutritionUnconfirmed)
    .map(i => `「${i.ingredient?.name ?? i.ingredientNameOverride ?? '不明'}」の成分情報が未確認です`);

  // 店舗情報取得
  const shopId = config.shopId;
  let shopInfo = {
    shopName:       '',
    companyName:    '',
    postalCode:     '',
    address:        '',
    phone:          '',
    representative: '',
    email:          '',
    showPhone:          true,
    showRepresentative: false,
    showEmail:          false,
  };

  if (shopId) {
    const shop = await prisma.shop.findFirst({
      where: { id: shopId, userId: session.user.id },
    });
    if (shop) {
      shopInfo = {
        shopName:           shop.shopName,
        companyName:        shop.companyName ?? shop.shopName,
        postalCode:         shop.postalCode ?? '',
        address:            shop.address ?? '',
        phone:              shop.phone ?? '',
        representative:     '',
        email:              shop.email ?? '',
        showPhone:          shop.showPhone,
        showRepresentative: shop.showRepresentative,
        showEmail:          shop.showEmail,
      };
    }
  } else {
    // デフォルト店舗
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user) {
      shopInfo = {
        shopName:           user.companyName,
        companyName:        user.companyName,
        postalCode:         user.postalCode ?? '',
        address:            user.address ?? '',
        phone:              user.phone ?? '',
        representative:     user.representative ?? '',
        email:              user.email,
        showPhone:          true,
        showRepresentative: false,
        showEmail:          false,
      };
    }
  }

  // RecipeDetail 形式に変換
  const sortedIngredients = [...recipe.ingredients].sort((a, b) => {
    if (a.sortByWeight && a.unit === 'g') return Number(b.amount) - Number(a.amount);
    return a.displayOrder - b.displayOrder;
  });

  const allergenInfo = collectRecipeAllergens(
    sortedIngredients.map(ing => ({
      allergens:        ing.ingredient?.allergens ?? [],
      allergenOverride: ing.allergenOverride,
      ingredientName:   ing.ingredient?.name ?? ing.ingredientNameOverride ?? '',
    }))
  );

  const totalNutrition = {
    energyKcal:     recipe.energyKcal     ? Number(recipe.energyKcal)     : null,
    protein:        recipe.protein        ? Number(recipe.protein)        : null,
    fat:            recipe.fat            ? Number(recipe.fat)            : null,
    carbohydrate:   recipe.carbohydrate   ? Number(recipe.carbohydrate)   : null,
    sodium:         recipe.sodium         ? Number(recipe.sodium)         : null,
    saltEquivalent: recipe.saltEquivalent  ? Number(recipe.saltEquivalent) : null,
    dietaryFiber:   recipe.dietaryFiber   ? Number(recipe.dietaryFiber)   : null,
    sugar:          recipe.sugar          ? Number(recipe.sugar)          : null,
    cholesterol:    recipe.cholesterol    ? Number(recipe.cholesterol)    : null,
  };

  const recipeDetail: RecipeDetail = {
    id:             recipe.id,
    name:           recipe.name,
    nameKana:       recipe.nameKana,
    categoryName:   recipe.category?.name ?? null,
    unitCount:      recipe.unitCount,
    shelfLifeDays:  recipe.shelfLifeDays,
    shelfLifeType:  recipe.shelfLifeType as 'BEST_BEFORE' | 'USE_BY',
    salePrice:      recipe.salePrice  ? Number(recipe.salePrice)  : null,
    unitCost:       recipe.unitCost   ? Number(recipe.unitCost)   : null,
    costRate:       recipe.costRate   ? Number(recipe.costRate)   : null,
    contentAmount:  recipe.contentAmount,
    storageMethod:  recipe.storageMethod,
    notes:          recipe.notes,
    printComment:   recipe.printComment,
    qualityControl: recipe.qualityControl,
    bakingConditions: recipe.bakingConditions as BakingStep[] | null,
    totalCost:      recipe.totalCost  ? Number(recipe.totalCost)  : null,
    totalWeightG:   recipe.totalWeightG ? Number(recipe.totalWeightG) : null,
    nutrition:      totalNutrition,
    nutritionPerUnit: roundForDisplay(calcPerUnit(totalNutrition, recipe.unitCount)),
    ingredientsLabel: buildIngredientsLabel(
      sortedIngredients.map(i => ({
        ingredientName: i.ingredient?.name ?? i.ingredientNameOverride ?? '',
        amount: Number(i.amount),
        unit: i.unit,
      })),
      allergenInfo.all
    ),
    allergensLabel: allergenInfo.all.join('・'),
    allergens:      allergenInfo as unknown as string[],
    hasUnconfirmedNutrition: recipe.ingredients.some(i => i.nutritionUnconfirmed),
    isActive:       recipe.isActive,
    createdAt:      recipe.createdAt,
    updatedAt:      recipe.updatedAt,
    ingredients: sortedIngredients.map(ing => ({
      id:                     ing.id,
      ingredientId:           ing.ingredientId ?? undefined,
      ingredientName:         ing.ingredient?.name ?? ing.ingredientNameOverride ?? '',
      ingredientNameOverride: ing.ingredientNameOverride ?? undefined,
      amount:                 Number(ing.amount),
      unit:                   ing.unit,
      displayOrder:           ing.displayOrder,
      sortByWeight:           ing.sortByWeight,
      originCountry:          ing.originCountry ?? undefined,
      costPrice:              ing.costPrice   ? Number(ing.costPrice)  : null,
      costTotal:              ing.costTotal   ? Number(ing.costTotal)  : null,
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
  };

  const labelConfig: LabelConfig = {
    ...config,
    displaySettings: config.displaySettings ?? getDefaultDisplaySettings(),
  };

  const content = generateLabelContent(recipeDetail, labelConfig, shopInfo);
  const html    = generateLabelHtml(content, labelConfig);

  // 印刷履歴を保存
  await prisma.label.create({
    data: {
      recipeId:       config.recipeId,
      shopId:         config.shopId,
      userId:         session.user.id,
      manufactureDate: new Date(config.manufactureDate),
      printCount:     config.printCount,
      fontSizePt:     config.fontSizePt,
      deviceType:     config.deviceType,
      labelWidthMm:   config.labelWidthMm,
      labelHeightMm:  config.labelHeightMm,
      isPrecut:       config.isPrecut,
      a4Cols:         config.a4Cols,
      a4Rows:         config.a4Rows,
      startPosition:  config.startPosition,
      displaySettings: config.displaySettings ?? getDefaultDisplaySettings(),
      generatedHtml:  html.substring(0, 10000), // DBサイズ制限
    },
  });

  return NextResponse.json({
    success: true,
    data: { html, content, warnings },
  });
}
