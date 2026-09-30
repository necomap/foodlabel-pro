// ============================================================
// lib/onboarding-mail.ts - 登録後のステップメール（2026-09-30新設）
// ============================================================
// 登録から 1・3・7・14日目 に1通ずつ、その人の利用状況（レシピ数・印刷回数・プラン）に
// 合わせた内容を自動で送る。毎日1回のCron（app/api/cron/onboarding/route.ts）から呼ばれる。
//
// ・対象: ONBOARDING_START_AT 以降に登録した、メール認証済み・有効なユーザー
//   （それ以前の既存ユーザーには送らない。遡って一斉送信されるのを防ぐため）
// ・1回のCronで1人に送るのは最大1通（Cronが何日か止まっても、まとめて何通も届かない）
// ・宣伝を含むため、特定電子メール法に合わせて送信者名・問い合わせ先・配信停止リンクを必ず入れる

import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { sendMarketingEmail } from '@/lib/email';

export const ONBOARDING_START_AT = new Date('2026-09-30T00:00:00+09:00');
/** n通目（0始まり）を送る「登録からの経過日数」 */
export const ONBOARDING_STEP_DAYS = [1, 3, 7, 14] as const;

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://foodlabel.lucke.jp';
const MANUAL_URL = `${APP_URL}/manual/FoodLabelPro_manual.pdf`;
const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// 配信停止リンク（ログイン不要で押せるよう、ユーザーIDの署名付き）
// ------------------------------------------------------------
function signUserId(userId: string): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';
  return crypto.createHmac('sha256', secret).update(`onboarding-optout:${userId}`).digest('hex').slice(0, 32);
}
export function buildUnsubscribeUrl(userId: string): string {
  return `${APP_URL}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${signUserId(userId)}`;
}
export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = signUserId(userId);
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

// ------------------------------------------------------------
// 本文
// ------------------------------------------------------------
type UsageState = { name: string; recipes: number; prints: number; plan: string; trialAvailable: boolean };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#d4891f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:12px 0;">${label}</a>`;
const list = (items: string[]) =>
  `<ol style="padding-left:20px;line-height:1.8;">${items.map(i => `<li>${i}</li>`).join('')}</ol>`;

function wrap(userId: string, name: string, body: string): string {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#333;line-height:1.7;">
<h2 style="color:#d4891f;margin:0 0 12px;">FoodLabel Pro</h2>
<p>${esc(name)} 様</p>
${body}
<hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px;">
<p style="color:#999;font-size:12px;line-height:1.6;">
このメールは FoodLabel Pro にご登録いただいた方へ、使い方のご案内としてお送りしています。<br>
送信者：FoodLabel Pro（Bummeln）／ お問い合わせ：<a href="${APP_URL}/dashboard/contact" style="color:#999;">お問い合わせフォーム</a>（運営者情報は<a href="${APP_URL}/legal" style="color:#999;">こちら</a>）<br>
今後このご案内メールが不要な場合は<a href="${buildUnsubscribeUrl(userId)}" style="color:#999;">配信停止</a>できます（ログイン通知など重要なお知らせは引き続き届きます）。
</p></div>`;
}

const SAMPLE_STEPS = list([
  `レシピ一覧の<strong>「サンプルレシピを選ぶ」</strong>から、近い商品（クッキー・食パン・ケーキ・唐揚げなど）を取り込む`,
  `レシピを開き、<strong>「ラベル印刷」</strong>でプレビューを確認する（原材料・アレルゲン・栄養成分表示が自動で入っています）`,
  `商品名や分量を自分の商品に合わせて書き換えて、印刷する`,
]);

const PRINT_TIPS = list([
  `ラベル印刷画面の「プリンタ設定」で、<strong>ラベルプリンタ</strong>か<strong>A4プリンタ</strong>かを選ぶ`,
  `「用紙」で、使っている用紙に近いサイズを選ぶ（うまくいかないときは画面内の「印刷手順ガイド」へ）`,
  `印刷画面では<strong>倍率100%（実際のサイズ）</strong>・<strong>余白なし</strong>・<strong>ヘッダーとフッターをオフ</strong>にする`,
  `ラベルプリンタの場合は、プリンタのドライバ側にも同じ用紙サイズを登録しておく`,
]);

export function buildOnboardingMail(step: number, userId: string, s: UsageState): { subject: string; html: string } {
  let subject = '';
  let body = '';

  if (step === 0) {
    if (s.recipes === 0) {
      subject = '【FoodLabel Pro】最初の1枚を印刷するまでの3ステップ';
      body = `<p>ご登録ありがとうございます。まずは材料入力なしで、ラベルができあがるところまで試してみてください。</p>${SAMPLE_STEPS}${btn(`${APP_URL}/dashboard/recipes`, 'サンプルレシピを選ぶ')}`;
    } else if (s.prints === 0) {
      subject = '【FoodLabel Pro】次はラベルのプレビューを見てみましょう';
      body = `<p>レシピのご登録ありがとうございます。次はラベル印刷画面で、原材料・アレルゲン・栄養成分表示がどう並ぶかを確認してみてください。</p>${btn(`${APP_URL}/dashboard/labels`, 'ラベル印刷画面を開く')}<p>うまく印刷できないときのポイント：</p>${PRINT_TIPS}`;
    } else {
      subject = '【FoodLabel Pro】ご利用ありがとうございます：店舗情報とロゴの設定';
      body = `<p>さっそくラベルを印刷していただきありがとうございます。設定画面の「店舗管理」で<strong>店舗情報（製造者・住所）</strong>や<strong>ロゴ</strong>を登録しておくと、毎回のラベルに自動で入ります。</p>${btn(`${APP_URL}/dashboard/settings`, '設定画面を開く')}`;
    }
  } else if (step === 1) {
    if (s.recipes === 0) {
      subject = '【FoodLabel Pro】サンプルを取り込むだけでラベルが作れます';
      body = `<p>「材料を全部入力するのが大変そう」と感じていませんか？ サンプルレシピを取り込めば、材料・栄養成分・アレルゲンが入った状態から始められます。自分の商品に近いものを選んで、分量を書き換えるだけです。</p>${SAMPLE_STEPS}${btn(`${APP_URL}/dashboard/recipes`, 'サンプルレシピを選ぶ')}`;
    } else if (s.prints === 0) {
      subject = '【FoodLabel Pro】ラベル印刷の設定のコツ';
      body = `<p>ラベルの印刷で、はみ出す・小さくなる・余白が出るといったときは、次の点を確認してみてください。</p>${PRINT_TIPS}${btn(`${APP_URL}/dashboard/labels`, 'ラベル印刷画面を開く')}<p>詳しい手順は<a href="${MANUAL_URL}">PDFマニュアル</a>にもまとめています。</p>`;
    } else {
      subject = '【FoodLabel Pro】食材マスタで原価と表示がもっと楽になります';
      body = `<p>よく使う材料は「食材マスタ」に仕入価格や一般名（ラベルに出す名前）を登録しておくと、どのレシピでも自動で原価計算・表示名がそろいます。</p>${btn(`${APP_URL}/dashboard/ingredients`, '食材マスタを開く')}`;
    }
  } else if (step === 2) {
    if (s.prints === 0) {
      subject = '【FoodLabel Pro】ラベル作りでお困りのことはありませんか？';
      body = `<p>登録から1週間が経ちました。使い方でわからないところがあれば、<a href="${MANUAL_URL}">PDFマニュアル</a>をご覧いただくか、お問い合わせフォームからお気軽にご連絡ください。</p>${btn(MANUAL_URL, 'PDFマニュアルを見る')}`;
    } else {
      subject = '【FoodLabel Pro】販売価格を入れると原価率がわかります';
      body = `<p>レシピの編集画面で<strong>販売価格</strong>を入力しておくと、食材マスタの仕入価格から1個あたりの原価と<strong>原価率</strong>が自動で計算されます。値付けの見直しにお役立てください。</p>${btn(`${APP_URL}/dashboard/recipes`, 'レシピ一覧を開く')}`;
    }
  } else {
    if (s.plan === 'free') {
      subject = '【FoodLabel Pro】レシピが増えてきたらスタンダードプラン';
      body = `<p>フリープランはレシピ10件・ラベル印刷は月20枚までです。商品数が多いお店や、毎日たくさん印刷するお店はスタンダードプランをご検討ください。</p>`
        + (s.trialAvailable ? `<p><strong>初めてのお申し込みは、初月500円</strong>でお試しいただけます。</p>` : '')
        + btn(`${APP_URL}/dashboard/upgrade`, 'プランを見る')
        + `<p style="font-size:13px;color:#666;">フリープランのままでも引き続きご利用いただけます。</p>`;
    } else {
      subject = '【FoodLabel Pro】ご利用ありがとうございます';
      body = `<p>いつもご利用ありがとうございます。「こんな機能がほしい」「ここがわかりにくい」といったご意見があれば、お問い合わせフォームからぜひお聞かせください。</p>${btn(`${APP_URL}/dashboard/contact`, 'ご意見を送る')}`;
    }
  }

  return { subject, html: wrap(userId, s.name, body) };
}

// ------------------------------------------------------------
// Cronから呼ぶ本体
// ------------------------------------------------------------
export async function runOnboardingMails(opts: { maxSend?: number; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const maxSend = opts.maxSend ?? 40;
  const trialCouponSet = !!process.env.STRIPE_TRIAL_COUPON_ID;

  const candidates = await prisma.user.findMany({
    where: {
      createdAt:            { gte: ONBOARDING_START_AT },
      onboardingMailStage:  { lt: ONBOARDING_STEP_DAYS.length },
      onboardingMailOptOut: false,
      emailVerified:        true,
      isActive:             true,
      plan:                 { not: 'admin' },
    },
    select: { id: true, email: true, companyName: true, representative: true, plan: true, createdAt: true, onboardingMailStage: true },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  let sent = 0;
  const errors: string[] = [];
  for (const u of candidates) {
    if (sent >= maxSend) break;
    const days = Math.floor((now.getTime() - u.createdAt.getTime()) / DAY_MS);
    const step = u.onboardingMailStage;
    if (days < ONBOARDING_STEP_DAYS[step]) continue;

    const [recipes, printAgg, priorSub] = await Promise.all([
      prisma.recipe.count({ where: { userId: u.id } }),
      prisma.label_print_logs.aggregate({ where: { userId: u.id }, _sum: { printCount: true } }),
      prisma.subscription.findFirst({ where: { userId: u.id }, select: { id: true } }),
    ]);
    const state: UsageState = {
      name:     u.representative || u.companyName || 'ご担当者',
      recipes,
      prints:   printAgg._sum.printCount ?? 0,
      plan:     u.plan,
      trialAvailable: trialCouponSet && !priorSub,
    };
    const { subject, html } = buildOnboardingMail(step, u.id, state);

    // 先に段階を進めてから送る（送信後の更新に失敗して同じメールが毎日届く事故を防ぐ）
    await prisma.user.update({ where: { id: u.id }, data: { onboardingMailStage: step + 1 } });
    const ok = await sendMarketingEmail(u.email, subject, html);
    if (!ok) errors.push(`${u.id}: step${step + 1}`);
    sent += 1;
    // Resendの送信レート制限（秒間数通）に当たらないよう少し待つ
    await new Promise(r => setTimeout(r, 600));
  }
  return { checked: candidates.length, sent, errors };
}
