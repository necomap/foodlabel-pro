// app/api/ingredient-categories/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
  try {
    // ingredient_categories テーブルの列名はPrismaスキーマ通りキャメルケース（要ダブルクォート）。
    // "userId" が NULL のものは全ユーザー共通の基本カテゴリ、値が入っているものは
    // 各ユーザーが個別に追加した自分専用のカテゴリ。両方をまとめて返す（共通カテゴリを先頭に）。
    const cats = await prisma.$queryRaw`
      SELECT id::text, name, "sortOrder", ("userId" IS NULL) as "isShared"
      FROM ingredient_categories
      WHERE ("userId" = ${session.user.id} OR "userId" IS NULL) AND "isActive" = true
      ORDER BY ("userId" IS NULL) DESC, "sortOrder" ASC, name ASC
    `;
    return NextResponse.json({ success: true, data: cats });
  } catch (err) {
    console.error('ingredient-categories GET:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
  const { name, shared } = await request.json();
  if (!name?.trim()) return NextResponse.json({ success: false, error: 'カテゴリ名を入力してください' }, { status: 400 });

  // 「全ユーザー共通の基本カテゴリ」として追加できるのは管理者のみ。
  // 一般ユーザーが shared:true を送ってきても無視して自分専用カテゴリとして作成する。
  const isAdmin    = (session.user as any).plan === 'admin';
  const wantShared = !!shared && isAdmin;

  try {
    const result = await prisma.$queryRaw`
      INSERT INTO ingredient_categories (id, "userId", name, "sortOrder", "isActive", "createdAt")
      VALUES (gen_random_uuid(), ${wantShared ? null : session.user.id}, ${name.trim()}, 0, true, NOW())
      RETURNING id::text, name
    ` as Array<{id:string; name:string}>;
    return NextResponse.json({ success: true, data: result[0] });
  } catch (err) {
    console.error('ingredient-categories POST:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
