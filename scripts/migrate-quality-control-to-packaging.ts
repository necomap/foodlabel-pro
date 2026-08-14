// ============================================================
// scripts/migrate-quality-control-to-packaging.ts
// 既存レシピの「品質管理」欄（脱酸素剤など、実際は資材メモだったもの）を
// 新設した「使用資材メモ（packagingNotes）」に移し、品質管理欄を空にする。
// 空にした品質管理欄は、今後「お客様へのお願い・注意事項」として使う。
//
// 使い方:
//   npx tsx scripts/migrate-quality-control-to-packaging.ts --dry-run
//   npx tsx scripts/migrate-quality-control-to-packaging.ts
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function splitToItems(text: string): string[] {
  return text
    .split(/[、,・\/\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const email = process.env.IMPORT_USER_EMAIL || 'putin3martin3@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { console.error(`ユーザーが見つかりません: ${email}`); process.exit(1); }

  const targets = await prisma.recipe.findMany({
    where: { userId: user.id, qualityControl: { not: null } },
    select: { id: true, name: true, qualityControl: true },
  });

  console.log(`対象ユーザー: ${email}`);
  console.log(`品質管理欄が入っているレシピ: ${targets.length}件`);

  for (const r of targets) {
    const items = splitToItems(r.qualityControl!);
    if (dryRun) {
      console.log(`[preview] ${r.name}: 「${r.qualityControl}」 → 使用資材メモ ${JSON.stringify(items)} / 品質管理欄は空に`);
    } else {
      await prisma.recipe.update({
        where: { id: r.id },
        data: { packagingNotes: items, qualityControl: null },
      });
    }
  }

  console.log(`\n=== ${dryRun ? 'DRY RUN' : '結果'} ===`);
  console.log(`${dryRun ? '移行予定' : '移行完了'}: ${targets.length}件`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
