// ============================================================
// lib/excel-import-export.ts
// ExcelファイルのインポートとCSV/Excelエクスポート
// xlsxライブラリを使用
// ============================================================

import * as XLSX from 'xlsx';
import type { ExcelImportResult, ExcelExportOptions } from '@/types';

// ============================================================
// インポート用の型
// ============================================================
interface ImportedRecipe {
  no:              number;
  category:        string;
  name:            string;
  nameKana:        string;
  barcode:         string;
  variationName:   string;
  moldType:        string;
  contentAmount:   string;
  wasteAmountG:    number | null;
  shelfLifeType:   'BEST_BEFORE' | 'USE_BY';
  storageMethod:   string;
  qualityControl:  string;
  printComment:    string;
  unitCount:       number;
  salePrice:       number | null;
  costRate:        number | null;
  shelfLifeDays:   number;
  ingredientsText: string;
  notes:           string;
  energyKcal:      number | null;
  protein:         number | null;
  fat:             number | null;
  carbohydrate:    number | null;
  sugar:           number | null;
  dietaryFiber:    number | null;
  saltEquivalent:  number | null;
  sodium:          number | null;
  cholesterol:     number | null;
  ingredients: Array<{
    name:            string;
    amount:          number;
    unit:            string;
    order:           number;
    cost:            number | null;
    originCountry:   string;
    isAdditive:      boolean;
    additiveReason:  string;
    hideFromLabel:   boolean;
    processLabel:    string;
  }>;
  steps: string[];
  bakingConditions: Array<{
    steam:      string;
    topHeat:    number | null;
    bottomHeat: number | null;
    timeMin:    number | null;
  }>;
}

// ============================================================
// インポート処理
// ============================================================

/**
 * _resipi.xlsm 形式のExcelファイルをパースする
 * DBシートまたはDB(2)シートに対応
 */
export function parseExcelFile(buffer: ArrayBuffer): {
  recipes: ImportedRecipe[];
  errors:  Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
} {
  const errors:   Array<{ row: number; message: string }> = [];
  const warnings: Array<{ row: number; message: string }> = [];
  const recipes:  ImportedRecipe[] = [];

  const workbook = XLSX.read(buffer, { type: 'array' });

  // DBシートを優先
  const sheetName = workbook.SheetNames.find(n => n === 'DB') ??
                    workbook.SheetNames.find(n => n.startsWith('DB')) ??
                    workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as any[][];

  if (rows.length < 2) {
    errors.push({ row: 0, message: 'データが見つかりません' });
    return { recipes, errors, warnings };
  }

  // ヘッダー行を検索（「No」または「品名」を含む行）
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    if (row && (row[0] === 'No' || row[2] === '品名' || row[3] === '品名')) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // ヘッダーなしで1行目からデータとみなす
    headerRowIdx = 0;
  }

  const headers = rows[headerRowIdx] as string[];

  // 列インデックスを特定
  const colIdx = {
    no:           findColIdx(headers, ['No', 'NO', 'no']),
    barcode:      findColIdx(headers, ['バーコード']),
    category:     findColIdx(headers, ['カテゴリ', 'category']),
    name:         findColIdx(headers, ['品名']),
    nameKana:     findColIdx(headers, ['カナ', '品名カナ']),
    variationName: findColIdx(headers, ['バリエーション名']),
    moldType:     findColIdx(headers, ['型']),
    contentAmount: findColIdx(headers, ['内容量表示', '内容量']),
    unitCount:    findColIdx(headers, ['仕上数量', '仕上げ数量']),
    wasteAmountG: findColIdx(headers, ['廃棄数量']),
    salePrice:    findColIdx(headers, ['販売価格', '売価']),
    costRate:     findColIdx(headers, ['原価率']),
    shelfLifeDays: findColIdx(headers, ['賞味期限', '消費期限']),
    shelfLifeType: findColIdx(headers, ['期限区分']),
    storageMethod: findColIdx(headers, ['保存方法']),
    ingredientsText: findColIdx(headers, ['原材料']),
    // 「メモ（自分用）」が新しいエクスポート形式の名称。旧形式（アプリ以前の自作Excel・
    // 2026-08より前のエクスポート）では「注意事項」「印字コメント」という名前だったため、
    // それらも後方互換のフォールバックとして残す。
    notes:        findColIdx(headers, ['メモ（自分用）', 'メモ', '注意事項', '印字コメント']),
    qualityControl: findColIdx(headers, ['お客様へのお願い・注意事項', 'お客様へのお願い']),
    printComment: findColIdx(headers, ['印字コメント']),
    energyKcal:   findColIdx(headers, ['熱量']),
    protein:      findColIdx(headers, ['たんぱく質']),
    fat:          findColIdx(headers, ['脂質']),
    carbohydrate: findColIdx(headers, ['炭水化物']),
    sugar:        findColIdx(headers, ['糖質']),
    dietaryFiber: findColIdx(headers, ['食物繊維']),
    saltEquivalent: findColIdx(headers, ['食塩相当量']),
    sodium:       findColIdx(headers, ['ナトリウム']),
    cholesterol:  findColIdx(headers, ['コレステロール']),
    // 焼成
    steam1:    findColIdx(headers, ['スチーム1']),
    topHeat1:  findColIdx(headers, ['上火1']),
    botHeat1:  findColIdx(headers, ['下火1']),
    time1:     findColIdx(headers, ['時間1']),
    steam2:    findColIdx(headers, ['スチーム2']),
    topHeat2:  findColIdx(headers, ['上火2']),
    botHeat2:  findColIdx(headers, ['下火2']),
    time2:     findColIdx(headers, ['時間2']),
    // 材料（最大30個）のベースインデックス
    mat1Start: findColIdx(headers, ['材料1']),
    mat2Start: findColIdx(headers, ['材料2']),
    // 材料ごとの原産国・添加物情報（新形式のみ。旧形式の自作Excelには無いのでfindColIdxが
    // -1を返し、下のorigin1Idx等が-1のままになる＝読み込み時はスキップされる）
    origin1Idx:        findColIdx(headers, ['原産国1']),
    additive1Idx:      findColIdx(headers, ['添加物1']),
    additiveReason1Idx: findColIdx(headers, ['添加物理由1']),
    hideFromLabel1Idx: findColIdx(headers, ['ラベル非表示1']),
    processLabel1Idx:  findColIdx(headers, ['用途表示1']),
  };

  // 材料1個あたりの列数（＝「材料1」〜「材料2」の間隔）を実際のヘッダーから動的に判定する。
  // 以前はここが14列固定になっていたが、エクスポート側が5列しか書き出していなかったため、
  // 自分でエクスポートしたファイルを読み込み直すと材料2個目以降がすべてズレて読み込まれる
  // 不具合があった（2026-08発覚）。旧来の自作Excel（_resipi.xlsm、材料1個あたり14列＝
  // 材料名・分量・単位・表示順位・原価＋栄養9項目）を読み込む場合はヘッダーから14列と
  // 判定されるので、こちらも今まで通り読み込める。
  const matStep = (colIdx.mat1Start > -1 && colIdx.mat2Start > colIdx.mat1Start)
    ? (colIdx.mat2Start - colIdx.mat1Start)
    : 14;

  // データ行を処理
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[colIdx.name > -1 ? colIdx.name : 3]) continue;

    const name = String(row[colIdx.name > -1 ? colIdx.name : 3] ?? '').trim();
    if (!name) continue;

    try {
      // 材料を抽出（材料1〜材料30）
      const ingredients: ImportedRecipe['ingredients'] = [];
      if (colIdx.mat1Start > -1) {
        for (let m = 0; m < 30; m++) {
          // 材料Nの列は「材料1」からmatStep列ごと（材料名・分量・単位・表示順位・原価が基本の5項目。
          // 新形式エクスポートはこれに原産国・添加物情報が続く）
          const matBase = colIdx.mat1Start + m * matStep;
          const matName = String(row[matBase] ?? '').trim();
          if (!matName) continue;

          const amount = parseFloat(String(row[matBase + 1] ?? '0')) || 0;
          const unit   = String(row[matBase + 2] ?? 'g').trim() || 'g';
          const order  = parseInt(String(row[matBase + 3] ?? `${m}`)) || m;
          const cost   = parseFloat(String(row[matBase + 4] ?? '')) || null;

          // 原産国・添加物情報は新形式のエクスポートにのみ存在する（見出しが見つからない
          // 旧形式ファイルではidxが-1のままなので、その場合は空値になる）
          const originCountry  = colIdx.origin1Idx        > -1 ? String(row[colIdx.origin1Idx        + m * matStep] ?? '').trim() : '';
          const additiveRaw    = colIdx.additive1Idx      > -1 ? String(row[colIdx.additive1Idx      + m * matStep] ?? '').trim() : '';
          const additiveReason = colIdx.additiveReason1Idx > -1 ? String(row[colIdx.additiveReason1Idx + m * matStep] ?? '').trim() : '';
          const hideRaw        = colIdx.hideFromLabel1Idx > -1 ? String(row[colIdx.hideFromLabel1Idx  + m * matStep] ?? '').trim() : '';
          const processLabel   = colIdx.processLabel1Idx  > -1 ? String(row[colIdx.processLabel1Idx   + m * matStep] ?? '').trim() : '';

          ingredients.push({
            name: matName, amount, unit, order, cost,
            originCountry,
            isAdditive:    additiveRaw === 'はい',
            additiveReason,
            hideFromLabel: hideRaw === 'はい',
            processLabel,
          });
        }
      }

      // 作り方を抽出（手順1〜手順35）
      const steps: string[] = [];
      const stepsBase = findColIdx(headers, ['手順1']);
      if (stepsBase > -1) {
        for (let s = 0; s < 35; s++) {
          const step = String(row[stepsBase + s] ?? '').trim();
          if (step) steps.push(step);
        }
      }

      // 焼成条件
      const bakingConditions = [];
      if (colIdx.steam1 > -1 && row[colIdx.steam1] != null) {
        bakingConditions.push({
          steam:      String(row[colIdx.steam1] ?? ''),
          topHeat:    parseFloatOrNull(row[colIdx.topHeat1]),
          bottomHeat: parseFloatOrNull(row[colIdx.botHeat1]),
          timeMin:    parseFloatOrNull(row[colIdx.time1]),
        });
      }
      if (colIdx.steam2 > -1 && row[colIdx.steam2] != null) {
        bakingConditions.push({
          steam:      String(row[colIdx.steam2] ?? ''),
          topHeat:    parseFloatOrNull(row[colIdx.topHeat2]),
          bottomHeat: parseFloatOrNull(row[colIdx.botHeat2]),
          timeMin:    parseFloatOrNull(row[colIdx.time2]),
        });
      }

      // バーコードは新形式なら「バーコード」列、無ければ旧形式（自作Excel）に合わせて1列目を使う
      const barcodeRaw = colIdx.barcode > -1 ? row[colIdx.barcode] : row[0];
      // 期限区分は「消費期限」の文字が含まれていればUSE_BY、それ以外（未指定含む）はBEST_BEFORE
      const shelfLifeTypeRaw = colIdx.shelfLifeType > -1 ? String(row[colIdx.shelfLifeType] ?? '') : '';

      const recipe: ImportedRecipe = {
        no:              parseInt(String(row[0] ?? i)) || i,
        category:        String(row[colIdx.category > -1 ? colIdx.category : 1] ?? '').trim(),
        name,
        nameKana:        String(row[colIdx.nameKana > -1 ? colIdx.nameKana : 4] ?? '').trim(),
        barcode:         String(barcodeRaw ?? '').trim(),
        variationName:   String(row[colIdx.variationName] ?? '').trim(),
        moldType:        String(row[colIdx.moldType] ?? '').trim(),
        contentAmount:   String(row[colIdx.contentAmount] ?? '').trim(),
        wasteAmountG:    parseFloatOrNull(row[colIdx.wasteAmountG]),
        shelfLifeType:   shelfLifeTypeRaw.includes('消費期限') ? 'USE_BY' : 'BEST_BEFORE',
        storageMethod:   String(row[colIdx.storageMethod] ?? '').trim(),
        qualityControl:  String(row[colIdx.qualityControl] ?? '').trim(),
        printComment:    String(row[colIdx.printComment] ?? '').trim(),
        unitCount:       parseInt(String(row[colIdx.unitCount > -1 ? colIdx.unitCount : 5] ?? '1')) || 1,
        salePrice:       parseFloatOrNull(row[colIdx.salePrice > -1 ? colIdx.salePrice : 9]),
        costRate:        parseFloatOrNull(row[colIdx.costRate > -1 ? colIdx.costRate : 10]),
        shelfLifeDays:   parseInt(String(row[colIdx.shelfLifeDays > -1 ? colIdx.shelfLifeDays : 11] ?? '0')) || 0,
        ingredientsText: String(row[colIdx.ingredientsText > -1 ? colIdx.ingredientsText : 12] ?? '').trim(),
        notes:           String(row[colIdx.notes > -1 ? colIdx.notes : 13] ?? '').trim(),
        energyKcal:      parseFloatOrNull(row[colIdx.energyKcal > -1 ? colIdx.energyKcal : 17]),
        protein:         parseFloatOrNull(row[colIdx.protein > -1 ? colIdx.protein : 18]),
        fat:             parseFloatOrNull(row[colIdx.fat > -1 ? colIdx.fat : 19]),
        carbohydrate:    parseFloatOrNull(row[colIdx.carbohydrate > -1 ? colIdx.carbohydrate : 20]),
        sugar:           parseFloatOrNull(row[colIdx.sugar]),
        dietaryFiber:    parseFloatOrNull(row[colIdx.dietaryFiber]),
        saltEquivalent:  parseFloatOrNull(row[colIdx.saltEquivalent > -1 ? colIdx.saltEquivalent : 22]),
        sodium:          parseFloatOrNull(row[colIdx.sodium]),
        cholesterol:     parseFloatOrNull(row[colIdx.cholesterol]),
        ingredients,
        steps,
        bakingConditions,
      };

      recipes.push(recipe);
    } catch (err) {
      errors.push({ row: i + 1, message: `行${i + 1}: ${String(err)}` });
    }
  }

  return { recipes, errors, warnings };
}

// ============================================================
// エクスポート処理
// ============================================================

/**
 * レシピデータをExcel形式でエクスポートする
 * インポート可能な形式（DB シート互換）で出力
 */
export function exportRecipesToExcel(
  recipes: Array<{
    name:           string;
    nameKana:       string | null;
    variationName:  string | null;
    categoryName:   string | null;
    barcode:        string | null;
    unitCount:      number;
    moldType:       string | null;
    contentAmount:  string | null;
    wasteAmountG:   number | null;
    wasteRatio:     number | null;
    totalWeightG:   number | null;
    totalCost:      number | null;
    unitCost:       number | null;
    salePrice:      number | null;
    costRate:       number | null;
    shelfLifeDays:  number | null;
    shelfLifeType:  'BEST_BEFORE' | 'USE_BY';
    storageMethod:  string | null;
    ingredientsLabel: string;
    notes:          string | null;
    qualityControl: string | null;
    printComment:   string | null;
    energyKcal:     number | null;
    protein:        number | null;
    fat:            number | null;
    carbohydrate:   number | null;
    sugar:          number | null;
    dietaryFiber:   number | null;
    saltEquivalent: number | null;
    sodium:         number | null;
    cholesterol:    number | null;
    ingredients:    Array<{
      ingredientName: string;
      amount:         number;
      unit:           string;
      displayOrder:   number;
      costTotal:      number | null;
      originCountry:  string | null;
      isAdditive:     boolean;
      additiveReason: string | null;
      hideFromLabel:  boolean;
      processLabel:   string | null;
    }>;
    steps:          string[];
  }>,
  options: ExcelExportOptions
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // ヘッダー行の構築
  // 1列目は元々「No」（連番）だったが、実際の運用ではレジ読み取り用の自作バーコードを
  // 入れる列として使われていたため、「バーコード」に変更（2026-08）。
  // 2026-08: アプリ側で後から追加された項目（バリエーション名・お客様へのお願い・注意事項など）が
  // エクスポートに反映されていなかったため、レシピの全項目を対象に追加。
  // 「注意事項」という列名は自分用メモ（notes）のことだったが、新設した「お客様へのお願い・注意事項」
  // （qualityControl）と紛らわしいため「メモ（自分用）」に改名。
  const baseHeaders = [
    'バーコード', 'カテゴリ', 'FLG', '品名', 'カナ', 'バリエーション名', '型',
    '仕上数量', '内容量表示', '廃棄数量', '廃棄率(%)', '総重量(g)',
    '原価合計', '1個原価', '販売価格', '原価率',
    '賞味期限', '期限区分', '保存方法',
    '原材料', 'メモ（自分用）', 'お客様へのお願い・注意事項', '印字コメント',
  ];

  const nutritionHeaders = options.includeNutrition
    ? ['熱量', 'たんぱく質', '脂質', '炭水化物', '糖質', '食物繊維', '食塩相当量', 'ナトリウム', 'コレステロール']
    : [];

  // 材料列（最大30）
  // 2026-08: 原産国・添加物情報（個人バックアップ用。通常のインポート/エクスポートでは
  // 使わないが、Excel自体をバックアップとして保管したい要望に対応するため追加）。
  // 各材料ブロックは必ず「材料/分量/単位/表示順位/原価/原産国/添加物/添加物理由/
  // ラベル非表示/用途表示」の10列固定＝matStep=10。インポート側もこの並びを前提に
  // 材料2の開始列との差分からmatStepを自動検出している。
  const matHeaders: string[] = [];
  for (let i = 1; i <= 30; i++) {
    matHeaders.push(
      `材料${i}`, `分量${i}`, `単位${i}`, `表示順位${i}`, `原価${i}`,
      `原産国${i}`, `添加物${i}`, `添加物理由${i}`, `ラベル非表示${i}`, `用途表示${i}`
    );
  }

  // 手順列（最大35）
  const stepHeaders: string[] = [];
  if (options.includeSteps) {
    for (let i = 1; i <= 35; i++) stepHeaders.push(`手順${i}`);
  }

  const headers = [...baseHeaders, ...nutritionHeaders, ...matHeaders, ...stepHeaders];

  // データ行の構築
  const dataRows = recipes.map((recipe) => {
    // 原価情報（原価合計・1個原価・原価率、材料ごとの原価）は「原価情報を含める」
    // オプション（includeCost）がOFFの場合はまとめて空欄にする。以前はこのオプションが
    // 実際には使われておらず、チェックを外しても原価データが出力される不具合があった。
    const baseData = [
      recipe.barcode ?? '',
      recipe.categoryName ?? '',
      '',
      recipe.name,
      recipe.nameKana ?? '',
      recipe.variationName ?? '',
      recipe.moldType ?? '',
      recipe.unitCount,
      recipe.contentAmount ?? '',
      recipe.wasteAmountG ?? '',
      recipe.wasteRatio ?? '',
      recipe.totalWeightG ?? '',
      options.includeCost ? (recipe.totalCost ?? '') : '',
      options.includeCost ? (recipe.unitCost ?? '') : '',
      recipe.salePrice ?? '',
      options.includeCost && recipe.costRate != null ? (recipe.costRate * 100).toFixed(1) + '%' : '',
      recipe.shelfLifeDays ?? '',
      recipe.shelfLifeType === 'USE_BY' ? '消費期限' : '賞味期限',
      recipe.storageMethod ?? '',
      recipe.ingredientsLabel,
      recipe.notes ?? '',
      recipe.qualityControl ?? '',
      recipe.printComment ?? '',
    ];

    const nutritionData = options.includeNutrition
      ? [
          recipe.energyKcal ?? '',
          recipe.protein ?? '',
          recipe.fat ?? '',
          recipe.carbohydrate ?? '',
          recipe.sugar ?? '',
          recipe.dietaryFiber ?? '',
          recipe.saltEquivalent ?? '',
          recipe.sodium ?? '',
          recipe.cholesterol ?? '',
        ]
      : [];

    const matData: (string | number)[] = [];
    for (let i = 0; i < 30; i++) {
      const ing = recipe.ingredients[i];
      if (ing) {
        matData.push(
          ing.ingredientName, ing.amount, ing.unit, ing.displayOrder, options.includeCost ? (ing.costTotal ?? '') : '',
          ing.originCountry ?? '', ing.isAdditive ? 'はい' : 'いいえ', ing.additiveReason ?? '',
          ing.hideFromLabel ? 'はい' : 'いいえ', ing.processLabel ?? ''
        );
      } else {
        matData.push('', '', '', '', '', '', '', '', '', '');
      }
    }

    const stepData: string[] = [];
    if (options.includeSteps) {
      for (let i = 0; i < 35; i++) {
        stepData.push(recipe.steps[i] ?? '');
      }
    }

    return [...baseData, ...nutritionData, ...matData, ...stepData];
  });

  const wsData = [headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 列幅の設定（baseHeadersの並び順と対応）
  ws['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 5 }, { wch: 30 }, { wch: 25 }, { wch: 16 }, { wch: 10 },
    { wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
    { wch: 10 }, { wch: 10 }, { wch: 30 },
    { wch: 60 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'DB');

  // 食材マスタシートも追加
  const matHeaders2 = ['食材名', 'カナ', '成分番号', '仕入れ単位(g)', '仕入れ価格(円)', '1g単価', '保管', '仕入先', 'アレルゲン'];
  const matWs = XLSX.utils.aoa_to_sheet([matHeaders2]);
  matWs['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, matWs, '食材マスタ');

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

// ============================================================
// ユーティリティ
// ============================================================

function findColIdx(headers: unknown[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => String(h ?? '').includes(candidate));
    if (idx > -1) return idx;
  }
  return -1;
}

function parseFloatOrNull(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

/**
 * 半角→全角変換（品名や食材名の正規化）
 */
export function toFullWidth(str: string): string {
  return str
    .replace(/[!-~]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0))
    .replace(/\s/g, '　');
}

/**
 * 全角→半角変換
 */
export function toHalfWidth(str: string): string {
  return str
    .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ');
}
