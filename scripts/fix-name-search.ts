// ============================================================
// scripts/fix-name-search.ts
// 食材マスタの内部検索用フィールド nameSearch（name + nameKana）を
// 現在の name / nameKana から作り直す。
//
// 背景：
//   食材マスタの検索（/api/ingredients?q=...）は name / nameKana / nameSearch /
//   genericName の4項目を対象に部分一致検索している。name・nameKana・genericName は
//   一覧・編集画面のどちらにも表示されるが、nameSearch だけは画面上どこにも表示されない
//   「内部用の連結フィールド」。
//   本来は name・nameKana を保存するたびに nameSearch も必ず作り直す実装になっているが、
//   何らかの理由（過去バージョンでの一括登録・インポート処理など、現在のAPIを経由しない
//   経路で書き込まれたデータ）で name・nameKana とズレた古い値が残っている食材があると、
//   一覧・編集画面には何も手がかりが見えないのに検索結果だけ無関係な食材がヒットする
//   （例：「卵」で検索すると「たこ」「はったい粉」「まいたけ」等が出てくる）不具合になる。
//
// このスクリプトは全食材の nameSearch を name+nameKana から機械的に再計算し、
// 現在の値とズレているものだけを更新する（表示用データには一切触れない、安全な整合性修復）。
//
// 使い方:
//   npx tsx scripts/fix-name-search.ts --dry-run   ← まず確認（DBは変更しない）
//   npx tsx scripts/fix-name-search.ts             ← 実際に反映
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const all = await prisma.ingredient.findMany({
    select: { id: true, name: true, nameKana: true, nameSearch: true },
  });

  console.log(`食材マスタ 全${all.length}件をチェックします...`);

  const mismatched = all.filter(ing => {
    const expected = `${ing.name}${ing.nameKana ?? ''}`;
    return (ing.nameSearch ?? '') !== expected;
  });

  console.log(`\nnameSearch がズレている食材: ${mismatched.length}件`);
  if (mismatched.length > 0) {
    console.log('\n--- ズレの内容（食材名 / 保存されていた値 → 正しい値）---');
    for (const ing of mismatched.slice(0, 200)) {
      const expected = `${ing.name}${ing.nameKana ?? ''}`;
      console.log(`  ・${ing.name}\n      旧: ${JSON.stringify(ing.nameSearch)}\n      新: ${JSON.stringify(expected)}`);
    }
    if (mismatched.length > 200) {
      console.log(`  ...ほか${mismatched.length - 200}件`);
    }
  }

  if (dryRun) {
    console.log('\n[DRY RUN] 実際の更新は行っていません。内容を確認できたら --dry-run なしで再実行してください。');
    return;
  }

  let updated = 0;
  for (const ing of mismatched) {
    const expected = `${ing.name}${ing.nameKana ?? ''}`;
    await prisma.ingredient.update({
      where: { id: ing.id },
      data: { nameSearch: expected },
    });
    updated++;
  }

  console.log(`\n=== 完了 ===`);
  console.log(`更新した食材: ${updated}件`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
