// app/api/cron/onboarding/route.ts - 登録後のステップメール送信（2026-09-30新設）
// Vercel Cron（vercel.json）から毎日1回呼ばれる。内容・対象は lib/onboarding-mail.ts 参照。
import { NextResponse } from 'next/server';
import { runOnboardingMails } from '@/lib/onboarding-mail';

export async function GET(request: Request) {
  // Vercel Cron Jobからのリクエストのみ許可
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runOnboardingMails();
    console.log('[onboarding-mail]', JSON.stringify(result));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[onboarding-mail] error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
