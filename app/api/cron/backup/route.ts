// ============================================================
// app/api/cron/backup/route.ts
// 定期バックアップ（Vercel Cronから実行）
//
// Supabase FreeプランはSupabase側の自動バックアップが一切無いため、アプリ側でも
// 独自にバックアップを取っておく安全策として追加（2026-08）。Supabaseの有料プラン
// （Pro以上）にすれば過去7日分の自動バックアップが付くので、そちらも検討の価値あり。
//
// パスワードハッシュ・Stripe関連情報などの機微情報は対象外にし、「入力し直しが効かない
// データ」＝レシピ・食材・店舗・カテゴリを中心にJSONでダンプして管理者宛にメール添付で送る。
// データ量が増えてくると添付ファイルサイズがResend側の上限に近づく可能性があるため、
// 定期的に送信が成功しているか（Resendの送信ログ、または本メールの受信）を確認すること。
// ============================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendBackupEmail } from '@/lib/email';

// maxDurationはこのプロジェクトの慣習に合わせてvercel.jsonのfunctions側で設定する
// （app/api/import-export/route.tsと同じ方式）
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Vercel Cron Jobからのリクエストのみ許可（app/api/cron/keepaliveと同じ方式）
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const backupEmail = process.env.BACKUP_EMAIL ?? process.env.ADMIN_EMAIL;
  if (!backupEmail) {
    console.error('Backup cron: BACKUP_EMAIL / ADMIN_EMAIL が未設定です');
    return NextResponse.json({ success: false, error: 'BACKUP_EMAIL（またはADMIN_EMAIL）が未設定です' }, { status: 500 });
  }

  try {
    // passwordHash・stripeCustomerId等は含めず、アカウントの特定に必要な最小限の項目のみ
    const [users, shops, categories, ingredients, recipes] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, email: true, companyName: true, plan: true, isActive: true, createdAt: true },
      }),
      prisma.shop.findMany({ where: { isActive: true } }),
      prisma.category.findMany(),
      prisma.ingredient.findMany({ where: { isActive: true }, include: { nutritionData: true } }),
      prisma.recipe.findMany({
        where: { isActive: true },
        include: { ingredients: true, steps: true },
      }),
    ]);

    const backupData = {
      generatedAt: new Date().toISOString(),
      counts: {
        users:       users.length,
        shops:       shops.length,
        categories:  categories.length,
        ingredients: ingredients.length,
        recipes:     recipes.length,
      },
      users, shops, categories, ingredients, recipes,
    };

    // Prisma Decimal型はtoJSON()を持つため通常のJSON.stringifyでそのまま文字列化される。
    // 万一BigInt等が混ざっていても落ちないよう、念のためreplacerで防御しておく。
    const json = JSON.stringify(backupData, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    , 2);
    const base64   = Buffer.from(json, 'utf-8').toString('base64');
    const dateStr  = new Date().toISOString().slice(0, 10);
    const sizeKb   = Math.round(Buffer.byteLength(json, 'utf-8') / 1024);

    const html = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
      <h2 style="color:#d4891f;">FoodLabel Pro 自動バックアップ</h2>
      <p>${dateStr} 時点の全ユーザー分バックアップです（添付JSONファイル）。</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
        <tr><td style="padding:6px;border:1px solid #eee;background:#f9f9f9;">ユーザー数</td><td style="padding:6px;border:1px solid #eee;">${users.length}</td></tr>
        <tr><td style="padding:6px;border:1px solid #eee;background:#f9f9f9;">レシピ数</td><td style="padding:6px;border:1px solid #eee;">${recipes.length}</td></tr>
        <tr><td style="padding:6px;border:1px solid #eee;background:#f9f9f9;">食材数</td><td style="padding:6px;border:1px solid #eee;">${ingredients.length}</td></tr>
        <tr><td style="padding:6px;border:1px solid #eee;background:#f9f9f9;">店舗数</td><td style="padding:6px;border:1px solid #eee;">${shops.length}</td></tr>
        <tr><td style="padding:6px;border:1px solid #eee;background:#f9f9f9;">ファイルサイズ</td><td style="padding:6px;border:1px solid #eee;">約${sizeKb}KB</td></tr>
      </table>
      <p style="color:#999;font-size:12px;">パスワード・決済情報は含まれていません。このメールはVercel Cronから自動送信されています。</p>
    </div>`;

    const sent = await sendBackupEmail(
      backupEmail,
      `【FoodLabel Pro】自動バックアップ ${dateStr}`,
      html,
      [{ filename: `foodlabel_backup_${dateStr}.json`, content: base64 }]
    );

    if (!sent) {
      return NextResponse.json({ success: false, error: 'メール送信に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), counts: backupData.counts });
  } catch (error) {
    console.error('Backup cron error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
