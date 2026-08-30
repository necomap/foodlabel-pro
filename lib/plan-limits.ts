// lib/plan-limits.ts
import { prisma } from '@/lib/db';

export const PLAN_LIMITS = {
  free: {
    maxRecipes:    10,
    maxLabelPrints: 20,   // 月間
    maxShops:      1,
    canExport:     false,
    // 2026-08: インポート・エクスポートは元々canExportのみで判定しており、
    // インポート側（POST /api/import-export）には判定コード自体が漏れていて
    // フリープランでも使えてしまっていた不具合を修正。canExportをインポート・
    // エクスポート共通の「機能自体が使えるか」のフラグとして統一する。
    maxExportsPerMonth: 0,   // 月間（canExportがfalseなので実質未使用）
    maxImportsPerMonth: 0,   // 同上
    hasAds:        true,
    // Pro限定機能（2026-08新設）。詳細はcanUseComplianceCheck等の各フラグ参照。
    canUseComplianceCheck: false,
    canUseLabelTemplates:  false,
    canUseLotTracking:     false,
    canUseEcText:          false,
  },
  premium: {
    // 2026-08時点: プロプラン新設に向けて、プレミアムのレシピ数・店舗数に上限を設定。
    // ラベル印刷枚数はサーバー負荷的にコストが小さく、既存の「無制限」表示を維持するため据え置き。
    maxRecipes:    100,
    maxLabelPrints: Infinity,
    maxShops:      3,
    canExport:     true,
    // 2026-08: プロプランとの価格差（¥980 vs ¥6,980）に見合う差別化のため、
    // インポート・エクスポート自体は使えるが月あたりの回数に上限を設ける。
    // 上限に達した月は翌月まで待つかプロプランへのアップグレードが必要になる。
    // 具体的な回数は初期値の暫定値なので、実際の利用状況を見て調整すること。
    maxExportsPerMonth: 5,
    maxImportsPerMonth: 5,
    hasAds:        false,
    canUseComplianceCheck: false,
    canUseLabelTemplates:  false,
    canUseLotTracking:     false,
    canUseEcText:          false,
  },
  pro: {
    // 2026-08新設: プロプラン。レシピ・ラベル印刷は無制限、店舗数はプレミアムの3件から10件に拡張。
    // 目玉機能として表示法令コンプライアンスチェック（lib/compliance-check.ts）・
    // 複数ラベルデザインテンプレート（LabelTemplateモデル）・
    // ロット番号トレーサビリティ（Label.lotInfo）・
    // EC商品ページ用テキスト自動生成（lib/ec-text-generator.ts）を追加。
    // インポート・エクスポートもプレミアムと異なり回数無制限。
    maxRecipes:    Infinity,
    maxLabelPrints: Infinity,
    maxShops:      10,
    canExport:     true,
    maxExportsPerMonth: Infinity,
    maxImportsPerMonth: Infinity,
    hasAds:        false,
    canUseComplianceCheck: true,
    canUseLabelTemplates:  true,
    canUseLotTracking:     true,
    canUseEcText:          true,
  },
  admin: {
    maxRecipes:    Infinity,
    maxLabelPrints: Infinity,
    maxShops:      Infinity,
    canExport:     true,
    maxExportsPerMonth: Infinity,
    maxImportsPerMonth: Infinity,
    hasAds:        false,
    canUseComplianceCheck: true,
    canUseLabelTemplates:  true,
    canUseLotTracking:     true,
    canUseEcText:          true,
  },
};

export type PlanKey = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as PlanKey] ?? PLAN_LIMITS.free;
}

// premium/pro/adminいずれも「プレミアム以上」の機能（広告非表示・Excelエクスポート等）は
// 共通で使えるようにする（proはpremiumの上位互換のため）。
export function isPremium(plan: string) {
  return plan === 'premium' || plan === 'pro' || plan === 'admin';
}

export function isProPlan(plan: string) {
  return plan === 'pro' || plan === 'admin';
}

// ============================================================
// プラン上限超過による「読み取り専用」レシピの判定
// ============================================================
//
// 2026-08 再発防止コメント: 以前は一覧API（GET /api/recipes）側で、その時点で
// 「表示中の1ページ分（最大perPage件）」だけを対象に古い順readOnly判定をしていた。
// これだと、ユーザーがレシピをperPage件（一覧のデフォルトは24件）より多く持っている場合、
// ①ページによってreadOnlyの判定結果がぶれる、②編集API・ラベル印刷APIには元々何の
// 制限もかかっておらず、一覧のバッジ表示だけの「見た目上の」制限に過ぎなかった
// （プレミアム→解約でフリープランに戻っても、既存レシピは何件あっても全件編集・印刷し放題だった）
// という2つの問題があった。
//
// この関数で「そのユーザーの全アクティブレシピ」を対象に一括判定し、一覧表示・編集ブロックの
// 両方から同じ結果を参照することで、上の2つの問題をまとめて解消する。
// 判定基準は変更前と同じ「作成日が古い順に、上限を超えた分だけreadOnly」。
export async function getReadOnlyRecipeIds(userId: string, plan: string): Promise<Set<string>> {
  const limits = getPlanLimits(plan);
  if (limits.maxRecipes === Infinity) return new Set();

  const recipes = await prisma.recipe.findMany({
    where:   { userId, isActive: true },
    select:  { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (recipes.length <= limits.maxRecipes) return new Set();

  // createdAt昇順（古い順）なので、先頭から「件数 - 上限」件が上限超過分＝読み取り専用
  const excessCount = recipes.length - limits.maxRecipes;
  return new Set(recipes.slice(0, excessCount).map(r => r.id));
}

// ============================================================
// Excelインポート・エクスポートの月間回数カウント（2026-08新設）
// ============================================================
//
// プレミアムプランとプロプランの差別化のため、インポート・エクスポートそれぞれに
// 月間の実行回数上限を設けた（label_print_logsの印刷枚数カウントと同じ考え方）。
// 1回の呼び出し＝1回とカウントする（エクスポートするレシピ件数やインポート件数では
// なく、機能を実行した回数）。data_transfer_logsテーブルに記録する。
export async function getMonthlyDataTransferCount(userId: string, type: 'export' | 'import'): Promise<number> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const result = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM data_transfer_logs
    WHERE "userId" = ${userId} AND "type" = ${type} AND "createdAt" >= ${firstOfMonth}
  ` as any[];
  return Number(result[0]?.count ?? 0);
}

export async function logDataTransfer(userId: string, type: 'export' | 'import'): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO data_transfer_logs ("userId", "type", "createdAt")
      VALUES (${userId}, ${type}, NOW())
    `;
  } catch (e) { console.warn('data transfer log error:', e); }
}
