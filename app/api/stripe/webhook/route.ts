// app/api/stripe/webhook/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });

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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId  = session.metadata?.userId ?? session.client_reference_id;
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: 'premium',
              stripeCustomerId:       session.customer as string,
              stripeSubscriptionId:   session.subscription as string,
              subscriptionStatus:     'active',
            },
          });
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data:  { plan: 'free', subscriptionStatus: 'canceled' },
        });
        break;
      }
      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription;
        const status = sub.status === 'active' ? 'active' : sub.status;
        const plan   = sub.status === 'active' ? 'premium' : 'free';
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data:  { plan, subscriptionStatus: status },
        });
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}


