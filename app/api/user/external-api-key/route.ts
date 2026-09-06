// app/api/user/external-api-key/route.ts - 外部連携用APIキーの発行・再発行
// ============================================================
// 2026-09新設: 在庫アプリ（Lucke Inventory）の「製造・仕込」機能が、このアカウントの
// レシピだけを安全に取得できるようにするためのAPIキー。
// 以前は在庫アプリがfoodlabel-proのDBに直接接続し、認証もユーザー絞り込みも無いまま
// 「有効な全レシピ」を返していた（他ユーザーのレシピが見えてしまう重大なデータ漏えい）。
// このキーをAuthorizationヘッダー（Bearer）で検証するapp/api/external/recipes/route.tsと
// セットで、その代替として新設した。
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { externalApiKey: true },
  });
  return NextResponse.json({ success: true, data: { externalApiKey: user?.externalApiKey ?? null } });
}

// 新規発行・再発行。再発行すると古いキーは即座に無効になるため、在庫アプリ側の設定も
// 更新してもらう必要がある（画面側に注意書きを表示する）。
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  // fl_ プレフィックスで「foodlabel-pro発行のキー」と一目でわかるようにする
  const key = 'fl_' + crypto.randomBytes(24).toString('hex');
  await prisma.user.update({
    where: { id: session.user.id },
    data:  { externalApiKey: key },
  });

  return NextResponse.json({ success: true, data: { externalApiKey: key } });
}
