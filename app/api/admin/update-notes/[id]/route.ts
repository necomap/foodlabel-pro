// app/api/admin/update-notes/[id]/route.ts
// 個別の更新情報の編集・公開/下書き切り替え・削除。
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  const body = await request.json();
  const data: { title?: string; body?: string; publishedAt?: Date | null } = {};

  if (typeof body.title === 'string') {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ success: false, error: 'タイトルを入力してください' }, { status: 400 });
    data.title = title;
  }
  if (typeof body.body === 'string') {
    const text = body.body.trim();
    if (!text) return NextResponse.json({ success: false, error: '本文を入力してください' }, { status: 400 });
    data.body = text;
  }

  // 公開/下書きの切り替え。一度公開した日時はそのまま保持し（再公開時のみ現在時刻に更新）、
  // 下書きに戻すとnullにしてユーザー向け一覧から外れる。
  if (body.publish === true) {
    const existing = await prisma.updateNote.findUnique({ where: { id: params.id }, select: { publishedAt: true } });
    if (!existing) return NextResponse.json({ success: false, error: '見つかりません' }, { status: 404 });
    data.publishedAt = existing.publishedAt ?? new Date();
  } else if (body.publish === false) {
    data.publishedAt = null;
  }

  try {
    const note = await prisma.updateNote.update({ where: { id: params.id }, data });
    return NextResponse.json({ success: true, data: note });
  } catch {
    return NextResponse.json({ success: false, error: '更新に失敗しました' }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  try {
    await prisma.updateNote.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: '削除に失敗しました' }, { status: 404 });
  }
}
