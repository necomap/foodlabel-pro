// app/api/contact/route.ts - 問い合わせ送信API
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const { category, subject, body } = await request.json();
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ success: false, error: '件名と内容を入力してください' }, { status: 400 });
  }

  // admin_logsテーブルに保存（管理者が確認できる）
  await prisma.adminLog.create({
    data: {
      adminId:    session.user.id,
      action:     'USER_CONTACT',
      targetType: 'contact',
      details: {
        category,
        subject:   subject.trim(),
        body:      body.trim(),
        userEmail: session.user.email,
        userName:  session.user.name,
        sentAt:    new Date().toISOString(),
      },
    },
  });

  return NextResponse.json({ success: true, message: '送信しました' });
}
