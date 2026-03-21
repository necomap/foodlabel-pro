// ============================================================
// app/api/auth/register/route.ts - 会員登録API
// ============================================================

import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateToken, sendVerificationEmail } from '@/lib/email';

// 入力バリデーション
const registerSchema = z.object({
  email:          z.string().email('有効なメールアドレスを入力してください'),
  password:       z.string()
    .min(8, 'パスワードは8文字以上で入力してください')
    .regex(/[A-Za-z]/, 'パスワードには英字を含めてください')
    .regex(/[0-9]/, 'パスワードには数字を含めてください'),
  companyName:    z.string().min(1, '店舗名（社名）を入力してください').max(200),
  representative: z.string().max(100).optional(),
  postalCode:     z.string().regex(/^\d{3}-?\d{4}$/, '郵便番号の形式が正しくありません').optional().or(z.literal('')),
  address:        z.string().max(500).optional(),
  phone:          z.string().max(20).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.errors[0];
      return NextResponse.json(
        { success: false, error: firstError.message },
        { status: 400 }
      );
    }

    const data = result.data;

    // メールアドレスの重複チェック
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'このメールアドレスはすでに登録されています' },
        { status: 409 }
      );
    }

    // パスワードハッシュ化
    const passwordHash = await hash(data.password, 12);

    // メール認証トークン生成
    const verifyToken = generateToken();

    // ユーザー作成（トランザクション）
    const user = await prisma.$transaction(async tx => {
      const newUser = await tx.user.create({
        data: {
          email:             data.email,
          passwordHash,
          companyName:       data.companyName,
          representative:    data.representative,
          postalCode:        data.postalCode?.replace('-', '') || null,
          address:           data.address,
          phone:             data.phone,
          emailVerifyToken:  verifyToken,
          emailVerified:     false,
          plan:              'free',
        },
      });

      // デフォルト店舗を作成
      await tx.shop.create({
        data: {
          userId:    newUser.id,
          shopName:  data.companyName,
          postalCode: data.postalCode?.replace('-', '') || null,
          address:   data.address,
          phone:     data.phone,
          isDefault: true,
        },
      });

      return newUser;
    });

    // 認証メール送信
    try {
      await sendVerificationEmail(user.email, verifyToken);
    } catch (emailErr) {
      console.error('メール送信失敗:', emailErr);
      // メール送信失敗でもユーザー登録は成功扱い（開発環境では無視）
    }

    return NextResponse.json({
      success: true,
      message: '登録完了！確認メールをお送りしました。メール内のリンクをクリックして認証を完了してください。',
    });

  } catch (err) {
    console.error('Registration error:', err);
    return NextResponse.json(
      { success: false, error: '登録処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
