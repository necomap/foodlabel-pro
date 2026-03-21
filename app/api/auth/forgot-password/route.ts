// app/api/auth/forgot-password/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateToken, sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ success: false, error: 'メールアドレスが必要です' }, { status: 400 });

  // セキュリティ上、ユーザーが存在しなくても同じレスポンスを返す
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token   = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1時間
    await prisma.user.update({
      where: { id: user.id },
      data:  { passwordResetToken: token, passwordResetExpires: expires },
    });
    try { await sendPasswordResetEmail(email, token); } catch (e) { console.error('Email send failed:', e); }
  }

  return NextResponse.json({ success: true, message: 'メールを送信しました（登録済みの場合）' });
}
