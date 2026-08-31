// ============================================================
// app/api/recipes/bulk-hide/route.ts - レシピの一括非表示・元に戻す（2026-08新設）
// ============================================================
// レシピ一覧でチェックボックス選択→複数件まとめて非表示にする機能（Pro限定）。
// レシピ件数が多いプロプランのユーザーから「非表示にしたいレシピが多く、1件ずつ
// 非表示ボタンを押すのが手間」という要望を受けて追加。
//
// POST: 選択されたレシピをまとめて非表示（isActive: false）にする。Pro限定。
// PATCH: POST（または個別の非表示ボタン）で非表示にしたレシピを元に戻す（isActive: true）。
//        「間違えて非表示にした場合の取り消し」専用の操作のため、非表示化自体とは違い
//        プラン制限をかけない（誰でも自分が非表示にしたものは取り消せる）。

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';

const idsSchema = z.object({
  ids: z.array(z.string()).min(1, '対象のレシピが選択されていません').max(500),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const limits = getPlanLimits((session.user as any).plan ?? 'free');
  if (!limits.canUseBulkHide) {
    return NextResponse.json({
      success: false,
      error: 'レシピの一括非表示はProプラン限定機能です',
      upgradeRequired: true,
    }, { status: 403 });
  }

  const body   = await request.json().catch(() => null);
  const result = idsSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });

  // 自分の所有かつ現在表示中（isActive: true）のレシピのみ対象にする
  // （すでに非表示のものを含めても実害はないが、undoトーストのidsを実際に変更した
  // レシピだけに揃えるため、対象を絞ってから更新する）
  const targets = await prisma.recipe.findMany({
    where: { id: { in: result.data.ids }, userId: session.user.id, isActive: true },
    select: { id: true },
  });
  if (targets.length === 0) {
    return NextResponse.json({ success: true, data: { hiddenIds: [] }, message: '対象のレシピがありませんでした' });
  }
  const targetIds = targets.map(t => t.id);

  await prisma.recipe.updateMany({
    where: { id: { in: targetIds }, userId: session.user.id },
    data:  { isActive: false },
  });

  return NextResponse.json({ success: true, data: { hiddenIds: targetIds } });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const body   = await request.json().catch(() => null);
  const result = idsSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });

  const targets = await prisma.recipe.findMany({
    where: { id: { in: result.data.ids }, userId: session.user.id, isActive: false },
    select: { id: true },
  });
  if (targets.length === 0) {
    return NextResponse.json({ success: true, data: { restoredIds: [] }, message: '対象のレシピがありませんでした' });
  }
  const targetIds = targets.map(t => t.id);

  await prisma.recipe.updateMany({
    where: { id: { in: targetIds }, userId: session.user.id },
    data:  { isActive: true },
  });

  return NextResponse.json({ success: true, data: { restoredIds: targetIds } });
}
