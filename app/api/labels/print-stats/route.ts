// app/api/labels/print-stats/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false }, { status: 401 });

  const limits = getPlanLimits(session.user.plan ?? 'free');

  if (limits.maxLabelPrints === Infinity) {
    return NextResponse.json({
      success: true,
      data: { used: 0, limit: Infinity, resetDate: '-', isPremium: true },
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
    },
  });
}
