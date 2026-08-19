// ============================================================
// lib/stripe-plans.ts - 課金プラン（premium/pro）とStripe価格IDの対応表
// ============================================================
//
// 2026-08 プロプラン新設に伴い、Stripeの価格IDが複数（プレミアム/プロ）になったため、
// 「どの価格IDがどのプランに対応するか」をここに一元化する。
// checkout（新規申込）・webhook（決済結果の反映）の両方から参照する。

export type PaidPlan = 'premium' | 'pro';

export const PAID_PLANS: PaidPlan[] = ['premium', 'pro'];

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === 'premium' || value === 'pro';
}

// プラン→Stripe価格ID（環境変数）
export function getPriceIdForPlan(plan: PaidPlan): string | undefined {
  if (plan === 'premium') return process.env.STRIPE_PREMIUM_PRICE_ID;
  if (plan === 'pro')     return process.env.STRIPE_PRO_PRICE_ID;
  return undefined;
}

// Stripe価格ID→プラン（Webhookで「このサブスクリプションはどのプランか」を判定するために使う）
// 未知の価格ID（環境変数の設定漏れ・旧価格など）の場合はnullを返す。
export function resolvePlanFromPriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return 'premium';
  if (priceId === process.env.STRIPE_PRO_PRICE_ID)     return 'pro';
  return null;
}
