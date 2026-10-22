// app/api/recipes/[id]/label-check/route.ts
// 2026-10-22新設: 表示内容の確認記録（簡易承認）を保存・取り消しする（詳細は lib/label-check.ts）。
// ハッシュはレシピ詳細APIが返した値（画面に表示していた内容）をそのまま受け取って保存する。
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const recipe = await prisma.recipe.findFirst({ where: { id: params.id, userId: session.user.id }, select: { id: true } });
  if (!recipe) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const hash = typeof body.labelHash === 'string' ? body.labelHash.slice(0, 64) : '';
  const checkedBy = (typeof body.checkedBy === 'string' ? body.checkedBy.trim() : '').slice(0, 100);
  if (!hash) return NextResponse.json({ success: false, error: '確認する内容が取得できませんでした。画面を再読み込みしてください' }, { status: 400 });
  if (!checkedBy) return NextResponse.json({ success: false, error: '確認者の名前を入力してください' }, { status: 400 });

  const now = new Date();
  await prisma.recipe.update({
    where: { id: params.id },
    data: { labelCheckedAt: now, labelCheckedBy: checkedBy, labelCheckedHash: hash },
  });
  return NextResponse.json({ success: true, message: '表示内容を確認済みにしました', data: { checkedAt: now, checkedBy } });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
  const recipe = await prisma.recipe.findFirst({ where: { id: params.id, userId: session.user.id }, select: { id: true } });
  if (!recipe) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });
  await prisma.recipe.update({ where: { id: params.id }, data: { labelCheckedAt: null, labelCheckedBy: null, labelCheckedHash: null } });
  return NextResponse.json({ success: true, message: '確認記録を取り消しました' });
}
