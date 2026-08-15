// app/api/admin/ingredient-categories/seed/route.ts
// 全ユーザー共通の基本食材カテゴリ（userId IS NULL）を一括作成する。
// すでに同名の共通カテゴリがある場合はスキップするので、何度実行しても安全（冪等）。
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 専門店では小麦粉の種類（強力粉・準強力粉・薄力粉など）を多く扱うことがあるため、
// 「穀物・粉類」で一括りにせず、小麦粉／米粉／その他粉類（でん粉等）を分けている。
const BASE_CATEGORIES = [
  '小麦粉',
  '米粉',
  'その他粉類・でん粉（片栗粉・コーンスターチ等）',
  'パン酵母・膨張剤（イースト・ベーキングパウダー等）',
  '砂糖・甘味料',
  '油脂類',
  '乳製品',
  '卵',
  '肉類・魚介類（ひき肉・切り身等）',
  '野菜・いも類（生鮮・乾燥・パウダー等）',
  '果物・ナッツ類',
  'チョコレート・カカオ製品',
  'コーヒー・茶葉類（豆・粉末・リーフ等）',
  '酒類・洋酒（製菓用ブランデー等）',
  '調味料',
  '香辛料・スパイス',
  '食品添加物・その他素材',
  'その他',
];

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
  if ((session.user as any).plan !== 'admin') {
    return NextResponse.json({ success: false, error: '管理者権限が必要です' }, { status: 403 });
  }

  try {
    const existing = await prisma.$queryRaw`
      SELECT name FROM ingredient_categories WHERE "userId" IS NULL AND "isActive" = true
    ` as Array<{ name: string }>;
    const existingNames = new Set(existing.map(r => r.name));

    let created = 0;
    for (let i = 0; i < BASE_CATEGORIES.length; i++) {
      const name = BASE_CATEGORIES[i];
      if (existingNames.has(name)) continue;
      await prisma.$executeRaw`
        INSERT INTO ingredient_categories (id, "userId", name, "sortOrder", "isActive", "createdAt")
        VALUES (gen_random_uuid(), NULL, ${name}, ${i}, true, NOW())
      `;
      created++;
    }

    return NextResponse.json({
      success: true,
      data: { created, skipped: BASE_CATEGORIES.length - created, total: BASE_CATEGORIES.length },
      message: created > 0 ? `${created}件の基本カテゴリを作成しました` : 'すでにすべての基本カテゴリが存在します',
    });
  } catch (err) {
    console.error('ingredient-categories seed:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
