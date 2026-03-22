// app/api/auth/forgot-password/route.ts
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ success: false, error: 'メールアドレスを入力してください' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  // セキュリティのため、ユーザーが存在しない場合も同じレスポンスを返す
  if (!user) {
    return NextResponse.json({ success: true, message: 'メールを送信しました（登録済みの場合）' });
  }

  const token   = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1時間

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken:   token,
      passwordResetExpires: expires,
    },
  });

  await sendPasswordResetEmail(email, token);

  return NextResponse.json({ success: true, message: 'パスワードリセットメールを送信しました' });
}
