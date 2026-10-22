// ============================================================
// lib/generic-name-overrides.ts - 共有食材の「自分専用の一般名」上書き（2026-08新設）
// ============================================================
// 食材マスタのgenericNameは食材そのものに紐づく共有データのため、自分が所有していない
// 食材（システム共有＝userId nullの食材、または他ユーザーが登録した共有食材）では
// app/api/ingredients/[id]/route.ts のPUTで編集できない（他ユーザーの表示に影響してしまうため）。
// その代わりIngredientPurchaseSetting.genericNameOverride（ユーザー×食材ごとの個別値）に
// 保存し、実際の表示・印刷ではこちらを最優先で使う。他のユーザーには一切影響しない。
//
// レシピ詳細・ラベル生成・全レシピ一括印刷など、一般名を表示・印字するすべての箇所で
// この関数を通してから使うこと（個別にIngredient.genericNameだけを見ると、自分専用の
// 上書きが反映されないまま印刷されてしまう）。

import { prisma } from '@/lib/db';

export async function getGenericNameOverrides(userId: string, ingredientIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(ingredientIds.filter((v): v is string => !!v)));
  if (ids.length === 0) return new Map();

  const rows = await prisma.ingredientPurchaseSetting.findMany({
    where: { userId, ingredientId: { in: ids }, genericNameOverride: { not: null } },
    select: { ingredientId: true, genericNameOverride: true },
  });
  return new Map(rows.map(r => [r.ingredientId, r.genericNameOverride as string]));
}

// ============================================================
// 複合原材料の内訳の「自分専用」上書き（2026-10-22新設）
// ============================================================
// 共有食材（システム共有・他ユーザー共有）は本体を編集できないため、銘柄ごとに違う内訳は
// IngredientPurchaseSetting.compositeIngredientsOverride / compositeAdditivesOverride に保存する。
// 実際に使う値は resolveComposite() で「自分の上書き → 食材マスタ本体」の順に決める。
export type CompositeOverride = { ingredients: string | null; additives: string | null };

export async function getCompositeOverrides(userId: string, ingredientIds: (string | null | undefined)[]): Promise<Map<string, CompositeOverride>> {
  const ids = Array.from(new Set(ingredientIds.filter((v): v is string => !!v)));
  if (ids.length === 0) return new Map();
  const rows = await prisma.ingredientPurchaseSetting.findMany({
    where: {
      userId, ingredientId: { in: ids },
      OR: [{ compositeIngredientsOverride: { not: null } }, { compositeAdditivesOverride: { not: null } }],
    },
    select: { ingredientId: true, compositeIngredientsOverride: true, compositeAdditivesOverride: true },
  });
  return new Map(rows.map(r => [r.ingredientId, { ingredients: r.compositeIngredientsOverride, additives: r.compositeAdditivesOverride }]));
}

export function resolveComposite(
  overrides: Map<string, CompositeOverride>,
  ingredientId: string | null | undefined,
  ingredient: { compositeIngredients?: string | null; compositeAdditives?: string | null } | null | undefined,
): { compositeIngredients: string | null; compositeAdditives: string | null } {
  const o = ingredientId ? overrides.get(ingredientId) : undefined;
  if (o) return { compositeIngredients: o.ingredients, compositeAdditives: o.additives };
  return {
    compositeIngredients: ingredient?.compositeIngredients ?? null,
    compositeAdditives:   ingredient?.compositeAdditives ?? null,
  };
}
