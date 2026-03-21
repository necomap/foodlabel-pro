// app/api/user/profile/route.ts - プロフィール更新API
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { id: true, email: true, companyName: true, representative: true, postalCode: true, address: true, phone: true, plan: true },
  });

  return NextResponse.json({ success: true, data: user });
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
