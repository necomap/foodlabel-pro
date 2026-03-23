// app/api/auth/verify-email/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ success: false, error: '無効なリンクです。' }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token, emailVerified: false },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: 'このリンクは無効または既に使用済みです。' }, { status: 400 });
  }

  if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
    return NextResponse.json({ success: false, error: 'リンクの有効期限が切れています。再度登録してください。' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified:      true,
      emailVerifyToken:   null,
      emailVerifyExpires: null,
    },
  });

  await sendWelcomeEmail(user.email, user.companyName ?? '');

  return NextResponse.json({ success: true });
}
