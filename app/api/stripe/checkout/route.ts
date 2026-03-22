// app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!priceId) return NextResponse.json({ success: false, error: 'Stripe未設定' }, { status: 500 });

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode:         'subscription',
      payment_method_types: ['card'],
      line_items:   [{ price: priceId, quantity: 1 }],
      success_url:  `${process.env.NEXTAUTH_URL}/dashboard/recipes?upgraded=1`,
      cancel_url:   `${process.env.NEXTAUTH_URL}/dashboard/upgrade`,
      client_reference_id: session.user.id,
      customer_email: session.user.email,
      metadata: { userId: session.user.id },
      locale: 'ja',
    });
    return NextResponse.json({ success: true, url: checkoutSession.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
