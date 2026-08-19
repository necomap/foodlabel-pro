// ============================================================
// lib/ec-text-generator.ts - EC商品ページ用テキスト自動生成（Proプラン限定機能）
// ============================================================
// 2026-08 プロプラン新設の目玉機能④。レシピに登録済みの情報（原材料・アレルゲン・
// 栄養成分・内容量・保存方法など）から、BASE/STORES/minne/Instagram等の商品ページに
// そのまま貼り付けられる下書きテキストを自動生成する。
//
// 外部AI APIは使わず、テンプレートへの差し込みのみで完結させている
// （ユーザー数がまだ少ない段階での運用コストをゼロに抑えるため。生成のたびに
// API利用料が発生する仕組みではない）。将来的にAI生成オプションを追加する場合でも、
// このテンプレート方式は「無料版」として残す想定。
//
// 重要な注意: 生成される文章はあくまで下書き。医薬品的な効能効果を暗示する表現や、
// 実際と異なる誇大な表現になっていないか（景品表示法）、原材料・アレルゲン・栄養成分の
// 表示内容が正しいか（食品表示法）は、必ずユーザー自身が確認・編集すること。
// UI側にも同様の免責文言を表示する（app/dashboard/recipes/[id]/page.tsx参照）。

import type { NutritionValues } from '@/types';

export type EcTextStyle = 'simple' | 'warm' | 'gift';

export const EC_TEXT_STYLES: { key: EcTextStyle; label: string; desc: string }[] = [
  { key: 'simple', label: 'シンプル',   desc: '事実ベースで簡潔に伝えるスタイル' },
  { key: 'warm',   label: 'あたたかみ', desc: '手作り感・ぬくもりを伝えるスタイル' },
  { key: 'gift',   label: 'ギフト向け', desc: '贈り物としての魅力を伝えるスタイル' },
];

export interface EcTextInput {
  name:              string;
  categoryName?:     string | null;
  ingredientsLabel:  string;
  allergens?:        string[];
  contentAmount?:    string | null;
  storageMethod?:    string | null;
  shelfLifeDays?:    number | null;
  shelfLifeType?:    'BEST_BEFORE' | 'USE_BY' | null;
  qualityControl?:   string | null;
  nutritionPerUnit?: NutritionValues | null;
}

export interface EcTextOutput {
  catchcopies:      string[];
  description:      string;
  ingredientsBlock: string;
  allergenBlock:    string;
  nutritionBlock:   string;
  storageBlock:     string;
  fullText:         string;
}

function shelfLifeLine(input: EcTextInput): string | null {
  if (input.shelfLifeDays == null) return null;
  const type = input.shelfLifeType === 'USE_BY' ? '消費期限' : '賞味期限';
  return `${type}の目安：発送（製造）から${input.shelfLifeDays}日`;
}

export function generateEcText(input: EcTextInput, style: EcTextStyle = 'simple'): EcTextOutput {
  const name     = input.name?.trim() || '商品名未設定';
  const category = input.categoryName?.trim() || '';

  // ---- キャッチコピー候補（3案） ----
  const catchcopies: Record<EcTextStyle, string[]> = {
    simple: [
      category ? `${category}「${name}」` : name,
      `一つひとつ丁寧に仕上げた${name}`,
      `${name}のご紹介`,
    ],
    warm: [
      `毎日の食卓にそっと寄り添う、${name}`,
      `心を込めて仕上げた、あたたかい${name}`,
      `おうち時間にほっとひと息、${name}`,
    ],
    gift: [
      `大切な方へ贈りたい、${name}`,
      `特別な日を彩る、上質な${name}`,
      `ギフトにも喜ばれる${name}`,
    ],
  };

  // ---- 商品説明文 ----
  const introLine: Record<EcTextStyle, string> = {
    simple: category ? `${category}の「${name}」です。` : `「${name}」です。`,
    warm:   category
      ? `一つひとつ手作りした${category}「${name}」を、心を込めてお届けします。`
      : `一つひとつ手作りした「${name}」を、心を込めてお届けします。`,
    gift:   category
      ? `大切な方への贈り物にふさわしい、${category}「${name}」をご用意しました。`
      : `大切な方への贈り物にふさわしい「${name}」をご用意しました。`,
  };
  const ingredientsSentence = input.ingredientsLabel?.trim()
    ? '厳選した原材料を使用し、素材の味わいを大切に仕上げました。'
    : '';
  const closingLine: Record<EcTextStyle, string> = {
    simple: 'ぜひ一度お試しください。',
    warm:   '大切な方との時間に、ぜひ添えてみてください。',
    gift:   '心を込めて、丁寧にお包みしてお届けいたします。',
  };
  const description = [introLine[style], ingredientsSentence, closingLine[style]]
    .filter(Boolean).join('\n');

  // ---- 原材料表示 ----
  const ingredientsBlock = input.ingredientsLabel?.trim()
    ? `【原材料】\n${input.ingredientsLabel.trim()}`
    : '';

  // ---- アレルゲン ----
  const allergenBlock = input.allergens && input.allergens.length > 0
    ? `【アレルギー物質】\n本品には ${input.allergens.join('・')} を含みます。`
    : '';

  // ---- 栄養成分（1個あたり・推定値） ----
  const n = input.nutritionPerUnit;
  const nutritionLines = n
    ? [
        n.energyKcal     != null ? `熱量：${Math.round(n.energyKcal)}kcal` : null,
        n.protein        != null ? `たんぱく質：${n.protein}g` : null,
        n.fat            != null ? `脂質：${n.fat}g` : null,
        n.carbohydrate   != null ? `炭水化物：${n.carbohydrate}g` : null,
        n.saltEquivalent != null ? `食塩相当量：${n.saltEquivalent}g` : null,
      ].filter((v): v is string => !!v)
    : [];
  const nutritionBlock = nutritionLines.length > 0
    ? `【栄養成分表示（1個あたり・推定値）】\n${nutritionLines.join('\n')}`
    : '';

  // ---- 内容量・保存方法・期限 ----
  const storageLines = [
    input.contentAmount?.trim() ? `内容量：${input.contentAmount.trim()}` : null,
    input.storageMethod?.trim() ? `保存方法：${input.storageMethod.trim()}` : null,
    shelfLifeLine(input),
  ].filter((v): v is string => !!v);
  const storageBlock = storageLines.length > 0
    ? `【お届けについて】\n${storageLines.join('\n')}`
    : '';

  const noteBlock = input.qualityControl?.trim()
    ? `【お願い・注意事項】\n${input.qualityControl.trim()}`
    : '';

  const disclaimer = '※本文は登録内容から自動生成した下書きです。実際の販売ページに掲載する前に、表現内容（景品表示法等）や表示内容（食品表示法等）を必ずご自身でご確認・修正してください。';

  const fullText = [
    catchcopies[style][0],
    description,
    ingredientsBlock,
    allergenBlock,
    nutritionBlock,
    storageBlock,
    noteBlock,
    disclaimer,
  ].filter(b => b && b.trim().length > 0).join('\n\n');

  return { catchcopies: catchcopies[style], description, ingredientsBlock, allergenBlock, nutritionBlock, storageBlock, fullText };
}
