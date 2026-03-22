// app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { sendVerificationEmail, sendWelcomeEmail } from '@/lib/email';

const schema = z.object({
  email:       z.string().email('有効なメールアドレスを入力してください'),
  password:    z.string().min(8, 'パスワードは8文字以上で入力してください'),
  companyName: z.string().min(1, '店舗名・屋号を入力してください').max(200),
});

export async function POST(request: Request) {
  const body   = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });
  }

  const { email, password, companyName } = result.data;

  // 既存ユーザーチェック
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ success: false, error: 'このメールアドレスは既に登録されています' }, { status: 400 });
  }

  const passwordHash  = await hash(password, 12);
  const verifyToken   = randomBytes(32).toString('hex');
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      companyName,
      emailVerified:      false,
      emailVerifyToken:   verifyToken,
      emailVerifyExpires: verifyExpires,
      plan:               'free',
      isActive:           true,
    },
  });

  // デフォルト店舗を作成
  await prisma.shop.create({
    data: { userId: user.id, shopName: companyName, isDefault: true },
  });

  // 認証メール送信
  const emailSent = await sendVerificationEmail(email, verifyToken);

  if (!emailSent) {
    // メール送信失敗でも登録は完了（開発環境等）
    console.warn('Verification email failed to send for:', email);
  }

  return NextResponse.json({
    success: true,
    message: '登録が完了しました。認証メールをご確認ください。',
    emailSent,
  });
}
