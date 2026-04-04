import Link from 'next/link';
import { Cookie, BookOpen, Tag, ShoppingBasket, Printer, ArrowLeftRight, Settings, Shield } from 'lucide-react';

export const metadata = {
  title: '機能一覧 | FoodLabel Pro',
  description: 'FoodLabel Proの機能一覧。レシピ管理・アレルゲン判定・栄養成分計算・シール印刷・Excelエクスポートなど。',
};

const FEATURES = [
  {
    icon: BookOpen,
    title: 'レシピ管理',
    desc: '商品ごとにレシピを登録・管理できます。',
    items: ['レシピの新規作成・編集・削除', '材料と分量の登録', '製造工程（手順）の記録', '賞味期限・消費期限の設定', '保存方法の設定', 'レシピのコピー機能', 'カテゴリ分類'],
  },
  {
    icon: Shield,
    title: 'アレルゲン自動判定',
    desc: '食材を登録するだけでアレルゲンを自動判定します。',
    items: ['特定原材料8品目（義務表示）の自動判定', '特定原材料に準ずるもの20品目（推奨）の自動判定', '食材ごとのアレルゲン上書き設定', '原材料名の自動生成（重量順）', '添加物の区別表示'],
  },
  {
    icon: ShoppingBasket,
    title: '栄養成分計算',
    desc: '文科省の成分表データを使った自動計算。',
    items: ['熱量・たんぱく質・脂質・炭水化物・食塩相当量の自動計算', '食物繊維・糖質・コレステロールの計算', '1個あたりの栄養成分計算', '文科省 日本食品標準成分表2020年版対応', '成分表との食材紐付け機能'],
  },
  {
    icon: Printer,
    title: 'シール印刷',
    desc: '食品表示法に対応したラベルをすぐに印刷。',
    items: ['ラベルプリンター対応（サイズmm単位で設定）', 'A4用紙への複数面付け印刷', '製造日・賞味期限の自動計算', '店舗情報の自動挿入', 'フォントサイズ調整', '印刷プレビュー機能'],
  },
  {
    icon: Tag,
    title: '食材マスタ管理',
    desc: '食材情報を一元管理できます。',
    items: ['食材の登録・編集・削除', '食品成分表との紐付け', 'アレルゲン情報の設定', '仕入れ先・単価の管理', '食材カテゴリの分類', '共有食材マスタの利用'],
  },
  {
    icon: ArrowLeftRight,
    title: 'インポート・エクスポート',
    desc: 'データの一括管理ができます。（プレミアム）',
    items: ['レシピデータのExcelエクスポート', '食材データのExcelエクスポート', '管理者による食品成分表データのインポート'],
  },
  {
    icon: Settings,
    title: '店舗・設定管理',
    desc: '複数店舗の情報を管理できます。',
    items: ['複数店舗の登録・管理（プレミアム）', '店舗ごとの住所・電話番号設定', 'レシピカテゴリのカスタマイズ', 'プロフィール情報の編集'],
  },
];

export default function FeaturesPage() {
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

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-stone-800 font-display">機能一覧</h1>
          <p className="text-stone-500">FoodLabel Proが提供するすべての機能</p>
        </div>

        <div className="space-y-6">
          {FEATURES.map(feature => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="card space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-stone-800">{feature.title}</h2>
                    <p className="text-stone-500 text-sm">{feature.desc}</p>
                  </div>
                </div>
                <ul className="grid sm:grid-cols-2 gap-1.5">
                  {feature.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-stone-600">
                      <span className="w-1.5 h-1.5 bg-brand-400 rounded-full flex-shrink-0"></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold text-stone-800">すべての機能を無料でお試し</h2>
          <Link href="/auth/register" className="btn-primary inline-block px-8 py-3">無料で始める</Link>
        </div>
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
