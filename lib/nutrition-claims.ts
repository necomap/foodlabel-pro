// ============================================================
// lib/nutrition-claims.ts - 栄養強調表示の判定（目安）（2026-11新設）
// ============================================================
// 「低カロリー」「たんぱく質たっぷり」などの栄養強調表示（絶対表示）ができる条件を、
// 食品100g（飲料は100ml）あたりの量から判定する。レシピ詳細画面に「目安」として表示する。
//
// 基準値の出典（2026-11 確認）:
//   ・別表第12（補給ができる旨・高い旨／含む旨）… 令和7年3月28日改正後の値
//     東京都「栄養成分表示ハンドブック」改正点（令和7年3月28日より適用）
//   ・別表第13（適切な摂取ができる旨・含まない旨／低い旨）
//     東京都「栄養成分表示ハンドブック」第4章 表6、消費者庁「食品表示基準について」（令和8年4月1日改正後全文）
//   基準値を変えるときは必ず消費者庁・自治体の最新資料で確認してから直すこと（記憶で書かない）。
//
// このアプリで判定しないもの（データが無い／比較対象が要る）:
//   ・飽和脂肪酸・コレステロール … 飽和脂肪酸のデータが無く、付帯条件（飽和脂肪酸由来の熱量10%等）を確認できない
//   ・糖類 … このアプリの「糖質」は糖類とは別物（糖類＝単糖類・二糖類）なので判定に使えない
//   ・ミネラル・ビタミン … レシピ単位で集計していない
//   ・低減された旨／強化された旨（〇〇30%カット・減塩・2倍など）… 比較対象食品との比較が必要な相対表示
//   ・「糖類無添加」「食塩不使用」… 無添加強調表示は原材料の使い方の要件で、量の基準ではない

export type ClaimKind = 'free' | 'low' | 'high' | 'source';

export interface Per100Values {
  energyKcal:   number | null;
  protein:      number | null;
  fat:          number | null;
  sodium:       number | null;   // mg
  dietaryFiber: number | null;
}

export interface ClaimResult {
  nutrient:  string;          // 熱量・脂質など
  kind:      ClaimKind;
  examples:  string;          // 表現例
  ok:        boolean | null;  // null = 値が無く判定できない
  value:     number | null;   // 100g(100ml)あたりの値
  unit:      string;
  threshold: string;          // 基準の説明（例: 40kcal以下）
  basis?:    string;          // 100kcalあたりで満たした等の補足
}

// 別表第13（100g／100mlあたり）。含まない旨は「未満」、低い旨は「以下」
const LOW_TABLE = [
  { key: 'energyKcal' as const, nutrient: '熱量', unit: 'kcal', free: [5, 5],     low: [40, 20],
    freeEx: 'ノンカロリー・カロリーゼロ', lowEx: '低カロリー・カロリーひかえめ' },
  { key: 'fat' as const,        nutrient: '脂質', unit: 'g',    free: [0.5, 0.5], low: [3, 1.5],
    freeEx: '無脂肪・ノンファット',       lowEx: '低脂肪・脂質ひかえめ' },
  { key: 'sodium' as const,     nutrient: 'ナトリウム', unit: 'mg', free: [5, 5], low: [120, 120],
    freeEx: '食塩ゼロ・ナトリウムゼロ',   lowEx: '低塩・塩分ひかえめ' },
];

// 別表第12（令和7年3月28日改正後）。[100gあたり, 100mlあたり, 100kcalあたり]、いずれかを満たせばよい
const HIGH_TABLE = [
  { key: 'protein' as const,      nutrient: 'たんぱく質', unit: 'g', high: [17.0, 8.5, 8.5], source: [8.5, 4.3, 4.3],
    highEx: '高たんぱく・たんぱく質たっぷり', sourceEx: 'たんぱく質入り・たんぱく質源' },
  { key: 'dietaryFiber' as const, nutrient: '食物繊維',   unit: 'g', high: [6, 3, 3],         source: [3, 1.5, 1.5],
    highEx: '食物繊維たっぷり・食物繊維豊富', sourceEx: '食物繊維入り・食物繊維源' },
];

const fmt = (v: number) => (Math.round(v * 100) / 100).toString();

/**
 * 栄養強調表示（絶対表示）の判定
 * @param per100 食品100g（liquidなら100ml）あたりの量
 * @param liquid 一般に飲用に供する液状の食品（100ml基準）として判定する
 */
export function judgeNutritionClaims(per100: Per100Values, liquid = false): ClaimResult[] {
  const col = liquid ? 1 : 0;
  const per = liquid ? '100ml' : '100g';
  const results: ClaimResult[] = [];

  for (const row of LOW_TABLE) {
    const v = per100[row.key];
    const free = row.free[col];
    const low  = row.low[col];
    results.push({
      nutrient: row.nutrient, kind: 'free', examples: row.freeEx, unit: row.unit, value: v,
      ok: v == null ? null : v < free,
      threshold: `${per}あたり${free}${row.unit}未満`,
    });
    results.push({
      nutrient: row.nutrient, kind: 'low', examples: row.lowEx, unit: row.unit, value: v,
      ok: v == null ? null : v <= low,
      threshold: `${per}あたり${low}${row.unit}以下`,
    });
  }

  const kcal = per100.energyKcal;
  for (const row of HIGH_TABLE) {
    const v = per100[row.key];
    for (const kind of ['high', 'source'] as const) {
      const t = kind === 'high' ? row.high : row.source;
      const perWeight = t[col];
      const perKcal   = t[2];
      // 100kcalあたりの量（熱量が0や不明なら使わない）
      const per100kcal = v != null && kcal != null && kcal > 0 ? (v / kcal) * 100 : null;
      const okWeight = v != null && v >= perWeight;
      const okKcal   = per100kcal != null && per100kcal >= perKcal;
      results.push({
        nutrient: row.nutrient, kind,
        examples: kind === 'high' ? row.highEx : row.sourceEx,
        unit: row.unit, value: v,
        ok: v == null ? null : okWeight || okKcal,
        threshold: `${per}あたり${perWeight}${row.unit}以上 または 100kcalあたり${perKcal}${row.unit}以上`,
        basis: !okWeight && okKcal && per100kcal != null ? `100kcalあたり${fmt(per100kcal)}${row.unit}で基準を満たす` : undefined,
      });
    }
  }
  return results;
}

export const CLAIM_KIND_LABEL: Record<ClaimKind, string> = {
  free:   '含まない旨',
  low:    '低い旨',
  high:   '高い旨',
  source: '含む旨',
};

/**
 * 「120g」「約85 g」「1個（60g）」のような内容量の文字列から1個あたりのグラム数を取り出す。
 * 「5個入」「1本」など重量が書かれていなければ null。
 */
export function parseGramsFromContentAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  const half = s.replace(/[０-９．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/ｇ/g, 'g');
  const m = half.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|mL|l|L)(?![a-zA-Z])/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n > 0)) return null;
  return /^k/i.test(m[2]) || m[2] === 'l' || m[2] === 'L' ? n * 1000 : n;
}
