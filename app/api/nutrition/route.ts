// ============================================================
// app/api/nutrition/route.ts - 食品成分表検索API
// ============================================================

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q       = searchParams.get('q')    ?? '';
  const page    = parseInt(searchParams.get('page')    ?? '1');
  const perPage = parseInt(searchParams.get('perPage') ?? '20');
  const group   = searchParams.get('group') ?? '';

  if (!q && !group) {
    return NextResponse.json({ success: true, data: { items: [], total: 0 } });
  }

  const where = {
    AND: [
      ...(q ? [{ foodName: { contains: q, mode: 'insensitive' as const } }] : []),
      ...(group ? [{ foodGroup: group }] : []),
    ],
  };

  const [total, items] = await Promise.all([
    prisma.nutritionData.count({ where }),
    prisma.nutritionData.findMany({
      where,
      skip:    (page - 1) * perPage,
      take:    perPage,
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
    }),
  ]);

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
