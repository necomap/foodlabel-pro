// ============================================================
// app/api/labels/consumption/route.ts - 材料消費量レポート（Pro限定）
// ============================================================
// 2026-08新設: ラベル印刷のたびに記録している label_print_logs（レシピID・印刷枚数・日時）を
// 使って、指定期間内に「印刷枚数（＝製造した商品の個数）から逆算して、各材料をどれだけ
// 消費したか」を集計する。在庫の数量管理（残数・期限切れアラート等）はスコープ外で、
// ユーザーが別途開発中の在庫管理アプリの役割（lib/plan-limits.ts・app/dashboard/lots/page.tsx
// のコメント参照）。あくまで「期間内にどれだけ使ったか」の参考値を提供する機能。
//
// 計算方法: そのレシピの材料使用量（RecipeIngredient.amount）は「レシピ1回分
// （Recipe.unitCount個分）を作るときの量」なので、1個あたりの消費量は amount / unitCount。
// 期間内のそのレシピの印刷枚数（＝製造個数の実績）を掛け合わせて消費量を算出する。
// 印刷時点のレシピ内容のスナップショットではなく、常に「現在のレシピ内容」で計算するため、
// 印刷後にレシピの材料・分量を変更した場合は、変更後の内容で遡って計算される点に注意。

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const limits = getPlanLimits((session.user as any).plan ?? 'free');
  if (!limits.canUseConsumptionReport) {
    return NextResponse.json({ success: true, data: { canUse: false } });
  }

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get('from');
  const toStr   = searchParams.get('to');
  if (!fromStr || !toStr) {
    return NextResponse.json({ success: false, error: '期間（開始日・終了日）を指定してください' }, { status: 400 });
  }
  const from = new Date(`${fromStr}T00:00:00`);
  // toは指定日を含めたいので、翌日0時を排他的な上限として扱う
  const toExclusive = new Date(`${toStr}T00:00:00`);
  toExclusive.setDate(toExclusive.getDate() + 1);
  if (isNaN(from.getTime()) || isNaN(toExclusive.getTime()) || from >= toExclusive) {
    return NextResponse.json({ success: false, error: '期間の指定が正しくありません' }, { status: 400 });
  }

  // 期間内のレシピ別印刷枚数を集計
  const rows = await prisma.$queryRaw`
    SELECT "recipeId", COALESCE(SUM("printCount"), 0)::int as total
    FROM label_print_logs
    WHERE "userId" = ${session.user.id}
      AND "createdAt" >= ${from}
      AND "createdAt" <  ${toExclusive}
      AND "recipeId" IS NOT NULL
    GROUP BY "recipeId"
  ` as { recipeId: string; total: number }[];

  if (rows.length === 0) {
    return NextResponse.json({ success: true, data: { canUse: true, ingredients: [], recipes: [], totalPrintCount: 0 } });
  }

  const recipeIds = rows.map(r => r.recipeId);
  const printCountByRecipe = new Map(rows.map(r => [r.recipeId, r.total]));

  // 印刷時点のレシピ内容のスナップショットは保存していないため、現在のレシピ内容
  // （材料・使用量）で計算する。非表示レシピも対象に含める（isActiveで絞り込まない）。
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: recipeIds }, userId: session.user.id },
    include: {
      ingredients: { include: { ingredient: { select: { name: true } } } },
    },
  });
  const recipeById = new Map(recipes.map(r => [r.id, r]));

  // 材料名＋単位ごとに消費量を合算する（同じ材料名でもレシピによって単位が違う場合は
  // 誤って合算しないよう別行として扱う）
  const totals = new Map<string, { ingredientName: string; unit: string; amount: number }>();
  const recipeBreakdown: Array<{ recipeId: string; recipeName: string | null; printCount: number; recipeDeleted: boolean }> = [];

  // Map<string, number> はtsconfig.jsonのtarget（ES2015未満）ではfor...ofで直接
  // イテレートできない（--downlevelIterationが必要になる）ため、forEachで回す。
  // Map.forEachはコールバック引数の順序が(value, key)である点に注意（[key, value]ではない）。
  printCountByRecipe.forEach((printCount, recipeId) => {
    const recipe = recipeById.get(recipeId);
    recipeBreakdown.push({
      recipeId,
      recipeName: recipe?.name ?? null,
      printCount,
      // 印刷後にレシピ自体が完全削除されている場合、材料内訳は計算できない
      // （非表示レシピを全て完全に削除／全データクリアして上書き、等で発生しうる）
      recipeDeleted: !recipe,
    });
    if (!recipe || !recipe.unitCount || recipe.unitCount <= 0) return;
    for (const ing of recipe.ingredients) {
      const name = ing.ingredient?.name || ing.ingredientNameOverride || '（材料名未設定）';
      const key = `${name}__${ing.unit}`;
      const consumed = (Number(ing.amount) / recipe.unitCount) * printCount;
      const existing = totals.get(key);
      if (existing) existing.amount += consumed;
      else totals.set(key, { ingredientName: name, unit: ing.unit, amount: consumed });
    }
  });

  const ingredients = Array.from(totals.values())
    .map(t => ({ ...t, amount: Math.round(t.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  recipeBreakdown.sort((a, b) => b.printCount - a.printCount);

  const totalPrintCount = rows.reduce((sum, r) => sum + r.total, 0);

  return NextResponse.json({
    success: true,
    data: { canUse: true, ingredients, recipes: recipeBreakdown, totalPrintCount },
  });
}
