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
  'マカダミアナッツ': ['マカダミアナッツ', 'マカダミア', 'macadamia'],
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
    // 食材マスタに紐づいている（ingredientIdがある）場合はtrueにする。
    // trueのときは常に食材マスタ側のallergensのみを信頼する（レシピ側に古いスナップショットが
    // 残っていても無視し、名前からの自動再判定もしない）。
    // これにより、例えば「牛乳」が名前に「牛」を含むために自動判定で誤って「牛肉」と
    // 判定されてしまうケースでも、食材マスタ側で一度修正すれば全レシピに反映されるようになる。
    // 食材マスタに紐づいていない（自由入力の）材料は、このフラグをfalse／未指定のままにする。
    hasIngredientLink?: boolean;
  }>
): {
  required: string[];   // 義務表示8品目
  optional: string[];   // 推奨表示20品目
  all:      string[];   // 全部
} {
  const allDetected = new Set<string>();

  for (const ing of ingredients) {
    // 食材マスタに紐づいている場合は、マスタ側のallergensのみを信頼する（最優先・唯一の情報源）。
    // 紐づいていない（自由入力の）場合のみ、allergenOverride→無ければ名前からの自動判定、の順で使う。
    const sources = ing.hasIngredientLink
      ? (ing.allergens ?? [])
      : ing.allergenOverride?.length
        ? ing.allergenOverride
        : detectAllergens(ing.ingredientName);

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

// 原材料表示の並び替え・合算に使う入力の共通形
export interface LabelIngredientInput {
  ingredientName: string;
  amount:         number;
  unit:           string;
  displayOrder?:  number;
  sortByWeight?:  boolean;
  originCountry?: string;
  isAdditive?:    boolean;
  additiveReason?: string;
  // このレシピでの使用分だけの非表示指定（レシピ単位の一時的な例外）
  hideFromLabel?: boolean;
  // 食材マスタ側の「常に非表示」設定（この食材を使う全レシピに効く）
  ingredientAlwaysHideFromLabel?: boolean;
}

/**
 * 原材料表示の元データを、実際に印字する順番・内容に整形する。
 *
 * - 非表示設定（食材マスタの「常に非表示」／レシピ単位の「今回は非表示」のどちらか）が
 *   付いている原材料は除外する。※ あくまで原材料名の表示だけを省略する設定であり、
 *   栄養成分計算やアレルゲン表示（buildAllergenLabel）には一切影響しない
 *   （実際に使っている以上、アレルゲンは省略してはいけないため、そちらは常に全原材料を対象にする）。
 * - 同じ表示名（一般名）の原材料が同一レシピ内で複数回登場する場合
 *   （例：卵白に混ぜる分の砂糖と卵黄に混ぜる分の砂糖）は、分量を合計して1項目にまとめる。
 *   添加物は「同じ表示名」かつ「同じ使用理由」の場合のみまとめる（理由が異なる場合は
 *   別々の情報として扱うべきなので、まとめずに両方表示する）。
 * - 合算した後の重量をもとに表示順（重量順）を決め直す。単位が異なる同名項目は
 *   合算できないため、別項目のまま残す。
 */
export function prepareIngredientsForLabel<T extends LabelIngredientInput>(ingredients: T[]): T[] {
  const visible = ingredients.filter(i => !i.hideFromLabel && !i.ingredientAlwaysHideFromLabel);

  const merged: T[] = [];
  for (const ing of visible) {
    const name = (ing.ingredientName || '').trim();
    if (!name) continue;
    const match = merged.find(m =>
      m.ingredientName.trim() === name &&
      !!m.isAdditive === !!ing.isAdditive &&
      (m.isAdditive ? (m.additiveReason ?? '') === (ing.additiveReason ?? '') : true) &&
      m.unit === ing.unit
    );
    if (match) {
      match.amount = (match.amount ?? 0) + (ing.amount ?? 0);
      match.displayOrder = Math.min(match.displayOrder ?? 0, ing.displayOrder ?? 0);
      match.sortByWeight = (match.sortByWeight ?? true) || (ing.sortByWeight ?? true);
      if (!match.originCountry && ing.originCountry) match.originCountry = ing.originCountry;
    } else {
      merged.push({ ...ing });
    }
  }

  return merged.sort((a, b) => {
    if (a.sortByWeight && a.unit === 'g' && b.unit === 'g') return (b.amount ?? 0) - (a.amount ?? 0);
    return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  });
}

/**
 * 原材料表示文字列を生成する（食品表示法準拠）
 * @param ingredients - 重量順にソート・非表示除外・同名合算まで済んだ材料リスト
 *   （通常は事前に prepareIngredientsForLabel() を通したものを渡す）
 * @param allergens - 集約済みアレルゲン
 * @returns 原材料表示文字列
 */
export function buildIngredientsLabel(
  ingredients: Array<{
    ingredientName: string;
    displayOrder?:  number;
    amount:         number;
    unit:           string;
    originCountry?: string;
    isAdditive?:    boolean;
    additiveReason?: string;
  }>,
  allergens: string[]
): string {
  // 原材料と添加物を分離
  const mainIngredients = ingredients.filter(i => !i.isAdditive);
  const additives = ingredients.filter(i => i.isAdditive);

  // 原材料名（先頭に原産国を追加）
  const mainNames = mainIngredients
    .map((i, idx) => {
      const name = i.ingredientName.trim();
      if (idx === 0 && i.originCountry) {
        return `${name}（${i.originCountry}）`;
      }
      return name;
    })
    .filter(Boolean);

  // 添加物を理由別にグループ化
  const additiveGroups: Record<string, string[]> = {};
  const additivesNoReason: string[] = [];
  additives.forEach(i => {
    const name = i.ingredientName.trim();
    if (!name) return;
    if (i.additiveReason) {
      if (!additiveGroups[i.additiveReason]) additiveGroups[i.additiveReason] = [];
      additiveGroups[i.additiveReason].push(name);
    } else {
      additivesNoReason.push(name);
    }
  });

  // 添加物テキストを生成
  const additiveTexts: string[] = [];
  Object.entries(additiveGroups).forEach(([reason, names]) => {
    additiveTexts.push(`${names.join('、')}（${reason}）`);
  });
  if (additivesNoReason.length > 0) {
    additiveTexts.push(additivesNoReason.join('、'));
  }

  const allergenText = buildAllergenLabel(allergens);
  const mainText = mainNames.join('、');
  const additiveText = additiveTexts.length > 0 ? `/${additiveTexts.join('、')}` : '';

  return mainText + additiveText + allergenText;
}

/**
 * アレルゲンが特定原材料8品目かどうか判定する
 */
export function isRequiredAllergen(name: string): boolean {
  return name in REQUIRED_ALLERGENS;
}
