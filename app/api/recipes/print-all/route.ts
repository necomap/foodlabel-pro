// ============================================================
// app/api/recipes/print-all/route.ts - 全レシピ一括印刷用データ取得（Pro限定）
// ============================================================
// 2026-08新設: 保健所への立入検査時などに「全レシピ（非表示含む）を事業者控えとして
// まとめて印刷したい」というニーズに対応。通常のレシピ印刷（app/dashboard/recipes/print/page.tsx）
// はレシピ一覧で選択したidsをURLクエリ文字列で渡す方式だが、全件（数百件になりうる）を
// クエリに載せるとURL長の上限に抵触しうるため、専用エンドポイントでユーザーの全レシピを
// 一括取得する。印刷画面が必要とする最小限の項目のみ返す（個別取得API
// `GET /api/recipes/[id]` が行うアレルゲン集約・原材料表示テキスト生成等の重い処理はここでは不要）。

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const limits = getPlanLimits((session.user as any).plan ?? 'free');
  if (!limits.canUseBulkPrint) {
    return NextResponse.json({ success: true, data: { canUse: false, recipes: [] } });
  }

  // 非表示レシピも含め、そのユーザーの全レシピが対象（保健所提出用の事業者控えという
  // 用途上、現在の表示/非表示状態にかかわらず「扱っている全商品」を網羅する必要があるため）。
  const recipes = await prisma.recipe.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      category: { select: { name: true } },
      ingredients: {
        orderBy: { displayOrder: 'asc' },
        include: {
          ingredient: { select: { name: true, genericName: true, genericNameConfirmed: true } },
        },
      },
      steps: { orderBy: { stepNumber: 'asc' } },
    },
  });

  const data = recipes.map(r => ({
    id:           r.id,
    name:         r.name,
    unitCount:    r.unitCount,
    categoryName: r.category?.name ?? null,
    isActive:     r.isActive,
    ingredients: r.ingredients.map(ing => ({
      ingredientName:       ing.ingredient?.name || ing.ingredientNameOverride || '（材料名未設定）',
      amount:               Number(ing.amount),
      unit:                 ing.unit,
      genericName:          ing.ingredient?.genericName ?? null,
      genericNameConfirmed: ing.ingredient?.genericNameConfirmed ?? null,
      processLabel:         ing.processLabel,
    })),
    steps:           r.steps.map(s => s.instruction),
    bakingConditions: r.bakingConditions,
    totalWeightG:    r.totalWeightG != null ? Number(r.totalWeightG) : null,
    shelfLifeDays:   r.shelfLifeDays,
    shelfLifeType:   r.shelfLifeType,
    notes:           r.notes,
  }));

  return NextResponse.json({ success: true, data: { canUse: true, recipes: data } });
}
