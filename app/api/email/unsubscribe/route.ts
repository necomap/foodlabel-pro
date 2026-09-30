// app/api/email/unsubscribe/route.ts - ステップメールの配信停止（2026-09-30新設）
// メール内のリンクから、ログインなしで1クリックで停止できるようにする（特定電子メール法の配信停止手段）。
// リンクにはユーザーIDの署名（lib/onboarding-mail.ts）が付いており、他人のIDでは停止できない。
import { prisma } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/onboarding-mail';

function page(message: string, status = 200) {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>配信停止 | FoodLabel Pro</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;padding:0 16px;color:#333;line-height:1.7;">
<h2 style="color:#d4891f;">FoodLabel Pro</h2><p>${message}</p>
<p><a href="/dashboard/recipes" style="color:#d4891f;">FoodLabel Pro を開く</a></p></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('u') ?? '';
  const token  = url.searchParams.get('t') ?? '';
  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) {
    return page('リンクが正しくないか、有効期限が切れています。お手数ですがお問い合わせフォームからご連絡ください。', 400);
  }
  await prisma.user.updateMany({ where: { id: userId }, data: { onboardingMailOptOut: true } });
  return page('ご案内メールの配信を停止しました。ログイン通知やパスワード再設定など、アカウントに関する重要なお知らせは引き続きお送りします。');
}
