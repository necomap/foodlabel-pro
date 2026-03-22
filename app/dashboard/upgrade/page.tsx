'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Crown, Check, Loader2, Star, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

const FREE_FEATURES = [
  'レシピ最大10件',
  'シール印刷 月20枚まで',
  '店舗1件',
  'アレルゲン自動判定',
  '栄養成分計算',
  '広告あり',
];

const PREMIUM_FEATURES = [
  'レシピ無制限',
  'シール印刷 無制限',
  '店舗 無制限',
  'Excelエクスポート',
  'アレルゲン自動判定',
  '栄養成分計算',
  '優先サポート',
  '広告なし',
];

export default function UpgradePage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const isPremium = session?.user?.plan === 'premium' || session?.user?.plan === 'admin';

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? 'エラーが発生しました');
      }
    } catch { toast.error('通信エラーが発生しました'); }
    finally   { setLoading(false); }
  };

  const handlePortal = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.url) window.location.href = data.url;
      else toast.error(data.error ?? 'エラーが発生しました');
    } catch { toast.error('通信エラーが発生しました'); }
    finally   { setLoading(false); }
  };

  return (
    <div className="animate-fade-in max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-2">
          <Crown className="w-6 h-6 text-amber-500" />プランを選択
        </h1>
        <p className="text-stone-500 text-sm mt-0.5">FoodLabel Proのプレミアム機能をお試しください</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* フリープラン */}
        <div className={`card space-y-4 ${!isPremium ? 'border-brand-300 bg-brand-50/20' : ''}`}>
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-800">フリープラン</h2>
              {!isPremium && <span className="badge badge-brand text-xs">現在のプラン</span>}
            </div>
            <div className="text-3xl font-bold text-stone-800 mt-2">¥0<span className="text-sm font-normal text-stone-500">/月</span></div>
          </div>
          <ul className="space-y-2">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-stone-600">
                <Check className="w-4 h-4 text-stone-400 flex-shrink-0" />{f}
              </li>
            ))}
          </ul>
        </div>

        {/* プレミアムプラン */}
        <div className={`card space-y-4 border-2 ${isPremium ? 'border-amber-400 bg-amber-50/20' : 'border-amber-400'}`}>
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-800 flex items-center gap-1">
                <Star className="w-5 h-5 text-amber-500" />プレミアム
              </h2>
              {isPremium && <span className="badge bg-amber-100 text-amber-700 text-xs">現在のプラン</span>}
            </div>
            <div className="text-3xl font-bold text-stone-800 mt-2">¥980<span className="text-sm font-normal text-stone-500">/月</span></div>
            <p className="text-xs text-stone-500 mt-1">税込 ・ いつでも解約可能</p>
          </div>
          <ul className="space-y-2">
            {PREMIUM_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-stone-700">
                <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />{f}
              </li>
            ))}
          </ul>
          {isPremium ? (
            <button onClick={handlePortal} disabled={loading}
              className="btn-secondary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              請求・解約の管理
            </button>
          ) : (
            <button onClick={handleUpgrade} disabled={loading}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              プレミアムにアップグレード
            </button>
          )}
        </div>
      </div>

      <div className="card bg-cream-50 text-sm text-stone-500 space-y-1">
        <p>・ クレジットカード決済（Stripe）</p>
        <p>・ 毎月自動更新・いつでも解約可能</p>
        <p>・ 解約後は当月末までご利用いただけます</p>
      </div>
    </div>
  );
}
