// ============================================================
// lib/ingredient-rejection-reasons.ts
// 共有食材の却下理由（選択式）。管理画面の却下モーダルと、
// ユーザー側の通知（app/api/ingredients/rejection-notices）の両方から使う共通定義。
// ============================================================

export const INGREDIENT_REJECTION_REASONS = [
  { code: 'DUPLICATE',             label: '同じ食材がすでに共有食材として登録されている（重複）' },
  { code: 'INCORRECT_INFO',        label: '栄養成分・アレルゲン情報に誤りがある' },
  { code: 'UNCONFIRMED_NUTRITION', label: '栄養成分が未確認・未入力' },
  { code: 'UNCLEAR_NAME',          label: '食材名がわかりにくい・不適切' },
  { code: 'OTHER',                 label: 'その他' },
] as const;

export type IngredientRejectionReasonCode = typeof INGREDIENT_REJECTION_REASONS[number]['code'];

export function getRejectionReasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return INGREDIENT_REJECTION_REASONS.find(r => r.code === code)?.label ?? code;
}
