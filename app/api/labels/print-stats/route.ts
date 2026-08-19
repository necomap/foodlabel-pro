// app/api/labels/print-stats/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false }, { status: 401 });

  const limits = getPlanLimits(session.user.plan ?? 'free');

  // 今日の印刷枚数を取得（プレミアム・フリー共通）
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayResult = await prisma.$queryRaw`
    SELECT COALESCE(SUM("printCount"), 0) as total
    FROM label_print_logs
    WHERE "userId" = ${session.user.id}
    AND "createdAt" >= ${today}
  ` as any[];
  const todayCount = Number(todayResult[0]?.total ?? 0);

  if (limits.maxLabelPrints === Infinity) {
    // 今月合計も取得
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthResult = await prisma.$queryRaw`
      SELECT COALESCE(SUM("printCount"), 0) as total
      FROM label_print_logs
      WHERE "userId" = ${session.user.id}
      AND "createdAt" >= ${firstOfMonth}
    ` as any[];
    const monthUsed = Number(monthResult[0]?.total ?? 0);
    return NextResponse.json({
      success: true,
      data: { used: monthUsed, limit: Infinity, resetDate: '-', isPremium: true, todayCount, canUseLotTracking: limits.canUseLotTracking },
    });
  }

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDate = `${firstOfNextMonth.getFullYear()}/${String(firstOfNextMonth.getMonth() + 1).padStart(2, '0')}/${String(firstOfNextMonth.getDate()).padStart(2, '0')}`;

  const result = await prisma.$queryRaw`
    SELECT COALESCE(SUM("printCount"), 0) as total
    FROM label_print_logs
    WHERE "userId" = ${session.user.id}
    AND "createdAt" >= ${firstOfMonth}
  ` as any[];

  const used = Number(result[0]?.total ?? 0);

  return NextResponse.json({
    success: true,
    data: {
      used,
      limit: limits.maxLabelPrints,
      resetDate,
      isPremium: false,
      todayCount,
      canUseLotTracking: limits.canUseLotTracking,
    },
  });
}
