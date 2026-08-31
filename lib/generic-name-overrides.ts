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
