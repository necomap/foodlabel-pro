// app/api/ingredients/route.ts - 食材マスタ検索・登録API
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toFullWidth } from '@/lib/excel-import-export';
import { detectAllergens } from '@/lib/allergen';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q          = searchParams.get('q')          ?? '';
  const page       = parseInt(searchParams.get('page')    ?? '1');
  const perPage    = parseInt(searchParams.get('perPage') ?? '20');
  const categoryId = searchParams.get('categoryId') ?? '';

  const where = {
    isActive: true,
    ...(categoryId === '__none__'
      ? { ingredientCategoryId: null }
      : categoryId
        ? { ingredientCategoryId: categoryId }
        : {}),
    AND: [
      {
        OR: [
          { userId: session.user.id },
          { userId: null, isApproved: true },
          { userId: null, isPublic:   true  },
        ],
      },
      ...(q ? [{
        OR: [
          { name:      { contains: q, mode: 'insensitive' as const } },
          { nameKana:  { contains: q, mode: 'insensitive' as const } },
          { nameSearch: { contains: q, mode: 'insensitive' as const } },
        ],
      }] : []),
    ],
  };

  const [total, ingredients] = await Promise.all([
    prisma.ingredient.count({ where }),
    prisma.ingredient.findMany({
      where,
      skip:    (page - 1) * perPage,
      take:    perPage,
      orderBy: [{ userId: 'asc' }, { name: 'asc' }],
      include: {
        nutritionData: {
          select: {
            id: true, foodName: true,
            energyKcal: true, protein: true, fat: true,
            carbohydrate: true, sodium: true, saltEquivalent: true,
            dietaryFiber: true, sugar: true, cholesterol: true,
          },
        },
      },
    }),
  ]);

  // ingredientCategoryNameをraw queryで取得
  const ingIds = ingredients.map(i => i.id);
  let categoryMap: Record<string, {id:string;name:string}> = {};
  if (ingIds.length > 0) {
    try {
      const catRows = await prisma.$queryRaw`
        SELECT i.id::text as ingredient_id, ic.id::text as cat_id, ic.name as cat_name
        FROM ingredients i
        LEFT JOIN ingredient_categories ic ON ic.id = i."ingredientCategoryId"::uuid
        WHERE i.id::text = ANY(${ingIds})
      ` as Array<{ingredient_id:string; cat_id:string|null; cat_name:string|null}>;
      for (const row of catRows) {
        categoryMap[row.ingredient_id] = { id: row.cat_id ?? '', name: row.cat_name ?? '' };
      }
    } catch {
      // ingredient_categories テーブルがまだない場合は無視
    }
  }

  const items = ingredients.map(ing => ({
    id:              ing.id,
    name:            ing.name,
    nameKana:        ing.nameKana,
    allergens:       ing.allergens,
    nutritionId:     ing.nutritionId,
    nutritionVariant: ing.nutritionVariant,
    purchaseUnitG:   ing.purchaseUnitG,
    purchasePrice:   ing.purchasePrice  ? Number(ing.purchasePrice)  : null,
    unitPrice:       ing.unitPrice      ? Number(ing.unitPrice)      : null,
    storage:         ing.storage,
    supplier:        ing.supplier,
    ingredientCategoryId:   (ing as any).ingredientCategoryId ?? null,
    ingredientCategoryName: categoryMap[ing.id]?.name || null,
    isPublic:        ing.isPublic,
    isOwnRecord:     ing.userId === session.user.id,
    nutrition: ing.nutritionData ? {
      energyKcal:     ing.energyKcalManual    != null ? Number(ing.energyKcalManual)    : (ing.nutritionData.energyKcal     != null ? Number(ing.nutritionData.energyKcal)     : null),
      protein:        ing.proteinManual       != null ? Number(ing.proteinManual)       : (ing.nutritionData.protein        != null ? Number(ing.nutritionData.protein)        : null),
      fat:            ing.fatManual           != null ? Number(ing.fatManual)           : (ing.nutritionData.fat            != null ? Number(ing.nutritionData.fat)            : null),
      carbohydrate:   ing.carbohydrateManual  != null ? Number(ing.carbohydrateManual)  : (ing.nutritionData.carbohydrate   != null ? Number(ing.nutritionData.carbohydrate)   : null),
      sodium:         ing.sodiumManual        != null ? Number(ing.sodiumManual)        : (ing.nutritionData.sodium         != null ? Number(ing.nutritionData.sodium)         : null),
      saltEquivalent: ing.saltEquivalentManual != null ? Number(ing.saltEquivalentManual) : (ing.nutritionData.saltEquivalent != null ? Number(ing.nutritionData.saltEquivalent) : null),
      dietaryFiber:   ing.dietaryFiberManual  != null ? Number(ing.dietaryFiberManual)  : (ing.nutritionData.dietaryFiber   != null ? Number(ing.nutritionData.dietaryFiber)   : null),
      sugar:          ing.sugarManual         != null ? Number(ing.sugarManual)         : (ing.nutritionData.sugar          != null ? Number(ing.nutritionData.sugar)          : null),
      cholesterol:    ing.cholesterolManual   != null ? Number(ing.cholesterolManual)   : (ing.nutritionData.cholesterol    != null ? Number(ing.nutritionData.cholesterol)    : null),
    } : null,
  }));

  return NextResponse.json({ success: true, data: { items, total, page, perPage } });
}

const ingredientCreateSchema = z.object({
  name:                 z.string().min(1).max(200),
  nameKana:             z.string().max(200).optional(),
  nutritionId:          z.number().int().optional(),
  nutritionVariant:     z.string().optional(),
  ingredientCategoryId: z.string().optional(),
  purchaseUnitG:        z.number().int().positive().optional(),
  purchasePrice:        z.number().positive().optional(),
  storage:              z.enum(['ROOM_TEMP', 'FRIDGE', 'FROZEN', 'OTHER']).default('ROOM_TEMP'),
  supplier:             z.string().max(100).optional(),
  productCode:          z.string().max(100).optional(),
  allergens:            z.array(z.string()).optional(),
  isPublic:             z.boolean().default(false),
  energyKcalManual:     z.number().optional(),
  proteinManual:        z.number().optional(),
  fatManual:            z.number().optional(),
  carbohydrateManual:   z.number().optional(),
  sodiumManual:         z.number().optional(),
  saltEquivalentManual: z.number().optional(),
  dietaryFiberManual:   z.number().optional(),
  sugarManual:          z.number().optional(),
  cholesterolManual:    z.number().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const body   = await request.json();
  const result = ingredientCreateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });
  }
  const data = result.data;

  const normalizedName = toFullWidth(data.name);
  let unitPrice: number | undefined;
  if (data.purchaseUnitG && data.purchasePrice) {
    unitPrice = data.purchasePrice / data.purchaseUnitG;
  }
  const allergens = data.allergens?.length ? data.allergens : detectAllergens(normalizedName);

  const ingredient = await prisma.ingredient.create({
    data: {
      userId:          session.user.id,
      name:            normalizedName,
      nameKana:        data.nameKana,
      nameSearch:      `${normalizedName}${data.nameKana ?? ''}`,
      nutritionId:     data.nutritionId,
      nutritionVariant: data.nutritionVariant,
      purchaseUnitG:   data.purchaseUnitG,
      purchasePrice:   data.purchasePrice,
      unitPrice,
      storage:         data.storage,
      supplier:        data.supplier,
      productCode:     data.productCode,
      allergens,
      isPublic:        data.isPublic,
      isApproved:      !data.isPublic,
      energyKcalManual:    data.energyKcalManual,
      proteinManual:       data.proteinManual,
      fatManual:           data.fatManual,
      carbohydrateManual:  data.carbohydrateManual,
      sodiumManual:        data.sodiumManual,
      saltEquivalentManual: data.saltEquivalentManual,
      dietaryFiberManual:  data.dietaryFiberManual,
      sugarManual:         data.sugarManual,
      cholesterolManual:   data.cholesterolManual,
    },
  });

  // ingredientCategoryIdをraw SQLで更新（Prismaクライアント未生成対応）
  if (data.ingredientCategoryId) {
    try {
      await prisma.$executeRaw`
        UPDATE ingredients SET "ingredientCategoryId" = ${data.ingredientCategoryId}::uuid
        WHERE id = ${ingredient.id}
      `;
    } catch (e) { console.warn('ingredientCategoryId update skipped:', e); }
  }

  return NextResponse.json({ success: true, data: { id: ingredient.id } });
}
