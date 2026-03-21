// app/api/recipes/[id]/copy/route.ts - レシピコピーAPI
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const original = await prisma.recipe.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      ingredients: true,
      steps: { orderBy: { stepNumber: 'asc' } },
    },
  });

  if (!original) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });

  // 品名に「（コピー）」を追加
  const newName = `${original.name}（コピー）`;

  const copied = await prisma.recipe.create({
    data: {
      userId:          original.userId,
      categoryId:      original.categoryId,
      name:            newName,
      nameKana:        original.nameKana ? `${original.nameKana}（コピー）` : null,
      unitCount:       original.unitCount,
      wasteRatio:      original.wasteRatio,
      salePrice:       original.salePrice,
      shelfLifeDays:   original.shelfLifeDays,
      shelfLifeType:   original.shelfLifeType,
      contentAmount:   original.contentAmount,
      storageMethod:   original.storageMethod,
      notes:           original.notes,
      printComment:    original.printComment,
      qualityControl:  original.qualityControl,
      bakingConditions: original.bakingConditions,
      totalCost:       original.totalCost,
      unitCost:        original.unitCost,
      costRate:        original.costRate,
      totalWeightG:    original.totalWeightG,
      energyKcal:      original.energyKcal,
      protein:         original.protein,
      fat:             original.fat,
      carbohydrate:    original.carbohydrate,
      sodium:          original.sodium,
      saltEquivalent:  original.saltEquivalent,
      dietaryFiber:    original.dietaryFiber,
      sugar:           original.sugar,
      cholesterol:     original.cholesterol,
      ingredients: {
        create: original.ingredients.map(ing => ({
          ingredientId:           ing.ingredientId,
          ingredientNameOverride: ing.ingredientNameOverride,
          amount:                 ing.amount,
          unit:                   ing.unit,
          displayOrder:           ing.displayOrder,
          sortByWeight:           ing.sortByWeight,
          originCountry:          ing.originCountry,
          isPrimaryIngredient:    ing.isPrimaryIngredient,
          costPrice:              ing.costPrice,
          costTotal:              ing.costTotal,
          allergenOverride:       ing.allergenOverride,
          nutritionUnconfirmed:   ing.nutritionUnconfirmed,
          energyKcal:             ing.energyKcal,
          protein:                ing.protein,
          fat:                    ing.fat,
          carbohydrate:           ing.carbohydrate,
          sodium:                 ing.sodium,
          saltEquivalent:         ing.saltEquivalent,
          dietaryFiber:           ing.dietaryFiber,
          sugar:                  ing.sugar,
          cholesterol:            ing.cholesterol,
        })),
      },
      steps: {
        create: original.steps.map(s => ({
          stepNumber:  s.stepNumber,
          instruction: s.instruction,
        })),
      },
    },
  });

  return NextResponse.json({ success: true, data: { id: copied.id, name: copied.name } });
}
