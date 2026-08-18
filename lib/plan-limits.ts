// lib/plan-limits.ts
import { prisma } from '@/lib/db';

export const PLAN_LIMITS = {
  free: {
    maxRecipes:    10,
    maxLabelPrints: 20,   // 月間
    maxShops:      1,
    canExport:     false,
    hasAds:        true,
  },
  premium: {
    // 2026-08時点: プロプラン新設に向けて、プレミアムのレシピ数・店舗数に上限を設定。
    // ラベル印刷枚数はサーバー負荷的にコストが小さく、既存の「無制限」表示を維持するため据え置き。
    maxRecipes:    100,
    maxLabelPrints: Infinity,
    maxShops:      3,
    canExport:     true,
    hasAds:        false,
  },
  admin: {
    maxRecipes:    Infinity,
    maxLabelPrints: Infinity,
    maxShops:      Infinity,
    canExport:     true,
    hasAds:        false,
  },
};

export type PlanKey = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as PlanKey] ?? PLAN_LIMITS.free;
}

export function isPremium(plan: string) {
  return plan === 'premium' || plan === 'admin';
}

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
