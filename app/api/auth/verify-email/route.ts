// ============================================================
// app/api/auth/verify-email/route.ts - メール認証API
// ============================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(
      new URL('/auth/login?error=認証トークンが無効です', request.url)
    );
  }

  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token },
  });

  if (!user) {
    return NextResponse.redirect(
      new URL('/auth/login?error=認証リンクが無効または期限切れです', request.url)
    );
  }

  if (user.emailVerified) {
    return NextResponse.redirect(
      new URL('/auth/login?message=すでに認証済みです', request.url)
    );
  }

  // 認証完了
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified:    true,
      emailVerifyToken: null,
    },
  });

  return NextResponse.redirect(
    new URL('/auth/login?message=メール認証が完了しました！ログインしてください', request.url)
  );
}
