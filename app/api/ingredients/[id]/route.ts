// app/api/ingredients/[id]/route.ts - 食材更新・削除
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toFullWidth } from '@/lib/excel-import-export';
import { detectAllergens } from '@/lib/allergen';

type Params = { params: { id: string } };

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const ing = await prisma.ingredient.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!ing) return NextResponse.json({ success: false, error: '食材が見つかりません' }, { status: 404 });

  const body = await request.json();
  const name = body.name ? toFullWidth(body.name).trim() : ing.name;

  let unitPrice: number | undefined;
  if (body.purchaseUnitG && body.purchasePrice) {
    unitPrice = body.purchasePrice / body.purchaseUnitG;
  }

  const allergens = body.allergens?.length
    ? body.allergens
    : detectAllergens(name);

  await prisma.ingredient.update({
    where: { id: params.id },
    data: {
      name,
      nameKana:        body.nameKana        ?? ing.nameKana,
      nameSearch:      `${name}${body.nameKana ?? ''}`,
      ingredientCategoryId: body.ingredientCategoryId !== undefined ? (body.ingredientCategoryId || null) : (ing as any).ingredientCategoryId,
      nutritionId:     body.nutritionId     ?? ing.nutritionId,
      nutritionVariant: body.nutritionVariant ?? ing.nutritionVariant,
      purchaseUnitG:   body.purchaseUnitG   ?? ing.purchaseUnitG,
      purchasePrice:   body.purchasePrice   ?? ing.purchasePrice,
      unitPrice:       unitPrice ?? ing.unitPrice,
      storage:         body.storage         ?? ing.storage,
      supplier:        body.supplier        ?? ing.supplier,
      productCode:     body.productCode     ?? ing.productCode,
      allergens:       allergens,
      isPublic:        body.isPublic        ?? ing.isPublic,
      isApproved:      body.isPublic === false ? true : (body.isPublic ? false : ing.isApproved),
      energyKcalManual:    body.energyKcalManual    ?? ing.energyKcalManual,
      proteinManual:       body.proteinManual       ?? ing.proteinManual,
      fatManual:           body.fatManual           ?? ing.fatManual,
      carbohydrateManual:  body.carbohydrateManual  ?? ing.carbohydrateManual,
      sodiumManual:        body.sodiumManual        ?? ing.sodiumManual,
      saltEquivalentManual: body.saltEquivalentManual ?? ing.saltEquivalentManual,
      dietaryFiberManual:  body.dietaryFiberManual  ?? ing.dietaryFiberManual,
      sugarManual:         body.sugarManual         ?? ing.sugarManual,
      cholesterolManual:   body.cholesterolManual   ?? ing.cholesterolManual,
    },
  });

  return NextResponse.json({ success: true, message: '食材を更新しました' });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const ing = await prisma.ingredient.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!ing) return NextResponse.json({ success: false, error: '食材が見つかりません' }, { status: 404 });

  await prisma.ingredient.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
