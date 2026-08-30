// app/api/admin/update-notes/route.ts
// 管理画面「更新情報の管理」用。下書き含む全件の取得と新規作成。
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  const notes = await prisma.updateNote.findMany({
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ success: true, data: notes });
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  const body  = await request.json();
  const title = (body.title ?? '').trim();
  const text  = (body.body  ?? '').trim();

  if (!title) return NextResponse.json({ success: false, error: 'タイトルを入力してください' }, { status: 400 });
  if (!text)  return NextResponse.json({ success: false, error: '本文を入力してください' }, { status: 400 });

  const note = await prisma.updateNote.create({
    data: {
      title,
      body: text,
      // 作成と同時に公開する場合のみpublishedAtをセット。下書き保存はnullのまま。
      publishedAt: body.publish ? new Date() : null,
    },
  });

  return NextResponse.json({ success: true, data: note });
}
