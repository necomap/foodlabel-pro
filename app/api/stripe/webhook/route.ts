// app/api/stripe/webhook/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { resolvePlanFromPriceId, isPaidPlan } from '@/lib/stripe-plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

export async function POST(request: Request) {
  const body = await request.text();
  const sig  = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    if (!sig || !webhookSecret) throw new Error('No signature or webhook secret');
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // 注意（重要・再発防止）: usersテーブルには "stripeSubscriptionId" / "subscriptionStatus" という
  // 列は存在しない（schema.prisma・schema.sql両方で確認済み。存在するのは"stripeCustomerId"と
  // "plan"だけ）。サブスクリプションの詳細（Stripeのサブスクリプション自体・価格・状態）は
  // 別途用意されている subscriptions テーブルで管理する。以前はここで存在しない列をraw SQLで
  // UPDATEしようとしており、Postgresのエラー（column does not exist）で毎回失敗していた。
  // にもかかわらず外側のtry/catchで握りつぶされ500を返すだけだったため、決済が完了しても
  // ユーザーのplanが実際にはpremiumへ更新されていなかった（＝課金フローが根本的に機能していなかった）。
  try {
    switch (event.type) {
      // 決済完了（Checkoutでのサブスクリプション新規作成）
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const userId = checkoutSession.metadata?.userId ?? checkoutSession.client_reference_id;
        const stripeSubscriptionId = checkoutSession.subscription as string | null;
        const stripeCustomerId = checkoutSession.customer as string | null;
        if (userId && stripeSubscriptionId) {
          // 価格ID・状態などサブスクリプションの詳細を取得（Checkoutセッションのイベント本体には
          // サブスクリプションIDしか含まれないため）
          const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const priceId = sub.items.data[0]?.price?.id ?? null;

          // 2026-08 プロプラン新設: どのプランかは価格IDから逆引きする（プレミアム/プロで
          // 価格IDが異なるため）。価格IDが未登録・環境変数の設定漏れ等で解決できない場合のみ、
          // Checkoutセッション作成時にセットしたmetadata.planをフォールバックとして使う。
          // それも無ければ従来どおりpremium扱い（後方互換）。
          const metaPlan = checkoutSession.metadata?.plan;
          const plan = resolvePlanFromPriceId(priceId) ?? (isPaidPlan(metaPlan) ? metaPlan : 'premium');

          await prisma.user.update({
            where: { id: userId },
            data: {
              plan,
              ...(stripeCustomerId ? { stripeCustomerId } : {}),
            },
          });

          // 同じstripeSubscriptionIdで既にレコードがあれば更新、無ければ新規作成（Webhookの
          // 再送・リトライに対してべき等になるようupsertにしている）
          await prisma.subscription.upsert({
            where: { stripeSubscriptionId },
            create: {
              userId, stripeSubscriptionId, stripePriceId: priceId,
              plan, status: sub.status,
            },
            update: {
              stripePriceId: priceId, plan, status: sub.status,
            },
          });
        }
        break;
      }

      // 解約・一時停止
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const sub = event.data.object as Stripe.Subscription;
        // subscriptionsテーブル側でこのStripeサブスクリプションIDに紐づくuserIdを引いてから、
        // そのユーザーのplanをfreeに戻す（以前はusers.stripeSubscriptionIdで検索していたが、
        // その列自体がusersテーブルに存在しないため常にヒットせず、実質何もしていなかった＝
        // 解約してもplanがpremiumのまま残ってしまう不具合だった）。
        const existing = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
        if (existing) {
          const status = event.type === 'customer.subscription.paused' ? 'paused' : 'canceled';
          await prisma.subscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: { status, plan: 'free' },
          });
          await prisma.user.update({ where: { id: existing.userId }, data: { plan: 'free' } });
        }
        break;
      }

      // プラン変更・更新（お試し価格クーポンの初回請求後に通常価格へ切り替わる際や、
      // 支払い失敗によるpast_due等のステータス変化を含む）
      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription;
        const status = sub.status;
        const priceId = sub.items.data[0]?.price?.id ?? null;
        // 2026-08 プロプラン新設: プレミアム⇄プロの切り替え（Stripe請求ポータルでの「プラン変更」）も
        // このイベントで届く。価格IDから現在のプランを都度判定し直すことで、切り替え後の価格に
        // 追従する（解決できない価格IDの場合は、既存レコードのプランをそのまま維持する）。
        const existing = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
        const resolvedPlan = resolvePlanFromPriceId(priceId);
        const plan: 'premium' | 'pro' | 'free' = (status === 'active' || status === 'trialing')
          ? (resolvedPlan ?? (isPaidPlan(existing?.plan) ? existing!.plan : 'premium'))
          : 'free';

        if (existing) {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: { stripePriceId: priceId, plan, status },
          });
          await prisma.user.update({ where: { id: existing.userId }, data: { plan } });
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}


