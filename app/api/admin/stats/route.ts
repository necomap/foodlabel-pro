// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  const [totalUsers, premiumUsers, totalRecipes, totalIngredients, pendingIngredients] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { plan: 'premium', isActive: true } }),
    prisma.recipe.count({ where: { isActive: true } }),
    prisma.ingredient.count({ where: { isActive: true } }),
    prisma.ingredient.count({ where: { isPublic: true, isApproved: false } }),
  ]);

  return NextResponse.json({ success: true, data: { totalUsers, premiumUsers, totalRecipes, totalIngredients, pendingIngredients } });
}
