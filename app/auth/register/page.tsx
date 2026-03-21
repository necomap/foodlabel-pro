// ============================================================
// app/auth/register/page.tsx - 新規登録ページ
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Cookie, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router  = useRouter();
  const [step,  setStep]  = useState<'form' | 'done'>('form');
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    email:          '',
    password:       '',
    confirmPassword: '',
    companyName:    '',
    representative: '',
    postalCode:     '',
    address:        '',
    phone:          '',
  });

  const update = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.email)          errs.email          = 'メールアドレスを入力してください';
    if (!form.password)       errs.password       = 'パスワードを入力してください';
    else if (form.password.length < 8) errs.password = 'パスワードは8文字以上で入力してください';
    else if (!/[A-Za-z]/.test(form.password)) errs.password = 'パスワードには英字を含めてください';
    else if (!/[0-9]/.test(form.password))    errs.password = 'パスワードには数字を含めてください';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'パスワードが一致しません';
    if (!form.companyName) errs.companyName = '店舗名（社名）を入力してください';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) {
        setErrors({ form: data.error });
      } else {
        setStep('done');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-100 via-amber-50 to-cream-200 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card shadow-warm-lg text-center py-10">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-stone-800 mb-3">登録完了！</h2>
            <p className="text-stone-600 mb-2">
              <span className="font-medium text-brand-600">{form.email}</span> に確認メールをお送りしました。
            </p>
            <p className="text-stone-500 text-sm mb-8">
              メール内のリンクをクリックして、メールアドレスの認証を完了してください。
            </p>
            <Link href="/auth/login" className="btn-primary inline-block">
              ログインページへ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-amber-50 to-cream-200 py-8 px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-amber-100/40 blur-3xl" />
      </div>

      <div className="w-full max-w-lg mx-auto relative">
        {/* ロゴ */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-500 rounded-2xl shadow-warm-lg mb-3">
            <Cookie className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold text-stone-800 font-display">FoodLabel Pro</h1>
          <p className="text-stone-500 text-sm">新規アカウント登録</p>
        </div>

        <div className="card shadow-warm-lg">
          {errors.form && <div className="alert-error mb-4"><span>{errors.form}</span></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* アカウント情報 */}
            <div>
              <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3">
                アカウント情報
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="field-label" htmlFor="email">メールアドレス <span className="text-red-500">*</span></label>
                  <input id="email" type="email" value={form.email} onChange={e => update('email', e.target.value)}
                    className="field-input" placeholder="shop@example.com" />
                  {errors.email && <p className="field-error">{errors.email}</p>}
                </div>

                <div>
                  <label className="field-label" htmlFor="password">パスワード <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input id="password" type={showPw ? 'text' : 'password'} value={form.password}
                      onChange={e => update('password', e.target.value)}
                      className="field-input pr-12" placeholder="8文字以上（英字+数字）" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                      {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="field-error">{errors.password}</p>}
                </div>

                <div>
                  <label className="field-label" htmlFor="confirm">パスワード（確認） <span className="text-red-500">*</span></label>
                  <input id="confirm" type="password" value={form.confirmPassword}
                    onChange={e => update('confirmPassword', e.target.value)}
                    className="field-input" placeholder="もう一度入力" />
                  {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
                </div>
              </div>
            </div>

            <div className="border-t border-cream-200" />

            {/* 店舗情報 */}
            <div>
              <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3">
                店舗・事業者情報
              </h3>
              <p className="text-xs text-stone-500 mb-3">
                ※ シールの製造者欄に表示される情報です。後から変更できます。
              </p>
              <div className="space-y-3">
                <div>
                  <label className="field-label" htmlFor="companyName">店舗名・社名 <span className="text-red-500">*</span></label>
                  <input id="companyName" type="text" value={form.companyName} onChange={e => update('companyName', e.target.value)}
                    className="field-input" placeholder="例: ○○ベーカリー" />
                  {errors.companyName && <p className="field-error">{errors.companyName}</p>}
                </div>

                <div>
                  <label className="field-label" htmlFor="representative">代表者名</label>
                  <input id="representative" type="text" value={form.representative} onChange={e => update('representative', e.target.value)}
                    className="field-input" placeholder="例: 田中 太郎" />
                  <p className="field-hint">個人事業主の場合は法的に表示が必要な場合があります</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label" htmlFor="postal">郵便番号</label>
                    <input id="postal" type="text" value={form.postalCode} onChange={e => update('postalCode', e.target.value)}
                      className="field-input" placeholder="000-0000" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="phone">電話番号</label>
                    <input id="phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                      className="field-input" placeholder="000-0000-0000" />
                  </div>
                </div>

                <div>
                  <label className="field-label" htmlFor="address">住所</label>
                  <input id="address" type="text" value={form.address} onChange={e => update('address', e.target.value)}
                    className="field-input" placeholder="例: 東京都渋谷区○○1-2-3" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />登録中...</> : 'アカウントを作成する'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-stone-500">
            すでにアカウントをお持ちの場合{' '}
            <Link href="/auth/login" className="text-brand-600 font-medium hover:underline">
              ログインへ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
