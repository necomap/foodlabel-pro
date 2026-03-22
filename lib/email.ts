// lib/email.ts - Resendを使ったメール送信
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM ?? 'FoodLabel Pro <onboarding@resend.dev>';
const APP_URL = process.env.NEXTAUTH_URL ?? 'https://foodlabel-pro.vercel.app';

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[DEV] Email to ${to}: ${subject}`);
    return true;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const verifyUrl = `${APP_URL}/auth/verify-email?token=${token}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #d4891f;">FoodLabel Pro</h2>
      <p>アカウント登録ありがとうございます。</p>
      <p>以下のボタンをクリックしてメールアドレスを認証してください。</p>
      <a href="${verifyUrl}" style="display:inline-block; background:#d4891f; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; margin:16px 0;">
        メールアドレスを認証する
      </a>
      <p style="color:#999; font-size:12px;">このリンクは24時間有効です。</p>
      <p style="color:#999; font-size:12px;">心当たりがない場合は無視してください。</p>
    </div>
  `;
  return sendEmail(email, '【FoodLabel Pro】メールアドレスの認証', html);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #d4891f;">FoodLabel Pro</h2>
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>以下のボタンをクリックしてパスワードを再設定してください。</p>
      <a href="${resetUrl}" style="display:inline-block; background:#d4891f; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; margin:16px 0;">
        パスワードを再設定する
      </a>
      <p style="color:#999; font-size:12px;">このリンクは1時間有効です。</p>
      <p style="color:#999; font-size:12px;">心当たりがない場合は無視してください。</p>
    </div>
  `;
  return sendEmail(email, '【FoodLabel Pro】パスワードリセット', html);
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #d4891f;">FoodLabel Proへようこそ！</h2>
      <p>${name ?? 'ユーザー'}様、ご登録ありがとうございます。</p>
      <p>FoodLabel Proで食品成分表示ラベルの管理を始めましょう。</p>
      <a href="${APP_URL}/dashboard/recipes" style="display:inline-block; background:#d4891f; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; margin:16px 0;">
        ダッシュボードを開く
      </a>
      <hr style="border:none; border-top:1px solid #eee; margin:24px 0;">
      <p style="color:#999; font-size:12px;">FoodLabel Pro（Bummeln）</p>
    </div>
  `;
  return sendEmail(email, '【FoodLabel Pro】ご登録ありがとうございます', html);
}
