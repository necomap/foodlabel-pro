// app/api/auth/test-email/route.ts - 一時テスト用（後で削除）
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not set', apiKey: 'undefined' });
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail ?? 'FoodLabel Pro <noreply@lucke.jp>',
        to: 'info.lucke@gmail.com',
        subject: 'テストメール',
        html: '<p>テストメールです</p>',
      }),
    });
    const data = await res.json();
    return NextResponse.json({ status: res.status, data, apiKeyPrefix: apiKey.slice(0, 10) });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}
