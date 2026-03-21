'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, ChevronUp, HelpCircle, MessageSquare } from 'lucide-react';

interface FAQ { q: string; a: string; category: string; }

const FAQS: FAQ[] = [
  { category: 'レシピ', q: 'レシピを作成するには？', a: '「レシピ管理」→「新規作成」から品名・材料・手順を入力して保存します。材料は食材マスタから検索して選択すると、アレルゲンや栄養成分が自動入力されます。' },
  { category: 'レシピ', q: 'レシピをコピーして別フレーバーを作るには？', a: 'レシピ詳細画面の「コピー」ボタンをクリックすると、同じ材料・設定のレシピが新規作成できます。品名を変更して保存してください。' },
  { category: 'レシピ', q: '複数のレシピをまとめて印刷するには？', a: 'レシピ一覧画面の「レシピを印刷」ボタンをクリックすると選択モードになります。印刷したいレシピにチェックを入れて「○件を印刷」ボタンを押すと印刷プレビューページが開きます。' },
  { category: 'レシピ', q: 'レシピを非表示にするには？', a: 'レシピカード上にカーソルを当てると右下に目のアイコンが表示されます。クリックすると非表示になります。非表示レシピは「非表示レシピ」ボタンで確認・再表示できます。' },
  { category: 'レシピ', q: '原材料の重量順表示はどう決まる？', a: 'レシピに登録した材料を重量（g/ml）の多い順に自動並び替えて表示します。食品表示法に準拠した表示です。' },
  { category: 'レシピ', q: '添加物はどう入力する？', a: '材料入力欄の「添加物」チェックをONにすると添加物として登録されます。ラベルでは「/（スラッシュ）」の後に重量順で表示されます。' },
  { category: 'シール印刷', q: 'ラベルプリンターで印刷するには？', a: 'シール印刷画面で「ラベルプリンタ」を選択し、シールサイズ（幅・高さ mm）を入力します。「印刷する」ボタンでブラウザの印刷ダイアログが開きます。用紙サイズをシールサイズに合わせて印刷してください。' },
  { category: 'シール印刷', q: 'Bluetoothラベルプリンターは使えますか？', a: 'ブラウザの印刷機能経由で印刷するため、WindowsやMacにドライバーが入っていれば中国製を含むほとんどのBluetooth・USB接続ラベルプリンターが使えます。プリンターをPCに接続してドライバーをインストール後、ブラウザ印刷で選択できます。' },
  { category: 'シール印刷', q: 'A4用紙に複数のシールを印刷するには？', a: 'シール印刷画面で「A4プリンタ」を選択し、列数・行数・余白を設定します。使いかけのシール用紙に印刷する場合は「開始位置」を変更してください。' },
  { category: '食材マスタ', q: '食材のカテゴリ分けをするには？', a: '食材マスタ画面の「カテゴリ管理」ボタンから食材カテゴリ（例：小麦粉類・乳製品・野菜類など）を作成できます。食材の編集画面でカテゴリを設定し、一覧のフィルタで絞り込めます。' },
  { category: '食材マスタ', q: '食材の栄養成分はどこから来ますか？', a: '日本食品標準成分表（文部科学省）のデータを使用しています。食材マスタで成分表の食品を紐づけると自動で栄養値が入ります。成分表にない食材は手動入力が必要です。' },
  { category: '食材マスタ', q: '成分表のデータは自動更新されますか？', a: '成分表データは管理者が手動でインポートします。管理者画面からファイルをアップロードして更新できます。文部科学省のサイト（https://www.mext.go.jp）から最新のExcelをダウンロードしてください。' },
  { category: 'インポート', q: 'ExcelデータをインポートするとExcelのデータは消えますか？', a: 'いいえ。インポートはExcelからアプリへのコピーです。元のExcelファイルはそのまま残ります。' },
  { category: '設定', q: '店舗を複数登録できますか？', a: 'はい。設定→店舗管理から店舗を複数追加できます。シール印刷時に店舗を選択すると、その店舗の住所・電話番号がラベルに印字されます。' },
  { category: '設定', q: 'カテゴリを追加するには？', a: '設定→カテゴリから自由に追加・編集・削除できます。初期値はパン・焼菓子・総菜の3種です。' },
];

const CATEGORIES = ['すべて', 'レシピ', 'シール印刷', '食材マスタ', 'インポート', '設定'];

export default function HelpPage() {
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('すべて');
  const [openIdx,  setOpenIdx]  = useState<number|null>(null);

  const filtered = FAQS.filter(f => {
    const matchCat    = category === 'すべて' || f.category === category;
    const matchSearch = !search || f.q.includes(search) || f.a.includes(search);
    return matchCat && matchSearch;
  });

  return (
    <div className="animate-fade-in max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-brand-500" />ヘルプ・使い方
        </h1>
        <p className="text-stone-500 text-sm mt-0.5">よくある質問と使い方の説明です</p>
      </div>

      {/* 検索・カテゴリフィルタ */}
      <div className="card space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="field-input pl-10" placeholder="キーワードで検索..." />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${category === c ? 'bg-brand-500 text-white' : 'bg-cream-100 text-stone-600 hover:bg-cream-200'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ一覧 */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card text-center py-8 text-stone-400">該当する質問が見つかりません</div>
        )}
        {filtered.map((faq, idx) => (
          <div key={idx} className="card p-0 overflow-hidden">
            <button onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-cream-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="badge badge-brand text-xs flex-shrink-0">{faq.category}</span>
                <span className="font-medium text-stone-800">{faq.q}</span>
              </div>
              {openIdx === idx
                ? <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0 ml-2" />
                : <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0 ml-2" />
              }
            </button>
            {openIdx === idx && (
              <div className="px-4 pb-4 text-sm text-stone-600 leading-relaxed border-t border-cream-100 pt-3">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 問い合わせ・要望 */}
      <div className="card bg-brand-50 border-brand-200 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand-600" />
          <h3 className="font-semibold text-brand-800">お問い合わせ・機能要望</h3>
        </div>
        <p className="text-sm text-brand-700">
          こちらに掲載されていない内容や、機能の追加・改善要望はお問い合わせページからお送りください。
        </p>
        <Link href="/dashboard/contact" className="btn-primary inline-flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4" />お問い合わせ・要望を送る
        </Link>
      </div>
    </div>
  );
}
