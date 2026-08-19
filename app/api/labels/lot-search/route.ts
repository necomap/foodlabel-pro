// ============================================================
// app/api/labels/lot-search/route.ts - ロット番号トレース検索（Pro限定）
// ============================================================
// 2026-08 プロプラン新設。原材料の回収等が必要になった場合に、「そのロット番号を使った
// 印刷（製造バッチ）はどれか」を検索できるようにする。lib/plan-limits.tsのコメント参照の通り、
// 在庫の数量管理はこの機能のスコープ外（ユーザーが別途開発中の在庫管理アプリの役割）。

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPlanLimits } from '@/lib/plan-limits';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const limits = getPlanLimits((session.user as any).plan ?? 'free');
  if (!limits.canUseLotTracking) {
    return NextResponse.json({ success: true, data: { canUse: false, results: [] } });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  if (!q) return NextResponse.json({ success: true, data: { canUse: true, results: [] } });

  // lotSearchTextは保存時に小文字化済みなので、検索側も小文字化して単純containsで一致させる
  const labels = await prisma.label.findMany({
    where: {
      userId: session.user.id,
      lotSearchText: { contains: q },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      recipe: { select: { name: true, variationName: true } },
      shop:   { select: { shopName: true } },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      canUse: true,
      results: labels.map(l => ({
        id:              l.id,
        recipeName:      l.recipe?.name ?? '（削除済みレシピ）',
        variationName:   (l.recipe as any)?.variationName ?? null,
        shopName:        l.shop?.shopName ?? null,
        manufactureDate: l.manufactureDate,
        printCount:      l.printCount,
        createdAt:       l.createdAt,
        lots:            l.lotInfo as Array<{ ingredientName: string; lotNumber: string }> | null,
      })),
    },
  });
}
