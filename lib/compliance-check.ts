// ============================================================
// lib/compliance-check.ts - 表示法令コンプライアンスチェック（Proプラン限定機能）
// ============================================================
//
// 2026-08 プロプラン新設の目玉機能。印刷前に、食品表示基準上よくある表示漏れ・
// 表記ミスのパターンを自動検出して警告する。
//
// 重要な注意: これはあくまで表示ミスを減らすための「参考情報」であり、
// 食品表示法（食品表示基準）への適合を保証するものではない。対象食品の種類や
// 販売形態によって必要な表示事項は異なるため、最終的な表示内容は必ずユーザー自身の
// 確認、または必要に応じて保健所・専門家への確認を経ること。UI側にも必ず
// 同様の免責文言を表示すること（app/dashboard/recipes/[id]/page.tsx参照）。

export type ComplianceSeverity = 'error' | 'warning' | 'info';

export interface ComplianceIssue {
  code:     string;
  severity: ComplianceSeverity;
  message:  string;
  hint?:    string;
}

export interface ComplianceIngredientInput {
  ingredientName: string;
  amount:         number;
  unit:           string;
  isAdditive?:    boolean;
  additiveReason?: string;
  originCountry?: string;
  isPrimaryIngredient?: boolean;
  hideFromLabel?: boolean;
  ingredientAlwaysHideFromLabel?: boolean;
}

export interface ComplianceRecipeInput {
  name:           string;
  ingredients:    ComplianceIngredientInput[];
  contentAmount?: string | null;
  storageMethod?: string | null;
  shelfLifeDays?: number | null;
  barcode?:       string | null;
}

export interface ComplianceShopInput {
  companyName?: string | null;
  address?:     string | null;
}

/**
 * レシピ1件分の表示内容をチェックし、気づいた点を一覧で返す。
 * @param recipe - チェック対象のレシピ情報
 * @param shop - 製造者情報（店舗）。渡さない場合は製造者関連のチェックはスキップする
 *   （レシピ単体では店舗が確定していないため。ラベル印刷画面など店舗が確定している
 *   場面から呼ぶ場合にのみ渡す）
 */
export function checkRecipeCompliance(
  recipe: ComplianceRecipeInput,
  shop?: ComplianceShopInput | null
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  if (!recipe.name?.trim()) {
    issues.push({
      code: 'name_missing', severity: 'error',
      message: '商品名（名称）が未設定です。',
      hint: '食品表示基準では「名称」の表示が義務です。',
    });
  }

  const visible = recipe.ingredients.filter(i => !i.hideFromLabel && !i.ingredientAlwaysHideFromLabel);

  if (visible.length === 0) {
    issues.push({
      code: 'ingredients_empty', severity: 'error',
      message: '原材料が登録されていないか、すべて非表示設定になっています。',
      hint: '原材料名の表示は食品表示基準上の義務です。',
    });
  }

  // 添加物の用途表記漏れ（甘味料・着色料・保存料・増粘剤等／安定剤／ゲル化剤／糊料・
  // 酸化防止剤・発色剤・漂白剤・防かび剤／防ばい剤の8用途は、物質名と併せて用途名の
  // 表示が義務。それ以外の添加物は用途名任意のため、あくまで「確認を促す」warningとする）
  const additivesNoReason = visible.filter(i => i.isAdditive && !i.additiveReason?.trim());
  if (additivesNoReason.length > 0) {
    const names = additivesNoReason.map(i => i.ingredientName).filter(Boolean).join('・');
    issues.push({
      code: 'additive_reason_missing', severity: 'warning',
      message: `添加物「${names}」に用途名が設定されていません。`,
      hint: '甘味料・着色料・保存料・増粘剤等・酸化防止剤・発色剤・漂白剤・防かび剤（防ばい剤）の8用途に該当する添加物は、物質名に加えて用途名の表示が義務です。該当しない添加物であれば無視して構いません。',
    });
  }

  if (!recipe.contentAmount?.trim()) {
    issues.push({
      code: 'content_amount_missing', severity: 'warning',
      message: '内容量が未設定です。',
      hint: '内容量（重量・個数など）の表示は食品表示基準上の義務です。',
    });
  }

  if (!recipe.storageMethod?.trim()) {
    issues.push({
      code: 'storage_missing', severity: 'warning',
      message: '保存方法が未設定です。',
    });
  }

  if (recipe.shelfLifeDays == null) {
    issues.push({
      code: 'shelf_life_missing', severity: 'error',
      message: '賞味期限・消費期限の日数が未設定です。',
    });
  }

  // 最も配合量が多い原材料（isPrimaryIngredientフラグ）の原産国表示
  const primary = visible.find(i => i.isPrimaryIngredient);
  if (primary && !primary.originCountry?.trim()) {
    issues.push({
      code: 'origin_country_missing', severity: 'info',
      message: `最も配合量が多い原材料「${primary.ingredientName}」の原産国が未設定です。`,
      hint: '原料原産地表示の対象食品（生鮮食品や、対象加工食品に該当する場合）は原産国の表示が必要です。対象外の食品であればこの項目は無視して構いません。',
    });
  }

  if (shop) {
    if (!shop.companyName?.trim()) {
      issues.push({
        code: 'manufacturer_missing', severity: 'error',
        message: '製造者（会社名・屋号）が未設定です。',
        hint: '店舗設定で会社名を登録してください。',
      });
    }
    if (!shop.address?.trim()) {
      issues.push({
        code: 'manufacturer_address_missing', severity: 'error',
        message: '製造者の住所が未設定です。',
        hint: '店舗設定で住所を登録してください。',
      });
    }
  }

  return issues;
}

export function summarizeComplianceIssues(issues: ComplianceIssue[]): { errors: number; warnings: number; infos: number } {
  return {
    errors:   issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    infos:    issues.filter(i => i.severity === 'info').length,
  };
}
