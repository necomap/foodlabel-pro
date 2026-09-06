// app/api/user/profile/route.ts - プロフィール更新API
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: {
      id: true, email: true, companyName: true, representative: true, postalCode: true, address: true, phone: true, plan: true,
      // 電気代目安計算の設定（全プラン共通）
      electricityUnitPrice: true, ovenPowerKw: true, ovenSteamExtraKw: true,
      // b-PAC連携（Windows＋Brother QL-820NWB限定・任意）
      bpacTemplatePath: true,
      // 2026-09新設: 3アプリ（HACCP・在庫アプリ）連携先（lib/stock-sync.ts参照）
      inventoryUserId: true, haccpStoreCode: true,
    },
  });

  return NextResponse.json({
    success: true,
    data: user ? {
      ...user,
      electricityUnitPrice: user.electricityUnitPrice != null ? Number(user.electricityUnitPrice) : null,
      ovenPowerKw:           user.ovenPowerKw           != null ? Number(user.ovenPowerKw)           : null,
      ovenSteamExtraKw:      user.ovenSteamExtraKw      != null ? Number(user.ovenSteamExtraKw)      : null,
    } : null,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const body = await request.json();
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      companyName:    body.companyName    || undefined,
      representative: body.representative || undefined,
      postalCode:     body.postalCode     || undefined,
      address:        body.address        || undefined,
      phone:          body.phone          || undefined,
      // 電気代目安計算の設定（全プラン共通）。空欄で保存した場合に古い値が残らないよう、
      // undefinedではなく明示的にnullを渡す（同種の不具合の再発防止パターン。
      // app/api/recipes/[id]/route.tsのqualityControl周りのコメント参照）。
      electricityUnitPrice: body.electricityUnitPrice != null && body.electricityUnitPrice !== '' ? Number(body.electricityUnitPrice) : null,
      ovenPowerKw:           body.ovenPowerKw           != null && body.ovenPowerKw           !== '' ? Number(body.ovenPowerKw)           : null,
      ovenSteamExtraKw:      body.ovenSteamExtraKw      != null && body.ovenSteamExtraKw      !== '' ? Number(body.ovenSteamExtraKw)      : null,
      // b-PAC連携テンプレートパス（Windows＋Brother QL-820NWB限定・任意）。同上の理由で明示的にnullを渡す。
      bpacTemplatePath: body.bpacTemplatePath != null && body.bpacTemplatePath !== '' ? String(body.bpacTemplatePath).trim() : null,
      // 2026-09新設: 3アプリ連携先（在庫アプリのユーザーID／HACCPの店舗コード）。同上の理由で明示的にnullを渡す。
      inventoryUserId: body.inventoryUserId != null && body.inventoryUserId !== '' ? String(body.inventoryUserId).trim() : null,
      haccpStoreCode:  body.haccpStoreCode  != null && body.haccpStoreCode  !== '' ? String(body.haccpStoreCode).trim()  : null,
    },
  });

  // デフォルト店舗も同期更新
  const defaultShop = await prisma.shop.findFirst({ where: { userId: session.user.id, isDefault: true } });
  if (defaultShop) {
    await prisma.shop.update({
      where: { id: defaultShop.id },
      data: {
        shopName:   body.companyName || defaultShop.shopName,
        postalCode: body.postalCode  || defaultShop.postalCode,
        address:    body.address     || defaultShop.address,
        phone:      body.phone       || defaultShop.phone,
      },
    });
  }

  return NextResponse.json({ success: true, message: 'プロフィールを更新しました' });
}
