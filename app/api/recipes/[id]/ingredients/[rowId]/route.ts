// ============================================================
// app/api/recipes/[id]/ingredients/[rowId]/route.ts
// 2026-10-28新設: レシピ詳細画面から、材料1行の「ラベルに表示しない」（RecipeIngredient.hideFromLabel）を
// その場で切り替える。以前はレシピ編集画面に移動しないと切り替えられず手間だったため。
// レシピ単位の設定なので、同じ食材を使う他のレシピや他のユーザーには影響しない
// （食材マスタの「常に非表示」〔Ingredient.alwaysHideFromLabel〕とは別物）。
// ============================================================
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getReadOnlyRecipeIds } from '@/lib/plan-limits-server';
import { syncIngredientFromRecipe } from '@/lib/recipe-as-ingredient';

type Params = { params: { id: string; rowId: string } };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const recipe = await prisma.recipe.findFirst({ where: { id: params.id, userId: session.user.id }, select: { id: true } });
  if (!recipe) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });

  // レシピ編集（PUT /api/recipes/[id]）と同じく、プラン上限超過の読み取り専用レシピは変更不可
  const readOnlyIds = await getReadOnlyRecipeIds(session.user.id, (session.user as any).plan ?? 'free');
  if (readOnlyIds.has(params.id)) {
    return NextResponse.json({
      success: false,
      error: 'プランのレシピ上限を超えているため、このレシピは読み取り専用です。編集するには上位プランへのアップグレードが必要です。',
      upgradeRequired: true,
    }, { status: 403 });
  }

  const row = await prisma.recipeIngredient.findFirst({ where: { id: params.rowId, recipeId: params.id }, select: { id: true } });
  if (!row) return NextResponse.json({ success: false, error: '材料が見つかりません' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.hideFromLabel !== 'boolean') {
    return NextResponse.json({ success: false, error: '入力が正しくありません' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.recipeIngredient.update({ where: { id: row.id }, data: { hideFromLabel: body.hideFromLabel } }),
    // 一覧の並び順（更新日時順）にも反映されるよう、レシピ本体の更新日時も進める
    prisma.recipe.update({ where: { id: params.id }, data: { updatedAt: new Date() } }),
  ]);

  // このレシピから作った中間品の食材があれば、内訳（原材料名）を最新にする（失敗しても切り替えは成功扱い）
  await syncIngredientFromRecipe(session.user.id, params.id);

  return NextResponse.json({
    success: true,
    message: body.hideFromLabel ? 'このレシピのラベルに表示しないようにしました' : 'このレシピのラベルに表示するようにしました',
  });
}
