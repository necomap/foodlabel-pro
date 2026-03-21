// ============================================================
// app/auth/forgot-password/page.tsx - パスワードリセット申請
// ============================================================
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cookie, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('メールアドレスを入力してください'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const data = await res.json();
      // セキュリティ上、成功・失敗問わず同じメッセージを表示
      setDone(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-amber-50 to-cream-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-500 rounded-2xl shadow-warm-lg mb-3">
            <Cookie className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold text-stone-800 font-display">パスワードのリセット</h1>
        </div>

        {done ? (
          <div className="card text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="font-bold text-stone-800 mb-2">メールを送信しました</h2>
            <p className="text-stone-500 text-sm">
              {email} にパスワードリセット用のリンクをお送りしました。
              メールが届かない場合は迷惑メールフォルダをご確認ください。
            </p>
            <Link href="/auth/login" className="btn-primary inline-block mt-5">ログインに戻る</Link>
          </div>
        ) : (
          <div className="card">
            <p className="text-stone-600 text-sm mb-5">
              登録したメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="field-label">メールアドレス</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="field-input" placeholder="example@shop.com" required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />送信中...</> : 'リセットメールを送信'}
              </button>
            </form>
            <div className="mt-4 text-center">
              <Link href="/auth/login" className="text-sm text-brand-600 hover:underline">ログインに戻る</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
