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

  // ============================================================
  // 2026-08新設: ユーザー分析用の追加集計
  // ============================================================
  // 「絶対必要ではないが、今後のアプデの参考にしたい」という要望で追加。
  // ログインベースのリアルタイム「アクティブユーザー」（ログイン履歴の記録が必要）は
  // スキーマ変更が必要になるため対象外（ユーザーから明示的に不要と確認済み）。
  // 代わりに、既存データだけで判定できる「登録のみ（レシピ0件）ユーザー」を出すことで、
  // 実質的に「登録後に使い始めたユーザー」の裏返し（全ユーザー－登録のみユーザー）が分かるようにしている。

  const [recipeCountsByUser, ingredientCountsByUser, allActiveUsers, freeUsersWithSubHistory] = await Promise.all([
    // ユーザーごとのレシピ件数（非表示・論理削除は除く）
    prisma.recipe.groupBy({ by: ['userId'], where: { isActive: true }, _count: { _all: true } }),
    // ユーザーごとの食材マスタ件数（userIdがnull＝共有マスタなどは対象外）
    prisma.ingredient.groupBy({ by: ['userId'], where: { isActive: true, userId: { not: null } }, _count: { _all: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true } }),
    // 現在フリープランだが、過去に何らかの有料プラン契約（Subscriptionレコード）があるユーザー。
    // 「解約済み（元有料）」と「お試しのみ（一度も本契約に至らなかった）」の判定に使う。
    prisma.user.findMany({
      where: { isActive: true, plan: 'free', subscriptions: { some: {} } },
      select: { id: true, subscriptions: { select: { status: true, plan: true } } },
    }),
  ]);

  const recipeCountValues     = recipeCountsByUser.map(r => r._count._all);
  const ingredientCountValues = ingredientCountsByUser.map(r => r._count._all);
  const usersWithRecipeIds    = new Set(recipeCountsByUser.map(r => r.userId));
  // 登録のみユーザー（レシピを1件も作っていない）＝全アクティブユーザー－レシピを持つユーザー
  const registeredOnlyUsers = allActiveUsers.filter(u => !usersWithRecipeIds.has(u.id)).length;

  // 「解約済み（元有料）」＝ status:active/past_due の契約履歴がある（＝実際に課金されたことがある）
  // 「お試しのみ」＝ 契約履歴はあるが一度もactive/past_dueになっていない（トライアル中にキャンセル等）
  let churnedUsers   = 0;
  let trialOnlyUsers = 0;
  for (const u of freeUsersWithSubHistory) {
    const everBilled = u.subscriptions.some(s =>
      (s.plan === 'premium' || s.plan === 'pro') && (s.status === 'active' || s.status === 'past_due')
    );
    if (everBilled) churnedUsers++; else trialOnlyUsers++;
  }

  const summarize = (values: number[]) => values.length === 0
    ? { max: 0, min: 0, avg: 0 }
    : {
        max: Math.max(...values),
        min: Math.min(...values),
        avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
      };

  return NextResponse.json({
    success: true,
    data: {
      totalUsers, premiumUsers, proUsers, totalRecipes, totalIngredients, pendingIngredients,
      registeredOnlyUsers,
      churnedUsers,
      trialOnlyUsers,
      recipeCountStats:     summarize(recipeCountValues),
      ingredientCountStats: summarize(ingredientCountValues),
    },
  });
}
