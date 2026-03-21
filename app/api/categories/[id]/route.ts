// app/api/categories/[id]/route.ts - カテゴリ更新・削除
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Params = { params: { id: string } };

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ success: false, error: 'カテゴリ名を入力してください' }, { status: 400 });

  const cat = await prisma.category.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!cat) return NextResponse.json({ success: false, error: 'カテゴリが見つかりません' }, { status: 404 });

  await prisma.category.update({ where: { id: params.id }, data: { name: name.trim() } });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const cat = await prisma.category.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!cat) return NextResponse.json({ success: false, error: 'カテゴリが見つかりません' }, { status: 404 });

  // レシピが紐づいているか確認
  const recipeCount = await prisma.recipe.count({ where: { categoryId: params.id, isActive: true } });
  if (recipeCount > 0) {
    return NextResponse.json({ success: false, error: `このカテゴリには${recipeCount}件のレシピが紐づいています` }, { status: 400 });
  }

  await prisma.category.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
