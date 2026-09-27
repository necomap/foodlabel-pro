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

  const buffer = await file.arrayBuffer();

  // 2026-09修正（セキュリティ）: file.type はブラウザ（＝アップロードした本人）が申告した
  // 値をそのまま信用しており、実際のファイル内容とは無関係に偽装できてしまう。
  // (1) SVGはファイル内に<script>を埋め込める形式で、直接開かれた場合にスクリプトが
  //     実行されうるため、ロゴ画像としては明示的に拒否する。
  // (2) それ以外は、拡張子や申告MIMEに関わらずファイル先頭のマジックバイトで実際に
  //     PNG/JPEG/GIF/WEBPのいずれかであることを確認し、画像を装った任意ファイルの
  //     アップロード・公開ストレージへの設置（フィッシング等への悪用）を防ぐ。
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return NextResponse.json({ success: false, error: 'SVG形式はセキュリティ上の理由で許可していません。PNG/JPEG等でお試しください' }, { status: 400 });
  }
  const bytes = new Uint8Array(buffer.slice(0, 12));
  const isPng  = bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4E && bytes[3]===0x47;
  const isJpeg = bytes[0]===0xFF && bytes[1]===0xD8 && bytes[2]===0xFF;
  const isGif  = bytes[0]===0x47 && bytes[1]===0x49 && bytes[2]===0x46;
  const isWebp = bytes[0]===0x52 && bytes[1]===0x49 && bytes[2]===0x46 && bytes[3]===0x46
              && bytes[8]===0x57 && bytes[9]===0x45 && bytes[10]===0x42 && bytes[11]===0x50;
  const detectedExt = isPng ? 'png' : isJpeg ? 'jpg' : isGif ? 'gif' : isWebp ? 'webp' : null;
  if (!detectedExt) {
    return NextResponse.json({ success: false, error: '画像ファイルとして認識できませんでした（PNG/JPEG/GIF/WEBPのいずれかをお使いください）' }, { status: 400 });
  }

  const fileName = `${session.user.id}_${Date.now()}.${detectedExt}`;
  // 保存するContent-Typeも申告値ではなく、実際に検出した形式に基づいて確定する
  const verifiedContentType = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[detectedExt];

  // Supabaseストレージにアップロード
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/logos/${fileName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': verifiedContentType,
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
