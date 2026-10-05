// lib/amazon-associate.ts
// Amazonアソシエイト（2026-10-05追加）
// フリープランのダッシュボード下部に「食品ラベル作りに役立つアイテム」を表示する。
//
// ・リンクはAmazonのキーワード検索結果へ飛ばし、トラッキングIDを付ける。
//   個別商品（ASIN）を調べなくても使え、検索結果から購入された場合も報酬の対象になる。
// ・Amazonの商品画像・価格は表示しない（規約上、画像や価格を表示する場合は
//   Amazonが提供するツール／PA-APIの利用が必要で、価格を手書きで載せることは禁止されている）。
// ・規約で必要な表記は AMAZON_DISCLOSURE を必ずリンクの近くに表示する。
// ・商品を入れ替えるときは AMAZON_ITEMS を編集するだけでよい。

export const AMAZON_TRACKING_ID = 'luckefoodlabel-22';

export const AMAZON_DISCLOSURE =
  'Amazonのアソシエイトとして、FoodLabel Proは適格販売により収入を得ています。';

export type AmazonItem = {
  title: string;   // カードの見出し
  note: string;    // 一言説明
  keyword: string; // Amazonの検索キーワード
  icon: string;    // 絵文字アイコン
};

export const AMAZON_ITEMS: AmazonItem[] = [
  { icon: '🏷️', title: 'A4ラベルシール（面付け）', note: '家庭用プリンタで食品表示ラベルを印刷', keyword: 'ラベルシール A4 食品表示' },
  { icon: '🖨️', title: 'ラベルプリンター',         note: '1枚ずつ素早く・ロール紙で手間なし',   keyword: 'ラベルプリンター 食品表示' },
  { icon: '🧻', title: '感熱ラベル ロール',         note: 'ラベルプリンター用の交換ロール',       keyword: '感熱ラベル ロール 食品' },
  { icon: '⚖️', title: 'デジタルスケール 0.1g',    note: '配合量を正確に量って成分計算の精度UP', keyword: 'デジタルスケール 0.1g キッチン' },
  { icon: '🛍️', title: 'OPP袋（テープ付き）',      note: '焼き菓子の個包装にラベルを貼って販売', keyword: 'OPP袋 テープ付き お菓子' },
  { icon: '🔥', title: '卓上シーラー',              note: '袋の口をしっかり密封',                 keyword: '卓上シーラー 菓子' },
  { icon: '🌿', title: '脱酸素剤・乾燥剤',          note: '焼き菓子の品質保持・賞味期限対策に',   keyword: '脱酸素剤 食品 焼き菓子' },
  { icon: '📦', title: 'ギフトボックス',            note: '詰め合わせ販売・贈答用に',             keyword: 'ギフトボックス 焼き菓子' },
];

export function amazonSearchUrl(keyword: string) {
  const params = new URLSearchParams({ k: keyword, tag: AMAZON_TRACKING_ID });
  return `https://www.amazon.co.jp/s?${params.toString()}`;
}

// 表示する商品をランダムに選ぶ（ページを開くたびに入れ替わる）
export function pickAmazonItems(count: number): AmazonItem[] {
  const a = [...AMAZON_ITEMS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, count);
}
