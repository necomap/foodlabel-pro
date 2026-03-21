// app/api/categories/route.ts - カテゴリ一覧API
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ownOnly = searchParams.get('own') === 'true';

  const where = ownOnly
    ? { isActive: true, userId: session.user.id }
    : { isActive: true, OR: [{ userId: null as string|null }, { userId: session.user.id }] };

  const cats = await prisma.category.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, sortOrder: true },
  });

  return NextResponse.json({ success: true, data: cats });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ success: false, error: 'カテゴリ名を入力してください' }, { status: 400 });

  const cat = await prisma.category.create({
    data: { userId: session.user.id, name: name.trim() },
  });
  return NextResponse.json({ success: true, data: { id: cat.id, name: cat.name } });
}
