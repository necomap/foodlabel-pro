// app/api/stripe/portal/route.ts - 請求管理ポータル
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ success: false, error: 'サブスクリプションが見つかりません' }, { status: 404 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   user.stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/dashboard/settings`,
  });
  return NextResponse.json({ success: true, url: portalSession.url });
}
