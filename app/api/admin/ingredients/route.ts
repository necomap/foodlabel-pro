// app/api/admin/ingredients/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const where = status === 'pending'
    ? { isPublic: true, isApproved: false, isActive: true }
    : { isActive: true };

  const ingredients = await prisma.ingredient.findMany({
    where,
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    success: true,
    data: ingredients.map(i => ({
      id:        i.id,
      name:      i.name,
      userId:    i.userId,
      userEmail: i.user?.email,
      allergens: i.allergens,
      createdAt: i.createdAt,
    })),
  });
}
