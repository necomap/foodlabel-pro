// ============================================================
// app/api/label-templates/[id]/route.ts - ラベルデザインテンプレート更新・削除
// ============================================================
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';

type Params = { params: { id: string } };

const updateSchema = z.object({
  name:   z.string().min(1).max(100).optional(),
  config: z.record(z.any()).optional(),
});

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const limits = getPlanLimits((session.user as any).plan ?? 'free');
  if (!limits.canUseLabelTemplates) {
    return NextResponse.json({ success: false, error: 'Proプラン限定機能です', upgradeRequired: true }, { status: 403 });
  }

  // 他ユーザーのテンプレートを更新できないよう、userIdも条件に含めて所有者チェックを兼ねる
  const existing = await prisma.labelTemplate.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ success: false, error: 'テンプレートが見つかりません' }, { status: 404 });

  const body   = await request.json();
  const result = updateSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });

  const updated = await prisma.labelTemplate.update({
    where: { id: params.id },
    data: {
      ...(result.data.name   !== undefined ? { name: result.data.name.trim() } : {}),
      ...(result.data.config !== undefined ? { config: result.data.config }    : {}),
    },
  });

  return NextResponse.json({ success: true, data: { id: updated.id, name: updated.name, config: updated.config } });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const existing = await prisma.labelTemplate.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ success: false, error: 'テンプレートが見つかりません' }, { status: 404 });

  await prisma.labelTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
