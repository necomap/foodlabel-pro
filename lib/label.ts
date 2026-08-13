// ============================================================
// lib/label.ts - ラベル内容生成ロジック
// ============================================================

import { addDays, format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { LabelContent, LabelConfig, RecipeDetail } from '@/types';
import { buildIngredientsLabel, collectRecipeAllergens } from './allergen';
import { calcPerUnit, roundForDisplay } from './nutrition';

/**
 * レシピと設定からラベル内容を生成する
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
    qrUrl?:         string | null;
    logoUrl?:       string | null;
    logoHeightMm?:  number;
    qrSizeMm?:      number;
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
      originCountry: i.originCountry ?? undefined,
      isAdditive: (i as any).isAdditive ?? false,
      additiveReason: (i as any).additiveReason ?? undefined,
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
    qrUrl:       shopInfo.qrUrl ?? null,
    logoUrl:     shopInfo.logoUrl ?? null,
    logoHeightMm: shopInfo.logoHeightMm ?? 8,
    qrSizeMm:    shopInfo.qrSizeMm ?? 6,
    postalCode:      displaySettings.showPostalCode !== false && shopInfo.postalCode 
                       ? `〒${shopInfo.postalCode}` 
                       : '',
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
    barcode:         recipe.barcode ?? undefined,
    showBarcode:     (recipe as any).showBarcode !== false,
    showBarcodeText: (recipe as any).showBarcodeText !== false,
    barcodeHeightMm: (recipe as any).barcodeHeightMm ?? 7,
    barcodeHeightPx: 300,  // 高解像度で取得してCSSでリサイズ
  };
}

/**
 * ラベルHTMLを生成する（印刷用）
 * @param content - ラベル内容
 * @param config - 印刷設定
 * @param count - 枚数（A4の場合はページ全体）
 */

/** JAN-13のチェックデジットを検証 */
function isValidJan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}

/** バーコードの種類を自動判定してAPIのパスを返す */
function getBarcodeApiPath(code: string): string {
  if (isValidJan13(code)) return 'ean13';
  if (/^\d{8}$/.test(code) || /^\d{12}$/.test(code)) return 'code128';
  return 'code128';
}

export function generateLabelHtml(
  content: LabelContent,
  config: LabelConfig
): string {
  const { fontSizePt, labelWidthMm, labelHeightMm } = config;
  const width = labelWidthMm ?? 60;
  const height = labelHeightMm ?? 60;
  // ラベルサイズに合わせてフォントサイズを自動調整
  // 基準: 60mm×60mmで8pt。面積比で縮小（最小5pt）
  const baseFontSize = fontSizePt ?? 8;
  const areaRatio = Math.sqrt((width * height) / (60 * 60));
  const autoFontSize = Math.max(Math.round(baseFontSize * areaRatio * 10) / 10, 5);
  const fontSize = autoFontSize;
  // バーコード幅：シールの横幅に応じて自動計算（25mm〜45mmの範囲、リーダーで読み取れる実用サイズ）
  const barcodeWidthMm = Math.min(Math.max(Math.round(width * 0.7 * 10) / 10, 25), 45);

  const escHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 栄養成分：必須5項目（法令上の表示順固定）＋ ON になっている任意項目を末尾に追加し、
  // 左列に切り上げ半分・右列に残りを詰めて、非表示項目があっても左右の行数バランスを保つ
  const nutritionItems: Array<{ label: string; value: string }> = [
    { label: '熱量',      value: `${content.nutritionPerUnit.energyKcal}kcal` },
    { label: 'たんぱく質', value: `${content.nutritionPerUnit.protein}g` },
    { label: '脂質',      value: `${content.nutritionPerUnit.fat}g` },
    { label: '炭水化物',   value: `${content.nutritionPerUnit.carbohydrate}g` },
    { label: '食塩相当量', value: `${content.nutritionPerUnit.saltEquivalent}g` },
  ];
  if (content.nutritionPerUnit.sugar != null) {
    nutritionItems.push({ label: '糖質', value: `${content.nutritionPerUnit.sugar}g` });
  }
  if (content.nutritionPerUnit.dietaryFiber != null) {
    nutritionItems.push({ label: '食物繊維', value: `${content.nutritionPerUnit.dietaryFiber}g` });
  }
  if (content.nutritionPerUnit.cholesterol != null) {
    nutritionItems.push({ label: 'コレステロール', value: `${content.nutritionPerUnit.cholesterol}mg` });
  }
  const nutritionLeftCount = Math.ceil(nutritionItems.length / 2);
  const nutritionLeftItems  = nutritionItems.slice(0, nutritionLeftCount);
  const nutritionRightItems = nutritionItems.slice(nutritionLeftCount);
  const nutritionRowsHtml = nutritionLeftItems.map((item, i) => {
    const right = nutritionRightItems[i];
    return `<tr>
        <td>${item.label}</td><td style="text-align:right;">${item.value}</td>
        ${right ? `<td style="padding-left:2mm;">${right.label}</td><td style="text-align:right;">${right.value}</td>` : '<td></td><td></td>'}
      </tr>`;
  }).join('');

  const singleLabel = `
<div class="label" style="
  width: ${width}mm;
  min-height: ${height}mm;
  max-height: ${height}mm;
  overflow: hidden;
  font-size:${fontSize}pt;
  font-family: 'Noto Sans JP', 'Hiragino Sans', Meiryo, sans-serif;
  line-height: 1.15;
  padding: 1.2mm;
  border: none;
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
  <div style="margin-bottom:0.3mm;">
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
  <div style="margin-bottom:0.3mm;">
    <span style="font-weight:bold;">保存方法：</span>${escHtml(content.storageMethod)}
  </div>
  <!-- 栄養成分 -->
  <div style="border:0.3mm solid #ccc; padding:0.5mm 1mm; margin-bottom:0.3mm;">
    <div style="font-weight:bold; margin-bottom:0.2mm;">
      栄養成分表示（${escHtml(content.nutritionPerUnit.label)}）${content.isEstimated ? '※推定値' : ''}
    </div>
    <table style="width:100%; border-collapse:collapse;">
      ${nutritionRowsHtml}
    </table>
  </div>
  <!-- コメント -->
  ${content.comment ? `<div style="margin-bottom:0.3mm;">${escHtml(content.comment)}</div>` : ''}
  <!-- 品質管理 -->
  ${content.qualityControl ? `<div>${escHtml(content.qualityControl)}</div>` : ''}
  <!-- 製造者情報（ロゴ・QRコード含む） -->
  <div style="margin-top:0.3mm; border-top:0.3mm solid #ccc; padding-top:0.3mm; display:flex; align-items:flex-start; justify-content:space-between; gap:1mm;">
    <div style="flex:1; word-break:break-all; overflow-wrap:break-word; line-height:1.15;">
    <span style="font-weight:bold;">製造者：</span>${escHtml(content.manufacturerName)}${content.representative ? '　' + escHtml(content.representative) : ''}
    ${content.postalCode ? '<br>' + escHtml(content.postalCode) : ''}
    ${content.address ? '<br>' + escHtml(content.address) : ''}
    ${content.phone ? '<br>TEL ' + escHtml(content.phone) : ''}
    ${content.email ? '<br>' + escHtml(content.email) : ''}
    </div>
    ${(content.logoUrl || content.qrUrl) ? `<div style="display:flex;flex-direction:row;align-items:center;gap:0.5mm;flex-shrink:0;">
      ${content.logoUrl ? `<img src="${content.logoUrl}" style="max-height:${content.logoHeightMm ?? 8}mm;max-width:${(content.logoHeightMm ?? 8) * 2.5}mm;object-fit:contain;" />` : ''}
      ${content.qrUrl ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(content.qrUrl)}" style="width:${content.qrSizeMm ?? 6}mm;height:${content.qrSizeMm ?? 6}mm;" />` : ''}
    </div>` : ''}
  </div>
  <!-- バーコード（一番下） -->
${content.barcode && content.showBarcode !== false ? `<div style="text-align:center;margin-top:0.5mm;width:100%;">
    <div style="display:inline-block;width:${barcodeWidthMm}mm;max-width:95%;height:${content.barcodeHeightMm ?? 10}mm;overflow:hidden;">
      <img src="https://barcodeapi.org/api/${getBarcodeApiPath(content.barcode)}/${encodeURIComponent(content.barcode)}?height=${content.barcodeHeightPx ?? 300}${content.showBarcodeText === false ? '&text=none' : ''}" style="width:100%;height:100%;object-fit:cover;object-position:bottom;" onerror="this.parentElement.style.display='none'" />
    </div>
  </div>` : ''}
</div>
`;
  // ラベルプリンタ用：ラベルのみ
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
<body>${labels}
<script>
// フォント自動縮小：ラベルが枠からはみ出す場合にフォントを縮小
document.querySelectorAll('.label').forEach(function(label) {
  var maxH = label.style.maxHeight;
  if (!maxH) return;
  var maxPx = parseFloat(maxH) * 3.7795; // mm to px
  var minSize = 5;
  var step = 0.5;
  var el = label;
  while (el.scrollHeight > maxPx + 2 && parseFloat(el.style.fontSize) > minSize) {
    var cur = parseFloat(el.style.fontSize);
    el.style.fontSize = (cur - step) + 'pt';
    // 内部の小フォントも縮小
    el.querySelectorAll('[style*="font-size"]').forEach(function(child) {
      var cs = parseFloat(child.style.fontSize);
      if (cs > minSize) child.style.fontSize = Math.max(cs - step, minSize) + 'pt';
    });
  }
});
</script>
</body>
</html>`;
  }

  // A4プリンタ用：グリッドレイアウト
  const cols      = config.a4Cols ?? 3;
  const rows      = config.a4Rows ?? 5;
  const labelsPerPage = cols * rows;
  const startPos  = (config.startPosition ?? 1) - 1;
  const marginTop  = config.marginTopMm  ?? 0;
  const marginLeft = config.marginLeftMm ?? 0;
  // シールサイズが指定されている場合はそのサイズを使用、なければ印刷領域から自動計算
  const sealW = (config as any).a4SealWidthMm;
  const sealH = (config as any).a4SealHeightMm;
  const cellW = sealW ?? Math.floor(((210 - marginLeft) / cols) * 10) / 10;
  const cellH = sealH ?? Math.floor(((297 - marginTop)  / rows) * 10) / 10;
  // 右余白・下余白は自動計算
  const marginRight  = Math.max(210 - marginLeft - cellW * cols, 0);
  const marginBottom = Math.max(297 - marginTop  - cellH * rows, 0);

  const totalSlots = startPos + config.printCount;
  const pages      = Math.ceil(totalSlots / labelsPerPage);

  // A4セルサイズに合わせてフォントサイズを再計算
  const a4AreaRatio = Math.sqrt((cellW * cellH) / (60 * 60));
  const a4FontSize = Math.max(Math.round((fontSizePt ?? 8) * a4AreaRatio * 10) / 10, 5);

  // ラベルHTMLをセルサイズとフォントサイズに合わせて調整
  const cellLabel = singleLabel
    .replace(`width: ${width}mm`, `width: ${cellW}mm`)
    .replace(`min-height: ${height}mm`, `height: ${cellH}mm`)
    .replace(`max-height: ${height}mm`, `max-height: ${cellH}mm`)
    .replace(new RegExp(`font-size:${fontSize}pt`, 'g'), `font-size:${a4FontSize}pt`)
    .replace(new RegExp(`font-size:${Math.round(fontSize * 1.1)}pt`, 'g'), `font-size:${Math.round(a4FontSize * 1.1)}pt`);

  let gridHtml = '';
  for (let p = 0; p < pages; p++) {
    const isLastPage = p === pages - 1;
    gridHtml += `<div style="display:grid;grid-template-columns:repeat(${cols},${cellW}mm);grid-template-rows:repeat(${rows},${cellH}mm);width:${210 - marginLeft - marginRight}mm;height:${297 - marginTop - marginBottom}mm;margin:${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;${isLastPage ? '' : 'page-break-after:always;'}">`;
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
  html, body { width: 210mm; height: auto; margin: 0; padding: 0; background: white; overflow: hidden; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>${gridHtml}
<script>
document.querySelectorAll('.label').forEach(function(label) {
  var maxH = label.style.maxHeight;
  if (!maxH) return;
  var maxPx = parseFloat(maxH) * 3.7795;
  var minSize = 5;
  var step = 0.5;
  while (label.scrollHeight > maxPx + 2 && parseFloat(label.style.fontSize) > minSize) {
    var cur = parseFloat(label.style.fontSize);
    label.style.fontSize = (cur - step) + 'pt';
    label.querySelectorAll('[style*="font-size"]').forEach(function(child) {
      var cs = parseFloat(child.style.fontSize);
      if (cs > minSize) child.style.fontSize = Math.max(cs - step, minSize) + 'pt';
    });
  }
});
</script>
</body>
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
