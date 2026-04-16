import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '製菓・製パン店が知っておくべき食品表示の基本 | FoodLabel Pro',
  description: 'ケーキ・パン・クッキーなどを販売する際に必要な食品表示のルールをわかりやすくまとめました。',
};

export default function ArticlePage() {
  return (

      <div className="space-y-6">
        <div>
          <span className="badge badge-brand text-xs">食品表示基本</span>
          <h1 className="text-2xl font-bold text-stone-800 mt-3 leading-tight">製菓・製パン店が知っておくべき食品表示の基本</h1>
          <p className="text-stone-400 text-sm mt-2">2026年4月</p>
        </div>

        <p className="text-stone-600 leading-relaxed">ケーキ・パン・クッキーなどの食品を販売する際には、食品表示法に基づいたラベル表示が必要です。何を表示すればよいのか、初心者にもわかりやすく解説します。</p>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">食品表示に必要な基本項目</h2>
          <div className="space-y-2">
            {[
              {item:'名称', desc:'食品の名前（品名）。「ロールケーキ」「食パン」など具体的に記載'},
              {item:'原材料名', desc:'使用した原材料と添加物を重量の多い順に記載。アレルゲンも表示'},
              {item:'内容量', desc:'個数、重量（g）、容量（ml）などで表示'},
              {item:'消費期限・賞味期限', desc:'食品の特性に合わせて選択'},
              {item:'保存方法', desc:'冷蔵・冷凍・常温など。「直射日光・高温多湿を避けて保存」など'},
              {item:'製造者', desc:'製造者または販売者の名称と住所'},
              {item:'栄養成分表示', desc:'熱量・たんぱく質・脂質・炭水化物・食塩相当量の5項目（義務）'},
            ].map(row => (
              <div key={row.item} className="flex gap-3 bg-cream-50 rounded-xl p-3">
                <span className="text-brand-600 font-bold text-sm w-28 flex-shrink-0">{row.item}</span>
                <p className="text-stone-600 text-sm">{row.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">原材料名の書き方</h2>
          <p className="text-stone-600 leading-relaxed mb-3">原材料名は重量の多い順（降順）に記載します。複合原材料（マーガリンなど）の表示にも注意が必要です。</p>
          <div className="bg-cream-50 rounded-xl p-4">
            <p className="font-bold text-stone-800 mb-2">表示例（ショートケーキの場合）</p>
            <p className="text-stone-600 text-sm font-mono bg-white rounded-lg p-3">
              原材料名：生クリーム（国内製造）、スポンジケーキ（卵、小麦粉、砂糖、バター）、いちご、砂糖、洋酒/（一部に小麦・卵・乳成分を含む）
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">製造者情報の表示</h2>
          <div className="bg-cream-50 rounded-xl p-4 space-y-2 text-sm text-stone-600">
            <p>製造者または販売者の名称と住所を記載します。</p>
            <p>・ 個人事業主の場合は屋号または氏名と住所</p>
            <p>・ 法人の場合は法人名と所在地</p>
            <p>・ 電話番号は必須ではありませんが、記載することが推奨されます</p>
          </div>
        </div>

        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <p className="font-bold text-brand-800 mb-1">FoodLabel Proで食品表示を効率化</p>
          <p className="text-stone-600 text-sm">FoodLabel Proでレシピを登録すると、原材料名（重量順）とアレルゲン表示が自動生成されます。製造者情報も設定しておけば、ワンクリックでシールを印刷できます。</p>
        </div>

        <div className="text-xs text-stone-400 border-t pt-4">
          <p>参考：消費者庁「食品表示基準について」</p>
          <p className="mt-1">※ 本記事は一般的な情報提供を目的としています。最終的な表示内容は事業者様ご自身の責任において関係法令をご確認ください。</p>
        </div>
      </div>

  );
}
