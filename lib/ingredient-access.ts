// ============================================================
// lib/ingredient-access.ts - レシピに紐づけてよい食材かどうかの判定
// ============================================================
// 2026-09-27新設（セキュリティ修正）:
// 以前はレシピ作成・更新APIが、リクエストで送られた ingredientId を所有者の確認なしに
// prisma.ingredient.findUnique で読み込み、そのままレシピに保存していた。そのため、
// 他ユーザーの非共有（私有）食材のIDを知っていれば自分のレシピに紐づけることができ、
// レシピ詳細・ラベル画面を通じてその食材の名前・仕入価格・栄養値・アレルゲンを閲覧できてしまった。
//
// 紐づけてよいのは、食材一覧API（app/api/ingredients/route.ts）や仕入設定APIと同じく
//   (1) 自分が登録した食材
//   (2) 承認済みの共有食材（isPublic && isApproved。食品成分表由来のシステム食材を含む）
// のみとする。ただしレシピ更新時は、既にそのレシピに紐づいている食材も許可する
// （共有元が後から共有をやめた場合でも、既存レシピを保存し直せなくならないようにするため）。

import { prisma } from '@/lib/db';

/**
 * 指定されたIDのうち、このユーザーがレシピに使えない食材IDを返す（空配列なら問題なし）。
 * @param allowIds 追加で許可するID（レシピ更新時の既存紐づけ分）
 */
export async function findDisallowedIngredientIds(
  userId: string,
  ingredientIds: Array<string | null | undefined>,
  allowIds: Iterable<string> = [],
): Promise<string[]> {
  const allow = new Set(allowIds);
  const ids = Array.from(new Set(ingredientIds.filter((id): id is string => !!id && !allow.has(id))));
  if (ids.length === 0) return [];

  const accessible = await prisma.ingredient.findMany({
    where: {
      id: { in: ids },
      OR: [
        { userId },
        { isPublic: true, isApproved: true },
      ],
    },
    select: { id: true },
  });
  const ok = new Set(accessible.map(a => a.id));
  return ids.filter(id => !ok.has(id));
}

export const DISALLOWED_INGREDIENT_MESSAGE =
  '使用できない食材が含まれています。食材を選び直してから保存してください。';
