'use client';
// components/ObfuscatedEmail.tsx
// 迷惑メール対策用のメールアドレス表示コンポーネント。
// 生のメールアドレス文字列をHTML/JSソースにそのまま含めると、単純な正規表現で
// アドレスを収集するスパムボットに拾われやすい。base64でエンコードした状態で
// ソースに埋め込み、実際のアドレス文字列への復元はブラウザ上（クライアントサイド）で
// 行うことで、そうした簡易的な収集ボットからの被害を減らす。
// （JavaScriptを実行する高度なボットには効果が無いが、被害の大半を占める単純な
// スキャナーには有効なため、一般的な対策として採用）
import { useEffect, useState } from 'react';

interface ObfuscatedEmailProps {
  /** メールアドレスをbase64エンコードした文字列 */
  b64: string;
  className?: string;
}

export default function ObfuscatedEmail({ b64, className = '' }: ObfuscatedEmailProps) {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    try {
      setAddress(atob(b64));
    } catch {
      setAddress(null);
    }
  }, [b64]);

  if (!address) {
    // JS実行前・失敗時は何も表示しない（ソース上にもアドレス文字列は出さない）
    return <span className={className}>&nbsp;</span>;
  }

  return (
    <a href={`mailto:${address}`} className={className}>
      {address}
    </a>
  );
}
