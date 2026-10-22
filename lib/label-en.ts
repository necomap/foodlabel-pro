// ============================================================
// lib/label-en.ts - 英語の補助ラベル（2026-10-22新設）
// ============================================================
// 訪日客向けの店頭販売などで、日本語の法定表示とは別に貼る「英語の補助ラベル」を作る。
// 輸出先の国の表示基準（米国FDA・EU規則など）に合わせたものではない点に注意（画面にも明記する）。
//
// 英語名の決め方（材料・商品名・保存方法とも同じ考え方）:
//   1) ユーザーが登録した英語名（Ingredient.nameEn／共有食材は自分専用の上書き、Recipe.nameEn など）
//   2) 下の辞書（よく使う食材名・保存方法の決まり文句との完全一致）
//   3) どちらも無ければ日本語のまま表示し、警告一覧（missing）に入れて画面で知らせる
import { prepareIngredientsForLabel, splitLabelList } from './allergen';

// ---- アレルゲン（特定原材料9品目＋準ずるもの20品目） ----
export const ALLERGEN_EN: Record<string, string> = {
  'えび': 'Shrimp', 'かに': 'Crab', 'くるみ': 'Walnut', 'カシューナッツ': 'Cashew nut', '小麦': 'Wheat', 'そば': 'Buckwheat',
  '卵': 'Egg', '乳': 'Milk', '落花生': 'Peanut',
  'アーモンド': 'Almond', 'あわび': 'Abalone', 'いか': 'Squid', 'いくら': 'Salmon roe', 'オレンジ': 'Orange',
  'キウイフルーツ': 'Kiwi fruit', '牛肉': 'Beef', 'ごま': 'Sesame', 'さけ': 'Salmon', 'さば': 'Mackerel', '大豆': 'Soybean',
  '鶏肉': 'Chicken', 'バナナ': 'Banana', '豚肉': 'Pork', 'マカダミアナッツ': 'Macadamia nut', 'もも': 'Peach',
  'やまいも': 'Yam', 'りんご': 'Apple', 'ゼラチン': 'Gelatin', 'ピスタチオ': 'Pistachio',
};

// ---- 添加物の用途名 ----
const ADDITIVE_PURPOSE_EN: Record<string, string> = {
  '甘味料': 'Sweetener', '着色料': 'Color', '保存料': 'Preservative', '増粘剤': 'Thickener', '酸化防止剤': 'Antioxidant',
  '発色剤': 'Color fixative', '漂白剤': 'Bleaching agent', '防かび剤': 'Fungicide', '乳化剤': 'Emulsifier', 'pH調整剤': 'pH adjuster',
  '膨張剤': 'Leavening agent', '香料': 'Flavoring', '調味料': 'Seasoning', '酸味料': 'Acidulant', '強化剤': 'Fortifier', '製造用剤': 'Processing aid',
  'イーストフード': 'Yeast food', 'かんすい': 'Kansui (alkaline agent)', '酵素': 'Enzyme', '光沢剤': 'Glazing agent', 'ガムベース': 'Gum base',
  '軟化剤': 'Softener', '苦味料': 'Bittering agent', '豆腐用凝固剤': 'Coagulant',
};
const BULK_PURPOSES = ['乳化剤', 'pH調整剤', '膨張剤', '香料', '酸味料', 'イーストフード', 'かんすい', '酵素', '光沢剤', 'ガムベース', '軟化剤', '苦味料', '豆腐用凝固剤'];
const NAME_ONLY_PURPOSES = ['強化剤', '製造用剤'];

// ---- よく使う食材名（完全一致のみ。部分一致は「いちごジャム→Strawberry」のような誤訳になるため使わない） ----
export const INGREDIENT_EN: Record<string, string> = {
  '小麦粉': 'Wheat flour', '強力粉': 'Bread flour (wheat)', '準強力粉': 'Wheat flour', '中力粉': 'All-purpose flour (wheat)', '薄力粉': 'Cake flour (wheat)',
  '全粒粉': 'Whole wheat flour', 'ライ麦粉': 'Rye flour', '米粉': 'Rice flour', '上新粉': 'Rice flour', '白玉粉': 'Glutinous rice flour', 'もち粉': 'Glutinous rice flour',
  'もち米': 'Glutinous rice', '米': 'Rice', 'オートミール': 'Oatmeal', '片栗粉': 'Potato starch', 'でん粉': 'Starch', 'コーンスターチ': 'Cornstarch',
  'きなこ': 'Roasted soybean flour', 'きな粉': 'Roasted soybean flour',
  '砂糖': 'Sugar', 'グラニュー糖': 'Granulated sugar', '上白糖': 'Sugar', '三温糖': 'Brown sugar', 'きび砂糖': 'Cane sugar', '黒糖': 'Brown sugar',
  '黒砂糖': 'Brown sugar', '粉糖': 'Powdered sugar', 'てんさい糖': 'Beet sugar', 'はちみつ': 'Honey', '蜂蜜': 'Honey', 'メープルシロップ': 'Maple syrup',
  '水あめ': 'Starch syrup', '水飴': 'Starch syrup', 'ぶどう糖': 'Glucose', '麦芽糖': 'Maltose', 'トレハロース': 'Trehalose', '還元水あめ': 'Hydrogenated starch syrup',
  'バター': 'Butter', '無塩バター': 'Unsalted butter', '有塩バター': 'Salted butter', '発酵バター': 'Cultured butter', 'マーガリン': 'Margarine',
  'ショートニング': 'Shortening', 'ラード': 'Lard', '植物油': 'Vegetable oil', '植物油脂': 'Vegetable oil', 'サラダ油': 'Vegetable oil', '菜種油': 'Rapeseed oil',
  'オリーブオイル': 'Olive oil', 'ごま油': 'Sesame oil', '米油': 'Rice bran oil', 'ココナッツオイル': 'Coconut oil',
  '牛乳': 'Milk', '生クリーム': 'Fresh cream', 'クリーム': 'Cream', '脱脂粉乳': 'Skim milk powder', 'スキムミルク': 'Skim milk powder', '全粉乳': 'Whole milk powder',
  '練乳': 'Condensed milk', '加糖練乳': 'Sweetened condensed milk', 'ヨーグルト': 'Yogurt', 'チーズ': 'Cheese', 'クリームチーズ': 'Cream cheese',
  'マスカルポーネ': 'Mascarpone', 'チェダーチーズ': 'Cheddar cheese', 'モッツァレラチーズ': 'Mozzarella cheese', 'パルメザンチーズ': 'Parmesan cheese', '豆乳': 'Soy milk',
  '卵': 'Egg', '全卵': 'Whole egg', '鶏卵': 'Egg', '卵黄': 'Egg yolk', '卵白': 'Egg white', '乾燥卵白': 'Dried egg white',
  '食塩': 'Salt', '塩': 'Salt', '天日塩': 'Sea salt', '岩塩': 'Rock salt',
  'イースト': 'Yeast', 'ドライイースト': 'Dry yeast', '生イースト': 'Fresh yeast', '天然酵母': 'Natural yeast', 'パン酵母': 'Yeast',
  'ベーキングパウダー': 'Baking powder', '重曹': 'Baking soda', 'モルトパウダー': 'Malt powder', 'モルトエキス': 'Malt extract',
  'チョコレート': 'Chocolate', 'ミルクチョコレート': 'Milk chocolate', 'ホワイトチョコレート': 'White chocolate', 'ダークチョコレート': 'Dark chocolate',
  '準チョコレート': 'Chocolate', 'ココア': 'Cocoa powder', 'ココアパウダー': 'Cocoa powder', 'カカオマス': 'Cacao mass', 'ココアバター': 'Cocoa butter',
  '抹茶': 'Matcha (green tea powder)', '緑茶': 'Green tea', 'ほうじ茶': 'Roasted green tea', '紅茶': 'Black tea', 'コーヒー': 'Coffee', 'インスタントコーヒー': 'Instant coffee',
  'アーモンド': 'Almond', 'アーモンドプードル': 'Almond powder', 'アーモンドパウダー': 'Almond powder', 'アーモンドスライス': 'Sliced almonds',
  'くるみ': 'Walnut', 'クルミ': 'Walnut', 'カシューナッツ': 'Cashew nut', 'ピスタチオ': 'Pistachio', 'マカダミアナッツ': 'Macadamia nut', 'ヘーゼルナッツ': 'Hazelnut',
  'ピーナッツ': 'Peanut', '落花生': 'Peanut', 'ごま': 'Sesame', '白ごま': 'White sesame', '黒ごま': 'Black sesame', 'ココナッツ': 'Coconut',
  '小豆': 'Azuki beans', 'あずき': 'Azuki beans', 'あん': 'Sweet bean paste', 'こしあん': 'Smooth sweet bean paste', 'つぶあん': 'Chunky sweet bean paste',
  '白あん': 'White bean paste', '大豆': 'Soybean', '黒豆': 'Black soybeans', 'さつまいも': 'Sweet potato', 'かぼちゃ': 'Pumpkin', 'じゃがいも': 'Potato',
  'いちご': 'Strawberry', 'りんご': 'Apple', 'バナナ': 'Banana', 'ブルーベリー': 'Blueberry', 'ラズベリー': 'Raspberry', 'レモン': 'Lemon', 'レモン汁': 'Lemon juice',
  'オレンジ': 'Orange', 'オレンジピール': 'Orange peel', 'ゆず': 'Yuzu citrus', '柚子': 'Yuzu citrus', 'もも': 'Peach', '桃': 'Peach', 'マンゴー': 'Mango',
  'レーズン': 'Raisins', 'クランベリー': 'Cranberry', 'いちじく': 'Fig', 'くり': 'Chestnut', '栗': 'Chestnut', 'マロン': 'Chestnut',
  'バニラ': 'Vanilla', 'バニラビーンズ': 'Vanilla beans', 'バニラエッセンス': 'Vanilla essence', 'シナモン': 'Cinnamon', 'ジンジャー': 'Ginger', '生姜': 'Ginger',
  '洋酒': 'Liqueur', 'ラム酒': 'Rum', 'ブランデー': 'Brandy', 'キルシュ': 'Kirsch', '日本酒': 'Sake', '酒': 'Sake',
  'ゼラチン': 'Gelatin', '寒天': 'Agar', 'カスタード': 'Custard', 'カスタードクリーム': 'Custard cream', 'ジャム': 'Jam', 'いちごジャム': 'Strawberry jam',
  '醤油': 'Soy sauce', 'しょうゆ': 'Soy sauce', '味噌': 'Miso', 'みそ': 'Miso', 'みりん': 'Mirin', '酢': 'Vinegar', 'こしょう': 'Pepper', '胡椒': 'Pepper',
  '鶏肉': 'Chicken', '豚肉': 'Pork', '牛肉': 'Beef', 'ベーコン': 'Bacon', 'ハム': 'Ham', 'ソーセージ': 'Sausage', 'ツナ': 'Tuna',
  '玉ねぎ': 'Onion', 'たまねぎ': 'Onion', 'にんじん': 'Carrot', 'キャベツ': 'Cabbage', 'ほうれん草': 'Spinach', 'トマト': 'Tomato', 'コーン': 'Corn',
  'ほうれんそう': 'Spinach', 'ねぎ': 'Green onion', 'にんにく': 'Garlic', 'しめじ': 'Shimeji mushroom', 'マッシュルーム': 'Mushroom',
  '水': 'Water', 'パン粉': 'Breadcrumbs', 'マヨネーズ': 'Mayonnaise', 'ケチャップ': 'Ketchup', 'ソース': 'Sauce',
};

// ---- 保存方法の決まり文句 ----
const STORAGE_EN: Record<string, string> = {
  '直射日光・高温多湿を避けて保存してください。': 'Store away from direct sunlight, high temperature and humidity.',
  '直射日光・高温多湿を避けて保存してください': 'Store away from direct sunlight, high temperature and humidity.',
  '直射日光、高温多湿を避けて保存してください。': 'Store away from direct sunlight, high temperature and humidity.',
  '要冷蔵（10℃以下）': 'Keep refrigerated (10°C or below).',
  '要冷蔵（10℃以下で保存してください）': 'Keep refrigerated (10°C or below).',
  '10℃以下で保存してください。': 'Keep refrigerated (10°C or below).',
  '要冷凍（-18℃以下）': 'Keep frozen (-18°C or below).',
  '-18℃以下で保存してください。': 'Keep frozen (-18°C or below).',
};

const normalizeKey = (s: string) => s.replace(/\s|　/g, '');
const lookup = (dict: Record<string, string>, ja: string): string | undefined => {
  const k = normalizeKey(ja);
  for (const [key, v] of Object.entries(dict)) if (normalizeKey(key) === k) return v;
  return undefined;
};

export function translateIngredientName(ja: string, userEn?: string | null): string | null {
  return (userEn ?? '').trim() || lookup(INGREDIENT_EN, ja) || null;
}
export function translateStorage(ja: string | null | undefined, userEn?: string | null): string | null {
  return (userEn ?? '').trim() || (ja ? lookup(STORAGE_EN, ja) : undefined) || null;
}

/** 内容量の簡易英訳（「6個」→「6 pcs」、「1個」→「1 pc」）。それ以外の単位（g・ml等）はそのまま */
export function translateContentAmount(ja: string): string {
  return ja
    .replace(/(\d+)\s*(個|枚|本|切れ)/g, (_m, n) => `${n} ${n === '1' ? 'pc' : 'pcs'}`)
    .replace(/(\d+)\s*袋/g, (_m, n) => `${n} ${n === '1' ? 'bag' : 'bags'}`)
    .replace(/(\d+)\s*箱/g, (_m, n) => `${n} ${n === '1' ? 'box' : 'boxes'}`);
}

export type EnIngredientInput = {
  ingredientName: string;
  ingredientNameEn?: string | null;
  amount: number;
  unit: string;
  displayOrder?: number;
  sortByWeight?: boolean;
  isAdditive?: boolean;
  additiveReason?: string;
  hideFromLabel?: boolean;
  ingredientAlwaysHideFromLabel?: boolean;
  compositeIngredients?: string | null;
  compositeAdditives?: string | null;
};

/**
 * 英語の原材料表示（"Ingredients" の中身）とアレルゲン表示（"Contains: ..."）を作る。
 * 並び順・同名の合算・非表示の扱いは日本語ラベル（buildIngredientsLabel）と同じ。
 */
export function buildIngredientsLabelEn(ingredients: EnIngredientInput[], allergens: string[]): {
  ingredientsText: string; containsText: string; missing: string[];
} {
  const missing = new Set<string>();
  const tr = (ja: string, en?: string | null) => {
    const t = translateIngredientName(ja, en);
    if (!t) { missing.add(ja); return ja; }
    return t;
  };
  const prepared = prepareIngredientsForLabel(ingredients);

  const main = prepared.filter(i => !i.isAdditive).map(i => {
    let name = tr(i.ingredientName.trim(), i.ingredientNameEn);
    const inner = splitLabelList(i.compositeIngredients).map(t => tr(t, null));
    if (inner.length) name = `${name} (${inner.join(', ')})`;
    return name;
  });

  const texts: string[] = [];
  const push = (t: string) => { if (t && !texts.includes(t)) texts.push(t); };
  const groups: Record<string, string[]> = {};
  const order: string[] = [];
  prepared.forEach(i => {
    if (!i.isAdditive) {
      splitLabelList(i.compositeAdditives).forEach(t => {
        // 内訳の添加物は「乳化剤（大豆由来）」のような自由記述のため、用途名の部分だけ英訳する
        const m = t.match(/^([^（(]+)(.*)$/);
        const head = m ? m[1].trim() : t;
        let tail = (m?.[2] ?? '').replace(/[（(]\s*(.+?)\s*由来\s*[）)]/g, (_x, src) => ` (from ${(ALLERGEN_EN[src] ?? translateIngredientName(src) ?? src).toLowerCase()})`);
        if (/[^\x00-\x7F°]/.test(tail)) { missing.add(t); }
        order.push(`__text__${ADDITIVE_PURPOSE_EN[head] ? ADDITIVE_PURPOSE_EN[head] + tail : tr(t, null)}`);
      });
      return;
    }
    let reason = (i.additiveReason ?? '').trim().replace(/として$/, '');
    if (reason === 'その他') reason = '';
    const key = reason || '__none__';
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(tr(i.ingredientName.trim(), i.ingredientNameEn));
  });
  order.forEach(key => {
    if (key.startsWith('__text__')) { push(key.slice(8)); return; }
    const names = Array.from(new Set(groups[key]));
    if (key === '__none__' || NAME_ONLY_PURPOSES.includes(key)) names.forEach(push);
    else if (BULK_PURPOSES.includes(key)) push(ADDITIVE_PURPOSE_EN[key] ?? key);
    else push(`${ADDITIVE_PURPOSE_EN[key] ?? key} (${names.join(', ')})`);
  });

  const ingredientsText = [...main, ...texts].join(', ');
  const containsText = allergens.map(a => ALLERGEN_EN[a] ?? a).join(', ');
  return { ingredientsText, containsText, missing: Array.from(missing) };
}
