// app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  // 既にプレミアム/管理者の場合はチェックアウトではなく請求ポータル（解約・支払い方法変更）を使ってもらう
  const currentPlan = (session.user as any).plan;
  if (currentPlan === 'premium' || currentPlan === 'admin') {
    return NextResponse.json({ success: false, error: '既にプレミアムプランです。請求管理からご確認ください' }, { status: 400 });
  }

  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!priceId) return NextResponse.json({ success: false, error: 'Stripe未設定' }, { status: 500 });

  // 「初月500円」お試し価格は、これまでに一度もサブスクリプション（subscriptionsテーブルの行）を
  // 持ったことがないユーザーだけに適用する。この判定が無いと、解約→再登録を繰り返すことで
  // 何度でも500円が使えてしまう。STRIPE_TRIAL_COUPON_ID未設定の場合は通常価格のみ（お試し無効）。
  const priorSubscription = await prisma.subscription.findFirst({ where: { userId: session.user.id } });
  const trialCouponId = process.env.STRIPE_TRIAL_COUPON_ID;
  const applyTrialDiscount = !priorSubscription && !!trialCouponId;

  // ---- 一時デバッグ用（原因特定後に必ず削除すること）----
  // 「No such coupon」エラーの原因切り分け用。実際にサーバーが読み込んだ環境変数の値を
  // そのままログ・レスポンスに出す（coupon IDは秘密情報ではないので露出しても問題ない）。
  console.log('[DEBUG] STRIPE_TRIAL_COUPON_ID raw value:', JSON.stringify(trialCouponId));
  console.log('[DEBUG] length:', trialCouponId?.length, 'applyTrialDiscount:', applyTrialDiscount, 'priorSubscription found:', !!priorSubscription);
  // ---- デバッグ用ここまで ----

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
      metadata: { userId: session.user.id },
      locale: 'ja',
    });
    return NextResponse.json({ success: true, url: checkoutSession.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    // 一時デバッグ用：エラー本文とcoupon IDをそのまま画面のトーストに出す（原因特定後に戻すこと）
    const message = err?.message ?? String(err);
    return NextResponse.json({
      success: false,
      error: `${message} [debug: couponId="${trialCouponId}" applyTrialDiscount=${applyTrialDiscount}]`,
    }, { status: 500 });
  }
}
