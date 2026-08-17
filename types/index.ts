// ============================================================
// FoodLabel Pro - 共通型定義
// ============================================================

// ユーザープラン
export type UserPlan = 'free' | 'premium' | 'admin';

// 賞味期限タイプ
export type ShelfLifeType = 'BEST_BEFORE' | 'USE_BY';

// 保管方法
export type StorageType = 'ROOM_TEMP' | 'FRIDGE' | 'FROZEN' | 'OTHER';

// 印刷デバイス
export type PrintDeviceType = 'LABEL_PRINTER' | 'A4_PRINTER' | 'OTHER';

// アレルゲンカテゴリ
export type AllergenCategory = 'REQUIRED_8' | 'OPTIONAL_20';

// ============================================================
// 栄養成分
// ============================================================
export interface NutritionValues {
  energyKcal:    number | null;
  protein:       number | null;
  fat:           number | null;
  carbohydrate:  number | null;
  sodium:        number | null;
  saltEquivalent: number | null;
  dietaryFiber:  number | null;
  sugar:         number | null;
  cholesterol:   number | null;
}

// ============================================================
// 焼成条件
// ============================================================
export interface BakingStep {
  steam:      'ON' | 'OFF' | null;
  topHeat:    number | null;  // 上火（℃）
  bottomHeat: number | null;  // 下火（℃）
  timeMin:    number | null;  // 時間（分）
  label?:     string;         // 説明（例: "一次焼成"）
}

// ============================================================
// 食材マスタ
// ============================================================
export interface IngredientSummary {
  id:              string;
  name:            string;
  nameKana:        string | null;
  allergens:       string[];
  nutritionId:     number | null;
  nutritionVariant: string | null;
  purchaseUnitG:   number | null;
  purchasePrice:   number | null;
  unitPrice:       number | null;
  storage:         StorageType;
  supplier:        string | null;
  isPublic:        boolean;
  // 水・浄水など、どのレシピで使っても原材料表示に出す必要がない食材用のフラグ。
  // ONの食材は、使っている全レシピで自動的に原材料名表示から除外される
  // （栄養成分・アレルゲン判定には影響しない。あくまで表示だけの設定）
  alwaysHideFromLabel?: boolean;
  // 栄養値（100gあたり）
  nutrition?: NutritionValues;
}

// ============================================================
// レシピ材料
// ============================================================
export interface RecipeIngredientInput {
  ingredientId?:           string;
  ingredientNameOverride?: string;
  amount:                  number;
  unit:                    string;
  displayOrder:            number;
  sortByWeight:            boolean;
  originCountry?:          string;
  isAdditive?:             boolean;
  additiveReason?:         string;
  costPrice?:              number;
  allergenOverride?:       string[];
  // このレシピでのこの原材料の使用分だけを原材料表示から除外する（例：焼成後の含有量が表示義務の
  // 閾値未満になる添加物など、食材マスタ全体ではなく「今回の使い方」に限った一時的な例外）。
  hideFromLabel?:          boolean;
  // 工程・用途名（任意、例：湯種／本ごね／仕上げ）。計量を分けて仕込む際に使う、
  // レシピ内だけの表示グループ分け。ラベルの原材料表示（法定表示）には影響しない。
  processLabel?:           string;
}

export interface RecipeIngredientDetail extends RecipeIngredientInput {
  id:                     string;
  ingredientName:         string;  // 解決済みの食材名（食材マスタの登録名）
  genericName?:           string | null;  // ラベル表示用の一般名（設定されていれば印字・一覧表示で優先）
  genericNameConfirmed?:  boolean | null;
  costTotal:              number | null;
  nutrition:              NutritionValues;
  nutritionUnconfirmed:   boolean;
  isPrimaryIngredient:    boolean;
  // 食材マスタ側で「常に非表示」に設定されている食材かどうか（hideFromLabelとはOR条件で合成される）
  ingredientAlwaysHideFromLabel?: boolean;
}

// ============================================================
// レシピ
// ============================================================
export interface RecipeInput {
  name:             string;
  nameKana?:        string;
  categoryId?:      string;
  unitCount:        number;
  wasteRatio:       number;
  salePrice?:       number;
  shelfLifeDays?:   number;
  shelfLifeType:    ShelfLifeType;
  contentAmount?:   string;
  storageMethod?:   string;
  barcode?:         string;
  notes?:           string;
  printComment?:    string;
  qualityControl?:  string;
  bakingConditions?: BakingStep[];
  ingredients:      RecipeIngredientInput[];
  steps:            string[];
}

export interface RecipeSummary {
  id:             string;
  name:           string;
  nameKana:       string | null;
  categoryName:   string | null;
  unitCount:      number;
  shelfLifeDays:  number | null;
  shelfLifeType:  ShelfLifeType;
  salePrice:      number | null;
  unitCost:       number | null;
  costRate:       number | null;
  energyKcal?:    number | null;
  saltEquivalent?: number | null;
  allergens:      string[];
  hasUnconfirmedNutrition: boolean;
  isActive:       boolean;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface RecipeDetail extends RecipeSummary {
  categoryId?:     string | null;
  notes:           string | null;
  printComment:    string | null;
  qualityControl:  string | null;
  contentAmount:   string | null;
  storageMethod:   string | null;
  barcode:         string | null;
  bakingConditions: BakingStep[] | null;
  ingredients:     RecipeIngredientDetail[];
  steps:           string[];
  // 計算済み
  totalCost:       number | null;
  totalWeightG:    number | null;
  nutrition:       NutritionValues;
  // 原材料表示文字列（重量順・アレルゲン付き）
  ingredientsLabel:  string;
  allergensLabel:    string;
  nutritionPerUnit?: NutritionValues;
}

// ============================================================
// シール印刷
// ============================================================

// 識別マーク（リサイクルマーク）1個分の設定
// role: マークの下に印字する任意の役割名（例: 紙マーク→「外箱」、プラマーク→「袋」）
export interface RecycleMarkConfig {
  key:  string;
  role?: string;
}

export interface LabelDisplaySettings {
  showPostalCode?:     boolean;
  showPhone?:          boolean;
  showRepresentative?: boolean;
  showEmail?:          boolean;
  showNutrition?:      boolean;
  showDietaryFiber?:   boolean;
  showSugar?:          boolean;
  showCholesterol?:    boolean;
  showQualityControl?: boolean;
  showComment?:        boolean;
  nutritionNote?:      string;
  showBarcode?:     boolean;
  showBarcodeText?: boolean;
  barcodeHeightMm?: number;
}

export interface LabelConfig {
  logoHeightMm?: number;
  qrSizeMm?:     number;
  // シールサイズが小さいときなど、店舗設定（ロゴURL・QR URL）自体は残したまま
  // この印刷ジョブだけで一時的に非表示にするためのスイッチ（バーコードのshowBarcodeと同様）
  showLogo?:     boolean;
  showQr?:       boolean;
  recipeId?:        string;
  shopId?:         string;
  manufactureDate?: string;  // YYYY-MM-DD
  shelfLifeDays?:  number;  // 上書き可
  printCount?:      number;
  fontSizePt?:      number;
  // ラベル本文に使う日本語フォント。未指定時は 'noto-sans-jp'。
  // 選べる値は lib/label.ts の FONT_FAMILY_MAP に定義している
  // ('noto-sans-jp' | 'yu-gothic' | 'hiragino-kaku-gothic' | 'meiryo')
  fontFamily?:      string;
  deviceType?:      PrintDeviceType;
  // ラベルプリンタ
  labelWidthMm?:   number;
  labelHeightMm?:  number;
  // 無定長（連続）ロール用。trueの場合、高さを固定せず印刷側で内容に応じて自動的に長さを決める
  // （labelHeightMmは文字サイズ計算等の目安としてのみ使う）
  labelHeightAuto?: boolean;
  isPrecut?:       boolean;
  cutMarginMm?:    number;
  // A4プリンタ
  a4Cols?:         number;
  a4Rows?:         number;
  marginTopMm?:    number;
  marginBottomMm?: number;
  marginLeftMm?:   number;
  marginRightMm?:  number;
  startPosition?:  number;
  a4SealWidthMm?:  number;
  a4SealHeightMm?: number;
  a4ColGapMm?:     number;  // シール同士の横方向のスキマ（mm）
  a4RowGapMm?:     number;  // シール同士の縦方向のスキマ（mm）
  // 表示設定
  displaySettings?: LabelDisplaySettings;
  showBarcode?:     boolean;
  showBarcodeText?: boolean;
  barcodeHeightMm?: number;
  // 識別マーク（リサイクルマーク）。バーコードとは独立してサイズ指定できる
  // （識別表示マークは法令上マーク単体で6mm角以上が必要なため、バーコードサイズとは分離）
  recycleMarks?:        RecycleMarkConfig[];
  recycleMarkHeightMm?: number;
}

// ============================================================
// シール内容
// ============================================================
export interface LabelContent {
  productName:     string;
  categoryName:    string;
  ingredientsText: string;  // 「小麦粉,バター,...（原材料の一部に小麦・乳を含む）」
  contentAmount:   string;
  expiryDate:      string;  // 表示用文字列
  expiryType:      '賞味期限' | '消費期限';
  storageMethod:   string;
  manufacturerName: string;
  postalCode:      string;
  address:         string;
  phone?:          string;
  representative?: string;
  email?:          string;
  qualityControl?: string;
  comment?:        string;
  qrUrl?:          string | null;
  logoUrl?:        string | null;
  logoHeightMm?:   number;
  qrSizeMm?:       number;
  barcode?:        string;
  showBarcode?:     boolean;
  showBarcodeText?: boolean;
  barcodeHeightMm?: number;
  // 識別マーク（リサイクルマーク）
  recycleMarks?:        RecycleMarkConfig[];
  recycleMarkHeightMm?: number;
  // 栄養成分（1個/100gあたり）
  nutritionPerUnit: {
    label:         string;  // 例: "1個あたり"
    energyKcal:    number;
    protein:       number;
    fat:           number;
    carbohydrate:  number;
    saltEquivalent: number;
    dietaryFiber?:  number;
    sugar?:         number;
    cholesterol?:   number;
  };
  isEstimated: boolean;  // 推定値かどうか
  warnings:    string[]; // 未確認成分警告
}

// ============================================================
// Excel インポート/エクスポート
// ============================================================
export interface ExcelImportResult {
  success:   boolean;
  imported:  number;
  skipped:   number;
  errors:    Array<{ row: number; message: string }>;
  warnings:  Array<{ row: number; message: string }>;
}

export interface ExcelExportOptions {
  includeNutrition:  boolean;
  includeSteps:      boolean;
  includeCost:       boolean;
  categoryFilter?:   string;
}

// ============================================================
// API レスポンス
// ============================================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?:   T;
  error?:  string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items:    T[];
  total:    number;
  page:     number;
  perPage:  number;
  hasMore:  boolean;
}
