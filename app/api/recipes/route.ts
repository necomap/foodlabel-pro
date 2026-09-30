// ============================================================
// app/api/recipes/route.ts - レシピ一覧取得・新規作成API
// ============================================================

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';
import { getReadOnlyRecipeIds } from '@/lib/plan-limits-server';
import { findDisallowedIngredientIds, DISALLOWED_INGREDIENT_MESSAGE } from '@/lib/ingredient-access';
import { detectAllergens } from '@/lib/allergen';
import { recipeSchema, createRecipeRecord } from '@/lib/recipe-create';

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
      variationName:  (r as any).variationName ?? null,
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

  // プラン上限を超えている場合、作成日が古い順に上限超え分をreadOnlyにする。
  // 表示中のページ内だけで判定すると結果がぶれるため、そのユーザーの全アクティブレシピを
  // 対象に判定するgetReadOnlyRecipeIds（lib/plan-limits.ts）を使う（2026-08 修正）。
  const readOnlyIds = await getReadOnlyRecipeIds(session.user.id, (session.user as any).plan ?? 'free');
  if (readOnlyIds.size > 0) {
    items.forEach((r: any) => { r.readOnly = readOnlyIds.has(r.id); });
  }

  return NextResponse.json({
    success: true,
    data:    { items, total, page, perPage, hasMore: page * perPage < total },
  });
}

// ============================================================
// POST /api/recipes - レシピ新規作成
// ============================================================

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  // プラン制限チェック
  const currentPlan = session.user.plan ?? 'free';
  const limits = getPlanLimits(currentPlan);
  if (limits.maxRecipes !== Infinity) {
    const recipeCount = await prisma.recipe.count({ where: { userId: session.user.id, isActive: true } });
    if (recipeCount >= limits.maxRecipes) {
      // 2026-08 プロプラン新設: プレミアムユーザーが100件の上限に達した場合は「プロ」への
      // アップグレードを案内する（フリープランのまま案内すると、既にプレミアムの人には
      // 意味が通らないため、現在のプランに応じて文言を出し分ける）。
      const planLabel  = currentPlan === 'premium' ? 'スタンダードプラン' : 'フリープラン';
      const nextPlanLabel = currentPlan === 'premium' ? 'プロプラン' : 'スタンダードプラン';
      return NextResponse.json({
        success: false,
        error: `${planLabel}のレシピ上限（${limits.maxRecipes}件）に達しました。${nextPlanLabel}にアップグレードしてください。`,
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

    // 他ユーザーの非共有食材を紐づけられないようにする（lib/ingredient-access.ts 参照）
    const disallowed = await findDisallowedIngredientIds(session.user.id, data.ingredients.map(i => i.ingredientId));
    if (disallowed.length > 0) {
      return NextResponse.json({ success: false, error: DISALLOWED_INGREDIENT_MESSAGE }, { status: 400 });
    }

    const { recipe, perUnitNutrition } = await createRecipeRecord(session.user.id, data);

    return NextResponse.json({ success: true, data: { id: recipe.id, perUnitNutrition } });

  } catch (err) {
    console.error('Recipe create error:', err);
    return NextResponse.json({ success: false, error: 'レシピ保存中にエラーが発生しました' }, { status: 500 });
  }
}
