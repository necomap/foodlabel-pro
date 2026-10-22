// ============================================================
// lib/allergen.ts - アレルゲン自動判定ロジック
// 食品表示法（食品表示基準）に基づく
// ============================================================

import { toGrams } from './nutrition';

// 特定原材料9品目（表示義務）
// 2026-10-22: 食品表示基準の改正（令和8年4月1日施行・経過措置は令和10年3月31日まで）で
// カシューナッツが特定原材料（義務）に移ったため、推奨側からこちらへ移動した。
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
  'カシューナッツ': ['カシューナッツ', 'カシュー'],
};

// 特定原材料に準ずるもの20品目（推奨表示）※2026-04改正後の品目
export const OPTIONAL_ALLERGENS: Record<string, string[]> = {
  'アーモンド':    ['アーモンド', 'アーモンドプードル', 'アーモンドミルク', 'アーモンドスライス'],
  'あわび':        ['あわび', 'アワビ', '鮑'],
  'いか':          ['いか', 'イカ', '烏賊'],
  'いくら':        ['いくら', 'イクラ'],
  'オレンジ':      ['オレンジ', 'オレンジピール', 'オレンジジュース'],
  'キウイフルーツ': ['キウイ', 'キウイフルーツ'],
  // ゼラチンは独立した推奨品目（下の'ゼラチン'）であり、原料は牛とは限らない（豚由来も多い）ため牛肉の判定語から外した
  '牛肉':          ['牛肉', 'ビーフ', '牛', 'ビーフエキス'],
  'ごま':          ['ごま', 'ゴマ', '胡麻', 'セサミ', 'ごま油', 'タヒニ'],
  'さけ':          ['さけ', 'サケ', '鮭', 'サーモン', '塩鮭'],
  'さば':          ['さば', 'サバ', '鯖'],
  '大豆':          ['大豆', '豆乳', '豆腐', '味噌', 'みそ', 'しょうゆ', '醤油', '枝豆', '酒粕', 'きなこ', '油揚げ'],
  // 2026-10-22: 食品成分表の表記（にわとり・若どり・鳥肉）でも判定できるよう追加
  '鶏肉':          ['鶏肉', 'チキン', '鶏', 'ターキー', 'チキンエキス', 'にわとり', '若どり', '鳥肉'],
  'バナナ':        ['バナナ'],
  '豚肉':          ['豚肉', 'ポーク', 'ベーコン', 'ハム', 'ウインナー', 'ソーセージ', '豚', 'ポークエキス', 'ポークビッツ'],
  'マカダミアナッツ': ['マカダミアナッツ', 'マカダミア', 'macadamia'],
  'もも':          ['もも', 'モモ', '桃', 'ピーチ'],
  'やまいも':      ['やまいも', 'ヤマイモ', '山芋', '長芋', '大和芋'],
  'りんご':        ['りんご', 'リンゴ', '林檎', 'アップル', 'アップルジュース'],
  'ゼラチン':      ['ゼラチン', 'コラーゲン', '板ゼラチン', '粉ゼラチン'],
  // 2026-10-22: 同じ改正で推奨品目に追加
  'ピスタチオ':    ['ピスタチオ'],
};

export const ALL_ALLERGENS = { ...REQUIRED_ALLERGENS, ...OPTIONAL_ALLERGENS };

// 判定語を部分一致で探す際の明らかな誤判定を防ぐため、先に取り除く語（2026-09-27追加）。
// 例: 「豆乳」→乳、「鶏もも肉」→もも（桃）、「牛乳」→牛肉、「鶏卵」→鶏肉 と誤判定されていた。
const DETECT_EXCLUSIONS: Record<string, string[]> = {
  '乳':   ['豆乳', '乳化剤', 'ピーナッツバター', 'ピーナツバター'],
  '牛肉': ['牛乳', '牛蒡'],
  '鶏肉': ['鶏卵'],
  'もも': ['もも肉', 'モモ肉', 'すもも', 'スモモ'],
};

// 肉の部位としての「もも」を判定から外すための、肉を表す語（2026-10-22追加）
const MEAT_WORDS = ['肉', '鶏', '豚', '牛', 'チキン', 'ポーク', 'ビーフ', 'にわとり', '若どり', 'ぶた', '羊', '鴨', 'ターキー'];

/**
 * 食材名からアレルゲンを自動判定する
 * @param ingredientName - 食材名
 * @returns 含まれるアレルゲン名の配列
 */
export function detectAllergens(ingredientName: string): string[] {
  const detected: string[] = [];
  const name = ingredientName.trim();

  // 2026-10-22: 「鶏肉（もも）」「豚もも」「若鶏もも」のように、肉の部位としての「もも」が
  // 果物の「もも（桃）」と誤判定されていた。肉を表す語を含む名前では、ひらがな・カタカナの
  // 「もも／モモ」を判定から外す（「桃」「ピーチ」は引き続き判定する）。
  const isMeatName = MEAT_WORDS.some(w => name.includes(w));

  for (const [allergen, keywords] of Object.entries(ALL_ALLERGENS)) {
    let target = name;
    for (const ex of DETECT_EXCLUSIONS[allergen] ?? []) target = target.split(ex).join('');
    if (allergen === 'もも' && isMeatName) target = target.split('もも').join('').split('モモ').join('');
    for (const keyword of keywords) {
      if (target.includes(keyword)) {
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
    // 複合原材料の内訳（原材料・添加物の文字列）。2026-10-22: 内訳に書かれたアレルゲンの表示漏れを
    // 防ぐため、食材マスタのアレルゲンに加えて内訳の文字列からも自動判定して足す（表示が多くなる側に倒す）
    compositeText?: string | null;
  }>
): {
  required: string[];   // 義務表示9品目
  optional: string[];   // 推奨表示20品目（品目名に無い自由入力のアレルゲンも末尾に含める）
  all:      string[];   // 全部
} {
  const allDetected = new Set<string>();
  // 2026-10-22: 食材マスタのアレルゲンは自由入力のため、「乳成分」「小麦粉」のように品目名と
  // 一致しない書き方をすると、以前はラベルから黙って消えていた（表示漏れ）。
  // 品目名に寄せられるものは寄せ、寄せられないものも消さずにそのまま表示する。
  const others: string[] = [];

  for (const ing of ingredients) {
    // 食材マスタに紐づいている場合は、マスタ側のallergensのみを信頼する（最優先・唯一の情報源）。
    // 紐づいていない（自由入力の）場合のみ、allergenOverride→無ければ名前からの自動判定、の順で使う。
    const sources = ing.hasIngredientLink
      ? (ing.allergens ?? [])
      : ing.allergenOverride?.length
        ? ing.allergenOverride
        : detectAllergens(ing.ingredientName);

    const fromComposite = splitLabelList(ing.compositeText).flatMap(t => detectAllergens(t));
    for (const raw of [...sources, ...fromComposite]) {
      const a = (raw ?? '').trim();
      if (!a) continue;
      if (a in ALL_ALLERGENS) { allDetected.add(a); continue; }
      const norm = a === '乳成分' ? ['乳'] : detectAllergens(a);
      if (norm.length > 0) norm.forEach(n => allDetected.add(n));
      else if (!others.includes(a)) others.push(a);
    }
  }

  const required = Object.keys(REQUIRED_ALLERGENS).filter(a => allDetected.has(a));
  const optional = [...Object.keys(OPTIONAL_ALLERGENS).filter(a => allDetected.has(a)), ...others];

  return {
    required,
    optional,
    all: [...required, ...optional],
  };
}

/**
 * ラベル表記用のアレルゲン名（品目名「乳」は表示上「乳成分」と書く）
 */
export function toLabelAllergenName(a: string): string {
  return a === '乳' ? '乳成分' : a;
}

/**
 * アレルゲン表示文字列を生成する（一括表示）
 * 例: "（一部に小麦・卵・乳成分を含む）"
 * 2026-10-22: 消費者庁の表示例に合わせ、「原材料の一部に」→「一部に」、「乳」→「乳成分」に修正した
 * @param allergens - アレルゲン名の配列
 * @returns アレルゲン表示文字列（空の場合は空文字）
 */
export function buildAllergenLabel(allergens: string[]): string {
  if (allergens.length === 0) return '';
  return `（一部に${allergens.map(toLabelAllergenName).join('・')}を含む）`;
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
  // 複合原材料の内訳（原材料／添加物）。2026-10-22新設
  compositeIngredients?: string | null;
  compositeAdditives?:   string | null;
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
      (m.compositeIngredients ?? '') === (ing.compositeIngredients ?? '') &&
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

  // 重量順：g・kg・ml・L等はグラム換算して比較する（以前はg同士しか比較せず、
  // 牛乳200mlのような材料が重量順に並ばなかった）。重量換算できない単位（個など）は元の並び順。
  // 比較関数が矛盾しないよう、全て重量換算できる場合のみ重量で比べる。
  return merged.sort((a, b) => {
    const ga = toGrams(a.amount ?? 0, a.unit), gb = toGrams(b.amount ?? 0, b.unit);
    if (a.sortByWeight !== false && b.sortByWeight !== false && ga != null && gb != null && ga !== gb) return gb - ga;
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
// 添加物の用途のうち、一括名だけで表示できるもの（食品表示基準 別表第7の一括名のうち選択肢にあるもの）
const BULK_NAME_ADDITIVE_PURPOSES = ['乳化剤', 'pH調整剤', '膨張剤', '香料', '酸味料', 'イーストフード', 'かんすい', '酵素', '光沢剤', 'ガムベース', '軟化剤', '苦味料', '豆腐用凝固剤'];
// 添加物の用途のうち、用途名を付けず物質名だけを書くもの（強化剤・加工助剤等は表示免除の場合が多い）
const NAME_ONLY_ADDITIVE_PURPOSES = ['強化剤', '製造用剤'];

/** 読点・カンマ区切りの文字列を項目に分ける（かっこ内の読点では分けない） */
export function splitLabelList(text: string | null | undefined): string[] {
  const src = (text ?? '').trim();
  if (!src) return [];
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of src) {
    if (ch === '（' || ch === '(') depth++;
    if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === '、' || ch === ',' || ch === '，' || ch === '\n')) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function buildIngredientsLabel(
  ingredients: Array<{
    ingredientName: string;
    displayOrder?:  number;
    amount:         number;
    unit:           string;
    originCountry?: string;
    isAdditive?:    boolean;
    additiveReason?: string;
    compositeIngredients?: string | null;
    compositeAdditives?:   string | null;
  }>,
  allergens: string[]
): string {
  // 原材料と添加物を分離
  const mainIngredients = ingredients.filter(i => !i.isAdditive);

  // 原材料名（先頭に原産国を追加）。複合原材料は「名前（内訳）」で展開する（2026-10-22）
  const mainNames = mainIngredients
    .map((i, idx) => {
      let name = i.ingredientName.trim();
      if (!name) return '';
      if (idx === 0 && i.originCountry) name = `${name}（${i.originCountry}）`;
      const inner = splitLabelList(i.compositeIngredients);
      if (inner.length > 0) name = `${name}（${inner.join('、')}）`;
      return name;
    })
    .filter(Boolean);

  // 添加物を用途別にグループ化（重量順＝登場順を保つ）
  // 2026-10-22: 以前は「ベーキングパウダー（膨張剤として）」のように「物質名（用途＋として）」で
  // 出力していたが、食品表示基準の書き方ではない。次のように出力する（保存値は「〇〇として」のままでよい）:
  //   ・用途名併記が必要な8用途（甘味料・着色料・保存料・増粘剤等・酸化防止剤・発色剤・漂白剤・防かび剤）
  //     → 「用途名（物質名）」 例: 保存料（ソルビン酸K）
  //   ・調味料 → 「調味料（物質名）」 例: 調味料（アミノ酸等）
  //   ・一括名で表示できる用途（乳化剤・膨張剤・香料・酸味料・pH調整剤など）→ 一括名のみ 例: 膨張剤
  //   ・強化剤・製造用剤（表示免除の場合が多い）→ 物質名のみ
  //   ・「その他」で自由入力された用途 → 「用途（物質名）」
  // 複合原材料の内訳に含まれる添加物（compositeAdditives）は、入力された文字列のまま、
  // その複合原材料の重量順の位置に差し込む（同じ表記は1回だけ）。
  type Slot = { kind: 'group'; key: string } | { kind: 'text'; text: string };
  const slots: Slot[] = [];
  const additiveGroups: Record<string, string[]> = {};
  ingredients.forEach(i => {
    if (i.isAdditive) {
      const name = i.ingredientName.trim();
      if (!name) return;
      let reason = (i.additiveReason ?? '').trim().replace(/として$/, '');
      if (reason === 'その他') reason = '';  // 「その他」を選んで用途名を未入力のまま
      const key = reason || '__none__';
      if (!additiveGroups[key]) { additiveGroups[key] = []; slots.push({ kind: 'group', key }); }
      if (!additiveGroups[key].includes(name)) additiveGroups[key].push(name);
    } else {
      for (const t of splitLabelList(i.compositeAdditives)) slots.push({ kind: 'text', text: t });
    }
  });

  const additiveTexts: string[] = [];
  const pushText = (t: string) => { if (t && !additiveTexts.includes(t)) additiveTexts.push(t); };
  slots.forEach(slot => {
    if (slot.kind === 'text') { pushText(slot.text); return; }
    const key = slot.key;
    const names = additiveGroups[key];
    if (key === '__none__' || NAME_ONLY_ADDITIVE_PURPOSES.includes(key)) {
      names.forEach(pushText);
    } else if (BULK_NAME_ADDITIVE_PURPOSES.includes(key)) {
      pushText(key);
    } else {
      pushText(`${key}（${names.join('、')}）`);
    }
  });

  const allergenText = buildAllergenLabel(allergens);
  const mainText = mainNames.join('、');
  const additiveText = additiveTexts.length > 0 ? `/${additiveTexts.join('、')}` : '';

  return mainText + additiveText + allergenText;
}

/**
 * アレルゲンが特定原材料9品目かどうか判定する
 */
export function isRequiredAllergen(name: string): boolean {
  return name in REQUIRED_ALLERGENS;
}

/**
 * 食材マスタに登録されたアレルゲンと、食材名からの自動判定の食い違いを調べる（2026-10-22新設）。
 * 食材マスタに紐づいた材料は、ラベルにはマスタのアレルゲンだけが使われる（名前からの再判定はしない）ため、
 * 登録時に入れ忘れると表示漏れになる。印刷前の警告に使う。
 *   missing    … 名前から判定できるのにマスタに無い品目（表示漏れの疑い）
 *   suspicious … 肉の部位の「もも」を果物の「もも」として登録している疑い（以前の誤判定の名残）
 */
export function checkMasterAllergens(ingredientName: string, masterAllergens: string[]): { missing: string[]; suspicious: string[] } {
  const normalized = new Set(masterAllergens.map(a => (a === '乳成分' ? '乳' : a.trim())));
  const missing = detectAllergens(ingredientName).filter(a => !normalized.has(a));
  const isMeatName = MEAT_WORDS.some(w => ingredientName.includes(w));
  const suspicious = isMeatName && normalized.has('もも') && !/桃|ピーチ/.test(ingredientName) ? ['もも'] : [];
  return { missing, suspicious };
}

// 複合原材料であることが多い食材名（内訳の登録漏れの注意喚起用）
const LIKELY_COMPOSITE_WORDS = ['チョコ', 'あん', '餡', 'ジャム', 'マーガリン', 'ショートニング', 'カスタード', 'ソース', 'ケチャップ',
  'マヨネーズ', 'ミックス', 'フィリング', 'ガナッシュ', 'プラリネ', 'クッキー', 'ビスケット', 'コーンフレーク', 'ホイップ', 'フラワーペースト', 'ドレッシング', 'ルウ', 'ルー'];
export function isLikelyComposite(ingredientName: string): boolean {
  return LIKELY_COMPOSITE_WORDS.some(w => ingredientName.includes(w));
}
