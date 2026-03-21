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
  saltEquivalent:  number | null;
  ingredients: Array<{
    name:     string;
    amount:   number;
    unit:     string;
    order:    number;
    cost:     number | null;
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
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 1,
    defval: null,
  }) as unknown[][];

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
    category:     findColIdx(headers, ['カテゴリ', 'category']),
    name:         findColIdx(headers, ['品名']),
    nameKana:     findColIdx(headers, ['カナ', '品名カナ']),
    unitCount:    findColIdx(headers, ['仕上数量', '仕上げ数量']),
    salePrice:    findColIdx(headers, ['販売価格', '売価']),
    costRate:     findColIdx(headers, ['原価率']),
    shelfLifeDays: findColIdx(headers, ['賞味期限', '消費期限']),
    ingredientsText: findColIdx(headers, ['原材料']),
    notes:        findColIdx(headers, ['注意事項', '印字コメント']),
    energyKcal:   findColIdx(headers, ['熱量']),
    protein:      findColIdx(headers, ['たんぱく質']),
    fat:          findColIdx(headers, ['脂質']),
    carbohydrate: findColIdx(headers, ['炭水化物']),
    saltEquivalent: findColIdx(headers, ['食塩相当量']),
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
  };

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
          // 材料Nの列は「材料1」から始まり14列ごと（材料名・分量・単位・表示順位・原価・各栄養）
          const matBase = colIdx.mat1Start + m * 14;
          const matName = String(row[matBase] ?? '').trim();
          if (!matName) continue;

          const amount = parseFloat(String(row[matBase + 1] ?? '0')) || 0;
          const unit   = String(row[matBase + 2] ?? 'g').trim() || 'g';
          const order  = parseInt(String(row[matBase + 3] ?? `${m}`)) || m;
          const cost   = parseFloat(String(row[matBase + 4] ?? '')) || null;

          ingredients.push({ name: matName, amount, unit, order, cost });
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

      const recipe: ImportedRecipe = {
        no:              parseInt(String(row[0] ?? i)) || i,
        category:        String(row[colIdx.category > -1 ? colIdx.category : 1] ?? '').trim(),
        name,
        nameKana:        String(row[colIdx.nameKana > -1 ? colIdx.nameKana : 4] ?? '').trim(),
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
        saltEquivalent:  parseFloatOrNull(row[colIdx.saltEquivalent > -1 ? colIdx.saltEquivalent : 22]),
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
    categoryName:   string | null;
    unitCount:      number;
    salePrice:      number | null;
    costRate:       number | null;
    shelfLifeDays:  number | null;
    ingredientsLabel: string;
    notes:          string | null;
    energyKcal:     number | null;
    protein:        number | null;
    fat:            number | null;
    carbohydrate:   number | null;
    saltEquivalent: number | null;
    ingredients:    Array<{
      ingredientName: string;
      amount:         number;
      unit:           string;
      displayOrder:   number;
      costTotal:      number | null;
    }>;
    steps:          string[];
  }>,
  options: ExcelExportOptions
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // ヘッダー行の構築
  const baseHeaders = [
    'No', 'カテゴリ', 'FLG', '品名', 'カナ', '仕上数量', '廃棄数量', '原価合計',
    '1個原価', '販売価格', '原価率', '賞味期限', '原材料', '注意事項',
  ];

  const nutritionHeaders = options.includeNutrition
    ? ['熱量', 'たんぱく質', '脂質', '炭水化物', '食塩相当量']
    : [];

  // 材料列（最大30）
  const matHeaders: string[] = [];
  for (let i = 1; i <= 30; i++) {
    matHeaders.push(`材料${i}`, `分量${i}`, `単位${i}`, `表示順位${i}`, `原価${i}`);
  }

  // 手順列（最大35）
  const stepHeaders: string[] = [];
  if (options.includeSteps) {
    for (let i = 1; i <= 35; i++) stepHeaders.push(`手順${i}`);
  }

  const headers = [...baseHeaders, ...nutritionHeaders, ...matHeaders, ...stepHeaders];

  // データ行の構築
  const dataRows = recipes.map((recipe, idx) => {
    const baseData = [
      idx + 1,
      recipe.categoryName ?? '',
      '',
      recipe.name,
      recipe.nameKana ?? '',
      recipe.unitCount,
      '',
      '',
      '',
      recipe.salePrice ?? '',
      recipe.costRate != null ? (recipe.costRate * 100).toFixed(1) + '%' : '',
      recipe.shelfLifeDays ?? '',
      recipe.ingredientsLabel,
      recipe.notes ?? '',
    ];

    const nutritionData = options.includeNutrition
      ? [
          recipe.energyKcal ?? '',
          recipe.protein ?? '',
          recipe.fat ?? '',
          recipe.carbohydrate ?? '',
          recipe.saltEquivalent ?? '',
        ]
      : [];

    const matData: (string | number)[] = [];
    for (let i = 0; i < 30; i++) {
      const ing = recipe.ingredients[i];
      if (ing) {
        matData.push(ing.ingredientName, ing.amount, ing.unit, ing.displayOrder, ing.costTotal ?? '');
      } else {
        matData.push('', '', '', '', '');
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

  // 列幅の設定
  ws['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 5 }, { wch: 30 }, { wch: 25 },
    { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 },
    { wch: 60 }, { wch: 30 },
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
