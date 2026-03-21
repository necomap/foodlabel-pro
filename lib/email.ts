// ============================================================
// lib/email.ts - メール送信ユーティリティ
// nodemailerを使用
// ============================================================

import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';

// SMTPトランスポーターの設定
const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_SERVER_HOST,
  port:   parseInt(process.env.EMAIL_SERVER_PORT ?? '587'),
  secure: process.env.EMAIL_SERVER_PORT === '465',
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

const FROM = process.env.EMAIL_FROM ?? 'FoodLabel Pro <noreply@example.com>';
const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

/**
 * メール認証トークンを生成する
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * メール認証メールを送信する
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: FROM,
    to:   email,
    subject: '【FoodLabel Pro】メールアドレスの確認',
    html: `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #d4891f; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">FoodLabel Pro</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">成分表示ラベル管理システム</p>
  </div>
  <div style="background: white; border: 1px solid #e5d5b5; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #d4891f;">メールアドレスの確認</h2>
    <p>FoodLabel Pro にご登録いただきありがとうございます。</p>
    <p>以下のボタンをクリックして、メールアドレスの確認を完了してください。</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}"
         style="background: #d4891f; color: white; padding: 14px 32px; border-radius: 6px;
                text-decoration: none; font-size: 16px; font-weight: bold;">
        メールアドレスを確認する
      </a>
    </div>
    <p style="font-size: 12px; color: #999;">
      このメールに心当たりがない場合は、無視してください。<br>
      リンクの有効期限は24時間です。<br>
      ボタンが機能しない場合は、以下のURLをブラウザに貼り付けてください：<br>
      <a href="${verifyUrl}" style="color: #d4891f;">${verifyUrl}</a>
    </p>
  </div>
</body>
</html>
    `,
  });
}

/**
 * パスワードリセットメールを送信する
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const resetUrl = `${BASE_URL}/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: FROM,
    to:   email,
    subject: '【FoodLabel Pro】パスワードのリセット',
    html: `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #d4891f; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">FoodLabel Pro</h1>
  </div>
  <div style="background: white; border: 1px solid #e5d5b5; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #d4891f;">パスワードのリセット</h2>
    <p>パスワードリセットのリクエストを受け付けました。</p>
    <p>以下のボタンをクリックして、新しいパスワードを設定してください。</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}"
         style="background: #d4891f; color: white; padding: 14px 32px; border-radius: 6px;
                text-decoration: none; font-size: 16px; font-weight: bold;">
        パスワードをリセットする
      </a>
    </div>
    <p style="font-size: 12px; color: #999;">
      このリクエストに心当たりがない場合は、無視してください。<br>
      リンクの有効期限は1時間です。
    </p>
  </div>
</body>
</html>
    `,
  });
}
