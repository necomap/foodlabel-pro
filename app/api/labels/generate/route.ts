// ============================================================
// app/api/labels/generate/route.ts - ラベル生成API
// ============================================================
// レシピ → ラベル内容の組み立ては lib/label-build.ts（まとめて印刷 generate-batch と共通）。

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanLimits, startOfMonthJST } from '@/lib/plan-limits';
import { prisma } from '@/lib/db';
import { generateLabelHtml, getDefaultDisplaySettings } from '@/lib/label';
import { labelConfigSchema, resolveShopInfo, buildRecipeLabel } from '@/lib/label-build';
import { deductStockForPrint } from '@/lib/stock-sync';

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });



  const body   = await request.json();
  // フリープランの印刷制限チェック
  const limits = getPlanLimits(session.user.plan ?? 'free');
  if (limits.maxLabelPrints !== Infinity && !body.isPreview) {
    const firstOfMonth = startOfMonthJST();  // 2026-10-22: 日本時間の月初に修正（以前はUTC基準）
    const printCounts = await prisma.$queryRaw`
      SELECT COALESCE(SUM("printCount"), 0) as total
      FROM label_print_logs
      WHERE "userId" = ${session.user.id}
      AND "createdAt" >= ${firstOfMonth}
    ` as any[];
    const monthlyCount = Number(printCounts[0]?.total ?? 0);
    const requestedCount = body.printCount ?? 1;
    if (monthlyCount + requestedCount > limits.maxLabelPrints) {
      return NextResponse.json({
        success: false,
        error: `フリープランの月間印刷上限（${limits.maxLabelPrints}枚）に達しました。スタンダードプランにアップグレードしてください。`,
        upgradeRequired: true,
      }, { status: 403 });
    }
  }
  const result = labelConfigSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.errors[0].message },
      { status: 400 }
    );
  }
  const config = result.data;
  const shopInfo = await resolveShopInfo(session.user.id, config.shopId);
  const built = await buildRecipeLabel(session.user.id, config, shopInfo);
  if (!built) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });
  const { recipe, content, labelConfig, warnings } = built;
  const html    = generateLabelHtml(content, labelConfig, body.isPreview === true);

  // 印刷履歴を保存
  if (!body.isPreview) {
    // ロット番号トレーサビリティ（Pro限定）。Pro未満から送られてきた場合はサーバー側で無視する
    // （クライアント側のUIはPro未満に表示していないが、念のためサーバー側でも強制する）。
    const rawLots = (limits.canUseLotTracking ? config.lots : undefined)
      ?.filter(l => l.ingredientName.trim() && l.lotNumber.trim()) ?? [];
    const lotInfo = rawLots.length > 0 ? rawLots : undefined;
    const lotSearchText = rawLots.length > 0
      ? rawLots.map(l => `${l.ingredientName} ${l.lotNumber}`).join(' ').toLowerCase()
      : undefined;

    await prisma.label.create({
      data: {
        recipeId:       config.recipeId,
        shopId:         config.shopId,
        userId:         session.user.id,
        manufactureDate: new Date(config.manufactureDate),
        printCount:     config.printCount,
        fontSizePt:     config.fontSizePt,
        deviceType:     config.deviceType,
        labelWidthMm:   config.labelWidthMm,
        labelHeightMm:  config.labelHeightMm,
        isPrecut:       config.isPrecut,
        a4Cols:         config.a4Cols,
        a4Rows:         config.a4Rows,
        startPosition:  config.startPosition,
        displaySettings: config.displaySettings ?? getDefaultDisplaySettings(),
        generatedHtml:  html.substring(0, 10000), // DBサイズ制限
        lotInfo,
        lotSearchText,
      },
    });
  }

  // 印刷ログを記録（プレビューモードはカウントしない）
  if (!body.isPreview) {
    try {
      const actualPrintCount = body.printCount ?? 1;
      await prisma.$executeRaw`
        INSERT INTO label_print_logs ("userId", "recipeId", "printCount", "createdAt")
        VALUES (${session.user.id}, ${body.recipeId}, ${actualPrintCount}, NOW())
      `;
    } catch (e) { console.warn('print log error:', e); }
  }

  // 2026-09新設: 印刷時の在庫自動差し引き（Pro限定・チェックボックスON時のみ）。
  // HACCP連携（haccpStoreCode）が設定されていればそちら経由、無ければ在庫アプリへ直接。
  // ラベル印刷そのものを絶対に失敗させないよう必ずtry/catchし、結果はレスポンスの
  // data.stockSyncとして返すのみに留める（失敗してもラベル印刷自体は成功として返す）。
  let stockSyncResult: Awaited<ReturnType<typeof deductStockForPrint>> | null = null;
  if (!body.isPreview && config.deductStock && limits.canUseStockSync) {
    try {
      const userRow = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { haccpStoreCode: true, inventoryUserId: true },
      });
      if (userRow) {
        stockSyncResult = await deductStockForPrint(userRow, {
          recipeName: recipe.name,
          printCount: config.printCount,
          unitCount: recipe.unitCount,
          ingredients: recipe.ingredients.map((ing) => ({
            name: ing.ingredient?.name || ing.ingredientNameOverride || '（材料名未設定）',
            amount: Number(ing.amount),
            unit: ing.unit,
          })),
        });
      }
    } catch (e) { console.warn('stock sync error:', e); }
  }

  return NextResponse.json({
    success: true,
    data: {
      html, content, warnings,
      stockSync: stockSyncResult,
    },
  });
}
