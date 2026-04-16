// app/page.tsx - ランディングページ
import Link from 'next/link';
import { Cookie, CheckCircle2, Star, Shield, Printer, ShoppingBasket } from 'lucide-react';

export const metadata = { title: 'FoodLabel Pro - 製菓・製パン店向け食品表示ラベル管理システム' };

export default function RootPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-amber-50 to-cream-200">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
            <Cookie className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="font-bold text-stone-800 font-display">FoodLabel Pro</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/about" className="text-sm text-stone-600 hover:text-stone-800 hidden sm:block">サービス紹介</Link>
          <Link href="/features" className="text-sm text-stone-600 hover:text-stone-800 hidden sm:block">機能一覧</Link>
          <Link href="/blog" className="text-sm text-stone-600 hover:text-stone-800 hidden sm:block">お役立ち情報</Link>
          <Link href="/help" className="text-sm text-stone-600 hover:text-stone-800 hidden sm:block">よくある質問</Link>
          <Link href="/auth/login" className="text-sm text-stone-600 hover:text-stone-800">ログイン</Link>
          <Link href="/auth/register" className="btn-primary text-sm">無料で始める</Link>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="text-center px-4 py-16 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-brand-100 text-brand-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <Star className="w-4 h-4" />食品販売事業者向けSaaS
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-stone-800 font-display leading-tight mb-4">
          食品成分表示ラベルを<br />かんたんに管理
        </h1>
        <p className="text-stone-500 text-lg mb-8 leading-relaxed">
          レシピ登録からアレルゲン判定・栄養成分計算・ラベル印刷まで。<br />
          食品表示法に対応したラベルをすぐに作成できます。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/auth/register" className="btn-primary text-base px-8 py-3">
            無料で始める
          </Link>
          <Link href="/auth/login" className="btn-secondary text-base px-8 py-3">
            ログイン
          </Link>
        </div>
      </section>

      {/* 機能 */}
      <section className="px-4 py-12 max-w-4xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { icon: ShoppingBasket, title: 'アレルゲン自動判定', desc: '食材を選ぶだけで特定原材料8品目・20品目を自動で判定します' },
            { icon: Shield, title: '栄養成分計算', desc: '文科省の食品成分表データを元に栄養成分を自動計算します' },
            { icon: Printer, title: 'ラベル印刷', desc: 'ラベルプリンターやA4用紙に対応した食品表示ラベルを印刷できます' },
          ].map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card text-center">
                <div className="w-12 h-12 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="font-semibold text-stone-800 mb-2">{f.title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 使い方 */}
      <section className="px-4 py-12 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-stone-800 font-display mb-8">かんたん3ステップ</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { step: '1', title: '食材を登録', desc: '使用する食材をマスタに登録。文科省の成分表データから栄養成分を自動取得できます。' },
            { step: '2', title: 'レシピを作成', desc: '食材と分量を入力するだけ。アレルゲンと栄養成分が自動で計算されます。' },
            { step: '3', title: 'ラベルを印刷', desc: '食品表示法に対応したラベルをその場で印刷。ラベルプリンターとA4用紙に対応。' },
          ].map(s => (
            <div key={s.step} className="card text-center">
              <div className="w-10 h-10 bg-brand-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                {s.step}
              </div>
              <h3 className="font-semibold text-stone-800 mb-2">{s.title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 料金 */}
      <section className="px-4 py-12 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-stone-800 font-display mb-8">シンプルな料金プラン</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="card space-y-4">
            <h3 className="font-bold text-stone-800">フリープラン</h3>
            <div className="text-3xl font-bold text-stone-800">¥0<span className="text-sm font-normal text-stone-500">/月</span></div>
            <ul className="space-y-2 text-sm text-stone-600">
              {['レシピ最大10件', 'ラベル印刷月20枚', '店舗1件', 'アレルゲン判定', '栄養成分計算'].map(f => (
                <li key={f} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-stone-400" />{f}</li>
              ))}
            </ul>
            <Link href="/auth/register" className="btn-secondary block text-center text-sm">無料で始める</Link>
          </div>
          <div className="card space-y-4 border-2 border-amber-400">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-800">プレミアムプラン</h3>
              <span className="badge bg-amber-100 text-amber-700 text-xs">おすすめ</span>
            </div>
            <div className="text-3xl font-bold text-stone-800">¥980<span className="text-sm font-normal text-stone-500">/月</span></div>
            <ul className="space-y-2 text-sm text-stone-600">
              {['レシピ無制限', 'ラベル印刷無制限', '店舗無制限', 'Excelエクスポート', '広告なし', '優先サポート'].map(f => (
                <li key={f} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-500" />{f}</li>
              ))}
            </ul>
            <Link href="/auth/register" className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors block text-center text-sm">
              プレミアムで始める
            </Link>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="text-center py-8 text-xs text-stone-400 space-y-2">
      <p>お問い合わせ：info.lucke@gmail.com</p>
      <p>返金ポリシー：解約後は当月末まで利用可能。原則返金不可。</p>
      <p>サービス提供：決済完了後すぐにご利用いただけます。</p>
        <p>© 2026 FoodLabel Pro（Bummeln）</p>
        <div className="flex justify-center gap-4">
          <Link href="/about" className="hover:text-stone-600">サービス紹介</Link>
          <Link href="/features" className="hover:text-stone-600">機能一覧</Link>
          <Link href="/blog" className="hover:text-stone-600">お役立ち情報</Link>
          <Link href="/help" className="hover:text-stone-600">よくある質問</Link>
          <Link href="/terms" className="hover:text-stone-600">利用規約</Link>
          <Link href="/privacy" className="hover:text-stone-600">プライバシーポリシー</Link>
          <Link href="/legal" className="hover:text-stone-600">特定商取引法</Link>
        </div>
      </footer>
    </div>
  );
}
