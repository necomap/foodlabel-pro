// ============================================================
// app/api/recipes/[id]/route.ts - レシピ詳細・更新・削除API
// ============================================================

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getReadOnlyRecipeIds } from '@/lib/plan-limits';
import { buildIngredientsLabel, collectRecipeAllergens, prepareIngredientsForLabel } from '@/lib/allergen';
import { calcPerUnit, roundForDisplay, calcNutritionForAmount, resolveIngredientNutritionPer100g, calcCostRate } from '@/lib/nutrition';
import { getGenericNameOverrides } from '@/lib/generic-name-overrides';
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
          ingredient: {
            select: {
              id: true, name: true, allergens: true, unitPrice: true, genericName: true, genericNameConfirmed: true, alwaysHideFromLabel: true, originCountry: true,
              // 栄養成分「未確認」警告を、レシピ保存時点のスナップショットではなく食材マスタの
              // 最新値から毎回判定し直すために必要（詳細はlib/nutrition.tsのコメント参照）
              energyKcalManual: true, proteinManual: true, fatManual: true, carbohydrateManual: true,
              sodiumManual: true, saltEquivalentManual: true, dietaryFiberManual: true, sugarManual: true, cholesterolManual: true,
              nutritionData: { select: { energyKcal: true, protein: true, fat: true, carbohydrate: true, sodium: true, saltEquivalent: true, dietaryFiber: true, sugar: true, cholesterol: true } },
            },
          },
        },
      },
      steps: { orderBy: { stepNumber: 'asc' } },
    },
  });

  if (!recipe) {
    return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });
  }

  // 表示順は常にdisplayOrder（レシピ編集画面でドラッグ&ドロップして並び替えた順）を使う。
  // 実際に印字される原材料表示テキストの重量順ソートは、下のingredientsLabel計算
  // （prepareIngredientsForLabel内）で別途・自動的に行われるため、ここで重量順に並べ替える
  // 必要はない。むしろここで重量順に並べ替えてしまうと、編集画面やレシピ印刷を開き直すたびに
  // ユーザーが並び替えた順番が重量順に戻って見えてしまう（保存されていないように見える）バグになる。
  const sortedIngredients = [...recipe.ingredients].sort((a, b) => a.displayOrder - b.displayOrder);

  // 自分が所有していない共有食材（システム共有・他ユーザー共有）でも「自分専用の一般名」が
  // 設定されていれば、食材マスタ本体のgenericNameより優先する（詳細はlib/generic-name-overrides.ts）。
  const genericNameOverrides = await getGenericNameOverrides(session.user.id, sortedIngredients.map(ing => ing.ingredientId));
  const resolveGenericName = (ing: typeof sortedIngredients[number]): string | null =>
    (ing.ingredientId && genericNameOverrides.get(ing.ingredientId)) || (ing.ingredient as any)?.genericName || null;

  // アレルゲン集約（ラベル印刷時の判定〔app/api/labels/generate/route.ts〕と同じく、一般名優先で判定する）
  const allergenInfo = collectRecipeAllergens(
    sortedIngredients.map(ing => ({
      allergens:        ing.ingredient?.allergens ?? [],
      allergenOverride: ing.allergenOverride,
      ingredientName:   resolveGenericName(ing) || ing.ingredient?.name || ing.ingredientNameOverride || '',
      // 食材マスタに紐づいている材料は、マスタ側のallergensのみを信頼する（名前からの自動再判定はしない）
      hasIngredientLink: !!ing.ingredientId,
    }))
  );

  // 原材料表示テキスト（実際に印字される内容と一致するよう、一般名（ラベル表示用の名称）を優先。
  // 非表示設定の除外・同名原材料の合算・合算後の重量順ソートも印刷時と同じロジックで行う）
  const ingredientsLabel = buildIngredientsLabel(
    prepareIngredientsForLabel(
      sortedIngredients.map(ing => ({
        ingredientName: resolveGenericName(ing) || ing.ingredient?.name || ing.ingredientNameOverride || '',
        amount:         Number(ing.amount),
        unit:           ing.unit,
        displayOrder:   ing.displayOrder,
        sortByWeight:   ing.sortByWeight,
        // レシピ側に個別の原産地指定が無ければ、食材マスタ側の原産地（デフォルト）にフォールバックする。
        // これにより、食材マスタで原産地を後から入力・修正した場合も、既存レシピ（材料をマスタに
        // 紐づけた時点では原産地が未入力だったもの）を開き直すだけで反映されるようになる
        // （レシピ側で明示的に指定した値がある場合はそちらを優先する）。
        originCountry:  ing.originCountry || (ing.ingredient as any)?.originCountry || undefined,
        isAdditive:     ing.isAdditive ?? false,
        additiveReason: ing.additiveReason ?? undefined,
        hideFromLabel:  (ing as any).hideFromLabel ?? false,
        ingredientAlwaysHideFromLabel: (ing.ingredient as any)?.alwaysHideFromLabel ?? false,
      }))
    ),
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

  // 原価は栄養成分と違い、これまで「材料をレシピに追加した時点の原価単価」のスナップショット
  // （RecipeIngredient.costPrice）を保存するだけで、食材マスタ側の仕入単価（Ingredient.unitPrice）を
  // 後から設定・変更してもこのレシピ画面には反映されなかった（栄養成分は上のnutritionUnconfirmed判定の
  // ように、毎回マスタの最新値から再計算しているのに対し、原価だけこの自己修復が無かった）。
  // 「レシピ側の原価単価が未設定（null）」の材料に限り、食材マスタの現在の仕入単価から補完する
  // （ユーザーがこのレシピの材料行で明示的に原価単価を入力・上書きしている場合はそちらを尊重し、
  // 上書きしない。null埋めのみを対象にすることで、既存の意図的な入力値を壊さない）。
  const resolvedIngredients = sortedIngredients.map(ing => {
    let costPrice = ing.costPrice != null ? Number(ing.costPrice) : null;
    let costTotal = ing.costTotal != null ? Number(ing.costTotal) : null;
    if (ing.ingredientId && ing.ingredient && costPrice == null) {
      const masterUnitPrice = (ing.ingredient as any).unitPrice;
      if (masterUnitPrice != null) {
        costPrice = Number(masterUnitPrice);
        costTotal = Math.round(costPrice * Number(ing.amount) * 100) / 100;
      }
    }
    return { ing, costPrice, costTotal };
  });
  // 材料ごとの原価（上で補完済みのもの）を積み上げて合計・1個あたり・原価率を算出し直す。
  // レシピ本体のtotalCost/unitCost/costRateカラムは直近の保存時点のスナップショットのままだと
  // 上の材料単位の補完と食い違って見えるため、表示上はここで再計算した値を優先する。
  const totalCostResolved = resolvedIngredients.reduce((s, d) => s + (d.costTotal ?? 0), 0);
  const unitCostResolved  = recipe.unitCount > 0 ? totalCostResolved / recipe.unitCount : 0;
  const costRateResolved  = recipe.salePrice ? calcCostRate(unitCostResolved, Number(recipe.salePrice)) : 0;

  return NextResponse.json({
    success: true,
    data: {
      id:             recipe.id,
      name:           recipe.name,
      nameKana:       recipe.nameKana,
      variationName:  (recipe as any).variationName ?? null,
      categoryId:     recipe.category?.id ?? null,
      categoryName:   recipe.category?.name ?? null,
      unitCount:      recipe.unitCount,
      moldType:       (recipe as any).moldType ?? null,
      wasteAmountG:   (recipe as any).wasteAmountG ? Number((recipe as any).wasteAmountG) : null,
      wasteRatio:     Number(recipe.wasteRatio),
      salePrice:      recipe.salePrice ? Number(recipe.salePrice) : null,
      shelfLifeDays:  recipe.shelfLifeDays,
      shelfLifeType:  recipe.shelfLifeType,
      contentAmount:  recipe.contentAmount,
      storageMethod:  recipe.storageMethod,
      notes:          recipe.notes,
      barcode:        recipe.barcode ?? null,
      printComment:   recipe.printComment,
      qualityControl: recipe.qualityControl,
      bakingConditions: recipe.bakingConditions as unknown as BakingStep[] | null,
      totalCost:      totalCostResolved || null,
      unitCost:       unitCostResolved  || null,
      costRate:       costRateResolved  || null,
      totalWeightG:   recipe.totalWeightG ? Number(recipe.totalWeightG) : null,
      nutrition:      totalNutrition,
      nutritionPerUnit: roundForDisplay(calcPerUnit(totalNutrition, recipe.unitCount, Number(recipe.wasteRatio ?? 0))),
      ingredientsLabel,
      allergensLabel: allergenInfo.all.join('・'),
      allergens:      allergenInfo,
      isActive:       recipe.isActive,
      createdAt:      recipe.createdAt,
      updatedAt:      recipe.updatedAt,
      ingredients: resolvedIngredients.map(({ ing, costPrice, costTotal }) => {
        // 食材マスタに紐づいている材料は、RecipeIngredientに保存された時点のスナップショットではなく、
        // 食材マスタの最新の栄養成分から毎回「未確認」かどうかを判定し直す。
        // こうしないと、食材マスタ側で栄養成分を後から入力・修正しても、このレシピを開き直して
        // 保存し直すまで警告が消えない（直したのに反映されていないように見える）不具合になる。
        let nutritionUnconfirmed = ing.nutritionUnconfirmed;
        let nutrition = {
          energyKcal:     ing.energyKcal     != null ? Number(ing.energyKcal)     : null,
          protein:        ing.protein        != null ? Number(ing.protein)        : null,
          fat:            ing.fat            != null ? Number(ing.fat)            : null,
          carbohydrate:   ing.carbohydrate   != null ? Number(ing.carbohydrate)   : null,
          sodium:         ing.sodium         != null ? Number(ing.sodium)         : null,
          saltEquivalent: ing.saltEquivalent != null ? Number(ing.saltEquivalent) : null,
          dietaryFiber:   ing.dietaryFiber   != null ? Number(ing.dietaryFiber)   : null,
          sugar:          ing.sugar          != null ? Number(ing.sugar)          : null,
          cholesterol:    ing.cholesterol    != null ? Number(ing.cholesterol)    : null,
        };
        if (ing.ingredientId && ing.ingredient) {
          const resolved = resolveIngredientNutritionPer100g(ing.ingredient as any);
          nutritionUnconfirmed = resolved.unconfirmed;
          if (!resolved.unconfirmed) {
            nutrition = calcNutritionForAmount(resolved.per100g, Number(ing.amount));
          }
        }
        const hasPersonalGenericOverride = !!(ing.ingredientId && genericNameOverrides.has(ing.ingredientId));
        return {
          id:                     ing.id,
          ingredientId:           ing.ingredientId,
          ingredientName:         ing.ingredient?.name ?? ing.ingredientNameOverride ?? '',
          ingredientNameOverride: ing.ingredientNameOverride,
          genericName:            resolveGenericName(ing),
          // 自分専用の上書きは、自分で明示的に入力した値なので「要確認」扱いにはしない
          genericNameConfirmed:   hasPersonalGenericOverride ? true : ((ing.ingredient as any)?.genericNameConfirmed ?? null),
          genericNameIsPersonalOverride: hasPersonalGenericOverride,
          amount:                 Number(ing.amount),
          unit:                   ing.unit,
          displayOrder:           ing.displayOrder,
          sortByWeight:           ing.sortByWeight,
          originCountry:          ing.originCountry || (ing.ingredient as any)?.originCountry || null,
          isAdditive:             ing.isAdditive ?? false,
          additiveReason:         ing.additiveReason ?? null,
          hideFromLabel:          (ing as any).hideFromLabel ?? false,
          ingredientAlwaysHideFromLabel: (ing.ingredient as any)?.alwaysHideFromLabel ?? false,
          processLabel:           (ing as any).processLabel ?? null,
          costPrice:              costPrice,
          costTotal:              costTotal,
          allergenOverride:       ing.allergenOverride,
          isPrimaryIngredient:    ing.isPrimaryIngredient,
          nutritionUnconfirmed,
          nutrition,
        };
      }),
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

  // プラン上限超過による読み取り専用チェック（2026-08追加・再発防止コメント）。
  // 以前はこのAPIに上限チェックが一切無く、一覧画面の「読取専用」バッジは見た目だけで、
  // 実際には解約後も既存レシピを何件でも編集し続けられてしまっていた。
  // ラベル印刷（app/api/labels/generate/route.ts）は既存商品の運用を止めないため意図的に対象外。
  const readOnlyIds = await getReadOnlyRecipeIds(session.user.id, (session.user as any).plan ?? 'free');
  if (readOnlyIds.has(params.id)) {
    return NextResponse.json({
      success: false,
      error: 'プランのレシピ上限を超えているため、このレシピは読み取り専用です。編集するにはプレミアムプランへのアップグレードが必要です。',
      upgradeRequired: true,
    }, { status: 403 });
  }

  const body = await request.json();

  try {
    // 既存の材料・手順を削除
    await prisma.$transaction([
      prisma.recipeIngredient.deleteMany({ where: { recipeId: params.id } }),
      prisma.recipeStep.deleteMany({ where: { recipeId: params.id } }),
    ]);

    // 材料の栄養計算
    const { calcNutritionForAmount, sumNutrition, calcPerUnit, calcCostRate } = await import('@/lib/nutrition');
    const { buildIngredientsLabel: bil, collectRecipeAllergens: car, detectAllergens: da } = await import('@/lib/allergen');

    const ingredients = body.ingredients ?? [];
    const ingredientDetails = await Promise.all(
      ingredients.map(async (ing: any) => {
        let nutritionPer100g: any = {};
        let allergens: string[] = [];
        let hasIngredientLink = false;
        let nutritionUnconfirmed = false;
        // 食材マスタ側の現在の仕入単価（原価が未入力の材料行の補完用。下のcostTotal計算参照）
        let masterUnitPrice: number | null = null;
        // ラベル表示名：食材マスタに一般名が設定されていればそちらを優先（例:「無塩バター よつ葉」→「バター」）
        let displayName = ing.ingredientNameOverride ?? ing.name ?? '';

        if (ing.ingredientId) {
          const rec = await prisma.ingredient.findUnique({
            where: { id: ing.ingredientId },
            include: { nutritionData: true },
          });
          if (rec) {
            hasIngredientLink = true;
            masterUnitPrice = rec.unitPrice != null ? Number(rec.unitPrice) : null;
            // 食材マスタに紐づいている場合は常にマスタ側のallergensのみを信頼する。
            // レシピ側に古いスナップショット（ing.allergenOverride）が残っていても使わない。
            // こうすることで、食材マスタ側でアレルゲンを修正すれば、このレシピを保存し直すだけで
            // 正しい値に更新される（保存し直さなくても、印刷・表示時は常にマスタの最新値が使われる）。
            allergens = rec.allergens;
            if ((rec as any).genericName) displayName = (rec as any).genericName;
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
        if (!hasIngredientLink) {
          // 食材マスタに紐づいていない（自由入力の）材料：allergenOverrideがあれば優先、
          // なければ名前から自動判定する（新規作成時と同じロジック）。
          allergens = ing.allergenOverride?.length ? ing.allergenOverride : da(ing.ingredientNameOverride ?? ing.name ?? '');
        }
        const amount = Number(ing.amount);
        const nutrition = calcNutritionForAmount(nutritionPer100g, amount);
        // 原価単価：この材料行で明示的に入力されていればそれを優先し、未入力（0/空欄/undefined）の
        // 場合のみ食材マスタの現在の仕入単価で補完する（GET側の再計算ロジックと同じ考え方。
        // 詳細はGETハンドラのresolvedIngredients付近のコメント参照）。
        const costPriceResolved = (ing.costPrice != null && ing.costPrice !== '' && Number(ing.costPrice) > 0)
          ? Number(ing.costPrice)
          : masterUnitPrice;
        const costTotal = costPriceResolved && amount ? Math.round(costPriceResolved * amount * 100) / 100 : null;
        return { ing, allergens, hasIngredientLink, nutrition, nutritionUnconfirmed, costPriceResolved, costTotal, displayName };
      })
    );

    const allergenInfo = car(ingredientDetails.map(d => ({
      allergens: d.allergens, allergenOverride: d.ing.allergenOverride ?? [],
      ingredientName: d.displayName,
      // 食材マスタに紐づいている材料は、マスタ側のallergensのみを信頼する（名前からの自動再判定はしない）
      hasIngredientLink: d.hasIngredientLink,
    })));
    const totalNutrition = sumNutrition(ingredientDetails.map(d => ({ nutrition: d.nutrition })));
    const totalCost = ingredientDetails.reduce((s, d) => s + (d.costTotal ?? 0), 0);
    const totalWeightG = ingredients.reduce((s: number, ing: any) => s + (ing.unit === 'g' || ing.unit === 'ml' ? Number(ing.amount) : 0), 0);
    const unitCount = body.unitCount ?? 1;
    const wasteAmountG = body.wasteAmountG ? Number(body.wasteAmountG) : 0;
    const wasteRatio = (totalWeightG > 0 && wasteAmountG > 0) ? Math.round((wasteAmountG / totalWeightG) * 100 * 100) / 100 : 0;
    const ingredientsLabel = bil(
      ingredientDetails.map(d => ({ ingredientName: d.displayName, amount: Number(d.ing.amount), unit: d.ing.unit, originCountry: d.ing.originCountry ?? undefined, isAdditive: d.ing.isAdditive ?? false, additiveReason: d.ing.additiveReason ?? undefined })).sort((a,b) => b.amount - a.amount),
      allergenInfo.all
    );

    // レシピ更新
    await prisma.recipe.update({
      where: { id: params.id },
      data: {
        categoryId:      body.categoryId || null,
        name:            body.name,
        // 以下、空欄で保存すると undefined になりPrismaが「更新しない」と解釈して古い値が残ってしまうため、
        // 全て ?? null で明示的にnullを渡すよう統一（qualityControlで発覚した不具合の横展開）
        nameKana:        body.nameKana ?? null,
        variationName:   body.variationName || null,
        unitCount:       unitCount,
        moldType:        body.moldType || null,
        wasteAmountG:    wasteAmountG || null,
        wasteRatio:      wasteRatio,
        salePrice:       body.salePrice ? Number(body.salePrice) : null,
        shelfLifeDays:   body.shelfLifeDays ? Number(body.shelfLifeDays) : null,
        shelfLifeType:   body.shelfLifeType ?? 'USE_BY',
        contentAmount:   body.contentAmount ?? null,
        storageMethod:   body.storageMethod ?? null,
        barcode:         body.barcode ?? null,
        notes:           body.notes ?? null,
        printComment:    body.printComment ?? null,
        qualityControl:  body.qualityControl ?? null,
        bakingConditions: body.bakingConditions ? JSON.stringify(body.bakingConditions) : null,
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
          ingredientNameOverride: d.ing.ingredientNameOverride ?? d.ing.name ?? '',
          amount:                Number(d.ing.amount),
          unit:                  d.ing.unit ?? 'g',
          displayOrder:          idx,
          sortByWeight:          true,
          costPrice:             d.costPriceResolved,
          costTotal:             d.costTotal,
          originCountry:         d.ing.originCountry || null,
          isAdditive:            d.ing.isAdditive ?? false,
          additiveReason:        d.ing.additiveReason ?? null,
          hideFromLabel:         d.ing.hideFromLabel ?? false,
          processLabel:          d.ing.processLabel || null,
          isPrimaryIngredient:   d.ing.isPrimaryIngredient ?? false,
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
