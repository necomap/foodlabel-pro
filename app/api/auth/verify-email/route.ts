// app/api/auth/verify-email/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/auth/login?error=invalid-token', request.url));
  }

  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken: token,
      emailVerified:    false,
    },
  });

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login?error=invalid-token', request.url));
  }

  // トークン有効期限チェック
  if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
    return NextResponse.redirect(new URL('/auth/login?error=token-expired', request.url));
  }

  // 認証完了
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified:      true,
      emailVerifyToken:   null,
      emailVerifyExpires: null,
    },
  });

  // ウェルカムメール送信
  await sendWelcomeEmail(user.email, user.companyName ?? '');

  return NextResponse.redirect(new URL('/auth/login?message=メールアドレスの認証が完了しました。ログインしてください。', request.url));
}
