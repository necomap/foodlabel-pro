// ============================================================
// app/api/label-templates/route.ts - ラベルデザインテンプレート一覧・作成
// ============================================================
// 2026-08 プロプラン新設: 複数ラベルデザインテンプレート機能（Pro限定）。
// レシピ・店舗・製造日など「印刷ジョブごとに変わる値」は含めず、
// app/dashboard/labels/page.tsx の印刷設定（レイアウト・表示項目）を保存する。

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';

// 際限なく作られるのを防ぐための上限（プランによる差はなし・Pro内での安全弁）
const MAX_TEMPLATES = 30;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const limits = getPlanLimits((session.user as any).plan ?? 'free');
  if (!limits.canUseLabelTemplates) {
    // Pro未満のユーザーにも「機能が存在すること」自体は伝えたいので、404ではなく
    // canUse:falseを返す形にする（UI側はこれを見てアップグレード導線を出す）
    return NextResponse.json({ success: true, data: { canUse: false, templates: [] } });
  }

  const templates = await prisma.labelTemplate.findMany({
    where:   { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({
    success: true,
    data: {
      canUse: true,
      templates: templates.map(t => ({
        id: t.id, name: t.name, config: t.config,
        createdAt: t.createdAt, updatedAt: t.updatedAt,
      })),
    },
  });
}

// configの中身はapp/dashboard/labels/page.tsxのstateキーとほぼ1:1対応させているため、
// ここでは大枠のみバリデーションし、中身は緩めに（passthrough相当で）受け取る。
// 将来ページ側にフィールドが増えても、ここでエラーにして保存できなくなることを避けるため。
const templateSchema = z.object({
  name:   z.string().min(1, 'テンプレート名を入力してください').max(100),
  config: z.record(z.any()),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const limits = getPlanLimits((session.user as any).plan ?? 'free');
  if (!limits.canUseLabelTemplates) {
    return NextResponse.json({
      success: false,
      error: '複数ラベルデザインテンプレートはProプラン限定機能です',
      upgradeRequired: true,
    }, { status: 403 });
  }

  const count = await prisma.labelTemplate.count({ where: { userId: session.user.id } });
  if (count >= MAX_TEMPLATES) {
    return NextResponse.json({
      success: false,
      error: `テンプレートの保存上限（${MAX_TEMPLATES}件）に達しました。不要なテンプレートを削除してください。`,
    }, { status: 403 });
  }

  const body   = await request.json();
  const result = templateSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });

  const created = await prisma.labelTemplate.create({
    data: {
      userId: session.user.id,
      name:   result.data.name.trim(),
      config: result.data.config,
    },
  });

  return NextResponse.json({ success: true, data: { id: created.id, name: created.name, config: created.config } });
}
