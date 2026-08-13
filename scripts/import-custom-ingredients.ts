// ============================================================
// scripts/import-custom-ingredients.ts
// 自作Excel（原価栄養計算表）から食材マスタへインポートするスクリプト
//
// 使い方:
//   npm install xlsx --save-dev   （未インストールの場合のみ）
//   npx tsx scripts/import-custom-ingredients.ts "path/to/栄養成分自作.xlsx" --dry-run
//   （内容を確認したら --dry-run を外して再実行）
//
// 環境変数:
//   IMPORT_USER_EMAIL … インポート先のアカウント（未指定なら管理者アカウントを使用）
// ============================================================

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

// 区分列がこれに該当する行は非食品（包材等）として除外
const NONFOOD_CATEGORIES = new Set(['袋', 'シール', '型', '箱', '包材']);

// アレルギー列をそのまま採用してよい値（それ以外は手動確認へ）
const KNOWN_ALLERGENS = new Set([
  'えび', 'かに', '小麦', 'そば', '卵', '乳', '落花生', 'くるみ',
  'あわび', 'いか', 'いくら', 'オレンジ', 'カシューナッツ', 'キウイフルーツ', '牛肉', 'ごま',
  'さけ', 'さば', '大豆', '鶏肉', 'バナナ', '豚肉', 'まつたけ', 'もも', 'やまいも', 'りんご',
  'ゼラチン', 'アーモンド',
]);

type StorageType = 'ROOM_TEMP' | 'FRIDGE' | 'FROZEN' | 'OTHER';
function mapStorage(v: unknown): StorageType {
  const s = String(v ?? '');
  if (s.includes('冷凍')) return 'FROZEN';
  if (s.includes('冷蔵')) return 'FRIDGE';
  return 'ROOM_TEMP';
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const filePath = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!filePath) {
    console.error('使い方: npx tsx scripts/import-custom-ingredients.ts <Excelパス> [--dry-run]');
    process.exit(1);
  }

  const email = process.env.IMPORT_USER_EMAIL || 'putin3martin3@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`ユーザーが見つかりません: ${email}（IMPORT_USER_EMAIL で指定可能）`);
    process.exit(1);
  }

  const wb = XLSX.readFile(path.resolve(filePath));
  const ws = wb.Sheets[wb.SheetNames[0]];
  // 1行目（単位の注記）をスキップし、2行目をヘッダーとして読み込む
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { range: 1, defval: null });

  // 品名（原料名）で重複がある場合は後の行を優先（= 単純に後勝ちで上書きしていく）
  const byName = new Map<string, Record<string, any>>();
  let skippedNonFood = 0;
  let skippedNoName = 0;
  for (const row of rows) {
    const name = row['原料名'];
    if (!name || typeof name !== 'string' || !name.trim()) { skippedNoName++; continue; }
    if (NONFOOD_CATEGORIES.has(row['区分'])) { skippedNonFood++; continue; }
    byName.set(name.trim(), row);
  }

  console.log(`対象ユーザー: ${email} (${user.id})`);
  console.log(`読み込み行数: ${rows.length}`);
  console.log(`除外: 品名なし ${skippedNoName}件 / 非食品(区分) ${skippedNonFood}件`);
  console.log(`インポート候補: ${byName.size}件`);
  console.log(dryRun ? '=== DRY RUN（DBには書き込みません） ===\n' : '=== 本実行 ===\n');

  const allergyReview: { name: string; value: string }[] = [];
  let linkedByCode = 0, manualNutrition = 0, noNutrition = 0, created = 0, updated = 0;

  for (const [name, row] of Array.from(byName.entries())) {
    const foodCode = numOrNull(row['食品番号']);
    let nutritionId: number | null = null;
    let manualFields: Record<string, number | null> = {};

    if (foodCode != null) {
      const nd = await prisma.nutritionData.findUnique({ where: { id: foodCode } });
      if (nd) {
        nutritionId = foodCode; // DB側の最新データにリンク（今後の一括更新にも追従する）
        linkedByCode++;
      }
    }
    if (nutritionId == null) {
      const kcal = numOrNull(row['熱量']);
      if (kcal != null) {
        manualFields = {
          energyKcalManual:     kcal,
          proteinManual:        numOrNull(row['たんぱく質']),
          fatManual:             numOrNull(row['脂質']),
          carbohydrateManual:    numOrNull(row['炭水化物']),
          sodiumManual:          null, // シートにナトリウム(mg)はあるが食塩相当量列を優先使用
          saltEquivalentManual:  numOrNull(row['食塩相当量']),
          dietaryFiberManual:    numOrNull(row['食物繊維']),
          sugarManual:           numOrNull(row['糖質']),
          cholesterolManual:     numOrNull(row['コレステロール']),
        };
        manualNutrition++;
      } else {
        noNutrition++;
      }
    }

    // アレルギー：既知の表記のみ自動反映、それ以外は確認リストへ
    let allergens: string[] = [];
    const allergyRaw = row['アレルギー'];
    if (allergyRaw && allergyRaw !== 'なし') {
      if (KNOWN_ALLERGENS.has(allergyRaw)) {
        allergens = [allergyRaw];
      } else {
        allergyReview.push({ name, value: String(allergyRaw) });
      }
    }

    const data = {
      name,
      userId: user.id,
      isPublic: false,
      isApproved: false,
      nutritionId,
      ...manualFields,
      allergens,
      unitPrice:      numOrNull(row['原料単価']),
      purchaseUnitG:  numOrNull(row['仕入単位']),
      purchasePrice:  numOrNull(row['仕入価格']),
      supplier:       row['仕入先'] || null,
      productCode:    row['商品番号'] ? String(row['商品番号']) : null,
      storage:        mapStorage(row['保管場所']),
    };

    if (dryRun) {
      console.log(`[preview] ${name} — ${nutritionId ? `食品番号${nutritionId}にリンク` : (Object.keys(manualFields).length ? '手入力値で登録' : '栄養データなし')}`);
      continue;
    }

    const existing = await prisma.ingredient.findFirst({ where: { userId: user.id, name } });
    if (existing) {
      await prisma.ingredient.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.ingredient.create({ data });
      created++;
    }
  }

  console.log('\n=== 結果 ===');
  console.log(`食品番号でリンク: ${linkedByCode}件`);
  console.log(`手入力値で登録: ${manualNutrition}件`);
  console.log(`栄養データなし（未確認扱い）: ${noNutrition}件`);
  if (!dryRun) console.log(`新規作成: ${created}件 / 更新: ${updated}件`);
  if (allergyReview.length > 0) {
    console.log(`\n⚠ アレルギー表記が不明で自動反映しなかった項目（${allergyReview.length}件）。手動で確認してください：`);
    allergyReview.forEach(r => console.log(`  - ${r.name}: 「${r.value}」`));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
