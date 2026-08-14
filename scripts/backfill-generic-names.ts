// ============================================================
// scripts/backfill-generic-names.ts
// 食材マスタの「一般名」を、名前の末尾一致で自動推測して仮入力する
// （誤判定を避けるため、名前が既知の一般名で「終わる」場合のみ反映）
// 反映したものは genericNameConfirmed=false（要確認）のまま。
//
// 使い方:
//   npx tsx scripts/backfill-generic-names.ts --dry-run
//   npx tsx scripts/backfill-generic-names.ts
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 末尾一致で判定する一般名の候補（長い語を先に判定＝より具体的な語を優先）
const GENERIC_TERMS = [
  '無塩バター', '発酵バター', 'バター',
  '生クリーム', 'ホイップクリーム', 'クリームチーズ', 'マスカルポーネ',
  'クーベルチュールチョコレート', 'クーベルチュール', 'ホワイトチョコレート', 'チョコレート',
  '薄力粉', '強力粉', '準強力粉', '中力粉', '全粒粉', 'アーモンドプードル', '米粉', 'ライ麦粉',
  'グラニュー糖', '上白糖', '三温糖', '粉糖', '黒糖', '砂糖',
  '全卵', '卵黄', '卵白', '乾燥卵白',
  '牛乳', '脱脂粉乳', 'スキムミルク', 'バターミルクパウダー',
  'ドライイースト', 'インスタントドライイースト',
  'ベーキングパウダー', '重曹',
  '食塩', '岩塩', '塩',
  'ゼラチン', '板ゼラチン', '粉ゼラチン',
  'アーモンド', 'くるみ', 'カシューナッツ', 'ヘーゼルナッツ', 'ピスタチオ',
  'バニラビーンズ', 'バニラエッセンス', 'バニラオイル',
  'レモン果汁', 'レモンピール', 'レモン',
  'オレンジピール', 'オレンジ',
  'はちみつ', '水あめ', 'メープルシロップ',
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const targets = await prisma.ingredient.findMany({
    where: {
      OR: [{ genericName: null }, { genericName: '' }],
    },
    select: { id: true, name: true, userId: true },
  });

  console.log(`一般名が未設定の食材: ${targets.length}件`);

  let matched = 0, unmatched = 0;
  const unmatchedNames: string[] = [];

  for (const ing of targets) {
    const name = ing.name.trim();
    const hit = GENERIC_TERMS.find(term => name.endsWith(term));

    if (!hit) { unmatched++; unmatchedNames.push(name); continue; }

    if (dryRun) {
      console.log(`[preview] ${name} → ${hit}`);
    } else {
      await prisma.ingredient.update({
        where: { id: ing.id },
        data: { genericName: hit, genericNameConfirmed: false },
      });
    }
    matched++;
  }

  console.log(`\n=== ${dryRun ? 'DRY RUN' : '結果'} ===`);
  console.log(`自動反映（要確認フラグ付き）: ${matched}件`);
  console.log(`一致なし（手動入力が必要）: ${unmatched}件`);
  if (unmatched > 0 && unmatched <= 100) {
    console.log('\n一致しなかった食材名:');
    unmatchedNames.forEach(n => console.log(`  - ${n}`));
  } else if (unmatched > 100) {
    console.log('（100件超のため一覧は省略。食材マスタ画面で確認してください）');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
