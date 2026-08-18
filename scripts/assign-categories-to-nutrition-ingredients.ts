// ============================================================
// scripts/assign-categories-to-nutrition-ingredients.ts
//
// 食品成分表由来の共有食材（Ingredient.userId: null かつ nutritionId が
// 設定されているもの＝ scripts/seed-shared-ingredients-from-nutrition.ts で
// 生成された食材）に、食品成分表の食品群コード（NutritionData.foodGroup）を
// 手がかりにして ingredientCategoryId を一括で割り当てるスクリプト。
//
// 背景: seed-shared-ingredients-from-nutrition.ts で作成した共有食材は
// カテゴリ未設定のまま。食材マスタ一覧で全部「カテゴリなし」に見えてしまうため、
// あらかじめ食品群コード→既存の共通カテゴリ（IngredientCategory.userId: null）の
// 対応表を使って割り当てる。
//
// 注意（重要）: ingredientCategoryId は、このプロジェクトの Prisma Client 生成の
// 都合で通常の型付きアクセスから正しく読めないことが判明している
// （HANDOFF_20260818_2.md「不具合B」参照）。そのため、このスクリプトは
// 読み取り・書き込みの両方を raw SQL（$queryRaw / $executeRaw）で行う。
// 通常の `prisma.ingredient.update({ data: { ingredientCategoryId } })` は使わない。
//
// 事前条件:
//   - 対象の共通カテゴリ（下記 FOOD_GROUP_CATEGORY_NAMES に出てくる名前）が
//     ingredient_categories テーブルに userId: null, isActive: true として
//     存在していること。まだの場合は管理画面(/admin)の「全ユーザー共通の基本
//     カテゴリを追加」ボタン（app/api/admin/ingredient-categories/seed）を
//     先に実行しておくこと。
//
// 使い方:
//   npx tsx scripts/assign-categories-to-nutrition-ingredients.ts --dry-run
//     … 内容確認のみ（DBには書き込まない）
//   npx tsx scripts/assign-categories-to-nutrition-ingredients.ts
//     … 本実行。ただし「既に ingredientCategoryId が設定済み」の食材は
//       スキップする（誰かが手動で設定した値を上書きしないため）
//   npx tsx scripts/assign-categories-to-nutrition-ingredients.ts --force
//     … 既に設定済みのものも含めて、対象食材全件をこのスクリプトの判定結果で
//       上書きする（再実行して判定ロジックを直した後の再割り当て用）
//
// 再実行しても安全（idempotent）。対象は常に
//   userId IS NULL AND nutritionId IS NOT NULL AND isActive = true
// の食材のみで、ユーザーが自分で登録した食材やコミュニティ共有食材（ユーザー申請分）
// には一切影響しない。
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ------------------------------------------------------------
// 食品群コード → 割り当てたい共通カテゴリ名（デフォルト）。
// 名前は app/api/admin/ingredient-categories/seed/route.ts の
// BASE_CATEGORIES と完全に一致させること（一致しないと後述のチェックで
// エラーになり、どのカテゴリが存在しないか一覧表示される）。
//
// 一部の食品群（04 豆類, 08 きのこ類, 15 菓子類の非チョコ, 18 調理済み流通
// 食品類）は既存の共通カテゴリにうまく対応するものが無いため「その他」に
// 割り当てる。ユーザーの方針で「その他が増えてきたら」個別カテゴリを
// 追加してもらう想定（現時点では急ぎ対応不要）。
// ------------------------------------------------------------
const OTHER = 'その他';
const FOOD_GROUP_LABELS: Record<string, string> = {
  '01': '穀類',
  '02': 'いも及びでん粉類',
  '03': '砂糖及び甘味類',
  '04': '豆類',
  '05': '種実類',
  '06': '野菜類',
  '07': '果実類',
  '08': 'きのこ類',
  '10': '魚介類',
  '11': '肉類',
  '12': '卵類',
  '13': '乳類',
  '14': '油脂類',
  '15': '菓子類',
  '16': 'し好飲料類',
  '17': '調味料及び香辛料類',
  '18': '調理済み流通食品類',
};

// 名前の部分一致で、食品群コードだけでは分けきれないカテゴリをさらに細分類する。
// 各食品群コードごとに、上から順に最初にマッチしたものを採用。どれにもマッチ
// しなければ末尾の defaultCategory を使う。
const RULES: Record<string, { pattern: RegExp; category: string }[]> & Record<string, any> = {} as any;

function resolveCategory(name: string, foodGroup: string): string {
  switch (foodGroup) {
    case '01': // 穀類：小麦粉・米粉・でん粉・その他（パン粉等）に細分類
      if (/コーンスターチ|片栗粉|でん粉|澱粉|タピオカ/.test(name)) return 'その他粉類・でん粉（片栗粉・コーンスターチ等）';
      if (/米粉/.test(name)) return '米粉';
      if (/小麦粉|薄力粉|強力粉|中力粉|準強力粉|全粒粉|デュラム/.test(name)) return '小麦粉';
      return 'その他粉類・でん粉（片栗粉・コーンスターチ等）'; // パン粉・オートミール等の受け皿
    case '02': // いも及びでん粉類：いも本体は野菜・いも類、でん粉はその他粉類へ
      if (/いも|イモ|ポテト/.test(name)) return '野菜・いも類（生鮮・乾燥・パウダー等）';
      return 'その他粉類・でん粉（片栗粉・コーンスターチ等）';
    case '03':
      return '砂糖・甘味料';
    case '04': // 豆類：あんこ・きなこ等。既存カテゴリに適合するものが無いためその他
      return OTHER;
    case '05': // 種実類：アーモンド・くるみ・ごま等
      return '果物・ナッツ類';
    case '06':
      return '野菜・いも類（生鮮・乾燥・パウダー等）';
    case '07':
      return '果物・ナッツ類';
    case '08': // きのこ類：適合する既存カテゴリが無いためその他
      return OTHER;
    case '10':
    case '11':
      return '肉類・魚介類（ひき肉・切り身等）';
    case '12':
      return '卵';
    case '13':
      return '乳製品';
    case '14':
      return '油脂類';
    case '15': // 菓子類：チョコ系だけ分離、それ以外はその他
      if (/チョコ|カカオ/.test(name)) return 'チョコレート・カカオ製品';
      return OTHER;
    case '16':
      return 'コーヒー・茶葉類（豆・粉末・リーフ等）';
    case '17': // 調味料及び香辛料類：香辛料っぽい語だけ分離
      if (/こしょう|コショウ|胡椒|カレー粉|スパイス|シナモン|ナツメグ|クローブ|唐辛子|山椒|わさび|からし|ジンジャーパウダー/.test(name)) {
        return '香辛料・スパイス';
      }
      return '調味料';
    case '18':
      return OTHER;
    default:
      return OTHER;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  // 1. 現在存在する共通カテゴリ（userId: null, isActive: true）を取得し、名前→idのマップを作る。
  //    raw SQLで読む（ingredientCategoryIdと違い、IngredientCategory.id/nameは通常の
  //    Prisma型で問題なく読めるはずだが、他の箇所との統一のためここもraw SQLに揃える）。
  const categories = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM ingredient_categories WHERE "userId" IS NULL AND "isActive" = true
  `;
  const categoryIdByName = new Map(categories.map(c => [c.name, c.id]));

  // このスクリプトが使う可能性のあるカテゴリ名が全部揃っているか事前チェック
  const neededNames = new Set<string>();
  for (const code of Object.keys(FOOD_GROUP_LABELS)) {
    // resolveCategoryは名前依存なので全パターンを機械的に洗い出せないが、
    // コード単位のデフォルト・分岐先を代表的な入力で列挙してチェックする
    neededNames.add(resolveCategory('', code));
  }
  neededNames.add('小麦粉');
  neededNames.add('米粉');
  neededNames.add('その他粉類・でん粉（片栗粉・コーンスターチ等）');
  neededNames.add('野菜・いも類（生鮮・乾燥・パウダー等）');
  neededNames.add('チョコレート・カカオ製品');
  neededNames.add('香辛料・スパイス');
  neededNames.add(OTHER);

  // tsconfigのtargetがes2015未満のため、Setを直接スプレッド(...)すると
  // 「--downlevelIterationフラグが必要」というビルドエラーになる。Array.from()なら問題ない。
  const missing = Array.from(neededNames).filter(n => !categoryIdByName.has(n));
  if (missing.length > 0) {
    console.error('⚠ 以下の共通カテゴリがDBに存在しません（先に管理画面の「全ユーザー共通の基本カテゴリを追加」を実行してください）:');
    missing.forEach(n => console.error(`  - ${n}`));
    process.exit(1);
  }

  // 2. 対象食材を取得: システム所有（userId: null）かつ食品成分表リンク済み（nutritionId not null）
  //    かつ有効（isActive: true）。ingredientCategoryIdとfoodGroupは両方raw SQLで読む。
  const rows = await prisma.$queryRaw<{ id: string; name: string; ingredientCategoryId: string | null; foodGroup: string | null }[]>`
    SELECT i.id, i.name, i."ingredientCategoryId", n."foodGroup"
    FROM ingredients i
    JOIN nutrition_data n ON i."nutritionId" = n.id
    WHERE i."userId" IS NULL AND i."nutritionId" IS NOT NULL AND i."isActive" = true
  `;

  console.log(`対象食材（食品成分表由来の共有食材）: ${rows.length}件\n`);

  let assigned = 0, skippedAlreadySet = 0, skippedUnknownFoodGroup = 0;
  const perCategoryCount = new Map<string, number>();
  const unknownFoodGroups = new Map<string, number>();

  for (const row of rows) {
    if (!row.foodGroup || !(row.foodGroup in FOOD_GROUP_LABELS)) {
      skippedUnknownFoodGroup++;
      const key = row.foodGroup ?? '(null)';
      unknownFoodGroups.set(key, (unknownFoodGroups.get(key) ?? 0) + 1);
      continue;
    }

    if (row.ingredientCategoryId && !force) {
      skippedAlreadySet++;
      continue;
    }

    const categoryName = resolveCategory(row.name, row.foodGroup);
    const categoryId = categoryIdByName.get(categoryName)!; // 事前チェック済みなので必ず存在する

    perCategoryCount.set(categoryName, (perCategoryCount.get(categoryName) ?? 0) + 1);

    if (!dryRun) {
      // id / ingredientCategoryId はPrisma上String（実体はPostgresのtext型）なので、::uuidキャスト
      // すると「operator does not exist: text = uuid」で失敗する。素の文字列のまま渡す。
      await prisma.$executeRaw`
        UPDATE ingredients SET "ingredientCategoryId" = ${categoryId} WHERE id = ${row.id}
      `;
    }
    assigned++;
  }

  console.log(`=== ${dryRun ? 'DRY RUN（DBには書き込みません）' : '結果'} ===`);
  console.log(`割り当て${dryRun ? '対象' : '完了'}: ${assigned}件`);
  console.log(`スキップ（既にカテゴリ設定済み。--forceで上書き可能）: ${skippedAlreadySet}件`);
  console.log(`スキップ（対象外の食品群コード、TARGET_FOOD_GROUPS外のデータが混入している可能性）: ${skippedUnknownFoodGroup}件`);
  if (unknownFoodGroups.size > 0) {
    console.log('  内訳:');
    Array.from(unknownFoodGroups.entries()).forEach(([code, count]) => {
      console.log(`    ${code}: ${count}件`);
    });
  }
  console.log('\nカテゴリ別の割り当て件数:');
  Array.from(perCategoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => console.log(`  ${name}: ${count}件`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
