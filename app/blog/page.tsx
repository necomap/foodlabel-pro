import Link from 'next/link';
import { Cookie, BookOpen, ChevronRight } from 'lucide-react';

export const metadata = {
  title: '食品表示お役立ち情報 | FoodLabel Pro',
  description: '食品表示法・アレルゲン表示・栄養成分表示・賞味期限など、食品を販売する事業者向けのお役立ち情報をお届けします。',
};

const ARTICLES = [
  {
    slug: 'allergen-guide',
    title: '食品表示法のアレルゲン表示完全ガイド｜特定原材料8品目・20品目を解説',
    excerpt: '食品アレルゲンの表示は食品表示法で義務付けられています。特定原材料8品目（義務）と特定原材料に準ずるもの20品目（推奨）について、わかりやすく解説します。',
    date: '2026年4月',
    category: 'アレルゲン表示',
  },
  {
    slug: 'expiry-date-guide',
    title: '賞味期限と消費期限の違いと正しい表示方法',
    excerpt: '食品ラベルでよく見る「賞味期限」と「消費期限」。この2つの違いと、正しい表示方法について解説します。食品販売事業者が知っておくべき基本知識です。',
    date: '2026年4月',
    category: '期限表示',
  },
  {
    slug: 'nutrition-labeling',
    title: '栄養成分表示の基本｜義務化された5項目をわかりやすく解説',
    excerpt: '2020年4月から一般用加工食品への栄養成分表示が義務化されました。必須5項目（熱量・たんぱく質・脂質・炭水化物・食塩相当量）の計算方法と表示ルールを解説します。',
    date: '2026年4月',
    category: '栄養成分表示',
  },
  {
    slug: 'food-labeling-basics',
    title: '製菓・製パン店が知っておくべき食品表示の基本',
    excerpt: 'ケーキ・パン・クッキーなどを販売する際に必要な食品表示のルールをわかりやすくまとめました。どの情報を表示する必要があるか、初心者にもわかりやすく解説します。',
    date: '2026年4月',
    category: '食品表示基本',
  },
  {
    slug: 'online-food-sales',
    title: '手作りお菓子をネット販売するときの食品表示ルール',
    excerpt: 'ネットショップやフリマアプリで手作りお菓子を販売する際に必要な食品表示と許可について解説します。営業許可・食品表示・アレルゲン表示の3つのポイントを確認しましょう。',
    date: '2026年4月',
    category: 'ネット販売',
  },
];

export default function BlogPage() {
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

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-brand-600">
            <BookOpen className="w-6 h-6" />
            <span className="font-semibold">食品表示お役立ち情報</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-800 font-display">食品表示に関するお役立ち記事</h1>
          <p className="text-stone-500 text-sm">食品を販売する事業者向けに、食品表示法・アレルゲン・栄養成分などの情報をわかりやすく解説します。</p>
        </div>

        <div className="space-y-4">
          {ARTICLES.map(article => (
            <Link key={article.slug} href={`/blog/${article.slug}`}
              className="card block hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-brand text-xs">{article.category}</span>
                    <span className="text-xs text-stone-400">{article.date}</span>
                  </div>
                  <h2 className="font-bold text-stone-800 leading-snug">{article.title}</h2>
                  <p className="text-stone-500 text-sm leading-relaxed">{article.excerpt}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-300 flex-shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>

        <div className="card text-center space-y-3 bg-brand-50 border-brand-200">
          <p className="font-semibold text-stone-800">食品表示ラベルの作成はFoodLabel Proで</p>
          <p className="text-stone-500 text-sm">アレルゲン自動判定・栄養成分計算・シール印刷まで対応。無料プランから始められます。</p>
          <Link href="/auth/register" className="btn-primary inline-block px-8">無料で始める</Link>
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
        </div>
      </footer>
    </div>
  );
}
