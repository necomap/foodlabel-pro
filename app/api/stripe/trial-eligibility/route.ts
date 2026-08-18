// app/api/stripe/trial-eligibility/route.ts
// アップグレード画面で「初月500円」の案内を出してよいかどうかを判定するAPI。
// 判定基準は /api/stripe/checkout と同じ：これまでに一度もサブスクリプション
// （subscriptionsテーブルの行）を持ったことがないユーザーだけを対象にする。
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const priorSubscription = await prisma.subscription.findFirst({ where: { userId: session.user.id } });
  const eligible = !priorSubscription && !!process.env.STRIPE_TRIAL_COUPON_ID;
  return NextResponse.json({ success: true, eligible });
}
