// app/api/ingredient-categories/[id]/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Params = { params: { id: string } };

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ success: false, error: 'カテゴリ名を入力してください' }, { status: 400 });
  try {
    await prisma.$executeRaw`
      UPDATE ingredient_categories SET name = ${name.trim()}
      WHERE id::text = ${params.id} AND user_id = ${session.user.id}
    `;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
  try {
    await prisma.$executeRaw`
      UPDATE ingredient_categories SET is_active = false
      WHERE id::text = ${params.id} AND user_id = ${session.user.id}
    `;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
