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
    maxRecipes:    Infinity,
    maxLabelPrints: Infinity,
    maxShops:      Infinity,
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
