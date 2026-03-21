// app/api/auth/reset-password/route.ts - パスワード再設定API
import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const { token, password } = await request.json();

  if (!token || !password) {
    return NextResponse.json({ success: false, error: 'トークンとパスワードが必要です' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ success: false, error: 'パスワードは8文字以上で入力してください' }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken:   token,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: 'リセットリンクが無効または期限切れです' }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data:  { passwordHash, passwordResetToken: null, passwordResetExpires: null },
  });

  return NextResponse.json({ success: true, message: 'パスワードを再設定しました' });
}
