// app/api/shops/[id]/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Params = { params: { id: string } };

// 2026-09修正（セキュリティ）: logoUrl/qrUrlはこれまでノーチェックでそのまま保存しており、
// lib/label.tsのラベルHTML生成側でも当時logoUrlをエスケープしていなかった（現在は修正済み）。
// 通常の画面（設定画面）は必ずapp/api/upload/route.tsが返すURLしかセットしないが、この
// APIを直接叩けば任意の文字列を送り込めてしまうため、http(s)://で始まる値だけを許可する
// 多層防御を追加する（"><script>のような値でDBを汚さないようにする）。
function isSafeHttpUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v === '') return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const shop = await prisma.shop.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!shop) return NextResponse.json({ success: false, error: '店舗が見つかりません' }, { status: 404 });

  const body = await request.json();
  const safeQrUrl   = body.qrUrl   !== undefined ? (isSafeHttpUrl(body.qrUrl)   ? body.qrUrl   : null) : undefined;
  const safeLogoUrl = body.logoUrl !== undefined ? (isSafeHttpUrl(body.logoUrl) ? body.logoUrl : null) : undefined;
  try {
    await prisma.$executeRaw`
      UPDATE shops SET
        "shopName"           = ${body.shopName ?? shop.shopName},
        "companyName"        = ${body.companyName ?? null},
        representative       = ${body.representative ?? null},
        "postalCode"         = ${body.postalCode ?? null},
        address              = ${body.address ?? null},
        phone                = ${body.phone ?? null},
        email                = ${body.email || null},
        "showPhone"          = ${body.showPhone ?? shop.showPhone},
        "showRepresentative" = ${body.showRepresentative ?? shop.showRepresentative},
        "qrUrl"              = ${safeQrUrl ?? null},
        "logoUrl"            = ${safeLogoUrl ?? null},
        "logoHeightMm"       = ${body.logoHeightMm ?? 8},
        "qrSizeMm"           = ${body.qrSizeMm ?? 6},
        "updatedAt"          = NOW()
      WHERE id = ${params.id} AND "userId" = ${session.user.id}
    `;
    return NextResponse.json({ success: true, message: '店舗を更新しました' });
  } catch (err) {
    console.error('shop update error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const shop = await prisma.shop.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!shop) return NextResponse.json({ success: false, error: '店舗が見つかりません' }, { status: 404 });
  if (shop.isDefault) return NextResponse.json({ success: false, error: 'デフォルト店舗は削除できません' }, { status: 400 });

  await prisma.shop.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
