// ============================================================
// scripts/import-recipes-bulk.ts
// 旧マクロのレシピExcel（DB (2)シート）から一括インポートするスクリプト
// 既存レシピ・印刷履歴を全削除してから、Excelの内容で作り直します。
//
// 使い方:
//   npm install xlsx --save-dev   （未インストールの場合のみ）
//   1) まず必ずdry-runで内容確認（DBには一切触れません）
//      npx tsx scripts/import-recipes-bulk.ts "path/to/レシピ.xlsx" --dry-run
//   2) 問題なければ本実行（既存データを削除するため --confirm-delete が必須）
//      npx tsx scripts/import-recipes-bulk.ts "path/to/レシピ.xlsx" --confirm-delete
//
// 環境変数:
//   IMPORT_USER_EMAIL … インポート先のアカウント（未指定なら管理者アカウント）
// ============================================================

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';
import { detectAllergens } from '../lib/allergen';

const prisma = new PrismaClient();

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

type BakingStep = { steam: 'ON' | 'OFF'; topHeat: number | null; bottomHeat: number | null; timeMin: number | null };

function parseRow(row: Record<string, any>) {
  const ingredients: {
    name: string; amount: number; unit: string; displayOrder: number;
    costTotal: number | null;
    nutrition: Record<string, number | null>;
  }[] = [];
  for (let i = 1; i <= 30; i++) {
    const name = strOrNull(row[`材料${i}`]);
    if (!name) continue;
    ingredients.push({
      name,
      amount: numOrNull(row[`分量${i}`]) ?? 0,
      unit: strOrNull(row[`単位${i}`]) ?? 'g',
      displayOrder: numOrNull(row[`表示順位${i}`]) ?? i,
      costTotal: numOrNull(row[`原価${i}`]),
      nutrition: {
        energyKcal:     numOrNull(row[`熱量${i}`]),
        protein:        numOrNull(row[`たんぱく質${i}`]),
        fat:            numOrNull(row[`脂質${i}`]),
        carbohydrate:   numOrNull(row[`炭水化物${i}`]),
        sodium:         numOrNull(row[`ナトリウム${i}`]),
        saltEquivalent: numOrNull(row[`食塩相当量${i}`]),
        dietaryFiber:   numOrNull(row[`食物繊維${i}`]),
        sugar:          numOrNull(row[`糖質${i}`]),
        cholesterol:    numOrNull(row[`コレステロール${i}`]),
      },
    });
  }

  const steps: string[] = [];
  for (let i = 1; i <= 35; i++) {
    const s = strOrNull(row[`手順${i}`]);
    if (s) steps.push(s);
  }

  const bakingConditions: BakingStep[] = [];
  for (let i = 1; i <= 3; i++) {
    const steam = row[`スチーム${i}`];
    const topHeat = numOrNull(row[`上火${i}`]);
    const bottomHeat = numOrNull(row[`下火${i}`]);
    const timeMin = numOrNull(row[`時間${i}`]);
    if (steam != null || topHeat != null || bottomHeat != null || timeMin != null) {
      bakingConditions.push({ steam: steam === 'ON' ? 'ON' : 'OFF', topHeat, bottomHeat, timeMin });
    }
  }

  const noteParts: string[] = [];
  const chui = strOrNull(row['注意事項']);
  if (chui) noteParts.push(chui);
  const supplementary: string[] = [];
  if (strOrNull(row['型'])) supplementary.push(`型: ${row['型']}`);
  if (numOrNull(row['焼成前全体量']) != null) supplementary.push(`焼成前全体量: ${row['焼成前全体量']}g`);
  if (numOrNull(row['焼成前1個量']) != null) supplementary.push(`焼成前1個量: ${row['焼成前1個量']}g`);
  if (numOrNull(row['焼成後1個量']) != null) supplementary.push(`焼成後1個量: ${row['焼成後1個量']}g`);
  if (strOrNull(row['備考'])) supplementary.push(`備考: ${row['備考']}`);
  if (supplementary.length) noteParts.push(supplementary.join(' / '));

  const costRateRaw = numOrNull(row['原価率']);

  return {
    name:           strOrNull(row['品名']),
    nameKana:       strOrNull(row['カナ']),
    barcode:        strOrNull(row['No']),
    categoryName:   strOrNull(row['カテゴリ']),
    unitCount:      numOrNull(row['仕上数量']) ?? 1,
    salePrice:      numOrNull(row['販売価格']),
    shelfLifeDays:  numOrNull(row['賞味期限']),
    contentAmount:  strOrNull(row['内容量']),
    storageMethod:  strOrNull(row['保存方法']),
    printComment:   strOrNull(row['印字コメント']),
    qualityControl: strOrNull(row['品質管理']),
    notes:          noteParts.length ? noteParts.join('\n') : null,
    totalCost:      numOrNull(row['原価合計']),
    unitCost:       numOrNull(row['1個原価']),
    costRate:       costRateRaw != null ? costRateRaw / 100 : null,
    totalWeightG:   numOrNull(row['材料合計量']),
    nutrition: {
      energyKcal:     numOrNull(row['熱量']),
      protein:        numOrNull(row['たんぱく質']),
      fat:            numOrNull(row['脂質']),
      carbohydrate:   numOrNull(row['炭水化物']),
      sodium:         numOrNull(row['ナトリウム']),
      saltEquivalent: numOrNull(row['食塩相当量']),
      dietaryFiber:   numOrNull(row['食物繊維']),
      sugar:          numOrNull(row['糖質']),
      cholesterol:    numOrNull(row['コレステロール']),
    },
    ingredients, steps, bakingConditions,
  };
}

async function main() {
  const filePath = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  const confirmDelete = process.argv.includes('--confirm-delete');
  const listOnly = process.argv.includes('--list-existing');

  const email = process.env.IMPORT_USER_EMAIL || 'putin3martin3@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error(`ユーザーが見つかりません: ${email}`); process.exit(1); }

  if (listOnly) {
    const existing = await prisma.recipe.findMany({
      where: { userId: user.id },
      select: { name: true, createdAt: true, updatedAt: true, isActive: true },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    const activeCount = existing.filter(r => r.isActive).length;
    const inactiveCount = existing.length - activeCount;
    console.log(`既存レシピ: ${existing.length}件（有効: ${activeCount}件 / 無効化済み: ${inactiveCount}件）\n`);
    const byName = new Map<string, number>();
    existing.forEach(r => byName.set(r.name, (byName.get(r.name) ?? 0) + 1));
    const dupes = Array.from(byName.entries()).filter(([, c]) => c > 1);
    console.log(`ユニークな品名: ${byName.size}件 / 同名重複がある品名: ${dupes.length}件`);
    if (dupes.length > 0) {
      console.log('\n重複している品名（上位20件）:');
      dupes.slice(0, 20).forEach(([name, count]) => console.log(`  - ${name}: ${count}件`));
    }
    console.log('\n全件一覧（[無効] は画面に出ていないレコード）:');
    existing.forEach(r => console.log(`  ${r.isActive ? '' : '[無効] '}${r.name}  （作成: ${r.createdAt.toISOString().slice(0,10)}）`));
    return;
  }

  if (!filePath) {
    console.error('使い方: npx tsx scripts/import-recipes-bulk.ts <Excelパス> [--dry-run | --confirm-delete]');
    console.error('        npx tsx scripts/import-recipes-bulk.ts --list-existing  （既存レシピ一覧のみ表示）');
    process.exit(1);
  }

  const wb = XLSX.readFile(path.resolve(filePath));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  const parsed = rows.map(parseRow).filter(r => r.name);

  const existingRecipeCount = await prisma.recipe.count({ where: { userId: user.id } });
  const existingLabelCount  = await prisma.label.count({ where: { userId: user.id } });

  console.log(`対象ユーザー: ${email} (${user.id})`);
  console.log(`Excel読み込み: ${rows.length}行 → 品名ありレシピ ${parsed.length}件`);
  console.log(`既存レシピ: ${existingRecipeCount}件 / 既存印刷履歴: ${existingLabelCount}件 → 実行時にすべて削除されます`);

  const categorySet = new Set(parsed.map(r => r.categoryName).filter(Boolean));
  const totalIngredientRows = parsed.reduce((s, r) => s + r.ingredients.length, 0);
  const totalSteps = parsed.reduce((s, r) => s + r.steps.length, 0);
  console.log(`カテゴリ種類: ${categorySet.size}種類 / 材料明細合計: ${totalIngredientRows}行 / 手順合計: ${totalSteps}行`);

  if (dryRun) {
    console.log('\n=== DRY RUN（DBには一切触れていません） ===');
    console.log('サンプル（先頭3件）:');
    parsed.slice(0, 3).forEach(r => {
      console.log(`  - ${r.name}（${r.categoryName ?? 'カテゴリなし'}）材料${r.ingredients.length}件 / 手順${r.steps.length}件 / 焼成条件${r.bakingConditions.length}段階`);
    });
    console.log('\n内容に問題なければ --confirm-delete を付けて本実行してください。');
    return;
  }

  if (!confirmDelete) {
    console.error('\n本実行には --confirm-delete フラグが必要です（既存レシピ・印刷履歴を削除するため）。');
    console.error('内容の確認がまだなら、先に --dry-run で確認してください。');
    process.exit(1);
  }

  // 既存の食材マスタを事前に取得（材料名→ID のマップ。1件ずつ問い合わせるより高速）
  const masterIngredients = await prisma.ingredient.findMany({
    where: { OR: [{ userId: user.id }, { userId: null, isApproved: true }, { userId: null, isPublic: true }] },
    select: { id: true, name: true },
  });
  const ingredientIdByName = new Map(masterIngredients.map(i => [i.name, i.id]));

  console.log('\n既存レシピ・印刷履歴を削除しています...');
  await prisma.label.deleteMany({ where: { userId: user.id } });
  await prisma.recipe.deleteMany({ where: { userId: user.id } }); // RecipeIngredient/RecipeStepはCascadeで自動削除
  console.log('削除完了。インポートを開始します。\n');

  const categoryCache = new Map<string, string>();
  let created = 0;

  for (const r of parsed) {
    let categoryId: string | null = null;
    if (r.categoryName) {
      if (categoryCache.has(r.categoryName)) {
        categoryId = categoryCache.get(r.categoryName)!;
      } else {
        let cat = await prisma.category.findFirst({ where: { userId: user.id, name: r.categoryName } });
        if (!cat) cat = await prisma.category.create({ data: { userId: user.id, name: r.categoryName } });
        categoryCache.set(r.categoryName, cat.id);
        categoryId = cat.id;
      }
    }

    const recipe = await prisma.recipe.create({
      data: {
        userId: user.id,
        categoryId,
        name: r.name!,
        nameKana: r.nameKana,
        barcode: r.barcode,
        unitCount: r.unitCount,
        salePrice: r.salePrice,
        shelfLifeDays: r.shelfLifeDays,
        contentAmount: r.contentAmount,
        storageMethod: r.storageMethod,
        notes: r.notes,
        printComment: r.printComment,
        qualityControl: r.qualityControl,
        bakingConditions: r.bakingConditions.length ? (r.bakingConditions as any) : undefined,
        totalCost: r.totalCost,
        unitCost: r.unitCost,
        costRate: r.costRate,
        totalWeightG: r.totalWeightG,
        energyKcal:     r.nutrition.energyKcal,
        protein:        r.nutrition.protein,
        fat:            r.nutrition.fat,
        carbohydrate:   r.nutrition.carbohydrate,
        sodium:         r.nutrition.sodium,
        saltEquivalent: r.nutrition.saltEquivalent,
        dietaryFiber:   r.nutrition.dietaryFiber,
        sugar:          r.nutrition.sugar,
        cholesterol:    r.nutrition.cholesterol,
      },
    });

    if (r.ingredients.length) {
      await prisma.recipeIngredient.createMany({
        data: r.ingredients.map(ing => ({
          recipeId: recipe.id,
          ingredientId: ingredientIdByName.get(ing.name) ?? null,
          ingredientNameOverride: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          displayOrder: ing.displayOrder,
          sortByWeight: true,
          costTotal: ing.costTotal,
          allergenOverride: detectAllergens(ing.name),
          nutritionUnconfirmed: ing.nutrition.energyKcal == null,
          energyKcal:     ing.nutrition.energyKcal,
          protein:        ing.nutrition.protein,
          fat:            ing.nutrition.fat,
          carbohydrate:   ing.nutrition.carbohydrate,
          sodium:         ing.nutrition.sodium,
          saltEquivalent: ing.nutrition.saltEquivalent,
          dietaryFiber:   ing.nutrition.dietaryFiber,
          sugar:          ing.nutrition.sugar,
          cholesterol:    ing.nutrition.cholesterol,
        })),
      });
    }

    if (r.steps.length) {
      await prisma.recipeStep.createMany({
        data: r.steps.map((s, idx) => ({ recipeId: recipe.id, stepNumber: idx + 1, instruction: s })),
      });
    }

    created++;
    if (created % 50 === 0) console.log(`  ...${created}/${parsed.length}件 処理済み`);
  }

  console.log(`\n=== 完了 ===`);
  console.log(`作成したレシピ: ${created}件`);
  console.log(`作成したカテゴリ: ${categoryCache.size}件`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
