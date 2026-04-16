import Link from 'next/link';
import { Cookie, ChevronLeft } from 'lucide-react';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
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
          <Link href="/auth/login" className="text-sm text-stone-600 hover:text-stone-800">ログイン</Link>
          <Link href="/auth/register" className="btn-primary text-sm">無料で始める</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/blog" className="flex items-center gap-1 text-sm text-brand-600 hover:underline mb-6">
          <ChevronLeft className="w-4 h-4" />記事一覧に戻る
        </Link>
        <div className="card prose prose-stone max-w-none">
          {children}
        </div>
        <div className="card mt-6 text-center space-y-3 bg-brand-50 border-brand-200">
          <p className="font-semibold text-stone-800">FoodLabel Proで食品表示ラベルを作成</p>
          <p className="text-stone-500 text-sm">アレルゲン自動判定・栄養成分計算・シール印刷まで対応。</p>
          <Link href="/auth/register" className="btn-primary inline-block px-8">無料で始める</Link>
        </div>
      </div>

      <footer className="text-center py-8 text-xs text-stone-400 space-y-2">
        <p>© 2026 FoodLabel Pro（Bummeln）</p>
        <div className="flex justify-center gap-4 flex-wrap">
          <Link href="/blog" className="hover:text-stone-600">お役立ち情報</Link>
          <Link href="/terms" className="hover:text-stone-600">利用規約</Link>
          <Link href="/privacy" className="hover:text-stone-600">プライバシーポリシー</Link>
        </div>
      </footer>
    </div>
  );
}
