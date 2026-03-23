'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('無効なリンクです。'); return; }
    fetch(`/api/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) { setStatus('success'); }
        else { setStatus('error'); setMessage(d.error ?? '認証に失敗しました。'); }
      })
      .catch(() => { setStatus('error'); setMessage('通信エラーが発生しました。'); });
  }, [token]);

  if (status === 'loading') return (
    <div className="text-center space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-brand-500 mx-auto" />
      <p className="text-stone-600">認証中...</p>
    </div>
  );

  if (status === 'success') return (
    <div className="text-center space-y-4">
      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
      <h1 className="text-xl font-bold text-stone-800">メール認証が完了しました！</h1>
      <p className="text-stone-500 text-sm">ログインしてFoodLabel Proをお使いください。</p>
      <Link href="/auth/login" className="btn-primary block text-center">ログインする</Link>
    </div>
  );

  return (
    <div className="text-center space-y-4">
      <XCircle className="w-16 h-16 text-red-500 mx-auto" />
      <h1 className="text-xl font-bold text-stone-800">認証に失敗しました</h1>
      <p className="text-stone-500 text-sm">{message}</p>
      <Link href="/auth/register" className="btn-primary block text-center">新規登録はこちら</Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-amber-50 to-cream-200 flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <Suspense fallback={<div className="text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
