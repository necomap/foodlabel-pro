// lib/plan-limits.ts
//
// 2026-09 修正: このファイルはプラン別の機能フラグ定義（PLAN_LIMITS）と、それを引く
// getPlanLimits/isPremium/isProPlanのみを置く「クライアントからも読める」ファイルにする。
// 以前はDB（Prisma）を使う関数（getReadOnlyRecipeIds等）も同じファイルにあり、
// このファイルの先頭でprismaをimportしていたため、クライアントコンポーネント
// （'use client'）からは安全にimportできなかった（prismaはNode専用でブラウザで動かない）。
// そのせいでapp/dashboard/recipes/[id]/page.tsx（クライアント側）は
// canUseComplianceCheck・canUseEcTextの判定をこのファイルを使わずに
// `session?.user?.plan === 'pro' || 'admin'`と直書きしてしまい、
// PLAN_LIMITS側の値と食い違いうる二重管理状態になっていた。
// DBを使う関数は./plan-limits-server.tsに分離したので、クライアント側でも
// このファイルのgetPlanLimits()を直接使えばよい（サーバー側からの利用も従来通り可能）。

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
    // 2026-08新設: 全レシピ（非表示含む）を一括で保健所提出用に印刷する機能。
    canUseBulkPrint:         false,
    // 2026-08新設: 印刷枚数から期間内の材料消費量を逆算するレポート機能。
    canUseConsumptionReport: false,
    // 2026-08新設: レシピ一覧でチェックボックス選択→複数件まとめて非表示にする機能。
    // レシピ件数が多いプロプランのユーザー向けの効率化機能として、Pro限定にする。
    canUseBulkHide:          false,
    // 2026-09新設: ラベル印刷のたびに材料の在庫を自動で差し引く3アプリ連携機能
    // （HACCP・在庫アプリ側）。canUseConsumptionReport等と同じくPro限定。
    canUseStockSync:         false,
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
    canUseBulkPrint:         false,
    canUseConsumptionReport: false,
    canUseBulkHide:          false,
    canUseStockSync:         false,
  },
  pro: {
    // 2026-08新設: プロプラン。レシピ・ラベル印刷は無制限、店舗数はプレミアムの3件から10件に拡張。
    // 目玉機能として表示法令コンプライアンスチェック（lib/compliance-check.ts）・
    // 複数ラベルデザインテンプレート（LabelTemplateモデル）・
    // ロット番号トレーサビリティ（Label.lotInfo）・
    // EC商品ページ用テキスト自動生成（lib/ec-text-generator.ts）を追加。
    // インポート・エクスポートもプレミアムと異なり回数無制限。
    // 2026-08追加: 保健所提出用の全レシピ一括印刷（非表示含む）、印刷枚数から逆算する
    // 期間指定の材料消費量レポートも追加。
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
    canUseBulkPrint:         true,
    canUseConsumptionReport: true,
    canUseBulkHide:          true,
    canUseStockSync:         true,
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
    canUseBulkPrint:         true,
    canUseConsumptionReport: true,
    canUseBulkHide:          true,
    canUseStockSync:         true,
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

// DBを使う関数（getReadOnlyRecipeIds・getMonthlyDataTransferCount・logDataTransfer）は
// ./plan-limits-server.ts に移動した（このファイルをクライアントコンポーネントから
// 安全にimportできるようにするため。上部の2026-09コメント参照）。
// サーバー側のコードは引き続き '@/lib/plan-limits-server' からimportすること。
