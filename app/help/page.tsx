import Link from 'next/link';
import { Cookie, HelpCircle, ChevronDown } from 'lucide-react';

export const metadata = { title: 'ヘルプ・よくある質問 | FoodLabel Pro' };

const FAQS = [
  { q: 'FoodLabel Proとはどんなサービスですか？', a: '食品を販売する事業者向けの食品成分表示ラベル管理システムです。レシピ登録・アレルゲン自動判定・栄養成分計算・シール印刷までをワンストップで管理できます。製菓・製パン・総菜・弁当・加工食品など、食品表示が必要なすべての事業者にご利用いただけます。' },
  { q: '無料で使えますか？', a: 'はい、フリープランは無料でご利用いただけます。レシピ10件・シール印刷月20枚・店舗1件まで対応しています。より多くの機能が必要な場合は月額980円のプレミアムプランをご利用ください。' },
  { q: 'アレルゲン表示は自動で判定されますか？', a: 'はい、食材を登録するだけで特定原材料8品目（義務表示）と20品目（推奨表示）を自動で判定します。' },
  { q: '栄養成分は自動計算されますか？', a: '文部科学省の日本食品標準成分表データを使用して、レシピに使用した食材の量から栄養成分を自動計算します。食材マスタで成分表との紐付けを設定してください。' },
  { q: 'どんなプリンターで印刷できますか？', a: 'ラベルプリンター（幅・高さをmm単位で設定）とA4用紙（複数面付け印刷）に対応しています。' },
  { q: '複数の店舗を管理できますか？', a: 'プレミアムプランでは店舗数無制限で管理できます。シール印刷時に店舗を選択すると、その店舗の住所・電話番号がラベルに印字されます。' },
  { q: 'データはどこに保存されますか？', a: 'データはSupabase（PostgreSQL）を使用してクラウド上に安全に保存されます。インターネット環境があれば、どのデバイスからでもアクセスできます。' },
  { q: '解約はいつでもできますか？', a: 'はい、いつでも解約できます。解約後は当月末まで引き続きご利用いただけます。' },
];

export default function PublicHelpPage() {
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

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center justify-center gap-2">
            <HelpCircle className="w-7 h-7 text-brand-500" />よくある質問
          </h1>
          <p className="text-stone-500 text-sm mt-2">FoodLabel Proについてのよくある質問をまとめました</p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <details key={i} className="card p-0 overflow-hidden group">
              <summary className="flex items-center justify-between p-4 cursor-pointer list-none hover:bg-cream-50">
                <span className="font-medium text-stone-800 pr-4">{faq.q}</span>
                <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-sm text-stone-600 leading-relaxed border-t border-cream-100 pt-3">
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        <div className="card text-center space-y-3">
          <p className="font-semibold text-stone-800">まずは無料でお試しください</p>
          <p className="text-stone-500 text-sm">クレジットカード不要・登録は1分</p>
          <Link href="/auth/register" className="btn-primary inline-block px-8">無料で始める</Link>
        </div>

        <div className="text-center text-sm text-stone-500">
          <p>その他のご質問は <a href="mailto:info.lucke@gmail.com" className="text-brand-600 hover:underline">info.lucke@gmail.com</a> までお問い合わせください。</p>
        </div>
      </div>

      <footer className="text-center py-8 text-xs text-stone-400 space-y-2">
        <p>© 2026 FoodLabel Pro（Bummeln）</p>
        <div className="flex justify-center gap-4">
          <Link href="/terms" className="hover:text-stone-600">利用規約</Link>
          <Link href="/privacy" className="hover:text-stone-600">プライバシーポリシー</Link>
          <Link href="/legal" className="hover:text-stone-600">特定商取引法</Link>
        </div>
      </footer>
    </div>
  );
}
