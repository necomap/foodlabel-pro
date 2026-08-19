// app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';
import { isPaidPlan, getPriceIdForPlan, type PaidPlan } from '@/lib/stripe-plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  // どのプランに申し込むか（'premium' | 'pro'）。未指定・不正値の場合は premium にフォールバック
  // （2026-08以前はプレミアム固定だったため、旧クライアント・キャッシュされた古いUIからの
  // リクエストでも壊れないようにするための後方互換）。
  let requestedPlan: PaidPlan = 'premium';
  try {
    const body = await request.json();
    if (isPaidPlan(body?.plan)) requestedPlan = body.plan;
  } catch { /* ボディなし＝premium扱い（後方互換） */ }

  // 既にプレミアム/プロ/管理者の場合はチェックアウトではなく請求ポータル（プラン変更・解約・
  // 支払い方法変更）を使ってもらう。既存契約者に対して新規チェックアウトを走らせると、
  // 二重にサブスクリプションが作成されてしまうため、ここでは常にブロックする
  // （プレミアム→プロのアップグレードは、Stripeの請求ポータル側で「プランの変更」を
  // 有効化しておくことで、コード側の複雑な按分（プロレーション）処理無しに対応する）。
  const currentPlan = (session.user as any).plan;
  if (currentPlan === 'premium' || currentPlan === 'pro' || currentPlan === 'admin') {
    return NextResponse.json({ success: false, error: '既に有料プランです。プラン変更・請求管理からご確認ください' }, { status: 400 });
  }

  const priceId = getPriceIdForPlan(requestedPlan);
  if (!priceId) return NextResponse.json({ success: false, error: 'Stripe未設定' }, { status: 500 });

  // 「初月500円」お試し価格は、これまでに一度もサブスクリプション（subscriptionsテーブルの行）を
  // 持ったことがないユーザーだけに適用する。この判定が無いと、解約→再登録を繰り返すことで
  // 何度でも500円が使えてしまう。STRIPE_TRIAL_COUPON_ID未設定の場合は通常価格のみ（お試し無効）。
  // このクーポンはプレミアム（¥980）向けの固定額割引のため、プロプランには適用しない
  // （そのまま適用すると割引後価格の意図がずれてしまうため）。
  const priorSubscription = await prisma.subscription.findFirst({ where: { userId: session.user.id } });
  const trialCouponId = process.env.STRIPE_TRIAL_COUPON_ID;
  const applyTrialDiscount = requestedPlan === 'premium' && !priorSubscription && !!trialCouponId;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode:         'subscription',
      payment_method_types: ['card'],
      line_items:   [{ price: priceId, quantity: 1 }],
      ...(applyTrialDiscount && trialCouponId ? { discounts: [{ coupon: trialCouponId }] } : {}),
      success_url:  `${process.env.NEXTAUTH_URL}/dashboard/recipes?upgraded=1`,
      cancel_url:   `${process.env.NEXTAUTH_URL}/dashboard/upgrade`,
      client_reference_id: session.user.id,
      customer_email: session.user.email,
      // metadata.plan は webhook 側で価格IDからプランを逆引きできなかった場合
      // （環境変数の設定漏れ等）のフォールバックとして使う
      metadata: { userId: session.user.id, plan: requestedPlan },
      locale: 'ja',
    });
    return NextResponse.json({ success: true, url: checkoutSession.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({
      success: false,
      error: err?.message ?? '決済処理でエラーが発生しました',
    }, { status: 500 });
  }
}
