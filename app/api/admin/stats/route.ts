// app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  // 2026-08 プロプラン新設: 有料プランがpremium/proの2種類になったため、それぞれ個別に集計する
  // （以前はpremiumのみカウントしており、proユーザーが集計から漏れる状態だった）。
  const [
    totalUsers, premiumUsers, proUsers, adminUsers,
    totalRecipes, totalIngredients, pendingIngredients,
    recipeCountsByUser, ingredientCountsByUser,
    churnedUsers,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { plan: 'premium', isActive: true } }),
    prisma.user.count({ where: { plan: 'pro', isActive: true } }),
    prisma.user.count({ where: { plan: 'admin', isActive: true } }),
    prisma.recipe.count({ where: { isActive: true } }),
    prisma.ingredient.count({ where: { isActive: true } }),
    prisma.ingredient.count({ where: { isPublic: true, isApproved: false } }),
    // 2026-08新設: ユーザーごとのレシピ数（総レシピ数と同じisActive:trueだけを対象。
    // 非表示・削除済みは含まない）。件数の最大・最小・平均と、「1件以上持つユーザー数」
    // （＝これの逆数が「登録しただけで使っていないユーザー」の目安になる）をここから算出する。
    prisma.recipe.groupBy({ by: ['userId'], where: { isActive: true }, _count: { _all: true } }),
    // 同様にユーザーごとの食材マスタ数
    prisma.ingredient.groupBy({ by: ['userId'], where: { isActive: true }, _count: { _all: true } }),
    // 2026-08新設: 「今はフリープランだが、過去にpremium/proの契約履歴があるユーザー」＝
    // 有料プランを試した後に解約（またはお試しのまま終了）したユーザーの目安。
    // 正確な「お試し」フラグは無いため、あくまで概算値。
    prisma.user.count({
      where: {
        isActive: true,
        plan: 'free',
        subscriptions: { some: { plan: { in: ['premium', 'pro'] } } },
      },
    }),
  ]);

  // 件数配列から最大・最小・平均を出す小さいヘルパー（0件なら全部0扱い）
  const summarize = (counts: number[]) => {
    if (counts.length === 0) return { max: 0, min: 0, avg: 0, usersWithAtLeastOne: 0 };
    const sum = counts.reduce((a, b) => a + b, 0);
    return {
      max: Math.max(...counts),
      min: Math.min(...counts),
      avg: Math.round((sum / counts.length) * 10) / 10, // 小数第1位まで
      usersWithAtLeastOne: counts.length,
    };
  };

  const recipeStats     = summarize(recipeCountsByUser.map(r => r._count._all));
  const ingredientStats = summarize(ingredientCountsByUser.map(r => r._count._all));
  // 登録はしたがレシピを1件も作っていないユーザー数（＝グループ化の結果に出てこないユーザー数）
  const registeredOnlyUsers = totalUsers - recipeStats.usersWithAtLeastOne;
  const freeUsers = totalUsers - premiumUsers - proUsers - adminUsers;

  return NextResponse.json({
    success: true,
    data: {
      totalUsers, premiumUsers, proUsers, totalRecipes, totalIngredients, pendingIngredients,
      userBreakdown: { freeUsers, premiumUsers, proUsers, adminUsers },
      registeredOnlyUsers,
      churnedUsers,
      recipeStats,
      ingredientStats,
    },
  });
}
