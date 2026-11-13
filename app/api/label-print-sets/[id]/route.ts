// ============================================================
// app/api/label-print-sets/[id]/route.ts - まとめてラベル印刷のセット 削除（2026-11新設）
// ============================================================
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, props: Params) {
  const params = await props.params;
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  // 他ユーザーのセットを消せないよう userId も条件に含める
  const result = await prisma.labelPrintSet.deleteMany({ where: { id: params.id, userId: session.user.id } });
  if (result.count === 0) return NextResponse.json({ success: false, error: 'セットが見つかりません' }, { status: 404 });
  return NextResponse.json({ success: true });
}
