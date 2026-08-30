// app/api/update-notes/route.ts
// ダッシュボードの「更新情報」ページ用。ログイン済みユーザーなら誰でも閲覧可（公開済みのみ返す）
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 });

  const notes = await prisma.updateNote.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, title: true, body: true, publishedAt: true },
    take: 100,
  });

  return NextResponse.json({ success: true, data: notes });
}
