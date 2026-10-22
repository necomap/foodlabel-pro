// ============================================================
// lib/label-check.ts - 表示内容の確認記録（簡易承認）（2026-10-22新設）
// ============================================================
// 「誰が・いつ・どの表示内容を確認したか」をレシピに記録し、その後に材料・食材マスタ・
// 期限などが変わってラベルの表示内容が変わったら、自動で「未確認」に戻す仕組み。
// 表示内容（名称・原材料表示・アレルゲン・1個あたり栄養成分・内容量・期限・保存方法）を
// まとめてハッシュ化し、確認時のハッシュ（Recipe.labelCheckedHash）と比べる。
// レシピ詳細API（GET /api/recipes/[id]）とラベル生成API（POST /api/labels/generate）で
// 同じ関数を使うこと（計算方法がずれると、確認済みなのに未確認と表示されてしまう）。
import { createHash } from 'crypto';

export function computeLabelHash(input: {
  name: string;
  ingredientsLabel: string;
  nutritionPerUnit: Record<string, unknown>;
  contentAmount?: string | null;
  shelfLifeDays?: number | null;
  shelfLifeType?: string | null;
  storageMethod?: string | null;
}): string {
  const n = input.nutritionPerUnit;
  const payload = JSON.stringify([
    input.name.trim(),
    input.ingredientsLabel.trim(),
    [n.energyKcal, n.protein, n.fat, n.carbohydrate, n.saltEquivalent].map(v => (v == null ? null : Number(v))),
    (input.contentAmount ?? '').trim(),
    input.shelfLifeDays ?? null,
    input.shelfLifeType ?? null,
    (input.storageMethod ?? '').trim(),
  ]);
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}
