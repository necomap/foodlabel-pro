// lib/plan-limits.ts
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
