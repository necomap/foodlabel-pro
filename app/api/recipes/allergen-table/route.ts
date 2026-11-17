// ============================================================
// app/api/recipes/allergen-table/route.ts - アレルゲン一覧表用のデータ取得API（2026-11新設）
// ============================================================
// 表示中（isActive=true）の全レシピについて、特定原材料等28品目のどれを含むかを返す。
// 店頭掲示・問い合わせ対応用の一覧表（app/dashboard/allergen-table/page.tsx）で使う。
// 集計は lib/recipe-allergen-summary.ts（ラベルと同じ collectRecipeAllergens）。

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { REQUIRED_ALLERGENS, OPTIONAL_ALLERGENS } from '@/lib/allergen';
import { getRecipeAllergenSummaries } from '@/lib/recipe-allergen-summary';

const LIMIT = 1000;

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('category') ?? '';

  const items = await getRecipeAllergenSummaries(
    session.user.id,
    { isActive: true, ...(categoryId && { categoryId }) },
    LIMIT,
  );

  return NextResponse.json({
    success: true,
    data: {
      items,
      required: Object.keys(REQUIRED_ALLERGENS),
      optional: Object.keys(OPTIONAL_ALLERGENS),
      truncated: items.length >= LIMIT,
    },
  });
}
