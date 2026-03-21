// ============================================================
// lib/allergen.ts - アレルゲン自動判定ロジック
// 食品表示法（食品表示基準）に基づく
// ============================================================

// 特定原材料8品目（表示義務）
export const REQUIRED_ALLERGENS: Record<string, string[]> = {
  'えび':  ['えび', 'エビ', '海老', '蝦', 'シュリンプ'],
  'かに':  ['かに', 'カニ', '蟹', 'クラブ'],
  '小麦':  ['小麦', '強力粉', '薄力粉', '中力粉', '準強力粉', '全粒粉', 'ライ麦粉', 'ライ麦', 'ふすま粉', 'グルテン', '大麦', '燕麦'],
  'そば':  ['そば', 'ソバ', '蕎麦', 'そば粉'],
  '卵':    ['卵', '全卵', '卵黄', '卵白', 'たまご', 'タマゴ', '鶏卵', '乾燥卵白', 'メレンゲ', 'マヨネーズ'],
  '乳':    ['牛乳', '生クリーム', 'バター', 'チーズ', 'ヨーグルト', 'クリームチーズ', 'マスカルポーネ',
            'ホワイトチョコ', '乳', 'バターミルク', 'スキムミルク', '脱脂粉乳', 'カスタード', 'クリーム',
            'アイスクリーム', 'チョコレート', 'クーベルチュール'],
  '落花生': ['落花生', 'ピーナッツ', 'ピーナツ', 'ピーナッツバター'],
  'くるみ': ['くるみ', 'クルミ', '胡桃', 'ウォルナット'],
};

// 特定原材料に準ずるもの20品目（推奨表示）
export const OPTIONAL_ALLERGENS: Record<string, string[]> = {
  'アーモンド':    ['アーモンド', 'アーモンドプードル', 'アーモンドミルク', 'アーモンドスライス'],
  'あわび':        ['あわび', 'アワビ', '鮑'],
  'いか':          ['いか', 'イカ', '烏賊'],
  'いくら':        ['いくら', 'イクラ'],
  'オレンジ':      ['オレンジ', 'オレンジピール', 'オレンジジュース'],
  'カシューナッツ': ['カシューナッツ'],
  'キウイフルーツ': ['キウイ', 'キウイフルーツ'],
  '牛肉':          ['牛肉', 'ビーフ', '牛', 'ビーフエキス', 'ゼラチン'],
  'ごま':          ['ごま', 'ゴマ', '胡麻', 'セサミ', 'ごま油', 'タヒニ'],
  'さけ':          ['さけ', 'サケ', '鮭', 'サーモン', '塩鮭'],
  'さば':          ['さば', 'サバ', '鯖'],
  '大豆':          ['大豆', '豆乳', '豆腐', '味噌', 'みそ', 'しょうゆ', '醤油', '枝豆', '酒粕', 'きなこ', '油揚げ'],
  '鶏肉':          ['鶏肉', 'チキン', '鶏', 'ターキー', 'チキンエキス'],
  'バナナ':        ['バナナ'],
  '豚肉':          ['豚肉', 'ポーク', 'ベーコン', 'ハム', 'ウインナー', 'ソーセージ', '豚', 'ポークエキス', 'ポークビッツ'],
  'まつたけ':      ['まつたけ', 'マツタケ', '松茸'],
  'もも':          ['もも', 'モモ', '桃', 'ピーチ'],
  'やまいも':      ['やまいも', 'ヤマイモ', '山芋', '長芋', '大和芋'],
  'りんご':        ['りんご', 'リンゴ', '林檎', 'アップル', 'アップルジュース'],
  'ゼラチン':      ['ゼラチン', 'コラーゲン', '板ゼラチン', '粉ゼラチン'],
};

export const ALL_ALLERGENS = { ...REQUIRED_ALLERGENS, ...OPTIONAL_ALLERGENS };

/**
 * 食材名からアレルゲンを自動判定する
 * @param ingredientName - 食材名
 * @returns 含まれるアレルゲン名の配列
 */
export function detectAllergens(ingredientName: string): string[] {
  const detected: string[] = [];
  const name = ingredientName.trim();

  for (const [allergen, keywords] of Object.entries(ALL_ALLERGENS)) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        detected.push(allergen);
        break;
      }
    }
  }

  return detected;
}

/**
 * レシピの全材料からアレルゲンを集約する
 * @param ingredients - 材料リスト（アレルゲン配列付き）
 * @returns アレルゲン情報
 */
export function collectRecipeAllergens(
  ingredients: Array<{
    allergens?:       string[];
    allergenOverride?: string[];
    ingredientName:    string;
  }>
): {
  required: string[];   // 義務表示8品目
  optional: string[];   // 推奨表示20品目
  all:      string[];   // 全部
} {
  const allDetected = new Set<string>();

  for (const ing of ingredients) {
    // allergenOverrideがあればそれを優先、なければ自動判定 + ingredientsのallergens
    const sources = ing.allergenOverride?.length
      ? ing.allergenOverride
      : [
          ...(ing.allergens ?? []),
          ...detectAllergens(ing.ingredientName),
        ];

    for (const a of sources) {
      allDetected.add(a);
    }
  }

  const required = Object.keys(REQUIRED_ALLERGENS).filter(a => allDetected.has(a));
  const optional = Object.keys(OPTIONAL_ALLERGENS).filter(a => allDetected.has(a));

  return {
    required,
    optional,
    all: [...required, ...optional],
  };
}

/**
 * アレルゲン表示文字列を生成する
 * 例: "（原材料の一部に小麦・乳・卵を含む）"
 * @param allergens - アレルゲン名の配列
 * @returns アレルゲン表示文字列（空の場合は空文字）
 */
export function buildAllergenLabel(allergens: string[]): string {
  if (allergens.length === 0) return '';
  return `（原材料の一部に${allergens.join('・')}を含む）`;
}

/**
 * 原材料表示文字列を生成する（食品表示法準拠）
 * @param ingredients - 重量順にソート済みの材料リスト
 * @param allergens - 集約済みアレルゲン
 * @returns 原材料表示文字列
 */
export function buildIngredientsLabel(
  ingredients: Array<{
    ingredientName: string;
    displayOrder?:  number;
    amount:         number;
    unit:           string;
  }>,
  allergens: string[]
): string {
  const names = ingredients
    .map(i => {
      const name = i.ingredientName.trim();
      return name;
    })
    .filter(Boolean);

  const allergenText = buildAllergenLabel(allergens);
  return names.join('、') + allergenText;
}

/**
 * アレルゲンが特定原材料8品目かどうか判定する
 */
export function isRequiredAllergen(name: string): boolean {
  return name in REQUIRED_ALLERGENS;
}
