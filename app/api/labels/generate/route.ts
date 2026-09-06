// ============================================================
// app/api/labels/generate/route.ts - ラベル生成API
// ============================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getPlanLimits } from '@/lib/plan-limits';
import { prisma } from '@/lib/db';
import { generateLabelContent, generateLabelHtml, getDefaultDisplaySettings } from '@/lib/label';
import { buildIngredientsLabel, collectRecipeAllergens, prepareIngredientsForLabel } from '@/lib/allergen';
import { calcPerUnit, roundForDisplay, calcNutritionForAmount, resolveIngredientNutritionPer100g } from '@/lib/nutrition';
import { getGenericNameOverrides } from '@/lib/generic-name-overrides';
import { deductStockForPrint } from '@/lib/stock-sync';
import type { RecipeDetail, LabelConfig, BakingStep } from '@/types';

const labelConfigSchema = z.object({
  recipeId:        z.string(),
  shopId:          z.string().optional(),
  manufactureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shelfLifeDays:   z.number().int().min(0).optional(),
  printCount:      z.number().int().positive().default(1),
  fontSizePt:      z.number().min(6).max(12).default(8),
  // ラベル本文に使う日本語フォント。選べる値は lib/label.ts の FONT_FAMILY_OPTIONS 参照
  fontFamily:      z.enum(['noto-sans-jp', 'yu-gothic', 'hiragino-kaku-gothic', 'meiryo']).default('noto-sans-jp'),
  deviceType:      z.enum(['LABEL_PRINTER', 'A4_PRINTER', 'OTHER']).default('LABEL_PRINTER'),
  labelWidthMm:    z.number().positive().optional(),
  labelHeightMm:   z.number().positive().optional(),
  labelHeightAuto: z.boolean().optional(),
  isPrecut:        z.boolean().optional(),
  cutMarginMm:     z.number().optional(),
  // ラベル内側の余白（プリンタードライバーの印字不可能領域による欠け対策）
  labelPaddingTopMm:    z.number().min(0).max(10).optional(),
  labelPaddingBottomMm: z.number().min(0).max(10).optional(),
  labelPaddingLeftMm:   z.number().min(0).max(10).optional(),
  labelPaddingRightMm:  z.number().min(0).max(10).optional(),
  a4Cols:          z.number().int().positive().optional(),
  a4Rows:          z.number().int().positive().optional(),
  marginTopMm:     z.number().optional(),
  marginBottomMm:  z.number().optional(),
  marginLeftMm:    z.number().optional(),
  marginRightMm:   z.number().optional(),
  startPosition:   z.number().int().positive().optional(),
  a4SealWidthMm:   z.number().positive().optional(),
  a4SealHeightMm:  z.number().positive().optional(),
  a4ColGapMm:      z.number().min(0).optional(),
  a4RowGapMm:      z.number().min(0).optional(),
  displaySettings: z.object({
    showPostalCode:     z.boolean().default(true),
    showPhone:          z.boolean().default(true),
    showRepresentative: z.boolean().default(false),
    showEmail:          z.boolean().default(false),
    showNutrition:      z.boolean().default(true),
    showDietaryFiber:   z.boolean().default(true),
    showSugar:          z.boolean().default(true),
    showCholesterol:    z.boolean().default(false),
    showQualityControl: z.boolean().default(true),
    showComment:        z.boolean().default(true),
    nutritionNote:      z.string().default('※推定値'),
  }).optional(),
  logoHeightMm:     z.number().int().min(4).max(20).optional(),
  qrSizeMm:         z.number().int().min(4).max(20).optional(),
  showLogo:         z.boolean().optional(),
  showQr:           z.boolean().optional(),
  showBarcode:      z.boolean().optional(),
  showBarcodeText:  z.boolean().optional(),
  // 2026-08: 5mmでも実機で問題なく読み取れたとのことで下限を3mmに引き下げ。
  // 法令上の最小値ではなく、あくまでスキャナーでの読み取りやすさの目安（UI側にも注意書きあり）。
  barcodeHeightMm:  z.number().int().min(3).max(15).optional(),
  packageWidthMm:   z.number().positive().optional(),
  packageHeightMm:  z.number().positive().optional(),
  // 識別マーク（リサイクルマーク）。バーコードとは別にサイズ指定できる。
  // マークは法令上単体で6mm以上必要なため下限をスキーマ側でも強制する（実際の描画側でも再度クランプする）。
  recycleMarks: z.array(z.object({
    key:  z.enum(['plastic','paper','pet','steel','aluminum','board']),
    role: z.string().max(20).optional(),
  })).optional(),
  recycleMarkHeightMm: z.number().min(6).max(30).optional(),
  // 2026-08 プロプラン新設: ロット番号トレーサビリティ（Pro限定・任意入力）。
  // Pro未満のプランから送られてきた場合はサーバー側で無視する（下記のLabel.create部分参照）。
  lots: z.array(z.object({
    ingredientName: z.string().max(200),
    lotNumber:      z.string().max(100),
  })).optional(),
  // 2026-09新設: 印刷時の在庫自動差し引き（Pro限定）。印刷画面のチェックボックスで
  // ON/OFFできる（デフォルトON。再印刷・修正印刷時にOFFにすれば二重差し引きを防げる）。
  // Pro未満のプランから送られてきた場合はサーバー側で無視する（下記の実行部分参照）。
  deductStock: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });



  const body   = await request.json();
  // フリープランの印刷制限チェック
  const limits = getPlanLimits(session.user.plan ?? 'free');
  if (limits.maxLabelPrints !== Infinity && !body.isPreview) {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const printCounts = await prisma.$queryRaw`
      SELECT COALESCE(SUM("printCount"), 0) as total
      FROM label_print_logs
      WHERE "userId" = ${session.user.id}
      AND "createdAt" >= ${firstOfMonth}
    ` as any[];
    const monthlyCount = Number(printCounts[0]?.total ?? 0);
    const requestedCount = body.printCount ?? 1;
    if (monthlyCount + requestedCount > limits.maxLabelPrints) {
      return NextResponse.json({
        success: false,
        error: `フリープランの月間印刷上限（${limits.maxLabelPrints}枚）に達しました。スタンダードプランにアップグレードしてください。`,
        upgradeRequired: true,
      }, { status: 403 });
    }
  }
  const result = labelConfigSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.errors[0].message },
      { status: 400 }
    );
  }
  const config = result.data;

  // レシピ取得
  const recipe = await prisma.recipe.findFirst({
    where:   { id: config.recipeId, userId: session.user.id },
    include: {
      category:    { select: { name: true } },
      ingredients: {
        orderBy: [{ sortByWeight: 'desc' }, { displayOrder: 'asc' }],
        include: {
          ingredient: {
            select: {
              name: true, allergens: true, genericName: true, alwaysHideFromLabel: true, originCountry: true,
              // 栄養成分「未確認」警告を、レシピ保存時点のスナップショットではなく食材マスタの
              // 最新値から毎回判定し直すために必要（詳細はlib/nutrition.tsのコメント参照）
              energyKcalManual: true, proteinManual: true, fatManual: true, carbohydrateManual: true,
              sodiumManual: true, saltEquivalentManual: true, dietaryFiberManual: true, sugarManual: true, cholesterolManual: true,
              nutritionData: { select: { energyKcal: true, protein: true, fat: true, carbohydrate: true, sodium: true, saltEquivalent: true, dietaryFiber: true, sugar: true, cholesterol: true } },
            },
          },
        },
      },
      steps: { orderBy: { stepNumber: 'asc' } },
    },
  });

  if (!recipe) return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 });

  // 各材料について、食材マスタに紐づいているものは保存時点のスナップショット
  // （RecipeIngredient.nutritionUnconfirmed）ではなく、食材マスタの最新の栄養成分から
  // 「未確認」かどうかを毎回判定し直す。こうしないと、食材マスタ側で後から栄養成分を
  // 入力・修正しても、このレシピを開き直して保存し直すまで警告が消えない
  // （直したのに反映されないように見える）不具合になる。
  const resolvedIngredients = recipe.ingredients.map(ing => {
    let unconfirmed = ing.nutritionUnconfirmed;
    let nutrition: ReturnType<typeof calcNutritionForAmount> | null = null;
    if (ing.ingredientId && ing.ingredient) {
      const resolved = resolveIngredientNutritionPer100g(ing.ingredient as any);
      unconfirmed = resolved.unconfirmed;
      if (!resolved.unconfirmed) nutrition = calcNutritionForAmount(resolved.per100g, Number(ing.amount));
    }
    return { ing, unconfirmed, nutrition };
  });
  const resolvedById = new Map(resolvedIngredients.map(r => [r.ing.id, r]));

  // 未確認成分の警告収集
  const warnings = resolvedIngredients
    .filter(r => r.unconfirmed)
    .map(r => `「${r.ing.ingredient?.name ?? r.ing.ingredientNameOverride ?? '不明'}」の成分情報が未確認です`);

  // 店舗情報取得
  const shopId = config.shopId;
  let shopInfo = {
    shopName:       '',
    companyName:    '',
    postalCode:     '',
    address:        '',
    phone:          '',
    representative: '',
    email:          '',
    showPhone:          true,
    showRepresentative: false,
    showEmail:          false,
    qrUrl:              null,
    logoUrl:            null,
    logoHeightMm:       8,
    qrSizeMm:           6,
  };

  if (shopId) {
    const shops = await prisma.$queryRaw`
      SELECT "shopName", "companyName", representative, "postalCode",
             address, phone, email, "showPhone", "showRepresentative", "showEmail", "qrUrl", "logoUrl", "logoHeightMm", "qrSizeMm"
      FROM shops
      WHERE id = ${shopId} AND "userId" = ${session.user.id} AND "isActive" = true
      LIMIT 1
    ` as any[];
    const shop = shops[0];
    if (shop) {
      shopInfo = {
        shopName:           shop.shopName ?? '',
        companyName:        shop.companyName ?? shop.shopName ?? '',
        postalCode:         shop.postalCode ?? '',
        address:            shop.address ?? '',
        phone:              shop.phone ?? '',
        representative:     shop.representative ?? '',
        email:              shop.email ?? '',
        showPhone:          shop.showPhone ?? true,
        showRepresentative: true,  // フロントのcheckboxで制御
        showEmail:          shop.showEmail ?? false,
        qrUrl:              shop.qrUrl ?? null,
        logoUrl:            shop.logoUrl ?? null,
        logoHeightMm:       shop.logoHeightMm ?? 8,
        qrSizeMm:           shop.qrSizeMm ?? 6,
      };
    }
  } else {
    // デフォルト店舗またはユーザー情報
    const defaultShops = await prisma.$queryRaw`
      SELECT "shopName", "companyName", representative, "postalCode",
             address, phone, email, "showPhone", "showRepresentative", "showEmail", "qrUrl", "logoUrl", "logoHeightMm", "qrSizeMm"
      FROM shops
      WHERE "userId" = ${session.user.id} AND "isActive" = true AND "isDefault" = true
      LIMIT 1
    ` as any[];
    if (defaultShops[0]) {
      const s = defaultShops[0];
      shopInfo = {
        shopName:           s.shopName ?? '',
        companyName:        s.companyName ?? s.shopName ?? '',
        postalCode:         s.postalCode ?? '',
        address:            s.address ?? '',
        phone:              s.phone ?? '',
        representative:     s.representative ?? '',
        email:              s.email ?? '',
        showPhone:          s.showPhone ?? true,
        showRepresentative: true,  // フロントのcheckboxで制御
        showEmail:          s.showEmail ?? false,
        qrUrl:              s.qrUrl ?? null,
        logoUrl:            s.logoUrl ?? null,
        logoHeightMm:       s.logoHeightMm ?? 8,
        qrSizeMm:           s.qrSizeMm ?? 6,
      };
    } else {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (user) {
        shopInfo = {
          shopName:           (user as any).companyName ?? '',
          companyName:        (user as any).companyName ?? '',
          postalCode:         (user as any).postalCode ?? '',
          address:            (user as any).address ?? '',
          phone:              (user as any).phone ?? '',
          representative:     (user as any).representative ?? '',
          email:              user.email ?? '',
          showPhone:          true,
          showRepresentative: false,
          showEmail:          false,
          logoHeightMm:       8,
          qrSizeMm:           6,
          qrUrl:              null,
          logoUrl:            null,
        };
      }
    }
  }

  // RecipeDetail 形式に変換
  const sortedIngredients = [...recipe.ingredients].sort((a, b) => {
    if (a.sortByWeight && a.unit === 'g') return Number(b.amount) - Number(a.amount);
    return a.displayOrder - b.displayOrder;
  });

  // 自分が所有していない共有食材でも「自分専用の一般名」が設定されていれば優先する
  // （詳細はlib/generic-name-overrides.ts）。実際に印字される内容に反映させる必要があるため、
  // レシピ詳細API（app/api/recipes/[id]/route.ts）と同じロジックをここでも適用する。
  const genericNameOverrides = await getGenericNameOverrides(session.user.id, sortedIngredients.map(ing => ing.ingredientId));
  const resolveGenericName = (ing: typeof sortedIngredients[number]): string | null =>
    (ing.ingredientId && genericNameOverrides.get(ing.ingredientId)) || ing.ingredient?.genericName || null;

  const allergenInfo = collectRecipeAllergens(
    sortedIngredients.map(ing => ({
      allergens:        ing.ingredient?.allergens ?? [],
      allergenOverride: ing.allergenOverride,
      ingredientName:   resolveGenericName(ing) || ing.ingredient?.name || ing.ingredientNameOverride || '',
      // 食材マスタに紐づいている材料は、マスタ側のallergensのみを信頼する（名前からの自動再判定はしない）
      hasIngredientLink: !!ing.ingredientId,
    }))
  );

  const totalNutrition = {
    energyKcal:     recipe.energyKcal     ? Number(recipe.energyKcal)     : null,
    protein:        recipe.protein        ? Number(recipe.protein)        : null,
    fat:            recipe.fat            ? Number(recipe.fat)            : null,
    carbohydrate:   recipe.carbohydrate   ? Number(recipe.carbohydrate)   : null,
    sodium:         recipe.sodium         ? Number(recipe.sodium)         : null,
    saltEquivalent: recipe.saltEquivalent  ? Number(recipe.saltEquivalent) : null,
    dietaryFiber:   recipe.dietaryFiber   ? Number(recipe.dietaryFiber)   : null,
    sugar:          recipe.sugar          ? Number(recipe.sugar)          : null,
    cholesterol:    recipe.cholesterol    ? Number(recipe.cholesterol)    : null,
  };

  const recipeDetail: RecipeDetail = {
    id:             recipe.id,
    name:           recipe.name,
    nameKana:       recipe.nameKana,
    categoryName:   recipe.category?.name ?? null,
    unitCount:      recipe.unitCount,
    shelfLifeDays:  recipe.shelfLifeDays,
    shelfLifeType:  recipe.shelfLifeType as 'BEST_BEFORE' | 'USE_BY',
    salePrice:      recipe.salePrice  ? Number(recipe.salePrice)  : null,
    unitCost:       recipe.unitCost   ? Number(recipe.unitCost)   : null,
    costRate:       recipe.costRate   ? Number(recipe.costRate)   : null,
    contentAmount:  recipe.contentAmount,
    storageMethod:  recipe.storageMethod,
    barcode:        recipe.barcode ?? null,
    notes:          recipe.notes,
    printComment:   recipe.printComment,
    qualityControl: recipe.qualityControl,
    bakingConditions: recipe.bakingConditions as unknown as BakingStep[] | null,
    totalCost:      recipe.totalCost  ? Number(recipe.totalCost)  : null,
    totalWeightG:   recipe.totalWeightG ? Number(recipe.totalWeightG) : null,
    nutrition:      totalNutrition,
    ingredientsLabel: buildIngredientsLabel(
      prepareIngredientsForLabel(
        sortedIngredients.map(i => ({
          ingredientName: resolveGenericName(i) || i.ingredient?.name || i.ingredientNameOverride || '',
          amount: Number(i.amount),
          // レシピ側で個別に原産地を指定していなければ、食材マスタ側の原産地（デフォルト）を使う。
          // これが無いと、食材マスタで原産地を後から入力・修正しても、既存のレシピ（材料が
          // マスタに紐づけられた時点で原産地が未入力だったもの）には反映されないままになる。
          originCountry: i.originCountry || (i.ingredient as any)?.originCountry || undefined,
          unit: i.unit,
          displayOrder: i.displayOrder,
          sortByWeight: i.sortByWeight,
          isAdditive: i.isAdditive ?? false,
          additiveReason: i.additiveReason ?? undefined,
          hideFromLabel: (i as any).hideFromLabel ?? false,
          ingredientAlwaysHideFromLabel: (i.ingredient as any)?.alwaysHideFromLabel ?? false,
        }))
      ),
      allergenInfo.all
    ),
    allergensLabel: allergenInfo.all.join('・'),
    allergens:      allergenInfo as unknown as string[],
    hasUnconfirmedNutrition: resolvedIngredients.some(r => r.unconfirmed),
    isActive:       recipe.isActive,
    createdAt:      recipe.createdAt,
    updatedAt:      recipe.updatedAt,
    ingredients: sortedIngredients.map(ing => {
      const resolved = resolvedById.get(ing.id);
      const nutrition = resolved?.nutrition ?? {
        energyKcal:     ing.energyKcal     != null ? Number(ing.energyKcal)     : null,
        protein:        ing.protein        != null ? Number(ing.protein)        : null,
        fat:            ing.fat            != null ? Number(ing.fat)            : null,
        carbohydrate:   ing.carbohydrate   != null ? Number(ing.carbohydrate)   : null,
        sodium:         ing.sodium         != null ? Number(ing.sodium)         : null,
        saltEquivalent: ing.saltEquivalent != null ? Number(ing.saltEquivalent) : null,
        dietaryFiber:   ing.dietaryFiber   != null ? Number(ing.dietaryFiber)   : null,
        sugar:          ing.sugar          != null ? Number(ing.sugar)          : null,
        cholesterol:    ing.cholesterol    != null ? Number(ing.cholesterol)    : null,
      };
      return {
        id:                     ing.id,
        ingredientId:           ing.ingredientId ?? undefined,
        ingredientName:         resolveGenericName(ing) || ing.ingredient?.name || ing.ingredientNameOverride || '',
        ingredientNameOverride: ing.ingredientNameOverride ?? undefined,
        amount:                 Number(ing.amount),
        unit:                   ing.unit,
        displayOrder:           ing.displayOrder,
        sortByWeight:           ing.sortByWeight,
        originCountry:          ing.originCountry || (ing.ingredient as any)?.originCountry || undefined,
        isAdditive:             ing.isAdditive ?? false,
        additiveReason:         ing.additiveReason ?? undefined,
        hideFromLabel:          (ing as any).hideFromLabel ?? false,
        ingredientAlwaysHideFromLabel: (ing.ingredient as any)?.alwaysHideFromLabel ?? false,
        costPrice:              ing.costPrice   != null ? Number(ing.costPrice)  : null,
        costTotal:              ing.costTotal   != null ? Number(ing.costTotal)  : null,
        allergenOverride:       ing.allergenOverride,
        isPrimaryIngredient:    ing.isPrimaryIngredient,
        nutritionUnconfirmed:   resolved?.unconfirmed ?? ing.nutritionUnconfirmed,
        nutrition,
      };
    }),
    steps: recipe.steps.map(s => s.instruction),
  };

  const labelConfig: LabelConfig = {
    ...config,
    displaySettings: config.displaySettings ?? getDefaultDisplaySettings(),
    // zodスキーマ上 key は必須（z.enum、.optional()なし）だが、型推論の都合で
    // key?: ... という型になりビルドエラーになるため、ここで明示的に組み直す
    // （実行時はzodのバリデーションでkey未設定のデータは弾かれるので安全）
    recycleMarks: (config.recycleMarks ?? []).map(m => ({ key: m.key!, role: m.role })),
  };

  // フロントエンドからサイズ指定がある場合は上書き
  if (labelConfig.logoHeightMm) shopInfo.logoHeightMm = labelConfig.logoHeightMm;
  if (labelConfig.qrSizeMm)     shopInfo.qrSizeMm     = labelConfig.qrSizeMm;

  // バーコード設定をrecipeDetailに追加
  (recipeDetail as any).showBarcode     = labelConfig.showBarcode !== false;
  (recipeDetail as any).showBarcodeText  = labelConfig.showBarcodeText !== false;
  (recipeDetail as any).barcodeHeightMm = labelConfig.barcodeHeightMm ?? 7;
  (recipeDetail as any).recycleMarks        = Array.isArray((labelConfig as any).recycleMarks) ? (labelConfig as any).recycleMarks : [];
  (recipeDetail as any).recycleMarkHeightMm = (labelConfig as any).recycleMarkHeightMm ?? 8;

  const content = generateLabelContent(recipeDetail, labelConfig, shopInfo);
  // シールサイズが小さい場合など、店舗設定のロゴ/QR URL自体は残したまま
  // この印刷ジョブだけで一時的に非表示にできるようにする（設定側の削除は不要）
  if (labelConfig.showLogo === false) content.logoUrl = null;
  if (labelConfig.showQr   === false) content.qrUrl   = null;
  const html    = generateLabelHtml(content, labelConfig, body.isPreview === true);

  // 印刷履歴を保存
  if (!body.isPreview) {
    // ロット番号トレーサビリティ（Pro限定）。Pro未満から送られてきた場合はサーバー側で無視する
    // （クライアント側のUIはPro未満に表示していないが、念のためサーバー側でも強制する）。
    const rawLots = (limits.canUseLotTracking ? config.lots : undefined)
      ?.filter(l => l.ingredientName.trim() && l.lotNumber.trim()) ?? [];
    const lotInfo = rawLots.length > 0 ? rawLots : undefined;
    const lotSearchText = rawLots.length > 0
      ? rawLots.map(l => `${l.ingredientName} ${l.lotNumber}`).join(' ').toLowerCase()
      : undefined;

    await prisma.label.create({
      data: {
        recipeId:       config.recipeId,
        shopId:         config.shopId,
        userId:         session.user.id,
        manufactureDate: new Date(config.manufactureDate),
        printCount:     config.printCount,
        fontSizePt:     config.fontSizePt,
        deviceType:     config.deviceType,
        labelWidthMm:   config.labelWidthMm,
        labelHeightMm:  config.labelHeightMm,
        isPrecut:       config.isPrecut,
        a4Cols:         config.a4Cols,
        a4Rows:         config.a4Rows,
        startPosition:  config.startPosition,
        displaySettings: config.displaySettings ?? getDefaultDisplaySettings(),
        generatedHtml:  html.substring(0, 10000), // DBサイズ制限
        lotInfo,
        lotSearchText,
      },
    });
  }

  console.log('DEBUG_SHOP:', JSON.stringify({
    address: shopInfo.address,
    phone: shopInfo.phone,
    rep: shopInfo.representative,
    name: shopInfo.shopName,
  }));
  console.log('DEBUG_LABEL:', JSON.stringify({
    ing: recipeDetail.ingredientsLabel?.slice(0,30),
    qc: recipeDetail.qualityControl,
    pc: recipeDetail.printComment,
  }));

  // 印刷ログを記録（プレビューモードはカウントしない）
  if (!body.isPreview) {
    try {
      const actualPrintCount = body.printCount ?? 1;
      await prisma.$executeRaw`
        INSERT INTO label_print_logs ("userId", "recipeId", "printCount", "createdAt")
        VALUES (${session.user.id}, ${body.recipeId}, ${actualPrintCount}, NOW())
      `;
    } catch (e) { console.warn('print log error:', e); }
  }

  // 2026-09新設: 印刷時の在庫自動差し引き（Pro限定・チェックボックスON時のみ）。
  // HACCP連携（haccpStoreCode）が設定されていればそちら経由、無ければ在庫アプリへ直接。
  // ラベル印刷そのものを絶対に失敗させないよう必ずtry/catchし、結果はレスポンスの
  // data.stockSyncとして返すのみに留める（失敗してもラベル印刷自体は成功として返す）。
  let stockSyncResult: Awaited<ReturnType<typeof deductStockForPrint>> | null = null;
  if (!body.isPreview && config.deductStock && limits.canUseStockSync) {
    try {
      const userRow = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { haccpStoreCode: true, inventoryUserId: true },
      });
      if (userRow) {
        stockSyncResult = await deductStockForPrint(userRow, {
          recipeName: recipe.name,
          printCount: config.printCount,
          unitCount: recipe.unitCount,
          ingredients: recipe.ingredients.map((ing) => ({
            name: ing.ingredient?.name || ing.ingredientNameOverride || '（材料名未設定）',
            amount: Number(ing.amount),
            unit: ing.unit,
          })),
        });
      }
    } catch (e) { console.warn('stock sync error:', e); }
  }

  return NextResponse.json({
    success: true,
    data: {
      html, content, warnings,
      stockSync: stockSyncResult,
      _debug: {
        shopAddress: shopInfo.address,
        shopPhone: shopInfo.phone,
        shopRep: shopInfo.representative,
        ingredientsLabel: recipeDetail.ingredientsLabel?.slice(0,50),
        qualityControl: recipeDetail.qualityControl,
        printComment: recipeDetail.printComment,
      }
    },
  });
}
