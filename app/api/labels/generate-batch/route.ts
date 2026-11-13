// ============================================================
// app/api/labels/generate-batch/route.ts - まとめてラベル印刷API（2026-11新設）
// ============================================================
// 複数レシピのラベルを1つの印刷用HTMLにまとめて生成する（app/dashboard/labels/batch/page.tsx から呼ぶ）。
// - 印刷設定（用紙・フォント・表示項目・言語など）は全レシピ共通。ラベル印刷画面で最後に使った設定が送られてくる
// - レシピごとに期限日と枚数を指定。期限日は「期限日 − 製造日」の日数に直して既存の生成処理に渡す
// - A4シールは空きなく続けて詰める（lib/label.ts の generateMultiLabelHtml）
// レシピ → ラベル内容の組み立ては 1件ずつの生成（generate）と同じ lib/label-build.ts を使う。
// 1件ずつの生成と同じく、プランの月間上限チェック（合計枚数で判定）・印刷履歴（labels）・
// 印刷ログ（label_print_logs、レシピごと）・在庫差し引き（Pro）・確認記録の警告・英語ラベル分岐を行う。
// ロット番号はレシピごとの入力欄が無いため、まとめて印刷では記録しない（必要なら1件ずつの画面で印刷）。

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getPlanLimits, startOfMonthJST } from '@/lib/plan-limits';
import { prisma } from '@/lib/db';
import { generateLabelHtml, generateMultiLabelHtml, getDefaultDisplaySettings } from '@/lib/label';
import { labelConfigSchema, resolveShopInfo, buildRecipeLabel } from '@/lib/label-build';
import { deductStockForPrint } from '@/lib/stock-sync';
import type { LabelConfig, LabelContent } from '@/types';

// 一度に扱える上限（極端に大きなHTMLでブラウザが固まるのを防ぐ安全弁）
const MAX_RECIPES = 100;
const MAX_TOTAL_LABELS = 1000;

const batchSchema = labelConfigSchema
  .omit({ recipeId: true, printCount: true, shelfLifeDays: true, lots: true })
  .extend({
    isPreview: z.boolean().optional(),
    items: z.array(z.object({
      recipeId:   z.string().min(1),
      count:      z.number().int().min(1, '枚数は1以上にしてください').max(999),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '期限日の形式が正しくありません'),
    })).min(1, 'レシピを1件以上選んでください').max(MAX_RECIPES, `一度に印刷できるのは${MAX_RECIPES}レシピまでです`),
  });

/** YYYY-MM-DD 同士の日数差（b − a）。タイムゾーンの影響を受けないようUTCの日付として計算する */
function diffDays(a: string, b: string): number {
  const toUtc = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const body = await request.json();
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }
  const { items, isPreview: isPreviewRaw, deductStock, ...common } = parsed.data;
  const isPreview = isPreviewRaw === true;

  const totalCount = items.reduce((s, it) => s + it.count, 0);
  if (totalCount > MAX_TOTAL_LABELS) {
    return NextResponse.json({ success: false, error: `一度に印刷できるのは合計${MAX_TOTAL_LABELS}枚までです（現在${totalCount}枚）。分けて印刷してください` }, { status: 400 });
  }
  for (const it of items) {
    if (diffDays(common.manufactureDate, it.expiryDate) < 0) {
      return NextResponse.json({ success: false, error: '期限日が製造日より前になっている行があります' }, { status: 400 });
    }
  }

  // プランの月間印刷枚数上限（合計枚数で判定。プレビューはカウントしない）
  const limits = getPlanLimits(session.user.plan ?? 'free');
  if (limits.maxLabelPrints !== Infinity && !isPreview) {
    const firstOfMonth = startOfMonthJST();
    const printCounts = await prisma.$queryRaw`
      SELECT COALESCE(SUM("printCount"), 0) as total
      FROM label_print_logs
      WHERE "userId" = ${session.user.id}
      AND "createdAt" >= ${firstOfMonth}
    ` as any[];
    const monthlyCount = Number(printCounts[0]?.total ?? 0);
    if (monthlyCount + totalCount > limits.maxLabelPrints) {
      const remaining = Math.max(0, limits.maxLabelPrints - monthlyCount);
      return NextResponse.json({
        success: false,
        error: `フリープランの月間印刷上限（${limits.maxLabelPrints}枚）を超えます（今回${totalCount}枚・残り${remaining}枚）。枚数を減らすか、スタンダードプランにアップグレードしてください。`,
        upgradeRequired: true,
      }, { status: 403 });
    }
  }

  // 店舗情報は全レシピ共通なので1回だけ取得
  const shopInfo = await resolveShopInfo(session.user.id, common.shopId);

  // レシピごとにラベル内容を組み立てる（DB接続数を増やさないよう順番に処理）
  const built: Array<{
    recipeId: string; recipeName: string; count: number; expiryDate: string;
    content: LabelContent; labelConfig: LabelConfig;
    recipe: NonNullable<Awaited<ReturnType<typeof buildRecipeLabel>>>['recipe'];
  }> = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  for (const it of items) {
    const config = {
      ...common,
      recipeId:      it.recipeId,
      printCount:    it.count,
      shelfLifeDays: diffDays(common.manufactureDate, it.expiryDate),
      deductStock:   false,
    };
    const r = await buildRecipeLabel(session.user.id, config, shopInfo);
    if (!r) { missing.push(it.recipeId); continue; }
    built.push({ recipeId: it.recipeId, recipeName: r.recipe.name, count: it.count, expiryDate: it.expiryDate, content: r.content, labelConfig: r.labelConfig, recipe: r.recipe });
    r.warnings.forEach(w => warnings.push(`【${r.recipe.name}】${w}`));
  }
  if (built.length === 0) {
    return NextResponse.json({ success: false, error: '印刷できるレシピがありません（削除された可能性があります）' }, { status: 404 });
  }

  // 用紙・フォントなどは全レシピ共通なので、最初のレシピの設定で面付けする
  const html = generateMultiLabelHtml(built.map(b => ({ content: b.content, count: b.count })), built[0].labelConfig, isPreview);

  const stockSync: Array<{ recipeName: string; result: Awaited<ReturnType<typeof deductStockForPrint>> }> = [];
  if (!isPreview) {
    for (let i = 0; i < built.length; i++) {
      const b = built[i];
      // 印刷履歴（レシピごと）。保存するHTMLはそのレシピ単体のもの（1件ずつ印刷したときと同じ形）
      try {
        await prisma.label.create({
          data: {
            recipeId:        b.recipeId,
            shopId:          common.shopId,
            userId:          session.user.id,
            manufactureDate: new Date(common.manufactureDate),
            printCount:      b.count,
            fontSizePt:      common.fontSizePt,
            deviceType:      common.deviceType,
            labelWidthMm:    common.labelWidthMm,
            labelHeightMm:   common.labelHeightMm,
            isPrecut:        common.isPrecut,
            a4Cols:          common.a4Cols,
            a4Rows:          common.a4Rows,
            // 開始位置は最初のレシピにだけ適用している
            startPosition:   i === 0 ? common.startPosition : undefined,
            displaySettings: common.displaySettings ?? getDefaultDisplaySettings(),
            generatedHtml:   generateLabelHtml(b.content, b.labelConfig, false).substring(0, 10000),
          },
        });
      } catch (e) { console.warn('label history error:', e); }
      // 印刷ログ（月間枚数のカウント元）
      try {
        await prisma.$executeRaw`
          INSERT INTO label_print_logs ("userId", "recipeId", "printCount", "createdAt")
          VALUES (${session.user.id}, ${b.recipeId}, ${b.count}, NOW())
        `;
      } catch (e) { console.warn('print log error:', e); }
    }

    // 在庫の自動差し引き（Pro限定・チェックON時のみ）。失敗してもラベル生成は成功として返す
    if (deductStock && limits.canUseStockSync) {
      try {
        const userRow = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { haccpStoreCode: true, inventoryUserId: true },
        });
        if (userRow) {
          for (const b of built) {
            try {
              const result = await deductStockForPrint(userRow, {
                recipeName: b.recipe.name,
                printCount: b.count,
                unitCount:  b.recipe.unitCount,
                ingredients: b.recipe.ingredients.map(ing => ({
                  name:   ing.ingredient?.name || ing.ingredientNameOverride || '（材料名未設定）',
                  amount: Number(ing.amount),
                  unit:   ing.unit,
                })),
              });
              stockSync.push({ recipeName: b.recipeName, result });
            } catch (e) { console.warn('stock sync error:', e); }
          }
        }
      } catch (e) { console.warn('stock sync error:', e); }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      html,
      warnings,
      missing,
      totalCount: built.reduce((s, b) => s + b.count, 0),
      // b-PAC印刷用（レシピごとの構造化データ）
      items: built.map(b => ({ recipeId: b.recipeId, recipeName: b.recipeName, count: b.count, expiryDate: b.expiryDate, content: b.content })),
      stockSync,
    },
  });
}
