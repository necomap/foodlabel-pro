// ============================================================
// app/api/recipes/spec-sheet/route.ts - 商品規格書のデータ取得API（2026-11新設・全プラン）
// ============================================================
// 卸先・道の駅・百貨店などに提出する「商品規格書」（1商品A4縦1ページ）用のデータを返す。
// 原材料名・アレルゲン・栄養成分は、ラベルと食い違わないよう lib/label-build.ts の
// buildRecipeLabel（ラベル印刷と同じ処理）でそのまま組み立てる。ここで独自に計算し直さないこと。
//
// GET ?ids=<recipeId>,<recipeId>...&shopId=<任意>
//   ids は最大50件。店舗未指定ならラベルと同じくデフォルト店舗 → ユーザー情報の順。

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildRecipeLabel, labelConfigSchema, resolveShopInfo } from '@/lib/label-build';
import { REQUIRED_ALLERGENS, OPTIONAL_ALLERGENS } from '@/lib/allergen';
import { calcPerUnit, roundForDisplay } from '@/lib/nutrition';

const MAX_IDS = 50;

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ids = Array.from(new Set((searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean)));
  const shopId = searchParams.get('shopId') || undefined;
  if (ids.length === 0) return NextResponse.json({ success: false, error: 'レシピが指定されていません' }, { status: 400 });
  if (ids.length > MAX_IDS) return NextResponse.json({ success: false, error: `一度に作成できるのは${MAX_IDS}件までです` }, { status: 400 });

  const shopInfo = await resolveShopInfo(session.user.id, shopId);
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); // 日本時間の今日

  const items = [];
  for (const recipeId of ids) {
    // ラベル用の設定はすべて既定値（規格書では印字サイズ等は使わない）
    const config = labelConfigSchema.parse({ recipeId, shopId, manufactureDate: today });
    const built = await buildRecipeLabel(session.user.id, config, shopInfo);
    if (!built) continue;
    const { recipe, content, warnings, allergenInfo, totalNutrition } = built;

    items.push({
      id:            recipe.id,
      name:          recipe.name,
      variationName: (recipe as any).variationName ?? null,
      categoryName:  content.categoryName || recipe.category?.name || '',
      ingredientsText: content.ingredientsText,
      allergens:     allergenInfo.all,
      contentAmount: content.contentAmount || recipe.contentAmount || '',
      unitCount:     recipe.unitCount,
      shelfLifeDays: recipe.shelfLifeDays,
      shelfLifeType: recipe.shelfLifeType,  // BEST_BEFORE / USE_BY
      storageMethod: content.storageMethod || recipe.storageMethod || '',
      barcode:       recipe.barcode ?? null,
      // 栄養成分：ラベルと同じ表示値（0と表示できる基準の適用後）
      nutritionLabel: content.nutritionPerUnit,
      // 100gあたり換算用（丸め前の1個あたり・全体）
      nutritionPerUnitRaw: roundForDisplay(calcPerUnit(totalNutrition, recipe.unitCount, Number(recipe.wasteRatio ?? 0))),
      nutritionTotal: totalNutrition,
      totalWeightG:  recipe.totalWeightG ? Number(recipe.totalWeightG) : null,
      wasteRatio:    Number(recipe.wasteRatio ?? 0),
      isEstimated:   content.isEstimated,
      manufacturer: {
        name:       content.manufacturerName,
        postalCode: content.postalCode,
        address:    content.address,
        phone:      content.phone ?? '',
      },
      // 配合表（印刷時にON/OFF）。ラベルに出さない材料（水など）も含めた全材料を、登録順で返す
      formula: [...recipe.ingredients]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(i => ({
          name:   i.ingredient?.name || i.ingredientNameOverride || '',
          amount: Number(i.amount),
          unit:   i.unit,
        })),
      warnings,
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      items,
      required: Object.keys(REQUIRED_ALLERGENS),
      optional: Object.keys(OPTIONAL_ALLERGENS),
      shopName: shopInfo.shopName || shopInfo.companyName || '',
      today,
    },
  });
}
