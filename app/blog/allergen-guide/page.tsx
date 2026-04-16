import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '食品表示法のアレルゲン表示完全ガイド｜特定原材料8品目・20品目を解説 | FoodLabel Pro',
  description: '食品アレルゲンの表示は食品表示法で義務付けられています。特定原材料8品目と20品目について解説します。',
};

export default function ArticlePage() {
  return (

      <div className="space-y-6">
        <div>
          <span className="badge badge-brand text-xs">アレルゲン表示</span>
          <h1 className="text-2xl font-bold text-stone-800 mt-3 leading-tight">食品表示法のアレルゲン表示完全ガイド｜特定原材料8品目・20品目を解説</h1>
          <p className="text-stone-400 text-sm mt-2">2026年4月</p>
        </div>

        <p className="text-stone-600 leading-relaxed">食品アレルギーは命に関わる場合もあります。食品表示法では、アレルゲンを含む食品には必ず表示することが義務付けられています。この記事では、特定原材料8品目（義務）と特定原材料に準ずるもの20品目（推奨）について詳しく解説します。</p>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">特定原材料8品目（表示義務）</h2>
          <p className="text-stone-600 leading-relaxed mb-3">以下の8品目は、重篤な健康被害が報告されているため、含まれる場合は必ず表示しなければなりません。</p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <p className="font-bold text-red-800">表示義務あり（8品目）</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['えび', 'かに', '小麦', 'そば', '卵', '乳', '落花生（ピーナッツ）', 'くるみ'].map(item => (
                <div key={item} className="bg-white border border-red-200 rounded-lg px-3 py-2 text-sm text-center text-red-700 font-medium">{item}</div>
              ))}
            </div>
          </div>
          <p className="text-stone-500 text-sm mt-2">※ くるみは2023年3月より義務化されました。</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">特定原材料に準ずるもの20品目（表示推奨）</h2>
          <p className="text-stone-600 leading-relaxed mb-3">以下の20品目は、アレルギーを引き起こすことが確認されており、表示が推奨されています。義務ではありませんが、消費者の安全のためにできる限り表示することが望ましいです。</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="font-bold text-amber-800">表示推奨（20品目）</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['アーモンド', 'あわび', 'いか', 'いくら', 'オレンジ', 'カシューナッツ', 'キウイフルーツ', '牛肉', 'ごま', 'さけ', 'さば', '大豆', '鶏肉', 'バナナ', '豚肉', 'まつたけ', 'もも', 'やまいも', 'りんご', 'ゼラチン'].map(item => (
                <div key={item} className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm text-center text-amber-700">{item}</div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">アレルゲン表示の方法</h2>
          <p className="text-stone-600 leading-relaxed">アレルゲンの表示方法には「個別表示」と「一括表示」の2種類があります。</p>
          <div className="space-y-3 mt-3">
            <div className="bg-cream-50 rounded-xl p-4">
              <p className="font-bold text-stone-800 mb-1">個別表示</p>
              <p className="text-stone-600 text-sm">各原材料の後ろに括弧書きでアレルゲンを表示する方法。例：「薄力粉（小麦を含む）」</p>
            </div>
            <div className="bg-cream-50 rounded-xl p-4">
              <p className="font-bold text-stone-800 mb-1">一括表示</p>
              <p className="text-stone-600 text-sm">原材料名の最後にまとめて表示する方法。例：「…（一部に小麦・卵・乳成分を含む）」</p>
            </div>
          </div>
        </div>

        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <p className="font-bold text-brand-800 mb-1">FoodLabel Proでアレルゲン表示を自動化</p>
          <p className="text-stone-600 text-sm">FoodLabel Proでは、食材を登録してレシピに追加するだけで、特定原材料8品目・20品目のアレルゲンを自動判定します。手動での確認ミスを防ぎ、安全な食品表示をサポートします。</p>
        </div>

        <div className="text-xs text-stone-400 border-t pt-4">
          <p>参考：消費者庁「食品表示基準について」、農林水産省「食品表示のルール」</p>
          <p className="mt-1">※ 本記事は一般的な情報提供を目的としています。最終的な表示内容は事業者様ご自身の責任において関係法令をご確認ください。</p>
        </div>
      </div>

  );
}
