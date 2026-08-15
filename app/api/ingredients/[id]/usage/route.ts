// app/api/ingredients/[id]/usage/route.ts - この食材を使っているレシピの一覧
// 重複した食材マスタを整理する際、削除前にどのレシピで使われているか確認できるようにするためのAPI
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const rows = await prisma.recipeIngredient.findMany({
    where: { ingredientId: params.id, recipe: { userId: session.user.id } },
    select: {
      amount: true,
      unit:   true,
      recipe: {
        select: { id: true, name: true, variationName: true, isActive: true },
      },
    },
    distinct: ['recipeId'],
    orderBy: { recipe: { name: 'asc' } },
  });

  const items = rows.map(r => ({
    id:            r.recipe.id,
    name:          r.recipe.name,
    variationName: r.recipe.variationName,
    isActive:      r.recipe.isActive,
    amount:        Number(r.amount),
    unit:          r.unit,
  }));

  return NextResponse.json({ success: true, data: items });
}
