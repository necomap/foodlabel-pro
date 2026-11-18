// ============================================================
// app/api/recipes/pop/route.ts - POP・プライスカード用のデータ取得API（2026-11新設・全プラン）
// ============================================================
// GET ?ids=<recipeId>,<recipeId>...（最大100件）
// 商品名・販売価格・アレルゲン（ラベルと同じ集計）・おすすめポイントを返す。価格の税込/税抜の扱いは画面側で設定する。
// PATCH { id, popPoint } … おすすめポイントだけを保存（レシピ編集画面と同じ recipes.popPoint を更新。2026-11-18）

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getRecipeAllergenSummaries } from '@/lib/recipe-allergen-summary';

const MAX_IDS = 100;

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ids = Array.from(new Set((searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean)));
  if (ids.length === 0) return NextResponse.json({ success: false, error: 'レシピが指定されていません' }, { status: 400 });
  if (ids.length > MAX_IDS) return NextResponse.json({ success: false, error: `一度に作成できるのは${MAX_IDS}件までです` }, { status: 400 });

  const found = await getRecipeAllergenSummaries(session.user.id, { id: { in: ids } }, MAX_IDS);
  // 選んだ順に並べる
  const order = new Map(ids.map((id, i) => [id, i]));
  found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const points = await prisma.recipe.findMany({
    where: { userId: session.user.id, id: { in: found.map(f => f.id) } },
    select: { id: true, popPoint: true },
  });
  const pointMap = new Map(points.map(p => [p.id, p.popPoint]));
  const items = found.map(f => ({ ...f, popPoint: pointMap.get(f.id) ?? null }));

  return NextResponse.json({ success: true, data: { items } });
}

const MAX_POINT = 100;

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id || (body.popPoint != null && typeof body.popPoint !== 'string')) {
    return NextResponse.json({ success: false, error: '入力内容が正しくありません' }, { status: 400 });
  }
  const popPoint = (body.popPoint ?? '').trim();
  if (popPoint.length > MAX_POINT) {
    return NextResponse.json({ success: false, error: `おすすめポイントは${MAX_POINT}文字までです` }, { status: 400 });
  }

  // 自分のレシピだけ更新（updatedAt はレシピ一覧の並び順に使うので変えない）
  const r = await prisma.recipe.findFirst({ where: { id, userId: session.user.id }, select: { updatedAt: true } });
  if (!r) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });
  await prisma.recipe.update({ where: { id }, data: { popPoint: popPoint || null, updatedAt: r.updatedAt } });

  return NextResponse.json({ success: true, data: { id, popPoint: popPoint || null } });
}
