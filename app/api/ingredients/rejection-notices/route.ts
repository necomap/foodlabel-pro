// ============================================================
// app/api/ingredients/rejection-notices/route.ts
// 共有食材の却下をアプリ内でユーザーに通知するためのAPI。
// GET  : まだ確認していない却下（rejectionSeen:false）の一覧を返す
// POST : 通知を確認済みにする（rejectionSeen:trueに更新）
// ============================================================
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getRejectionReasonLabel } from '@/lib/ingredient-rejection-reasons';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const rejected = await prisma.ingredient.findMany({
    where: {
      userId: session.user.id,
      rejectionSeen: false,
      rejectionReason: { not: null },
    },
    select: { id: true, name: true, rejectionReason: true, rejectionNote: true, rejectedAt: true },
    orderBy: { rejectedAt: 'desc' },
  });

  return NextResponse.json({
    success: true,
    data: rejected.map(r => ({
      id:                   r.id,
      name:                 r.name,
      rejectionReasonLabel: getRejectionReasonLabel(r.rejectionReason),
      rejectionNote:        r.rejectionNote,
      rejectedAt:           r.rejectedAt,
    })),
  });
}

const dismissSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const body   = await request.json();
  const result = dismissSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });
  }

  // 自分の食材だけを確認済みにできる（他ユーザーの通知を消せないように）
  await prisma.ingredient.updateMany({
    where: { id: { in: result.data.ids }, userId: session.user.id },
    data:  { rejectionSeen: true },
  });

  return NextResponse.json({ success: true });
}
