// ============================================================
// app/api/ingredients/merge/route.ts
// 重複食材の統合ツール
// GET  : 自分の食材の中から「似た名前」の候補をグループ化して返す
// POST : 指定したグループを1件（keepId）に統合する
//        （統合元のRecipeIngredientをkeepIdに付け替えてから、統合元をisActive:falseにする）
// ============================================================
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { normalizeIngredientName, isSimilarName } from '@/lib/ingredient-similarity';

export async function GET(_request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  // マージ対象は「自分が作成した食材」に限定する（共有食材は作成者以外が削除できないため）
  const ingredients = await prisma.ingredient.findMany({
    where: { userId: session.user.id, isActive: true },
    select: { id: true, name: true, nameKana: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  if (ingredients.length < 2) {
    return NextResponse.json({ success: true, data: { groups: [] } });
  }

  const ingIds = ingredients.map(i => i.id);
  const usageCounts = await prisma.recipeIngredient.groupBy({
    by: ['ingredientId'],
    where: { ingredientId: { in: ingIds } },
    _count: { _all: true },
  });
  const usageMap: Record<string, number> = {};
  for (const row of usageCounts) if (row.ingredientId) usageMap[row.ingredientId] = row._count._all;

  const normalized = ingredients.map(ing => ({ ...ing, norm: normalizeIngredientName(ing.name) }));

  // 似ている者同士を素朴なグルーピング（Union-Find相当）でまとめる。
  // 件数が数百〜数千件規模を想定しているため、O(n^2)の総当たり比較でも実用上問題ない。
  const groupOf = new Array(normalized.length).fill(-1);
  const groups: number[][] = [];

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (!isSimilarName(normalized[i].norm, normalized[j].norm)) continue;

      const gi = groupOf[i];
      const gj = groupOf[j];
      if (gi === -1 && gj === -1) {
        const newIdx = groups.length;
        groups.push([i, j]);
        groupOf[i] = newIdx;
        groupOf[j] = newIdx;
      } else if (gi === -1) {
        groups[gj].push(i);
        groupOf[i] = gj;
      } else if (gj === -1) {
        groups[gi].push(j);
        groupOf[j] = gi;
      } else if (gi !== gj) {
        // 別々のグループがiとjの類似関係で橋渡しされた場合は結合する
        groups[gi].push(...groups[gj]);
        for (const idx of groups[gj]) groupOf[idx] = gi;
        groups[gj] = [];
      }
    }
  }

  const result = groups
    .filter(g => g.length >= 2)
    .map(g => {
      const items = g.map(idx => normalized[idx]);
      // 統合先の初期候補：レシピでの使用件数が多いものを優先し、同数なら最も古い（先に登録された）ものにする
      const sorted = [...items].sort((a, b) => {
        const ua = usageMap[a.id] ?? 0;
        const ub = usageMap[b.id] ?? 0;
        if (ua !== ub) return ub - ua;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      return {
        suggestedKeepId: sorted[0].id,
        items: items
          .sort((a, b) => (usageMap[b.id] ?? 0) - (usageMap[a.id] ?? 0))
          .map(it => ({ id: it.id, name: it.name, nameKana: it.nameKana, usageCount: usageMap[it.id] ?? 0 })),
      };
    });

  return NextResponse.json({ success: true, data: { groups: result } });
}

const mergeSchema = z.object({
  keepId:   z.string().min(1),
  mergeIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const body   = await request.json();
  const result = mergeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });
  }
  const { keepId } = result.data;
  const mergeIds = Array.from(new Set(result.data.mergeIds.filter(id => id !== keepId)));
  if (mergeIds.length === 0) {
    return NextResponse.json({ success: false, error: '統合対象が指定されていません' }, { status: 400 });
  }

  // 統合元・統合先がすべて自分が作成した食材であることを確認する
  // （他ユーザーの食材を誤って統合・非表示にできないようにするための安全チェック）
  const owned = await prisma.ingredient.findMany({
    where: { id: { in: [keepId, ...mergeIds] }, userId: session.user.id, isActive: true },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map(o => o.id));
  if (!ownedIds.has(keepId) || mergeIds.some(id => !ownedIds.has(id))) {
    return NextResponse.json({ success: false, error: '自分が登録した食材のみ統合できます' }, { status: 403 });
  }

  const movedCount = await prisma.$transaction(async tx => {
    // 統合元を使っているレシピの材料を、すべて統合先のIDに付け替える
    const moved = await tx.recipeIngredient.updateMany({
      where: { ingredientId: { in: mergeIds } },
      data:  { ingredientId: keepId },
    });
    // 統合元は物理削除ではなくisActive:falseにする（食材マスタ単体のDELETE APIと同じ方針。
    // 万一の誤操作でも、DBを直接触れば復旧できるようにするため）。
    await tx.ingredient.updateMany({
      where: { id: { in: mergeIds } },
      data:  { isActive: false },
    });
    return moved.count;
  });

  return NextResponse.json({
    success: true,
    data: { mergedCount: mergeIds.length, movedRecipeIngredients: movedCount },
  });
}
