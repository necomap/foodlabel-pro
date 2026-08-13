// ============================================================
// scripts/backfill-recipe-barcodes.ts
// 既にインポート済みのレシピに、Excelの「No」列（実際はバーコード）を後から反映する
//
// 使い方:
//   npx tsx scripts/backfill-recipe-barcodes.ts "path/to/foodlabeltest取り込み用.xlsx" --dry-run
//   npx tsx scripts/backfill-recipe-barcodes.ts "path/to/foodlabeltest取り込み用.xlsx"
// ============================================================

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const filePath = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!filePath) {
    console.error('使い方: npx tsx scripts/backfill-recipe-barcodes.ts <Excelパス> [--dry-run]');
    process.exit(1);
  }

  const email = process.env.IMPORT_USER_EMAIL || 'putin3martin3@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error(`ユーザーが見つかりません: ${email}`); process.exit(1); }

  const wb = XLSX.readFile(path.resolve(filePath));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: null });

  let matched = 0, notFound = 0, noBarcode = 0;
  const notFoundNames: string[] = [];

  for (const row of rows) {
    const name = row['品名'] ? String(row['品名']).trim() : null;
    const barcode = row['No'] ? String(row['No']).trim() : null;
    if (!name) continue;
    if (!barcode) { noBarcode++; continue; }

    const recipe = await prisma.recipe.findFirst({ where: { userId: user.id, name } });
    if (!recipe) { notFound++; notFoundNames.push(name); continue; }

    if (dryRun) {
      console.log(`[preview] ${name} → barcode: ${barcode}`);
    } else {
      await prisma.recipe.update({ where: { id: recipe.id }, data: { barcode } });
    }
    matched++;
  }

  console.log(`\n=== ${dryRun ? 'DRY RUN' : '結果'} ===`);
  console.log(`バーコード反映: ${matched}件 / バーコードなし（対象外）: ${noBarcode}件 / レシピが見つからず: ${notFound}件`);
  if (notFoundNames.length) {
    console.log('見つからなかった品名:');
    notFoundNames.forEach(n => console.log(`  - ${n}`));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
