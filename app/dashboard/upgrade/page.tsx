'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Crown, Check, Loader2, Star, Zap, Rocket } from 'lucide-react';
import toast from 'react-hot-toast';

const FREE_FEATURES = [
  'レシピ最大10件',
  'ラベル印刷 月20枚まで',
  '店舗1件',
  'アレルゲン自動判定',
  '栄養成分計算',
  '広告あり',
];

const PREMIUM_FEATURES = [
  'レシピ最大100件',
  'ラベル印刷 無制限',
  '店舗最大3件',
  'Excelインポート・エクスポート（月5回まで）',
  'アレルゲン自動判定',
  '栄養成分計算',
  '優先サポート',
  '広告なし',
];

const PRO_FEATURES = [
  'レシピ無制限',
  'ラベル印刷 無制限',
  '店舗最大10件',
  'Excelインポート・エクスポート（回数無制限）',
  '表示法令コンプライアンスチェック（新機能）',
  '複数ラベルデザインテンプレート保存（新機能）',
  'ロット番号トレース検索（新機能）',
  'ECページ用テキスト自動生成（新機能）',
  'アレルゲン自動判定',
  '栄養成分計算',
  '優先サポート',
  '広告なし',
];

type PlanKey = 'premium' | 'pro';

export default function UpgradePage() {
  const { data: session } = useSession();
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const currentPlan = session?.user?.plan ?? 'free';
  const isAdmin   = currentPlan === 'admin';
  const isPremium = currentPlan === 'premium';
  const isPro     = currentPlan === 'pro';
  const hasPaidPlan = isPremium || isPro || isAdmin;

  // 「初月500円」お試し価格の対象かどうか（未ログイン確定前・API未応答の間はfalse扱いにしておき、
  // 対象と分かった時点でだけ案内を出す。過去にサブスクリプションを持ったことがある場合は対象外。
  // このお試し価格はプレミアムのみが対象）
  const [trialEligible, setTrialEligible] = useState(false);
  useEffect(() => {
    if (hasPaidPlan) return;
    fetch('/api/stripe/trial-eligibility').then(r => r.json()).then(d => {
      if (d.success) setTrialEligible(d.eligible);
    }).catch(() => {});
  }, [hasPaidPlan]);

  const handleUpgrade = async (plan: PlanKey) => {
    setLoadingPlan(plan);
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? 'エラーが発生しました');
      }
    } catch { toast.error('通信エラーが発生しました'); }
    finally   { setLoadingPlan(null); }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.url) window.location.href = data.url;
      else toast.error(data.error ?? 'エラーが発生しました');
    } catch { toast.error('通信エラーが発生しました'); }
    finally   { setPortalLoading(false); }
  };

  return (
    <div className="animate-fade-in max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-2">
          <Crown className="w-6 h-6 text-amber-500" />プランを選択
        </h1>
        <p className="text-stone-500 text-sm mt-0.5">FoodLabel Proのプレミアム・プロ機能をお試しください</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {/* フリープラン */}
        <div className={`card space-y-4 ${currentPlan === 'free' ? 'border-brand-300 bg-brand-50/20' : ''}`}>
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-800">フリープラン</h2>
              {currentPlan === 'free' && <span className="badge badge-brand text-xs">現在のプラン</span>}
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
            {trialEligible && !hasPaidPlan ? (
              <>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="badge bg-amber-100 text-amber-700 text-[10px] font-bold">初月お試し</span>
                  <span className="text-3xl font-bold text-stone-800">¥500</span>
                </div>
                <p className="text-xs text-stone-500 mt-1">2ヶ月目以降は¥980/月（税込）・いつでも解約可能</p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-stone-800 mt-2">¥980<span className="text-sm font-normal text-stone-500">/月</span></div>
                <p className="text-xs text-stone-500 mt-1">税込 ・ いつでも解約可能</p>
              </>
            )}
          </div>
          <ul className="space-y-2">
            {PREMIUM_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-stone-700">
                <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />{f}
              </li>
            ))}
          </ul>
          {isPremium ? (
            <button onClick={handlePortal} disabled={portalLoading}
              className="btn-secondary w-full flex items-center justify-center gap-2">
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              請求・解約の管理
            </button>
          ) : isPro || isAdmin ? (
            <button disabled className="w-full py-3 px-4 bg-stone-100 text-stone-400 font-bold rounded-xl cursor-not-allowed">
              プロプランをご利用中です
            </button>
          ) : (
            <button onClick={() => handleUpgrade('premium')} disabled={loadingPlan !== null}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
              {loadingPlan === 'premium' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              {trialEligible ? '初月500円でお試し' : 'プレミアムにアップグレード'}
            </button>
          )}
        </div>

        {/* プロプラン */}
        <div className={`card space-y-4 border-2 ${isPro ? 'border-brand-500 bg-brand-50/20' : 'border-brand-500'} relative`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="badge bg-brand-500 text-white text-xs px-3 py-1 shadow-warm">おすすめ</span>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-800 flex items-center gap-1">
                <Rocket className="w-5 h-5 text-brand-600" />プロ
              </h2>
              {isPro && <span className="badge bg-brand-100 text-brand-700 text-xs">現在のプラン</span>}
            </div>
            <div className="text-3xl font-bold text-stone-800 mt-2">¥6,980<span className="text-sm font-normal text-stone-500">/月</span></div>
            <p className="text-xs text-stone-500 mt-1">税込 ・ いつでも解約可能</p>
          </div>
          <ul className="space-y-2">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-stone-700">
                <Check className="w-4 h-4 text-brand-500 flex-shrink-0" />{f}
              </li>
            ))}
          </ul>
          {isPro ? (
            <button onClick={handlePortal} disabled={portalLoading}
              className="btn-secondary w-full flex items-center justify-center gap-2">
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              請求・解約の管理
            </button>
          ) : isPremium ? (
            <button onClick={handlePortal} disabled={portalLoading}
              className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              プロにアップグレード
            </button>
          ) : isAdmin ? (
            <button disabled className="w-full py-3 px-4 bg-stone-100 text-stone-400 font-bold rounded-xl cursor-not-allowed">
              管理者アカウント
            </button>
          ) : (
            <button onClick={() => handleUpgrade('pro')} disabled={loadingPlan !== null}
              className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
              {loadingPlan === 'pro' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              プロにアップグレード
            </button>
          )}
        </div>
      </div>

      <div className="card bg-cream-50 text-sm text-stone-500 space-y-1">
        <p>・ クレジットカード決済（Stripe）</p>
        <p>・ 毎月自動更新・いつでも解約可能</p>
        <p>・ 解約後は当月末までご利用いただけます</p>
        <p>・ プレミアムからプロへのアップグレードは「請求・解約の管理」から行えます</p>
      </div>
    </div>
  );
}
