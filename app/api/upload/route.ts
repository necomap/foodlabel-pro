// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://vpemskdkaxeugjolsutg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ success: false, error: 'ファイルが必要です' }, { status: 400 });

  // ファイルサイズ制限（2MB）
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'ファイルサイズは2MB以下にしてください' }, { status: 400 });
  }

  // 画像ファイルのみ許可
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ success: false, error: '画像ファイルのみアップロードできます' }, { status: 400 });
  }

  const ext = file.name.split('.').pop();
  const fileName = `${session.user.id}_${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();

  // Supabaseストレージにアップロード
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/logos/${fileName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': file.type,
    },
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('Supabase upload error:', err);
    return NextResponse.json({ success: false, error: 'アップロードに失敗しました' }, { status: 500 });
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/logos/${fileName}`;
  return NextResponse.json({ success: true, url: publicUrl });
}
