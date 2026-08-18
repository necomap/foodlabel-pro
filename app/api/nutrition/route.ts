// ============================================================
// app/api/nutrition/route.ts - 食品成分表検索API
// ============================================================

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { normalizeIngredientName } from '@/lib/ingredient-similarity';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q       = (searchParams.get('q') ?? '').trim();
  const page    = parseInt(searchParams.get('page')    ?? '1');
  const perPage = parseInt(searchParams.get('perPage') ?? '20');
  const group   = searchParams.get('group') ?? '';

  if (!q && !group) {
    return NextResponse.json({ success: true, data: { items: [], total: 0, page, perPage } });
  }

  // 食品成分表は全体で数千件程度と小規模なので、group以外の絞り込みはDB側の contains では
  // 行わず、一旦候補を取得してからアプリ側でひらがな/カタカナ・全角半角の表記ゆれを吸収した
  // 正規化文字列で絞り込み・関連度順に並べ替える。
  // （以前は DB の id 順＝食品群の掲載順のまま先頭 take 件だけを返していたため、
  // 「油」のように多くの食品名に部分一致しがちなキーワードだと、たまたま食品群の並び順が
  // 早い無関係な食品（即席めん類など）で件数上限が埋まってしまい、本来探している食品
  // （ごま油など）が一覧に出てこない、という不具合があった）
  const where = group ? { foodGroup: group } : {};

  const rows = await prisma.nutritionData.findMany({
    where,
    orderBy: { id: 'asc' },
    select: {
      id:             true,
      foodGroup:      true,
      foodName:       true,
      wasteRatio:     true,
      energyKcal:     true,
      protein:        true,
      fat:            true,
      carbohydrate:   true,
      sodium:         true,
      saltEquivalent: true,
      dietaryFiber:   true,
      sugar:          true,
      cholesterol:    true,
      notes:          true,
    },
  });

  const qNorm = q ? normalizeIngredientName(q) : '';

  const matched = q
    ? rows.filter(r => normalizeIngredientName(r.foodName).includes(qNorm))
    : rows;

  // 関連度順に並べ替え：完全一致 > 前方一致 > それ以外の部分一致、の順。
  // 同じ関連度内では食品名が短い（＝より的確な一致である可能性が高い）ものを優先する。
  const ranked = q
    ? matched
        .map(r => {
          const nameNorm = normalizeIngredientName(r.foodName);
          const score = nameNorm === qNorm ? 0 : nameNorm.startsWith(qNorm) ? 1 : 2;
          return { r, score };
        })
        .sort((a, b) => a.score - b.score || a.r.foodName.length - b.r.foodName.length || a.r.id - b.r.id)
        .map(s => s.r)
    : matched;

  const total = ranked.length;
  const items = ranked.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  return NextResponse.json({
    success: true,
    data: {
      items: items.map(n => ({
        ...n,
        energyKcal:     n.energyKcal     ? Number(n.energyKcal)     : null,
        protein:        n.protein        ? Number(n.protein)        : null,
        fat:            n.fat            ? Number(n.fat)            : null,
        carbohydrate:   n.carbohydrate   ? Number(n.carbohydrate)   : null,
        sodium:         n.sodium         ? Number(n.sodium)         : null,
        saltEquivalent: n.saltEquivalent  ? Number(n.saltEquivalent) : null,
        dietaryFiber:   n.dietaryFiber   ? Number(n.dietaryFiber)   : null,
        sugar:          n.sugar          ? Number(n.sugar)          : null,
        cholesterol:    n.cholesterol    ? Number(n.cholesterol)    : null,
        wasteRatio:     n.wasteRatio     ? Number(n.wasteRatio)     : null,
      })),
      total, page, perPage,
    },
  });
}
