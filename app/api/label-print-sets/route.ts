// ============================================================
// app/api/label-print-sets/route.ts - まとめてラベル印刷のセット 一覧・保存（2026-11新設）
// ============================================================
// 「朝の焼き菓子セット」のように名前を付けて「レシピと枚数」を保存する。期限日は保存しない
// （呼び出し時に製造日＋各レシピの日数で再計算する）。複数端末・複数人で使えるようDBに保存。
// 同じ名前のセットがあれば上書きする（「上書き保存」と「新規保存」を1つの操作にまとめるため）。

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 際限なく作られるのを防ぐための上限
const MAX_SETS = 50;

const setItemsSchema = z.array(z.object({
  recipeId: z.string().min(1),
  count:    z.number().int().min(1).max(999),
})).min(1, 'レシピが1件もありません').max(100);

const createSchema = z.object({
  name:  z.string().trim().min(1, 'セット名を入力してください').max(100, 'セット名は100文字以内にしてください'),
  items: setItemsSchema,
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const sets = await prisma.labelPrintSet.findMany({
    where:   { userId: session.user.id },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({
    success: true,
    data: sets.map(s => ({ id: s.id, name: s.name, items: s.items, updatedAt: s.updatedAt })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const body   = await request.json();
  const result = createSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });
  const { name, items } = result.data;

  const existing = await prisma.labelPrintSet.findFirst({ where: { userId: session.user.id, name } });
  if (existing) {
    const updated = await prisma.labelPrintSet.update({ where: { id: existing.id }, data: { items } });
    return NextResponse.json({ success: true, data: { id: updated.id, name: updated.name, items: updated.items, updatedAt: updated.updatedAt, overwritten: true } });
  }

  const count = await prisma.labelPrintSet.count({ where: { userId: session.user.id } });
  if (count >= MAX_SETS) {
    return NextResponse.json({ success: false, error: `セットは${MAX_SETS}件まで保存できます。不要なセットを削除してください` }, { status: 400 });
  }
  const created = await prisma.labelPrintSet.create({ data: { userId: session.user.id, name, items } });
  return NextResponse.json({ success: true, data: { id: created.id, name: created.name, items: created.items, updatedAt: created.updatedAt, overwritten: false } });
}
