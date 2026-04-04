// lib/email.ts - Resendを使ったメール送信
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM ?? 'FoodLabel Pro <noreply@lucke.jp>';
const APP_URL = process.env.NEXTAUTH_URL ?? 'https://foodlabel.lucke.jp';

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
    const data = await res.json();
    if (!res.ok) {
      console.error('Resend error:', JSON.stringify(data));
      return false;
    }
    console.log('Email sent:', data.id);
    return true;
  } catch (err) {
    console.error('Email send error:', err);
    return false;
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const verifyUrl = `${APP_URL}/auth/verify-email?token=${token}`;
  const html = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2 style="color:#d4891f;">FoodLabel Pro</h2><p>アカウント登録ありがとうございます。</p><p>以下のボタンをクリックしてメールアドレスを認証してください。</p><a href="${verifyUrl}" style="display:inline-block;background:#d4891f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">メールアドレスを認証する</a><p style="color:#999;font-size:12px;">このリンクは24時間有効です。</p><p style="color:#999;font-size:12px;">心当たりがない場合は無視してください。</p></div>`;
  return sendEmail(email, '【FoodLabel Pro】メールアドレスの認証', html);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;
  const html = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2 style="color:#d4891f;">FoodLabel Pro</h2><p>パスワードリセットのリクエストを受け付けました。</p><a href="${resetUrl}" style="display:inline-block;background:#d4891f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">パスワードを再設定する</a><p style="color:#999;font-size:12px;">このリンクは1時間有効です。</p><p style="color:#999;font-size:12px;">心当たりがない場合は無視してください。</p></div>`;
  return sendEmail(email, '【FoodLabel Pro】パスワードリセット', html);
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const html = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2 style="color:#d4891f;">FoodLabel Proへようこそ！</h2><p>${name ?? 'ユーザー'}様、ご登録ありがとうございます。</p><a href="${APP_URL}/dashboard/recipes" style="display:inline-block;background:#d4891f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">ダッシュボードを開く</a><p style="color:#999;font-size:12px;">FoodLabel Pro（Bummeln）</p></div>`;
  return sendEmail(email, '【FoodLabel Pro】ご登録ありがとうございます', html);
}

export async function sendLoginNotificationEmail(email: string, ipAddress: string): Promise<boolean> {
  const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const APP_URL_LOCAL = process.env.NEXTAUTH_URL ?? 'https://foodlabel.lucke.jp';
  const html = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2 style="color:#d4891f;">FoodLabel Pro</h2><p>お使いのアカウントに新しいログインがありました。</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="padding:8px;border:1px solid #eee;background:#f9f9f9;font-weight:bold;">日時</td><td style="padding:8px;border:1px solid #eee;">${now}</td></tr><tr><td style="padding:8px;border:1px solid #eee;background:#f9f9f9;font-weight:bold;">IPアドレス</td><td style="padding:8px;border:1px solid #eee;">${ipAddress}</td></tr></table><p style="color:#e74c3c;font-size:13px;">心当たりがない場合はすぐにパスワードを変更してください。</p><a href="${APP_URL_LOCAL}/auth/forgot-password" style="display:inline-block;background:#e74c3c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">パスワードを変更する</a></div>`;
  return sendEmail(email, '【FoodLabel Pro】新しいログインがありました', html);
}
