// app/api/admin/ingredients/[id]/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { INGREDIENT_REJECTION_REASONS } from '@/lib/ingredient-rejection-reasons';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (session?.user?.plan !== 'admin') return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 });

  const { isApproved, isPublic, rejectionReason, rejectionNote } = await request.json();

  // 却下（承認しない）の場合は理由の選択が必須。理由が「その他」の場合は自由記述も必須にする
  // （ユーザーへの通知で「その他」とだけ表示されても何のことか分からず不親切なため）。
  if (!isApproved) {
    const validCodes = INGREDIENT_REJECTION_REASONS.map(r => r.code);
    if (!rejectionReason || !validCodes.includes(rejectionReason)) {
      return NextResponse.json({ success: false, error: '却下理由を選択してください' }, { status: 400 });
    }
    if (rejectionReason === 'OTHER' && !String(rejectionNote ?? '').trim()) {
      return NextResponse.json({ success: false, error: '却下理由が「その他」の場合はコメントを入力してください' }, { status: 400 });
    }
  }

  await prisma.ingredient.update({
    where: { id: params.id },
    data: {
      isApproved: !!isApproved,
      isPublic:   !!isPublic,
      // 承認した場合は、過去に却下履歴があっても表示上は不要になるためクリアする。
      // 却下した場合は理由・却下日時を記録し、ユーザー側の通知で未確認（rejectionSeen:false）にする。
      rejectionReason: isApproved ? null : rejectionReason,
      rejectionNote:   isApproved ? null : (String(rejectionNote ?? '').trim() || null),
      rejectedAt:      isApproved ? null : new Date(),
      rejectionSeen:   isApproved ? true : false,
    },
  });

  return NextResponse.json({ success: true });
}
