// app/api/ingredient-categories/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
  try {
    // ingredient_categories はスネークケース (手動作成)
    const cats = await prisma.$queryRaw`
      SELECT id::text, name, sort_order as "sortOrder"
      FROM ingredient_categories
      WHERE user_id = ${session.user.id} AND is_active = true
      ORDER BY sort_order ASC, name ASC
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
  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ success: false, error: 'カテゴリ名を入力してください' }, { status: 400 });
  try {
    const result = await prisma.$queryRaw`
      INSERT INTO ingredient_categories (id, user_id, name, sort_order, is_active, created_at)
      VALUES (gen_random_uuid(), ${session.user.id}, ${name.trim()}, 0, true, NOW())
      RETURNING id::text, name
    ` as Array<{id:string; name:string}>;
    return NextResponse.json({ success: true, data: result[0] });
  } catch (err) {
    console.error('ingredient-categories POST:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
