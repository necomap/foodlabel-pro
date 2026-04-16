import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '手作りお菓子をネット販売するときの食品表示ルール | FoodLabel Pro',
  description: 'ネットショップやフリマアプリで手作りお菓子を販売する際に必要な食品表示と許可について解説します。',
};

export default function ArticlePage() {
  return (

      <div className="space-y-6">
        <div>
          <span className="badge badge-brand text-xs">ネット販売</span>
          <h1 className="text-2xl font-bold text-stone-800 mt-3 leading-tight">手作りお菓子をネット販売するときの食品表示ルール</h1>
          <p className="text-stone-400 text-sm mt-2">2026年4月</p>
        </div>

        <p className="text-stone-600 leading-relaxed">「手作りのクッキーをネットで販売したい」というケースが増えています。しかし、食品をネットで販売するには様々なルールがあります。この記事では、必要な許可と食品表示について解説します。</p>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="font-bold text-red-800 mb-1">⚠️ 重要：営業許可が必要です</p>
          <p className="text-stone-600 text-sm">食品を販売するには、原則として都道府県知事の「食品営業許可」が必要です。自宅のキッチンでは許可が下りない場合が多く、許可を取得した施設（保健所の基準を満たした調理場）での製造が必要です。詳細はお住まいの地域の保健所にご確認ください。</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">ネット販売に必要な食品表示</h2>
          <p className="text-stone-600 leading-relaxed mb-3">ネットショップで食品を販売する場合も、実店舗と同様に食品表示法に基づく表示が必要です。商品に貼るラベル（シール）に以下の情報を記載してください。</p>
          <div className="space-y-2">
            {[
              '名称（商品名）',
              '原材料名（アレルゲン表示含む）',
              '内容量',
              '消費期限または賞味期限',
              '保存方法',
              '製造者名・住所',
              '栄養成分表示（5項目）',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-stone-600 text-sm">
                <span className="w-2 h-2 bg-brand-400 rounded-full flex-shrink-0"></span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">フリマアプリでの販売について</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="font-bold text-amber-800">メルカリ・minneなどでの食品販売</p>
            <p className="text-stone-600 text-sm">フリマアプリやハンドメイドサイトでも、食品を販売する場合は同様に営業許可と食品表示が必要です。各プラットフォームの規約も確認してください。</p>
            <p className="text-stone-600 text-sm">「非営利」「趣味の範囲」であっても、繰り返し販売する場合は営業とみなされる可能性があります。</p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">ネット販売開始の手順</h2>
          <div className="space-y-3">
            {[
              {step:'1', title:'保健所に相談', desc:'営業許可の取得条件（施設基準）を確認'},
              {step:'2', title:'製造施設の整備', desc:'保健所の基準を満たした調理場を用意'},
              {step:'3', title:'食品営業許可の取得', desc:'保健所に申請して許可を取得'},
              {step:'4', title:'食品表示の準備', desc:'ラベルのデザインと内容を作成'},
              {step:'5', title:'ネットショップの開設', desc:'Shopify・BASE・minne等のプラットフォームに出店'},
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3 bg-cream-50 rounded-xl p-3">
                <div className="w-7 h-7 bg-brand-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{s.step}</div>
                <div>
                  <p className="font-bold text-stone-800 text-sm">{s.title}</p>
                  <p className="text-stone-500 text-sm">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <p className="font-bold text-brand-800 mb-1">FoodLabel Proでラベル作成を効率化</p>
          <p className="text-stone-600 text-sm">商品数が増えてもFoodLabel Proならレシピを登録するだけで食品表示ラベルを自動生成。ネット販売の商品ラベルも素早く作成できます。</p>
        </div>

        <div className="text-xs text-stone-400 border-t pt-4">
          <p>参考：消費者庁「食品表示基準について」、厚生労働省「食品衛生法」</p>
          <p className="mt-1">※ 本記事は一般的な情報提供を目的としています。営業許可等の詳細はお住まいの地域の保健所にご確認ください。</p>
        </div>
      </div>

  );
}
