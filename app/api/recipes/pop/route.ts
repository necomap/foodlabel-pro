// ============================================================
// app/api/recipes/pop/route.ts - POP・プライスカード用のデータ取得API（2026-11新設・全プラン）
// ============================================================
// GET ?ids=<recipeId>,<recipeId>...（最大100件）
// 商品名・販売価格・アレルゲン（ラベルと同じ集計）を返す。価格の税込/税抜の扱いは画面側で設定する。

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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

  return NextResponse.json({ success: true, data: { items: found } });
}
