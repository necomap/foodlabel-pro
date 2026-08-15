// app/api/ingredients/[id]/purchase-setting/route.ts
// 共有食材について、閲覧しているユーザー自身の仕入れ単位・価格・保管方法・仕入れ先を保存するAPI。
// 食材マスタ本体（名前・栄養成分・アレルゲン等）は共有元の作成者だけが編集できるが、
// 仕入れに関する情報は使う事業者ごとに異なる（価格・仕入れ先は機密性も高い）ため、
// ingredient_purchase_settings テーブルにユーザーごとの行として個別に持たせる。
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

type Params = { params: { id: string } };

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  // 対象の食材が閲覧可能（自分の食材、または承認済みの共有食材）か確認してから保存する
  const ing = await prisma.ingredient.findFirst({
    where: {
      id: params.id,
      isActive: true,
      OR: [
        { userId: session.user.id },
        { isPublic: true, isApproved: true },
      ],
    },
  });
  if (!ing) return NextResponse.json({ success: false, error: '食材が見つかりません' }, { status: 404 });

  const body = await request.json();
  const purchaseUnitG = body.purchaseUnitG != null ? Number(body.purchaseUnitG) : null;
  const purchasePrice = body.purchasePrice != null ? Number(body.purchasePrice) : null;
  const unitPrice      = (purchaseUnitG && purchasePrice) ? purchasePrice / purchaseUnitG : null;
  const storage         = body.storage || null;
  const supplier        = body.supplier || null;

  try {
    await prisma.$executeRaw`
      INSERT INTO ingredient_purchase_settings
        (id, "userId", "ingredientId", "purchaseUnitG", "purchasePrice", "unitPrice", storage, supplier, "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid(), ${session.user.id}, ${params.id}, ${purchaseUnitG}, ${purchasePrice}, ${unitPrice}, ${storage}, ${supplier}, NOW(), NOW())
      ON CONFLICT ("userId", "ingredientId") DO UPDATE SET
        "purchaseUnitG" = EXCLUDED."purchaseUnitG",
        "purchasePrice" = EXCLUDED."purchasePrice",
        "unitPrice"     = EXCLUDED."unitPrice",
        storage         = EXCLUDED.storage,
        supplier        = EXCLUDED.supplier,
        "updatedAt"     = NOW()
    `;
    return NextResponse.json({ success: true, message: '仕入れ設定を保存しました' });
  } catch (err) {
    console.error('purchase-setting PUT:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
