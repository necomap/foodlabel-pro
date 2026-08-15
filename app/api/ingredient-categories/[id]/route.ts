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

  // 自分専用カテゴリは本人のみ、全ユーザー共通の基本カテゴリ（userId IS NULL）は管理者のみ編集可。
  const isAdmin = (session.user as any).plan === 'admin';
  try {
    const affected = await prisma.$executeRaw`
      UPDATE ingredient_categories SET name = ${name.trim()}
      WHERE id::text = ${params.id}
        AND ("userId" = ${session.user.id} OR ("userId" IS NULL AND ${isAdmin}))
    `;
    if (affected === 0) {
      return NextResponse.json({ success: false, error: 'このカテゴリを編集する権限がありません' }, { status: 403 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const isAdmin = (session.user as any).plan === 'admin';
  try {
    const affected = await prisma.$executeRaw`
      UPDATE ingredient_categories SET "isActive" = false
      WHERE id::text = ${params.id}
        AND ("userId" = ${session.user.id} OR ("userId" IS NULL AND ${isAdmin}))
    `;
    if (affected === 0) {
      return NextResponse.json({ success: false, error: 'このカテゴリを削除する権限がありません' }, { status: 403 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
