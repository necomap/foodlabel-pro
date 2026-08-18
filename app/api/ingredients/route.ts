// app/api/ingredients/route.ts - 食材マスタ検索・登録API
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toFullWidth } from '@/lib/excel-import-export';
import { detectAllergens } from '@/lib/allergen';
import { normalizeIngredientName, isSimilarName } from '@/lib/ingredient-similarity';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q          = searchParams.get('q')          ?? '';
  const page       = parseInt(searchParams.get('page')    ?? '1');
  const perPage    = parseInt(searchParams.get('perPage') ?? '20');
  const categoryId = searchParams.get('categoryId') ?? '';
  // source: 'own'=自分の食材のみ／'community'=他ユーザーが共有した食材のみ／
  // 'system'=食品成分表から自動生成した共有食材のみ／未指定='all'（従来どおり自分の食材を
  // 先頭にした統合リスト。レシピ編集画面の材料検索など、タブ分けせず横断的に検索したい
  // 呼び出し元との後方互換のために残している）。
  const source = searchParams.get('source') ?? 'all';

  const categoryFilter = categoryId === '__none__'
    ? { ingredientCategoryId: null }
    : categoryId
      ? { ingredientCategoryId: categoryId }
      : {};
  const qFilter = q ? {
    OR: [
      { name:      { contains: q, mode: 'insensitive' as const } },
      { nameKana:  { contains: q, mode: 'insensitive' as const } },
      { nameSearch: { contains: q, mode: 'insensitive' as const } },
      { genericName: { contains: q, mode: 'insensitive' as const } },
    ],
  } : undefined;

  // include を変数に切り出す際、単なるオブジェクトリテラルのままだと select 内の `true` が
  // `boolean` 型に広がってしまい、Prismaのfindmanyの戻り値型からnutritionDataが
  // 消えてしまう（実際にビルドで発生した型エラー）。`satisfies Prisma.IngredientInclude`
  // で literal型（true）を保ったまま型チェックすることで、inline指定した場合と同じ
  // 戻り値の型推論（nutritionData含む）を維持する。
  const nutritionInclude = {
    nutritionData: {
      select: {
        id: true, foodName: true,
        energyKcal: true, protein: true, fat: true,
        carbohydrate: true, sodium: true, saltEquivalent: true,
        dietaryFiber: true, sugar: true, cholesterol: true,
      },
    },
  } satisfies Prisma.IngredientInclude;

  let ingredients: Prisma.IngredientGetPayload<{ include: typeof nutritionInclude }>[];
  let total: number;

  if (source === 'own') {
    // 自分が登録した食材のみ
    const where = { isActive: true, ...categoryFilter, userId: session.user.id, ...(qFilter ? { AND: [qFilter] } : {}) };
    [total, ingredients] = await Promise.all([
      prisma.ingredient.count({ where }),
      prisma.ingredient.findMany({ where, skip: (page - 1) * perPage, take: perPage, orderBy: { name: 'asc' }, include: nutritionInclude }),
    ]);
  } else if (source === 'community') {
    // 他ユーザーが登録し、共有申請が承認された食材（システム自動生成分は除く）
    const where = {
      isActive: true, ...categoryFilter,
      isPublic: true, isApproved: true,
      userId: { not: null as string | null },
      NOT: { userId: session.user.id },
      ...(qFilter ? { AND: [qFilter] } : {}),
    };
    [total, ingredients] = await Promise.all([
      prisma.ingredient.count({ where }),
      prisma.ingredient.findMany({ where, skip: (page - 1) * perPage, take: perPage, orderBy: { name: 'asc' }, include: nutritionInclude }),
    ]);
  } else if (source === 'system') {
    // 食品成分表から自動生成した共有食材（userId: null）
    const where = {
      isActive: true, ...categoryFilter,
      isPublic: true, isApproved: true,
      userId: null as string | null,
      ...(qFilter ? { AND: [qFilter] } : {}),
    };
    [total, ingredients] = await Promise.all([
      prisma.ingredient.count({ where }),
      prisma.ingredient.findMany({ where, skip: (page - 1) * perPage, take: perPage, orderBy: { name: 'asc' }, include: nutritionInclude }),
    ]);
  } else {
    // 'all'（後方互換）: 自分の食材と共有食材（他ユーザー申請分・システム自動生成分の両方）を
    // 別々のクエリで取得し、常に自分の食材を先に表示する。Prismaのfindmany().orderBy()には
    // 「userId===自分ならCASE WHENで先頭に」のような条件付き並び替えを直接書けないため、
    // 2クエリに分けてページ境界をまたいでも自分の食材が必ず先に来るよう skip/take を手計算で振り分ける。
    const ownWhere = {
      isActive: true, ...categoryFilter,
      userId: session.user.id,
      ...(qFilter ? { AND: [qFilter] } : {}),
    };
    const sharedWhere = {
      isActive: true, ...categoryFilter,
      userId: { not: session.user.id },
      isPublic: true, isApproved: true,
      ...(qFilter ? { AND: [qFilter] } : {}),
    };
    const [ownTotal, sharedTotal] = await Promise.all([
      prisma.ingredient.count({ where: ownWhere }),
      prisma.ingredient.count({ where: sharedWhere }),
    ]);
    total = ownTotal + sharedTotal;

    const skip      = (page - 1) * perPage;
    const ownSkip    = Math.min(skip, ownTotal);
    const ownTake    = Math.max(0, Math.min(perPage, ownTotal - ownSkip));
    const sharedSkip = Math.max(0, skip - ownTotal);
    const sharedTake = Math.max(0, perPage - ownTake);

    // take:0 でも空配列がそのまま返る（Prisma的に有効なクエリ）ため、件数0のときも
    // 同じfindMany呼び出しに統一する。三項演算子でPromise.resolve([])に分岐させていた
    // 以前の実装は、分岐ごとに戻り値の型が微妙にズレてnutritionDataへのアクセスが
    // 型エラーになる問題があったため、常に同じ形の呼び出しにして型を一致させている。
    const [ownItems, sharedItems] = await Promise.all([
      prisma.ingredient.findMany({ where: ownWhere, skip: ownSkip, take: ownTake, orderBy: { name: 'asc' }, include: nutritionInclude }),
      prisma.ingredient.findMany({ where: sharedWhere, skip: sharedSkip, take: sharedTake, orderBy: { name: 'asc' }, include: nutritionInclude }),
    ]);
    ingredients = [...ownItems, ...sharedItems];
  }

  // ingredientCategoryNameをraw queryで取得
  // ingredientCategoryId が空文字や不正な形式（UUIDでない）のレコードが1件でも混ざっていると、
  // ::uuid キャストがその行でエラーになりクエリ全体が失敗する（Postgresは1行のエラーでクエリ
  // 全体を中断する）。その結果catchで握りつぶされてcategoryMapが空のまま返り、実際にはカテゴリが
  // 設定されている食材も含めて「一覧の食材が全部カテゴリなし」に見えてしまう不具合があった
  // （管理画面の承認待ち一覧で報告されたのと同種の不具合）。
  // CASE式で「正規のUUID形式に一致する行だけ」キャストするようにし、それ以外の行は（エラーに
  // せず）その行だけカテゴリなし扱いにすることで、1件の不正データが他の正常な表示まで
  // 巻き込まないようにしている。
  const ingIds = ingredients.map(i => i.id);
  let categoryMap: Record<string, {id:string;name:string}> = {};
  if (ingIds.length > 0) {
    try {
      const catRows = await prisma.$queryRaw`
        SELECT i.id::text as ingredient_id, ic.id::text as cat_id, ic.name as cat_name
        FROM ingredients i
        LEFT JOIN ingredient_categories ic ON ic.id = (
          CASE WHEN i."ingredientCategoryId" ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
               THEN i."ingredientCategoryId"::uuid END
        )
        WHERE i.id::text = ANY(${ingIds})
      ` as Array<{ingredient_id:string; cat_id:string|null; cat_name:string|null}>;
      for (const row of catRows) {
        categoryMap[row.ingredient_id] = { id: row.cat_id ?? '', name: row.cat_name ?? '' };
      }
    } catch (e) {
      console.warn('ingredients categoryMap lookup skipped:', e);
    }
  }

  // 各食材が自分のレシピで何件使われているか（重複食材の整理・削除可否の判断用）
  let usageMap: Record<string, number> = {};
  if (ingIds.length > 0) {
    const usageCounts = await prisma.recipeIngredient.groupBy({
      by:    ['ingredientId'],
      where: { ingredientId: { in: ingIds }, recipe: { userId: session.user.id } },
      _count: { _all: true },
    });
    for (const row of usageCounts) {
      if (row.ingredientId) usageMap[row.ingredientId] = row._count._all;
    }
  }

  // 共有食材（自分が作成者ではないもの）については、仕入れ単位・価格・保管方法・仕入れ先を
  // 食材マスタ本体からではなく、閲覧者自身の個別設定（ingredient_purchase_settings）から取得する。
  // これをしないと、共有食材を承認しただけで作成者の仕入れ値・仕入れ先が他ユーザー全員に
  // 見えてしまう（価格や取引先は事業者にとって機密性の高い情報のため）。
  type PurchaseSetting = { ingredientId: string; purchaseUnitG: number|null; purchasePrice: number|null; unitPrice: number|null; storage: string|null; supplier: string|null };
  let purchaseSettingMap: Record<string, PurchaseSetting> = {};
  if (ingIds.length > 0) {
    try {
      const rows = await prisma.$queryRaw`
        SELECT "ingredientId", "purchaseUnitG",
               "purchasePrice"::float as "purchasePrice",
               "unitPrice"::float as "unitPrice",
               storage, supplier
        FROM ingredient_purchase_settings
        WHERE "userId" = ${session.user.id} AND "ingredientId" = ANY(${ingIds})
      ` as PurchaseSetting[];
      for (const row of rows) purchaseSettingMap[row.ingredientId] = row;
    } catch (e) {
      console.warn('ingredient_purchase_settings lookup skipped:', e);
    }
  }

  const items = ingredients.map(ing => {
    // 成分表データ（nutritionData）にリンクしていなくても、手入力(Manual)値だけが
    // 入っているケース（成分表に該当食品がない食材）があるため、どちらかがあれば nutrition を組み立てる。
    // 以前は nutritionData が無いと問答無用で null にしていたため、手入力した栄養成分が
    // 一覧にも編集画面にも反映されない（保存はされているのに表示されない）不具合があった。
    const hasManual = [
      ing.energyKcalManual, ing.proteinManual, ing.fatManual, ing.carbohydrateManual,
      ing.sodiumManual, ing.saltEquivalentManual, ing.dietaryFiberManual, ing.sugarManual, ing.cholesterolManual,
    ].some(v => v != null);

    const isOwnRecord    = ing.userId === session.user.id;
    // 食品成分表から自動生成したシステム所有食材（userId: null）かどうか。
    // 管理者が編集・削除できるようにするための判定に使う（一般ユーザーは編集不可のまま）。
    const isSystemOwned = ing.userId === null;
    const mySetting     = purchaseSettingMap[ing.id];
    // 自分の食材ならマスタ本体の値をそのまま、共有食材なら自分の個別設定（未設定ならnull）を使う。
    const purchaseUnitG = isOwnRecord ? ing.purchaseUnitG : (mySetting?.purchaseUnitG ?? null);
    const purchasePrice = isOwnRecord ? (ing.purchasePrice != null ? Number(ing.purchasePrice) : null) : (mySetting?.purchasePrice ?? null);
    const unitPrice      = isOwnRecord ? (ing.unitPrice != null ? Number(ing.unitPrice) : null) : (mySetting?.unitPrice ?? null);
    const storage         = isOwnRecord ? ing.storage : (mySetting?.storage ?? null);
    const supplier        = isOwnRecord ? ing.supplier : (mySetting?.supplier ?? null);

    return {
      id:              ing.id,
      name:            ing.name,
      nameKana:        ing.nameKana,
      genericName:          (ing as any).genericName ?? null,
      genericNameConfirmed: (ing as any).genericNameConfirmed ?? true,
      alwaysHideFromLabel:  (ing as any).alwaysHideFromLabel ?? false,
      originCountry:        (ing as any).originCountry ?? null,
      recipeUsageCount: usageMap[ing.id] ?? 0,
      allergens:       ing.allergens,
      nutritionId:     ing.nutritionId,
      nutritionVariant: ing.nutritionVariant,
      purchaseUnitG,
      purchasePrice,
      unitPrice,
      storage,
      supplier,
      // 共有食材について、自分がまだ仕入れ設定を入力していないかどうか（一覧のボタン表示切り替え用）
      hasPurchaseSetting: isOwnRecord ? true : !!mySetting,
      ingredientCategoryId:   (ing as any).ingredientCategoryId ?? null,
      ingredientCategoryName: categoryMap[ing.id]?.name || null,
      isPublic:        ing.isPublic,
      isOwnRecord,
      isSystemOwned,
      nutrition: (ing.nutritionData || hasManual) ? {
        energyKcal:     ing.energyKcalManual    != null ? Number(ing.energyKcalManual)    : (ing.nutritionData?.energyKcal     != null ? Number(ing.nutritionData.energyKcal)     : null),
        protein:        ing.proteinManual       != null ? Number(ing.proteinManual)       : (ing.nutritionData?.protein        != null ? Number(ing.nutritionData.protein)        : null),
        fat:            ing.fatManual           != null ? Number(ing.fatManual)           : (ing.nutritionData?.fat            != null ? Number(ing.nutritionData.fat)            : null),
        carbohydrate:   ing.carbohydrateManual  != null ? Number(ing.carbohydrateManual)  : (ing.nutritionData?.carbohydrate   != null ? Number(ing.nutritionData.carbohydrate)   : null),
        sodium:         ing.sodiumManual        != null ? Number(ing.sodiumManual)        : (ing.nutritionData?.sodium         != null ? Number(ing.nutritionData.sodium)         : null),
        saltEquivalent: ing.saltEquivalentManual != null ? Number(ing.saltEquivalentManual) : (ing.nutritionData?.saltEquivalent != null ? Number(ing.nutritionData.saltEquivalent) : null),
        dietaryFiber:   ing.dietaryFiberManual  != null ? Number(ing.dietaryFiberManual)  : (ing.nutritionData?.dietaryFiber   != null ? Number(ing.nutritionData.dietaryFiber)   : null),
        sugar:          ing.sugarManual         != null ? Number(ing.sugarManual)         : (ing.nutritionData?.sugar          != null ? Number(ing.nutritionData.sugar)          : null),
        cholesterol:    ing.cholesterolManual   != null ? Number(ing.cholesterolManual)   : (ing.nutritionData?.cholesterol    != null ? Number(ing.nutritionData.cholesterol)    : null),
      } : null,
    };
  });

  return NextResponse.json({ success: true, data: { items, total, page, perPage } });
}

const ingredientCreateSchema = z.object({
  name:                 z.string().min(1).max(200),
  nameKana:             z.string().max(200).optional(),
  genericName:          z.string().max(200).optional(),
  alwaysHideFromLabel:  z.boolean().default(false),
  nutritionId:          z.number().int().optional(),
  nutritionVariant:     z.string().optional(),
  ingredientCategoryId: z.string().optional(),
  purchaseUnitG:        z.number().int().positive().optional(),
  purchasePrice:        z.number().positive().optional(),
  storage:              z.enum(['ROOM_TEMP', 'FRIDGE', 'FROZEN', 'OTHER']).default('ROOM_TEMP'),
  supplier:             z.string().max(100).optional(),
  productCode:          z.string().max(100).optional(),
  originCountry:        z.string().max(100).optional(),
  allergens:            z.array(z.string()).optional(),
  isPublic:             z.boolean().default(false),
  // trueの場合、下の類似食材チェックをスキップしてそのまま登録する
  // （ユーザーが警告を見た上で「このまま登録する」を選んだ場合に送られてくる）
  confirmDuplicate:     z.boolean().default(false),
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

  // 似た名前の食材がすでにある場合は、確認なしにそのまま重複登録してしまわないよう
  // 一旦警告を返す（confirmDuplicate:true が送られてきたときだけスキップする）。
  // 自動で統合はせず、「このまま登録する」か「既存を使う」かはユーザーに選ばせる方針。
  if (!data.confirmDuplicate) {
    const compareName = normalizeIngredientName(normalizedName);
    // 検索結果一覧（GET）と同じ可視範囲（自分の食材＋共有・承認済みの食材）で類似チェックする
    const visible = await prisma.ingredient.findMany({
      where: {
        isActive: true,
        OR: [
          { userId: session.user.id },
          { isPublic: true, isApproved: true },
        ],
      },
      select: { id: true, name: true, isPublic: true },
    });
    const candidates = visible
      .filter(v => isSimilarName(compareName, normalizeIngredientName(v.name)))
      .slice(0, 5)
      .map(v => ({ id: v.id, name: v.name, isPublic: v.isPublic }));
    if (candidates.length > 0) {
      return NextResponse.json({
        success: false,
        needsConfirmation: true,
        error: '似た名前の食材が既に登録されています',
        data: { candidates },
      });
    }
  }

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
      genericName:          data.genericName || null,
      // ユーザーが手入力した一般名は確定済み扱い（自動仮入力バッチのものはfalseになる）
      genericNameConfirmed: data.genericName ? true : false,
      alwaysHideFromLabel:  data.alwaysHideFromLabel,
      nutritionId:     data.nutritionId,
      nutritionVariant: data.nutritionVariant,
      purchaseUnitG:   data.purchaseUnitG,
      purchasePrice:   data.purchasePrice,
      unitPrice,
      storage:         data.storage,
      supplier:        data.supplier,
      productCode:     data.productCode,
      originCountry:   data.originCountry || null,
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
  // 注意：WHERE句のidにも::uuidキャストが必要（無いとPostgresがuuid=textの型不一致で
  // 例外を投げ、下のcatchで黙って握りつぶされてカテゴリが保存されないバグになる）。
  if (data.ingredientCategoryId) {
    try {
      await prisma.$executeRaw`
        UPDATE ingredients SET "ingredientCategoryId" = ${data.ingredientCategoryId}::uuid
        WHERE id = ${ingredient.id}::uuid
      `;
    } catch (e) { console.warn('ingredientCategoryId update skipped:', e); }
  }

  return NextResponse.json({ success: true, data: { id: ingredient.id } });
}
