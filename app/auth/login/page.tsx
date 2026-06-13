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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-stone-500">
                または
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              signIn('google', { callbackUrl: '/dashboard/recipes' });
            }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors font-medium text-stone-700 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Googleでログイン
          </button>

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
