// app/auth/reset-password/page.tsx - パスワード再設定
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Cookie, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token)             { setError('無効なリセットリンクです'); return; }
    if (password.length < 8){ setError('パスワードは8文字以上で入力してください'); return; }
    if (password !== confirm){ setError('パスワードが一致しません'); return; }

    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        setTimeout(() => router.push('/auth/login?message=パスワードを再設定しました'), 2000);
      } else {
        setError(data.error ?? 'リセットに失敗しました');
      }
    } catch { toast.error('通信エラーが発生しました'); }
    finally   { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-amber-50 to-cream-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-500 rounded-2xl shadow-warm-lg mb-3">
            <Cookie className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold text-stone-800 font-display">新しいパスワードを設定</h1>
        </div>

        {done ? (
          <div className="card text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-medium text-stone-800">パスワードを再設定しました</p>
            <p className="text-stone-500 text-sm mt-1">ログインページへ移動します...</p>
          </div>
        ) : (
          <div className="card">
            {error && <div className="alert-error mb-4"><span>{error}</span></div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="field-label">新しいパスワード</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="field-input pr-12" placeholder="8文字以上（英字+数字）" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="field-label">確認</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  className="field-input" placeholder="もう一度入力" />
              </div>
              <button type="submit" disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />設定中...</> : 'パスワードを設定する'}
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
