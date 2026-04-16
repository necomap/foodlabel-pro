import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '栄養成分表示の基本｜義務化された5項目をわかりやすく解説 | FoodLabel Pro',
  description: '栄養成分表示の義務化5項目（熱量・たんぱく質・脂質・炭水化物・食塩相当量）の計算方法と表示ルールを解説します。',
};

export default function ArticlePage() {
  return (

      <div className="space-y-6">
        <div>
          <span className="badge badge-brand text-xs">栄養成分表示</span>
          <h1 className="text-2xl font-bold text-stone-800 mt-3 leading-tight">栄養成分表示の基本｜義務化された5項目をわかりやすく解説</h1>
          <p className="text-stone-400 text-sm mt-2">2026年4月</p>
        </div>

        <p className="text-stone-600 leading-relaxed">2020年4月から、一般消費者向けに販売される加工食品への栄養成分表示が義務化されました。手作り食品を販売する製菓・製パン店・惣菜店なども対象となる場合があります。正しく理解して適切に表示しましょう。</p>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">義務表示の5項目</h2>
          <p className="text-stone-600 leading-relaxed mb-3">以下の5項目は必ず表示しなければなりません。</p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[
              {name:'熱量', unit:'kcal', desc:'カロリー'},
              {name:'たんぱく質', unit:'g', desc:''},
              {name:'脂質', unit:'g', desc:''},
              {name:'炭水化物', unit:'g', desc:'糖質＋食物繊維'},
              {name:'食塩相当量', unit:'g', desc:'ナトリウム量から換算'},
            ].map(item => (
              <div key={item.name} className="bg-brand-50 border border-brand-200 rounded-xl p-3 text-center">
                <p className="font-bold text-brand-800 text-sm">{item.name}</p>
                <p className="text-brand-600 text-xs">単位：{item.unit}</p>
                {item.desc && <p className="text-stone-400 text-xs mt-1">{item.desc}</p>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">表示単位と基準</h2>
          <div className="space-y-3">
            <div className="bg-cream-50 rounded-xl p-4">
              <p className="font-bold text-stone-800 mb-1">表示の基準量</p>
              <p className="text-stone-600 text-sm">100g（100ml）当たり、または1食分・1個当たりで表示します。製品の特性に合わせて選択できます。</p>
            </div>
            <div className="bg-cream-50 rounded-xl p-4">
              <p className="font-bold text-stone-800 mb-1">誤差の許容範囲</p>
              <p className="text-stone-600 text-sm">実測値との誤差は±20%以内が許容されます（食塩相当量は±20%または±0.1g以内）。</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">栄養成分の計算方法</h2>
          <p className="text-stone-600 leading-relaxed">栄養成分の計算には主に3つの方法があります。</p>
          <div className="space-y-3 mt-3">
            <div className="bg-cream-50 rounded-xl p-4">
              <p className="font-bold text-stone-800 mb-1">① 成分表を使用する方法（推奨）</p>
              <p className="text-stone-600 text-sm">文部科学省の「日本食品標準成分表」を使用して、各食材の栄養成分を計算します。最も正確で信頼性が高い方法です。FoodLabel Proでは2538件の食品データを収録し、自動計算に対応しています。</p>
            </div>
            <div className="bg-cream-50 rounded-xl p-4">
              <p className="font-bold text-stone-800 mb-1">② 分析機関に依頼する方法</p>
              <p className="text-stone-600 text-sm">専門の食品分析機関に実際の製品を送って分析してもらう方法。費用はかかりますが、最も正確です。</p>
            </div>
            <div className="bg-cream-50 rounded-xl p-4">
              <p className="font-bold text-stone-800 mb-1">③ 類似食品の成分値を使用する方法</p>
              <p className="text-stone-600 text-sm">類似した食品の成分値を参考にする方法。ただし誤差が大きくなる場合があります。</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-bold text-amber-800 mb-2">小規模事業者の特例</p>
          <p className="text-stone-600 text-sm">以下に該当する場合は、栄養成分表示が免除または緩和される場合があります。</p>
          <ul className="text-stone-600 text-sm mt-2 space-y-1">
            <li>・ 食品の製造・加工を行う食品関連事業者（中小企業以外）は義務</li>
            <li>・ 店内で製造して店内で販売する場合（インストア加工）は任意</li>
            <li>・ 外食は対象外</li>
          </ul>
          <p className="text-xs text-stone-400 mt-2">詳細は消費者庁のガイドラインをご確認ください。</p>
        </div>

        <div className="text-xs text-stone-400 border-t pt-4">
          <p>参考：消費者庁「栄養成分表示について」、文部科学省「日本食品標準成分表2020年版（八訂）」</p>
          <p className="mt-1">※ 本記事は一般的な情報提供を目的としています。最終的な表示内容は事業者様ご自身の責任において関係法令をご確認ください。</p>
        </div>
      </div>

  );
}
