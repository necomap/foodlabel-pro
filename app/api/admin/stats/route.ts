// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  // 2026-08 プロプラン新設: 有料プランがpremium/proの2種類になったため、それぞれ個別に集計する
  // （以前はpremiumのみカウントしており、proユーザーが集計から漏れる状態だった）。
  const [totalUsers, premiumUsers, proUsers, totalRecipes, totalIngredients, pendingIngredients] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { plan: 'premium', isActive: true } }),
    prisma.user.count({ where: { plan: 'pro', isActive: true } }),
    prisma.recipe.count({ where: { isActive: true } }),
    prisma.ingredient.count({ where: { isActive: true } }),
    prisma.ingredient.count({ where: { isPublic: true, isApproved: false } }),
  ]);

  return NextResponse.json({ success: true, data: { totalUsers, premiumUsers, proUsers, totalRecipes, totalIngredients, pendingIngredients } });
}
