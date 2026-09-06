// app/api/external/recipes/route.ts - 外部アプリ（在庫アプリ）向けレシピ取得API
// ============================================================
// 2026-09新設: 在庫アプリ（Lucke Inventory）の「製造・仕込」ページから呼ばれる。
// 以前は在庫アプリがこのDBに直接Postgres接続し、認証なしで「有効な全レシピ」を
// 無条件に返していた（他ユーザーのレシピ・原材料配合が丸見えになる重大なデータ漏えい。
// 2026-09発見・修正）。ここではAuthorizationヘッダー（Bearer <APIキー>）で
// app/api/user/external-api-key/route.tsが発行したキーを検証し、そのキーの持ち主の
// レシピだけを返すようにする。
//
// レスポンス形式は旧実装（在庫アプリ側の直接DB接続コード）と互換性を持たせ、
// 在庫アプリのフロント側（app/production/page.tsx）の表示コードは変更不要にしてある。
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const key = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!key) {
    return NextResponse.json({ error: 'Authorizationヘッダー（Bearer <APIキー>）が必要です' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { externalApiKey: key },
    select: { id: true, isActive: true },
  });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'APIキーが無効です' }, { status: 401 });
  }

  const recipes = await prisma.recipe.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      id: true, name: true, unitCount: true, salePrice: true, bakingConditions: true,
      ingredients: {
        select: {
          id: true, ingredientId: true, amount: true, unit: true, ingredientNameOverride: true,
          ingredient: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = recipes.map(r => ({
    id:               r.id,
    name:             r.name,
    unitCount:        r.unitCount,
    salePrice:        r.salePrice != null ? Number(r.salePrice) : null,
    bakingConditions: r.bakingConditions,
    ingredients: r.ingredients.map(ing => ({
      id:           ing.id,
      ingredientId: ing.ingredientId,
      name:         ing.ingredient?.name || ing.ingredientNameOverride || '（材料名未設定）',
      amount:       Number(ing.amount),
      unit:         ing.unit,
    })),
  }));

  return NextResponse.json({ recipes: result });
}
