// ============================================================
// lib/label.ts - シール内容生成ロジック
// ============================================================

import { addDays, format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { LabelContent, LabelConfig, RecipeDetail } from '@/types';
import { buildIngredientsLabel, collectRecipeAllergens } from './allergen';
import { calcPerUnit, roundForDisplay } from './nutrition';

/**
 * レシピと設定からシール内容を生成する
 */
export function generateLabelContent(
  recipe: RecipeDetail,
  config: LabelConfig,
  shopInfo: {
    shopName:       string;
    companyName?:   string;
    postalCode?:    string;
    address?:       string;
    phone?:         string;
    representative?: string;
    email?:         string;
    showPhone:      boolean;
    showRepresentative: boolean;
    showEmail:      boolean;
  }
): LabelContent {
  // 賞味期限計算
  const manufactureDate = new Date(config.manufactureDate);
  const shelfLifeDays = config.shelfLifeDays ?? recipe.shelfLifeDays ?? 0;
  const expiryDate = shelfLifeDays > 0
    ? addDays(manufactureDate, shelfLifeDays)
    : manufactureDate;
  const expiryDateStr = format(expiryDate, 'yyyy.MM.dd', { locale: ja });
  const expiryType = recipe.shelfLifeType === 'BEST_BEFORE' ? '賞味期限' : '消費期限';

  // アレルゲン集約
  const allergenInfo = collectRecipeAllergens(
    recipe.ingredients.map(ing => ({
      allergens:        ing.allergenOverride?.length ? [] : (ing as any).allergens ?? [],
      allergenOverride: ing.allergenOverride ?? [],
      ingredientName:   ing.ingredientName,
    }))
  );

  // 原材料表示（重量順ソート済み前提）
  const sortedIngredients = [...recipe.ingredients].sort((a, b) => {
    if (a.sortByWeight && a.unit === 'g' && b.unit === 'g') {
      return b.amount - a.amount;
    }
    return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  });

  const ingredientsText = buildIngredientsLabel(
    sortedIngredients.map(i => ({
      ingredientName: i.ingredientName,
      amount: i.amount,
      unit: i.unit,
    })),
    allergenInfo.all
  );

  // 栄養成分（1個あたり）
  const totalNutrition = recipe.nutrition;
  const perUnit = roundForDisplay(
    calcPerUnit(totalNutrition, recipe.unitCount)
  );

  // 未確認成分の警告
  const warnings = recipe.ingredients
    .filter(i => i.nutritionUnconfirmed)
    .map(i => `「${i.ingredientName}」の成分情報が未確認です`);

  // 製造者情報
  const manufacturerName = shopInfo.companyName ?? shopInfo.shopName;
  const { displaySettings } = config;

  return {
    productName:     recipe.name,
    categoryName:    recipe.categoryName ?? '',
    ingredientsText,
    contentAmount:   recipe.contentAmount ?? `1個`,
    expiryDate:      expiryDateStr,
    expiryType,
    storageMethod:   recipe.storageMethod ?? '直射日光・高温多湿を避けて保存してください。',
    manufacturerName,
    postalCode:      shopInfo.postalCode ? `〒${shopInfo.postalCode}` : '',
    address:         shopInfo.address ?? '',
    phone:           displaySettings.showPhone
                       ? shopInfo.phone ?? undefined
                       : undefined,
    representative:  displaySettings.showRepresentative
                       ? shopInfo.representative ?? undefined
                       : undefined,
    email:           displaySettings.showEmail && shopInfo.showEmail
                       ? shopInfo.email ?? undefined
                       : undefined,
    qualityControl:  displaySettings.showQualityControl
                       ? recipe.qualityControl ?? undefined
                       : undefined,
    comment:         displaySettings.showComment
                       ? recipe.printComment ?? undefined
                       : undefined,
    nutritionPerUnit: {
      label:          `${recipe.contentAmount ?? '1個'}あたり`,
      energyKcal:     perUnit.energyKcal ?? 0,
      protein:        perUnit.protein ?? 0,
      fat:            perUnit.fat ?? 0,
      carbohydrate:   perUnit.carbohydrate ?? 0,
      saltEquivalent: perUnit.saltEquivalent ?? 0,
      dietaryFiber:   displaySettings.showDietaryFiber
                        ? perUnit.dietaryFiber ?? undefined
                        : undefined,
      sugar:          displaySettings.showSugar
                        ? perUnit.sugar ?? undefined
                        : undefined,
      cholesterol:    displaySettings.showCholesterol
                        ? perUnit.cholesterol ?? undefined
                        : undefined,
    },
    isEstimated: true,  // 推定値として表示
    warnings,
  };
}

/**
 * シールHTMLを生成する（印刷用）
 * @param content - シール内容
 * @param config - 印刷設定
 * @param count - 枚数（A4の場合はページ全体）
 */
export function generateLabelHtml(
  content: LabelContent,
  config: LabelConfig
): string {
  const { fontSizePt, labelWidthMm, labelHeightMm } = config;
  const width = labelWidthMm ?? 60;
  const height = labelHeightMm ?? 60;
  // シールサイズに合わせてフォントサイズを自動調整
  // 基準: 60mm×60mmで8pt。面積比で縮小（最小5pt）
  const baseFontSize = fontSizePt ?? 8;
  const areaRatio = Math.sqrt((width * height) / (60 * 60));
  const autoFontSize = Math.max(Math.round(baseFontSize * areaRatio * 10) / 10, 5);
  const fontSize = autoFontSize;
  const smallFontSize = Math.max(Math.round((fontSize - 1) * 10) / 10, 5);

  const escHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const singleLabel = `
<div class="label" style="
  width: ${width}mm;
  min-height: ${height}mm;
  overflow: hidden;
  font-size:${fontSize}pt;
  font-family: 'Noto Sans JP', 'Hiragino Sans', Meiryo, sans-serif;
  line-height: 1.25;
  padding: 1.5mm;
  border: 0.3mm solid #999;
  box-sizing: border-box;
  break-inside: avoid;
  page-break-inside: avoid;
  break-after: avoid;
">
  <!-- 品名 -->
  <div style="font-weight:bold; font-size:${Math.round(fontSize * 1.1)}pt; border-bottom:0.3mm solid #ccc; margin-bottom:0.5mm; padding-bottom:0.3mm;">
    ${escHtml(content.productName)}
  </div>
  <!-- 名称 -->
  <div style="margin-bottom:0.3mm;">
    <span style="font-weight:bold;">名称：</span>${escHtml(content.categoryName)}
  </div>
  <!-- 原材料名 -->
  <div style="margin-bottom:0.3mm; font-size:${smallFontSize}pt;">
    <span style="font-weight:bold;">原材料名：</span>${escHtml(content.ingredientsText)}
  </div>
  <!-- 内容量 -->
  <div style="margin-bottom:0.3mm;">
    <span style="font-weight:bold;">内容量：</span>${escHtml(content.contentAmount)}
  </div>
  <!-- 賞味期限 -->
  <div style="margin-bottom:0.3mm;">
    <span style="font-weight:bold;">${escHtml(content.expiryType)}：</span>${escHtml(content.expiryDate)}
  </div>
  <!-- 保存方法 -->
  <div style="margin-bottom:0.3mm; font-size:${smallFontSize}pt;">
    <span style="font-weight:bold;">保存方法：</span>${escHtml(content.storageMethod)}
  </div>
  <!-- 栄養成分 -->
  <div style="border:0.3mm solid #ccc; padding:0.5mm 1mm; margin-bottom:0.3mm; font-size:${smallFontSize}pt;">
    <div style="font-weight:bold; margin-bottom:0.2mm;">
      栄養成分表示（${escHtml(content.nutritionPerUnit.label)}）${content.isEstimated ? '※推定値' : ''}
    </div>
    <table style="width:100%; border-collapse:collapse;">
      <tr>
        <td>熱量</td><td style="text-align:right;">${content.nutritionPerUnit.energyKcal}kcal</td>
        <td style="padding-left:2mm;">炭水化物</td><td style="text-align:right;">${content.nutritionPerUnit.carbohydrate}g</td>
      </tr>
      <tr>
        <td>たんぱく質</td><td style="text-align:right;">${content.nutritionPerUnit.protein}g</td>
        <td style="padding-left:2mm;">食塩相当量</td><td style="text-align:right;">${content.nutritionPerUnit.saltEquivalent}g</td>
      </tr>
      <tr>
        <td>脂質</td><td style="text-align:right;">${content.nutritionPerUnit.fat}g</td>
        ${content.nutritionPerUnit.dietaryFiber != null
          ? `<td style="padding-left:2mm;">食物繊維</td><td style="text-align:right;">${content.nutritionPerUnit.dietaryFiber}g</td>`
          : '<td></td><td></td>'
        }
      </tr>
      ${content.nutritionPerUnit.sugar != null ? `
      <tr>
        <td></td><td></td>
        <td style="padding-left:2mm;">糖質</td><td style="text-align:right;">${content.nutritionPerUnit.sugar}g</td>
      </tr>` : ''}
      ${content.nutritionPerUnit.cholesterol != null ? `
      <tr>
        <td></td><td></td>
        <td style="padding-left:2mm;">コレステロール</td><td style="text-align:right;">${content.nutritionPerUnit.cholesterol}mg</td>
      </tr>` : ''}
    </table>
  </div>
  <!-- コメント -->
  ${content.comment ? `<div style="margin-bottom:0.3mm; font-size:${smallFontSize}pt;">${escHtml(content.comment)}</div>` : ''}
  <!-- 品質管理 -->
  ${content.qualityControl ? `<div style="font-size:${smallFontSize}pt;">${escHtml(content.qualityControl)}</div>` : ''}
  <!-- 製造者情報 -->
  <div style="margin-top:0.3mm; border-top:0.3mm solid #ccc; padding-top:0.3mm; font-size:${smallFontSize}pt; word-break:break-all; overflow-wrap:break-word;">
    <span style="font-weight:bold;">製造者：</span>${escHtml(content.manufacturerName)}${content.representative ? '　' + escHtml(content.representative) : ''}
    ${content.postalCode ? '<br>' + escHtml(content.postalCode) : ''}
    ${content.address ? '<br>' + escHtml(content.address) : ''}
    ${content.phone ? '<br>TEL ' + escHtml(content.phone) : ''}
    ${content.email ? '<br>' + escHtml(content.email) : ''}
  </div>
`;
  // ラベルプリンタ用：シールのみ
  if (config.deviceType === 'LABEL_PRINTER') {
    const labels = Array(config.printCount).fill(singleLabel).join('\n');
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; size: ${width}mm auto; }
  body { margin: 0; padding: 0; } html, body { height: auto !important; }
  .label { break-after: page; }
  .label:last-child { break-after: avoid; page-break-after: avoid; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>${labels}</body>
</html>`;
  }

  // A4プリンタ用：グリッドレイアウト
  const cols      = config.a4Cols ?? 3;
  const rows      = config.a4Rows ?? 5;
  const labelsPerPage = cols * rows;
  const startPos  = (config.startPosition ?? 1) - 1;
  const marginTop    = config.marginTopMm    ?? 10;
  const marginBottom = config.marginBottomMm ?? 10;
  const marginLeft   = config.marginLeftMm   ?? 10;
  const marginRight  = config.marginRightMm  ?? 10;

  // シールサイズ：指定があればそれを使用、なければ印刷領域から自動計算
  const printAreaW = 210 - marginLeft - marginRight;
  const printAreaH = 297 - marginTop  - marginBottom;
  const autoCellW  = Math.floor((printAreaW / cols) * 10) / 10;
  const autoCellH  = Math.floor((printAreaH / rows) * 10) / 10;
  const cellW = (config as any).a4SealWidthMm  ?? autoCellW;
  const cellH = (config as any).a4SealHeightMm ?? autoCellH;

  const totalSlots = startPos + config.printCount;
  const pages      = Math.ceil(totalSlots / labelsPerPage);

  // A4セルサイズに合わせてフォントサイズを再計算
  const a4AreaRatio = Math.sqrt((cellW * cellH) / (60 * 60));
  const a4FontSize = Math.max(Math.round((fontSizePt ?? 8) * a4AreaRatio * 10) / 10, 5);
  const a4SmallFontSize = Math.max(Math.round((a4FontSize - 1) * 10) / 10, 5);

  // ラベルHTMLをセルサイズとフォントサイズに合わせて調整
  const cellLabel = singleLabel
    .replace(`width: ${width}mm`, `width: ${cellW}mm`)
    .replace(`min-height: ${height}mm`, `height: ${cellH}mm`)
    .replace(new RegExp(`font-size:${fontSize}pt`, 'g'), `font-size:${a4FontSize}pt`)
    .replace(new RegExp(`font-size:${Math.round(fontSize * 1.1)}pt`, 'g'), `font-size:${Math.round(a4FontSize * 1.1)}pt`)
    .replace(new RegExp(`font-size:${smallFontSize}pt`, 'g'), `font-size:${a4SmallFontSize}pt`);

  let gridHtml = '';
  for (let p = 0; p < pages; p++) {
    const isLastPage = p === pages - 1;
    gridHtml += `<div style="display:grid;grid-template-columns:repeat(${cols},${cellW}mm);grid-template-rows:repeat(${rows},${cellH}mm);width:210mm;height:297mm;padding:${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;box-sizing:border-box;${isLastPage ? '' : 'page-break-after:always;'}">`;
    for (let i = 0; i < labelsPerPage; i++) {
      const slot = p * labelsPerPage + i;
      const isEmpty = slot < startPos || slot >= startPos + config.printCount;
      gridHtml += `<div style="width:${cellW}mm;height:${cellH}mm;box-sizing:border-box;">${isEmpty ? '' : cellLabel}</div>`;
    }
    gridHtml += '</div>';
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 0; size: A4 portrait; }
  html, body { width: 210mm; height: auto; margin: 0; padding: 0; background: white; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>${gridHtml}</body>
</html>`;
}

/**
 * デフォルトの表示設定を返す
 */
export function getDefaultDisplaySettings() {
  return {
    showPhone:          true,
    showRepresentative: false,
    showEmail:          false,
    showNutrition:      true,
    showDietaryFiber:   true,
    showSugar:          true,
    showCholesterol:    false,
    showQualityControl: true,
    showComment:        true,
    nutritionNote:      '※推定値',
  };
}
