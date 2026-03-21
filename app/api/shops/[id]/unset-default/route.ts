// app/api/shops/[id]/unset-default/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
  await prisma.shop.update({ where: { id: params.id }, data: { isDefault: false } });
  return NextResponse.json({ success: true });
}
