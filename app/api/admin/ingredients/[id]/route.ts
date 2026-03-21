// app/api/admin/ingredients/[id]/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  const { isApproved, isPublic } = await request.json();
  await prisma.ingredient.update({
    where: { id: params.id },
    data:  { isApproved: !!isApproved, isPublic: !!isPublic },
  });

  return NextResponse.json({ success: true });
}
