import Link from 'next/link';

export const metadata = { title: '特定商取引法に基づく表記 | FoodLabel Pro' };

export default function LegalPage() {
  const items = [
    { label: '販売業者',       value: 'Bummeln' },
    { label: '運営統括責任者', value: '代表者（個人事業主）' },
    { label: '所在地',         value: '愛知県名古屋市瑞穂区竹田町\n（詳細住所は請求があれば遅滞なく開示します）' },
    { label: '電話番号',       value: 'メールにてお問い合わせください\n（開示請求には遅滞なく対応します）' },
    { label: 'メールアドレス', value: 'info.lucke@gmail.com' },
    { label: 'サービス名',     value: 'FoodLabel Pro' },
    { label: '販売価格',       value: 'フリープラン：無料\nプレミアムプラン：月額980円（税込）' },
    { label: '支払方法',       value: 'クレジットカード（Visa・Mastercard・American Express・JCB）' },
    { label: '支払時期',       value: '毎月自動更新（登録日を基準に1ヶ月ごと）' },
    { label: 'サービス提供時期', value: '決済完了後、即時利用可能' },
    { label: '解約・返金',     value: 'いつでも解約可能。解約後は当月末まで利用可能。\n原則として返金は行いません。' },
    { label: '動作環境',       value: 'インターネット接続環境が必要です。\n推奨ブラウザ：Google Chrome・Safari・Firefox最新版' },
  ];

  return (
    <div className="min-h-screen bg-cream-100 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">特定商取引法に基づく表記</h1>
          <p className="text-stone-500 text-sm mt-1">最終更新日：2026年3月23日</p>
        </div>

        <div className="divide-y divide-cream-200">
          {items.map(item => (
            <div key={item.label} className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-semibold text-stone-600 mb-1 sm:mb-0">{item.label}</dt>
              <dd className="text-sm text-stone-700 sm:col-span-2 whitespace-pre-line">{item.value}</dd>
            </div>
          ))}
        </div>

        <div className="flex gap-4 text-sm pt-4 border-t border-cream-200">
          <Link href="/terms" className="text-brand-600 hover:underline">利用規約</Link>
          <Link href="/privacy" className="text-brand-600 hover:underline">プライバシーポリシー</Link>
        </div>
      </div>
    </div>
  );
}
