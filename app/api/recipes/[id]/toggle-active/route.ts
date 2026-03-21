// app/api/recipes/[id]/toggle-active/route.ts - レシピ非表示/再表示
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const recipe = await prisma.recipe.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!recipe) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });

  await prisma.recipe.update({
    where: { id: params.id },
    data:  { isActive: !recipe.isActive },
  });

  return NextResponse.json({ success: true, data: { isActive: !recipe.isActive } });
}
