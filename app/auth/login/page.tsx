// ============================================================
// app/auth/login/page.tsx - ログインページ
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Cookie, Loader2 } from 'lucide-react';

function LoginPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // URLパラメータからメッセージ表示
  useEffect(() => {
    const message = searchParams.get('message');
    const errMsg  = searchParams.get('error');
    if (message) toast.success(message);
    if (errMsg)  setError(errMsg);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('メールアドレスとパスワードを入力してください'); return; }

    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      email, password, redirect: false,
    });

    setLoading(false);

    if (res?.ok && !res?.error) {
      window.location.replace('/dashboard/recipes');
    } else {
      setError('メールアドレスまたはパスワードが間違っています');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-amber-50 to-cream-200 flex items-center justify-center p-4">
      {/* 背景装飾 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-amber-100/40 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500 rounded-2xl shadow-warm-lg mb-4">
            <Cookie className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-stone-800 font-display">FoodLabel Pro</h1>
          <p className="text-stone-500 text-sm mt-1">成分表示ラベル管理システム</p>
        </div>

        {/* ログインフォーム */}
        <div className="card shadow-warm-lg">
          <h2 className="text-xl font-semibold text-stone-800 mb-6">ログイン</h2>

          {error && (
            <div className="alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="email">メールアドレス</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="field-input"
                placeholder="example@shop.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="field-label" htmlFor="password">パスワード</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="field-input pr-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="text-right mt-1">
                <Link href="/auth/forgot-password" className="text-xs text-brand-600 hover:underline">
                  パスワードを忘れた場合
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />ログイン中...</>
              ) : 'ログイン'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-stone-500">
            アカウントをお持ちでない場合{' '}
            <Link href="/auth/register" className="text-brand-600 font-medium hover:underline">
              新規登録はこちら
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">
          © {new Date().getFullYear()} FoodLabel Pro（Bummeln）
        </p>
        <div className="flex justify-center gap-4 text-xs text-stone-400 mt-2">
          <a href="/terms" className="hover:text-stone-600">利用規約</a>
          <a href="/privacy" className="hover:text-stone-600">プライバシーポリシー</a>
          <a href="/legal" className="hover:text-stone-600">特定商取引法</a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
