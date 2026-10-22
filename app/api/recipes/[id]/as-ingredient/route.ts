// app/api/recipes/[id]/as-ingredient/route.ts
// 2026-10-22新設: レシピを中間品（自分の食材）として登録・更新する（詳細は lib/recipe-as-ingredient.ts）
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { upsertIngredientFromRecipe } from '@/lib/recipe-as-ingredient';

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const result = await upsertIngredientFromRecipe(session.user.id, params.id);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

  const warn = result.computed.unconfirmedCount > 0
    ? `（成分未確認の材料が${result.computed.unconfirmedCount}件あります。その分の栄養成分は含まれていません）`
    : '';
  return NextResponse.json({
    success: true,
    message: (result.created ? '食材マスタに中間品として登録しました' : '中間品の食材を最新の内容に更新しました') + warn,
    data: { ingredientId: result.ingredientId, created: result.created, weightG: result.computed.weightG },
  });
}
