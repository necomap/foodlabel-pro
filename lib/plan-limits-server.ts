// lib/plan-limits-server.ts
//
// 2026-09新設: lib/plan-limits.tsのうちPrisma（DB）を使う関数だけをこちらに分離した。
// lib/plan-limits.ts側にprisma importが残っていると、そのファイルはクライアント
// コンポーネント（'use client'）からimportできず、Pro限定機能フラグの判定が
// 画面側で直書きされる二重管理の原因になっていた。サーバー専用コード（APIルート等）
// からはこちらをimportすること。
import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';

// ============================================================
// プラン上限超過による「読み取り専用」レシピの判定
// ============================================================
//
// 2026-08 再発防止コメント: 以前は一覧API（GET /api/recipes）側で、その時点で
// 「表示中の1ページ分（最大perPage件）」だけを対象に古い順readOnly判定をしていた。
// これだと、ユーザーがレシピをperPage件（一覧のデフォルトは24件）より多く持っている場合、
// ①ページによってreadOnlyの判定結果がぶれる、②編集API・ラベル印刷APIには元々何の
// 制限もかかっておらず、一覧のバッジ表示だけの「見た目上の」制限に過ぎなかった
// （プレミアム→解約でフリープランに戻っても、既存レシピは何件あっても全件編集・印刷し放題だった）
// という2つの問題があった。
//
// この関数で「そのユーザーの全アクティブレシピ」を対象に一括判定し、一覧表示・編集ブロックの
// 両方から同じ結果を参照することで、上の2つの問題をまとめて解消する。
// 判定基準は変更前と同じ「作成日が古い順に、上限を超えた分だけreadOnly」。
export async function getReadOnlyRecipeIds(userId: string, plan: string): Promise<Set<string>> {
  const limits = getPlanLimits(plan);
  if (limits.maxRecipes === Infinity) return new Set();

  const recipes = await prisma.recipe.findMany({
    where:   { userId, isActive: true },
    select:  { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (recipes.length <= limits.maxRecipes) return new Set();

  // createdAt昇順（古い順）なので、先頭から「件数 - 上限」件が上限超過分＝読み取り専用
  const excessCount = recipes.length - limits.maxRecipes;
  return new Set(recipes.slice(0, excessCount).map(r => r.id));
}

// ============================================================
// Excelインポート・エクスポートの月間回数カウント（2026-08新設）
// ============================================================
//
// プレミアムプランとプロプランの差別化のため、インポート・エクスポートそれぞれに
// 月間の実行回数上限を設けた（label_print_logsの印刷枚数カウントと同じ考え方）。
// 1回の呼び出し＝1回とカウントする（エクスポートするレシピ件数やインポート件数では
// なく、機能を実行した回数）。data_transfer_logsテーブルに記録する。
export async function getMonthlyDataTransferCount(userId: string, type: 'export' | 'import'): Promise<number> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const result = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM data_transfer_logs
    WHERE "userId" = ${userId} AND "type" = ${type} AND "createdAt" >= ${firstOfMonth}
  ` as any[];
  return Number(result[0]?.count ?? 0);
}

export async function logDataTransfer(userId: string, type: 'export' | 'import'): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO data_transfer_logs ("userId", "type", "createdAt")
      VALUES (${userId}, ${type}, NOW())
    `;
  } catch (e) { console.warn('data transfer log error:', e); }
}
