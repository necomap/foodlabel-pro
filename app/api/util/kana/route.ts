// app/api/util/kana/route.ts
// goo Lab APIが使えない環境向けにローカル変換のみ
import { NextResponse } from 'next/server';

// 簡易ひらがな→カタカナ変換（JavaScriptで実装）
function toKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

export async function POST(request: Request) {
  const { text } = await request.json();
  if (!text) return NextResponse.json({ success: true, kana: '' });
  // テキストをそのまま返す（漢字はそのまま、ひらがなはカタカナに変換）
  const kana = toKatakana(text);
  return NextResponse.json({ success: true, kana, fallback: true });
}
