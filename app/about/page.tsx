import Link from 'next/link';
import { Cookie, Shield, Printer, ShoppingBasket, Star, CheckCircle2, Users } from 'lucide-react';

export const metadata = {
  title: 'FoodLabel Proについて | 食品表示ラベル管理システム',
  description: '製菓・製パン・総菜・弁当など食品を販売するすべての事業者向けの食品成分表示ラベル管理システムです。',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-amber-50 to-cream-200">
      <header className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
            <Cookie className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <span className="font-bold text-stone-800 font-display">FoodLabel Pro</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/help" className="text-sm text-stone-600 hover:text-stone-800 hidden sm:block">よくある質問</Link>
          <Link href="/auth/login" className="text-sm text-stone-600 hover:text-stone-800">ログイン</Link>
          <Link href="/auth/register" className="btn-primary text-sm">無料で始める</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-16">

        {/* ヒーロー */}
        <section className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-stone-800 font-display">FoodLabel Proとは</h1>
          <p className="text-stone-600 text-lg leading-relaxed max-w-2xl mx-auto">
            食品を販売するすべての事業者のために開発された、食品成分表示ラベル管理システムです。
            食品表示法に対応したラベルを、かんたんな操作で作成・印刷できます。
          </p>
        </section>

        {/* 対象ユーザー */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-stone-800 font-display text-center">こんな事業者におすすめ</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: '🥐', title: '製菓・製パン店', desc: 'ケーキ、クッキー、パンなどのラベル管理に' },
              { icon: '🍱', title: '惣菜・弁当店', desc: '日替わりメニューのラベルを素早く作成' },
              { icon: '🏭', title: '食品加工業者', desc: '複数商品のラベルを一括管理' },
              { icon: '🛒', title: '道の駅・農産物直売所', desc: '手作り加工品のラベル表示に対応' },
              { icon: '🍰', title: 'ネットショップ', desc: 'オンライン販売の食品表示に対応' },
              { icon: '🍜', title: 'レストラン・カフェ', desc: 'テイクアウト商品のラベル作成に' },
            ].map(item => (
              <div key={item.title} className="card flex items-start gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <h3 className="font-semibold text-stone-800">{item.title}</h3>
                  <p className="text-stone-500 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* なぜFoodLabel Pro */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-stone-800 font-display text-center">FoodLabel Proが選ばれる理由</h2>
          <div className="space-y-4">
            {[
              { icon: Shield, title: '食品表示法に対応', desc: '特定原材料8品目・推奨20品目のアレルゲン表示、栄養成分5項目（熱量・たんぱく質・脂質・炭水化物・食塩相当量）の表示に対応しています。' },
              { icon: ShoppingBasket, title: '文科省の成分表データを使用', desc: '日本食品標準成分表2020年版（八訂）のデータを搭載。食材を選ぶだけで栄養成分が自動計算されます。' },
              { icon: Printer, title: 'さまざまなプリンターに対応', desc: 'ラベルプリンター（幅・高さmm単位で設定）とA4用紙の複数面付け印刷に対応。お手持ちのプリンターですぐに印刷できます。' },
              { icon: Star, title: 'シンプルで使いやすい', desc: 'ITの知識がなくても直感的に操作できます。食材の登録からラベル印刷まで、最短5分で完結します。' },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="card flex items-start gap-4">
                  <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-800 mb-1">{item.title}</h3>
                    <p className="text-stone-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 運営者情報 */}
        <section className="card space-y-4">
          <h2 className="text-xl font-bold text-stone-800 font-display flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-500" />運営者情報
          </h2>
          <div className="text-sm text-stone-600 space-y-2">
            <p><span className="font-medium">運営者：</span>Bummeln（個人事業主）</p>
            <p><span className="font-medium">所在地：</span>愛知県名古屋市瑞穂区竹田町</p>
            <p><span className="font-medium">お問い合わせ：</span><a href="mailto:info.lucke@gmail.com" className="text-brand-600 hover:underline">info.lucke@gmail.com</a></p>
            <p className="text-stone-400 text-xs mt-2">
              FoodLabel Proは、食品販売事業者の食品表示業務の効率化を支援するために開発されたSaaSサービスです。
              食品表示法・健康増進法等の関連法規に基づく表示の最終確認は、事業者様ご自身の責任において行っていただきますようお願いいたします。
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center space-y-4">
          <h2 className="text-xl font-bold text-stone-800">まずは無料でお試しください</h2>
          <p className="text-stone-500 text-sm">クレジットカード不要・登録は1分</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register" className="btn-primary px-8 py-3">無料で始める</Link>
            <Link href="/help" className="btn-secondary px-8 py-3">よくある質問を見る</Link>
          </div>
        </section>
      </div>

      <footer className="text-center py-8 text-xs text-stone-400 space-y-2">
        <p>© 2026 FoodLabel Pro（Bummeln）</p>
        <div className="flex justify-center gap-4 flex-wrap">
          <Link href="/about" className="hover:text-stone-600">サービス紹介</Link>
          <Link href="/features" className="hover:text-stone-600">機能一覧</Link>
          <Link href="/help" className="hover:text-stone-600">よくある質問</Link>
          <Link href="/terms" className="hover:text-stone-600">利用規約</Link>
          <Link href="/privacy" className="hover:text-stone-600">プライバシーポリシー</Link>
          <Link href="/legal" className="hover:text-stone-600">特定商取引法</Link>
        </div>
      </footer>
    </div>
  );
}
