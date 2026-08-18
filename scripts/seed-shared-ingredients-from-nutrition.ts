// ============================================================
// scripts/seed-shared-ingredients-from-nutrition.ts
//
// 食品成分表（nutrition_data）から、パン・洋菓子・惣菜パン関連の食品群を対象に
// 「共有食材（コミュニティ共有）」を自動生成するスクリプト。
//
// 背景: 新規ユーザーが最初に食材マスタをゼロから登録しないといけないのが
// 実用化のハードルになっているため、公式の食品成分表データを元に、
// あらかじめ使いそうな食材を共有食材としてある程度充実させておく。
//
// 生成される共有食材は userId: null（システム所有）とし、承認フローを通さず
// isPublic: true / isApproved: true で即座に公開する（文科省の公式データであり、
// ユーザーからの申請ではないため、既存の却下理由フローの対象外）。
// nutritionId で食品成分表本体にリンクするため、将来 nutrition_data 側を
// 更新すればこの共有食材の栄養成分も自動的に最新値になる。
//
// 使い方:
//   npx tsx scripts/seed-shared-ingredients-from-nutrition.ts --dry-run   … 内容確認のみ
//   npx tsx scripts/seed-shared-ingredients-from-nutrition.ts            … 本実行
//
// 再実行しても安全（同じ nutrition_data.id に紐づく既存の共有食材があれば
// 新規作成せず更新するだけ。かつ既存のユーザー作成の公開食材と似た名前のものが
// あれば重複登録を避けてスキップする）。
// ============================================================

import { PrismaClient } from '@prisma/client';
import { detectAllergens } from '../lib/allergen';
import { normalizeIngredientName, isSimilarName } from '../lib/ingredient-similarity';

const prisma = new PrismaClient();

// ------------------------------------------------------------
// 対象とする食品群（日本食品標準成分表の食品群コード、2桁）。
// 「パン・洋菓子関連 + 惣菜パン関連」をカバーする想定で、藻類(09)以外の
// ほぼ全食品群を対象にしている。合わないと感じたらこの配列を編集して
// 再実行すればよい（既存分は上書き、除外した分は次回実行時に対象外になるだけで
// 既存データが自動削除されることはない＝手動でisActive: falseにする必要あり）。
// ------------------------------------------------------------
const TARGET_FOOD_GROUPS: Record<string, string> = {
  '01': '穀類',                 // 小麦粉・パン粉・米粉など
  '02': 'いも及びでん粉類',       // 片栗粉・コーンスターチなど
  '03': '砂糖及び甘味類',        // グラニュー糖・はちみつ・水あめなど
  '04': '豆類',                 // あんこ・きなこ・大豆製品など
  '05': '種実類',               // アーモンド・くるみ・ごまなど
  '06': '野菜類',               // 惣菜パンの具材用
  '07': '果実類',               // ジャム・ドライフルーツなど
  '08': 'きのこ類',              // キッシュ・ピザパンの具材用
  // '09': '藻類',               // 基本対象外（必要なら有効化）
  '10': '魚介類',               // ツナサンド・鮭パンなどの具材用
  '11': '肉類',                 // ハム・ベーコン・ソーセージパンなどの具材用
  '12': '卵類',
  '13': '乳類',                 // 牛乳・生クリーム・バター・チーズなど
  '14': '油脂類',
  '15': '菓子類',               // パン粉・ビスケット等、材料として使うものを含む
  '16': 'し好飲料類',            // コーヒー・紅茶など風味付け用
  '17': '調味料及び香辛料類',     // 惣菜パンの味付けに必須
  '18': '調理済み流通食品類',     // 惣菜パンの具材（コロッケ種など）
};

// 名前の末尾一致で「一般名（ラベル表示名）」を仮推測するための候補。
// scripts/backfill-generic-names.ts と同じ考え方・同じベースリストに、
// 惣菜パン関連の定番語をいくつか追加している。
// 一致しなかったものは genericName を空のまま登録し、各ユーザーが
// 食材編集画面で確認・入力する想定（genericNameConfirmed: false は
// 「一般名が未確認」を表す共通フラグなので、一致有無に関わらず false にする）。
const GENERIC_TERMS = [
  '無塩バター', '発酵バター', 'バター',
  '生クリーム', 'ホイップクリーム', 'クリームチーズ', 'マスカルポーネ',
  'クーベルチュールチョコレート', 'クーベルチュール', 'ホワイトチョコレート', 'チョコレート',
  '薄力粉', '強力粉', '準強力粉', '中力粉', '全粒粉', 'アーモンドプードル', '米粉', 'ライ麦粉', 'パン粉',
  'グラニュー糖', '上白糖', '三温糖', '粉糖', '黒糖', '砂糖',
  '全卵', '卵黄', '卵白', '乾燥卵白',
  '牛乳', '脱脂粉乳', 'スキムミルク', 'バターミルクパウダー', 'チーズ',
  'ドライイースト', 'インスタントドライイースト',
  'ベーキングパウダー', '重曹',
  '食塩', '岩塩', '塩', 'こしょう', 'コショウ', 'カレー粉',
  'ゼラチン', '板ゼラチン', '粉ゼラチン',
  'アーモンド', 'くるみ', 'カシューナッツ', 'ヘーゼルナッツ', 'ピスタチオ', 'ごま',
  'バニラビーンズ', 'バニラエッセンス', 'バニラオイル',
  'レモン果汁', 'レモンピール', 'レモン',
  'オレンジピール', 'オレンジ',
  'はちみつ', '水あめ', 'メープルシロップ',
  'ロースハム', 'ハム', 'ベーコン', 'ソーセージ', 'ウインナー', 'ツナ',
  'マヨネーズ', 'ケチャップ', 'コーン',
];

function guessGenericName(foodName: string): string | null {
  const hit = GENERIC_TERMS.find(term => foodName.endsWith(term));
  return hit ?? null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // まず実際に nutrition_data に入っている食品群コードと件数を確認する。
  // TARGET_FOOD_GROUPS で指定したコードが実データと食い違っていないかの
  // 安全確認（食い違っていると対象0件のまま気づかず終わってしまうため）。
  const groupCounts = await prisma.nutritionData.groupBy({
    by: ['foodGroup'],
    _count: { _all: true },
    orderBy: { foodGroup: 'asc' },
  });
  console.log('=== nutrition_data の食品群一覧（実データ） ===');
  groupCounts.forEach(g => {
    const label = g.foodGroup ? (TARGET_FOOD_GROUPS[g.foodGroup] ?? '(対象外)') : '(不明)';
    console.log(`  ${g.foodGroup ?? '(null)'} : ${g._count._all}件  ${label}`);
  });
  console.log('');

  const targetCodes = Object.keys(TARGET_FOOD_GROUPS);
  const rows = await prisma.nutritionData.findMany({
    where: { foodGroup: { in: targetCodes } },
    orderBy: { id: 'asc' },
  });
  console.log(`対象食品群の合計: ${rows.length}件\n`);

  if (rows.length === 0) {
    console.log('⚠ 対象件数が0件です。TARGET_FOOD_GROUPS のコードが実データの食品群コードと一致しているか確認してください。');
    return;
  }

  // 既存の「システム所有（userId: null）の共有食材」を nutritionId → Ingredient のマップにしておく
  // （再実行時の重複作成防止・更新用）
  const existingSystemOwned = await prisma.ingredient.findMany({
    where: { userId: null, nutritionId: { not: null } },
    select: { id: true, nutritionId: true, name: true },
  });
  const systemOwnedByNutritionId = new Map(existingSystemOwned.map(i => [i.nutritionId as number, i]));

  // 既存の「公開済み（isPublic:true）の食材」全体の正規化名リスト
  // （ユーザーが既に手動で同じような食材を共有登録済みの場合、重複登録を避けるため）
  const existingPublic = await prisma.ingredient.findMany({
    where: { isPublic: true, isActive: true, nutritionId: null }, // nutritionId未リンクのユーザー登録分を主対象に類似判定
    select: { id: true, name: true },
  });
  const existingPublicNorm = existingPublic.map(i => ({ ...i, norm: normalizeIngredientName(i.name) }));

  let created = 0, updated = 0, skippedDuplicate = 0, genericGuessed = 0, genericUnmatched = 0;
  const unmatchedNames: string[] = [];

  for (const row of rows) {
    const name = row.foodName.trim();
    if (!name) continue;

    const existing = systemOwnedByNutritionId.get(row.id);

    // 既にこのnutritionIdで自動生成済みなら、新規作成せず更新のみ行う（idempotent）
    if (existing) {
      if (!dryRun) {
        await prisma.ingredient.update({
          where: { id: existing.id },
          data: {
            name,
            nameSearch: name,
            allergens: detectAllergens(name),
          },
        });
      }
      updated++;
      continue;
    }

    // ユーザーが既に同じような食材を手動で共有登録していないか類似チェック
    const nameNorm = normalizeIngredientName(name);
    const dup = existingPublicNorm.find(p => isSimilarName(nameNorm, p.norm));
    if (dup) {
      skippedDuplicate++;
      continue;
    }

    const genericName = guessGenericName(name);
    if (genericName) genericGuessed++; else { genericUnmatched++; unmatchedNames.push(name); }

    if (dryRun) {
      created++;
      continue;
    }

    await prisma.ingredient.create({
      data: {
        userId: null,
        name,
        nameSearch: name,
        genericName,
        genericNameConfirmed: false,
        nutritionId: row.id,
        allergens: detectAllergens(name),
        isPublic: true,
        isApproved: true,
        isActive: true,
        storage: 'ROOM_TEMP',
      },
    });
    created++;
  }

  console.log(`=== ${dryRun ? 'DRY RUN（DBには書き込みません）' : '結果'} ===`);
  console.log(`新規作成: ${created}件`);
  console.log(`更新（既存の自動生成分を最新化）: ${updated}件`);
  console.log(`スキップ（既存の公開食材と似た名前のため重複回避）: ${skippedDuplicate}件`);
  console.log(`一般名を自動推測できた: ${genericGuessed}件 / できなかった（要手動確認）: ${genericUnmatched}件`);
  if (genericUnmatched > 0 && genericUnmatched <= 100) {
    console.log('\n一般名が未設定のまま登録される食材名（各ユーザーが使う際に確認・入力する想定）:');
    unmatchedNames.forEach(n => console.log(`  - ${n}`));
  } else if (genericUnmatched > 100) {
    console.log('（100件超のため一覧は省略）');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
