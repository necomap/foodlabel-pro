// ============================================================
// app/api/import-export/route.ts
// Excelインポート・エクスポートAPI
// ============================================================

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanLimits } from '@/lib/plan-limits';
import { prisma } from '@/lib/db';
import { parseExcelFile, exportRecipesToExcel, toFullWidth } from '@/lib/excel-import-export';
import { detectAllergens } from '@/lib/allergen';
import { calcNutritionForAmount, sumNutrition } from '@/lib/nutrition';

// ============================================================
// POST /api/import-export/import - Excelインポート
// ============================================================
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const formData  = await request.formData();
  const file      = formData.get('file') as File | null;
  const overwrite = formData.get('overwrite') === 'true';

  if (!file) {
    return NextResponse.json({ success: false, error: 'ファイルが選択されていません' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['xlsx', 'xlsm', 'xls'].includes(ext ?? '')) {
    return NextResponse.json({ success: false, error: 'Excel形式（.xlsx, .xlsm, .xls）のファイルを選択してください' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const { recipes: parsedRecipes, errors, warnings } = parseExcelFile(buffer);

  if (errors.length > 0 && parsedRecipes.length === 0) {
    return NextResponse.json({ success: false, error: 'ファイルの読み込みに失敗しました', data: { errors } }, { status: 400 });
  }

  let imported = 0;
  let skipped  = 0;

  for (const pr of parsedRecipes) {
    try {
      const name = toFullWidth(pr.name).trim();
      if (!name) { skipped++; continue; }

      // 既存レシピチェック（上書きしない場合はスキップ）
      if (!overwrite) {
        const exists = await prisma.recipe.findFirst({
          where: { userId: session.user.id, name, isActive: true },
        });
        if (exists) { skipped++; continue; }
      }

      // カテゴリを探す or 作る
      let categoryId: string | undefined;
      if (pr.category) {
        let cat = await prisma.category.findFirst({
          where: {
            name:     pr.category,
            OR: [{ userId: null }, { userId: session.user.id }],
          },
        });
        if (!cat) {
          cat = await prisma.category.create({
            data: { userId: session.user.id, name: pr.category },
          });
        }
        categoryId = cat.id;
      }

      // 材料の食材マスタ検索・作成
      const ingredientDetails = [];
      for (const rawIng of pr.ingredients) {
        const ingName = toFullWidth(rawIng.name).trim();
        if (!ingName) continue;

        // 食材マスタを検索（自分の + 共有）
        let ingredient = await prisma.ingredient.findFirst({
          where: {
            name:     ingName,
            isActive: true,
            OR: [{ userId: session.user.id }, { userId: null }],
          },
          include: { nutritionData: true },
        });

        // なければ自動作成（手入力扱い）
        if (!ingredient) {
          ingredient = await prisma.ingredient.create({
            data: {
              userId:    session.user.id,
              name:      ingName,
              nameKana:  '',
              allergens: detectAllergens(ingName),
              isActive:  true,
            },
            include: { nutritionData: true },
          });
        }

        // 栄養計算
        const amountG = ['g', 'ml'].includes(rawIng.unit) ? rawIng.amount : 0;
        const nutrition = amountG > 0 && ingredient.nutritionData
          ? calcNutritionForAmount({
              energyKcal:     ingredient.nutritionData.energyKcal     ? Number(ingredient.nutritionData.energyKcal)     : null,
              protein:        ingredient.nutritionData.protein        ? Number(ingredient.nutritionData.protein)        : null,
              fat:            ingredient.nutritionData.fat            ? Number(ingredient.nutritionData.fat)            : null,
              carbohydrate:   ingredient.nutritionData.carbohydrate   ? Number(ingredient.nutritionData.carbohydrate)   : null,
              sodium:         ingredient.nutritionData.sodium         ? Number(ingredient.nutritionData.sodium)         : null,
              saltEquivalent: ingredient.nutritionData.saltEquivalent  ? Number(ingredient.nutritionData.saltEquivalent) : null,
              dietaryFiber:   ingredient.nutritionData.dietaryFiber   ? Number(ingredient.nutritionData.dietaryFiber)   : null,
              sugar:          ingredient.nutritionData.sugar          ? Number(ingredient.nutritionData.sugar)          : null,
              cholesterol:    ingredient.nutritionData.cholesterol    ? Number(ingredient.nutritionData.cholesterol)    : null,
            }, amountG)
          : { energyKcal: null, protein: null, fat: null, carbohydrate: null, sodium: null, saltEquivalent: null, dietaryFiber: null, sugar: null, cholesterol: null };

        ingredientDetails.push({
          ingredientId:        ingredient.id,
          amount:              rawIng.amount,
          unit:                rawIng.unit || 'g',
          displayOrder:        rawIng.order,
          sortByWeight:        true,
          costPrice:           rawIng.cost ? rawIng.cost / rawIng.amount : undefined,
          costTotal:           rawIng.cost,
          allergenOverride:    [] as string[],
          nutritionUnconfirmed: !ingredient.nutritionData,
          isPrimary:           false,
          nutrition,
        });
      }

      // 最重量食材にフラグ
      const gIngs = ingredientDetails.filter(i => i.unit === 'g' || i.unit === 'ml');
      if (gIngs.length > 0) {
        const maxIdx = ingredientDetails.indexOf(
          gIngs.reduce((a, b) => b.amount > a.amount ? b : a)
        );
        ingredientDetails[maxIdx].isPrimary = true;
      }

      const totalNutrition = sumNutrition(ingredientDetails.map(i => ({ nutrition: i.nutrition })));
      const totalCost = ingredientDetails.reduce((s, i) => s + (i.costTotal ?? 0), 0);

      // 上書きの場合は既存を論理削除
      if (overwrite) {
        await prisma.recipe.updateMany({
          where: { userId: session.user.id, name, isActive: true },
          data:  { isActive: false },
        });
      }

      // レシピ作成
      await prisma.recipe.create({
        data: {
          userId:         session.user.id,
          categoryId,
          name,
          nameKana:       pr.nameKana || null,
          unitCount:      pr.unitCount,
          shelfLifeDays:  pr.shelfLifeDays || null,
          salePrice:      pr.salePrice || null,
          totalCost:      totalCost || null,
          unitCost:       pr.unitCount > 0 ? (totalCost / pr.unitCount) || null : null,
          energyKcal:     totalNutrition.energyKcal,
          protein:        totalNutrition.protein,
          fat:            totalNutrition.fat,
          carbohydrate:   totalNutrition.carbohydrate,
          sodium:         totalNutrition.sodium,
          saltEquivalent: totalNutrition.saltEquivalent,
          dietaryFiber:   totalNutrition.dietaryFiber,
          sugar:          totalNutrition.sugar,
          cholesterol:    totalNutrition.cholesterol,
          bakingConditions: pr.bakingConditions.length > 0
            ? JSON.stringify(pr.bakingConditions)
            : undefined,
          ingredients: {
            create: ingredientDetails.map(ing => ({
              ingredientId:        ing.ingredientId,
              amount:              ing.amount,
              unit:                ing.unit,
              displayOrder:        ing.displayOrder,
              sortByWeight:        ing.sortByWeight,
              costPrice:           ing.costPrice,
              costTotal:           ing.costTotal,
              allergenOverride:    ing.allergenOverride,
              isPrimaryIngredient: ing.isPrimary,
              nutritionUnconfirmed: ing.nutritionUnconfirmed,
              ...ing.nutrition,
            })),
          },
          steps: {
            create: pr.steps.map((instruction, idx) => ({
              stepNumber:  idx + 1,
              instruction,
            })),
          },
        },
      });

      imported++;
    } catch (err) {
      console.error(`Import error for ${pr.name}:`, err);
      errors.push({ row: pr.no, message: `「${pr.name}」の取り込みに失敗しました` });
    }
  }

  return NextResponse.json({
    success:  true,
    data:     { imported, skipped, total: parsedRecipes.length, errors, warnings },
    message:  `${imported}件のレシピを取り込みました${skipped > 0 ? `（${skipped}件スキップ）` : ''}`,
  });
}

// ============================================================
// GET /api/import-export/export - Excelエクスポート
// ============================================================
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const limits = getPlanLimits(session.user.plan ?? 'free');
  if (!limits.canExport) {
    return NextResponse.json({
      success: false,
      error: 'Excelエクスポートはプレミアムプランの機能です。',
      upgradeRequired: true,
    }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeNutrition = searchParams.get('nutrition') !== 'false';
  const includeSteps     = searchParams.get('steps')     !== 'false';
  const includeCost      = searchParams.get('cost')      !== 'false';
  const categoryFilter   = searchParams.get('category')  ?? undefined;

  const recipes = await prisma.recipe.findMany({
    where: {
      userId:   session.user.id,
      isActive: true,
      ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    },
    include: {
      category:    { select: { name: true } },
      ingredients: {
        orderBy: [{ sortByWeight: 'desc' }, { displayOrder: 'asc' }],
        include: { ingredient: { select: { name: true, allergens: true } } },
      },
      steps: { orderBy: { stepNumber: 'asc' } },
    },
    orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
  });

  const exportData = recipes.map(r => ({
    name:           r.name,
    nameKana:       r.nameKana,
    categoryName:   r.category?.name ?? null,
    unitCount:      r.unitCount,
    salePrice:      r.salePrice    ? Number(r.salePrice)    : null,
    costRate:       r.costRate     ? Number(r.costRate)     : null,
    shelfLifeDays:  r.shelfLifeDays,
    ingredientsLabel: r.ingredients
      .map(i => i.ingredient?.name ?? i.ingredientNameOverride ?? '')
      .join('、'),
    notes:          r.notes,
    energyKcal:     r.energyKcal     ? Number(r.energyKcal)     : null,
    protein:        r.protein        ? Number(r.protein)        : null,
    fat:            r.fat            ? Number(r.fat)            : null,
    carbohydrate:   r.carbohydrate   ? Number(r.carbohydrate)   : null,
    saltEquivalent: r.saltEquivalent  ? Number(r.saltEquivalent) : null,
    ingredients:    r.ingredients.map(i => ({
      ingredientName: i.ingredient?.name ?? i.ingredientNameOverride ?? '',
      amount:         Number(i.amount),
      unit:           i.unit,
      displayOrder:   i.displayOrder,
      costTotal:      i.costTotal ? Number(i.costTotal) : null,
    })),
    steps: r.steps.map(s => s.instruction),
  }));

  const excelBuffer = exportRecipesToExcel(exportData, {
    includeNutrition,
    includeSteps,
    includeCost,
    categoryFilter,
  });

  return new Response(Buffer.from(excelBuffer), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''foodlabel_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
    },
  });
}
