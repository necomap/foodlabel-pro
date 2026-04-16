import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '賞味期限と消費期限の違いと正しい表示方法 | FoodLabel Pro',
  description: '食品ラベルでよく見る賞味期限と消費期限の違いと正しい表示方法を解説します。',
};

export default function ArticlePage() {
  return (

      <div className="space-y-6">
        <div>
          <span className="badge badge-brand text-xs">期限表示</span>
          <h1 className="text-2xl font-bold text-stone-800 mt-3 leading-tight">賞味期限と消費期限の違いと正しい表示方法</h1>
          <p className="text-stone-400 text-sm mt-2">2026年4月</p>
        </div>

        <p className="text-stone-600 leading-relaxed">食品ラベルには必ず「賞味期限」または「消費期限」のどちらかを表示する必要があります。この2つは似ているようで意味が全く異なります。正しく理解して適切に表示しましょう。</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <p className="font-bold text-blue-800 text-lg">賞味期限</p>
            <p className="text-blue-700 text-sm font-medium">「おいしく食べられる期限」</p>
            <p className="text-stone-600 text-sm">品質が保たれる期限です。期限を過ぎてもすぐに食べられなくなるわけではありませんが、品質が低下します。</p>
            <p className="text-stone-500 text-xs mt-2">例：スナック菓子、缶詰、レトルト食品、チーズなど</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <p className="font-bold text-red-800 text-lg">消費期限</p>
            <p className="text-red-700 text-sm font-medium">「安全に食べられる期限」</p>
            <p className="text-stone-600 text-sm">安全性が保たれる期限です。期限を過ぎたものは食べないことが推奨されます。</p>
            <p className="text-stone-500 text-xs mt-2">例：弁当、惣菜、サンドイッチ、生菓子など</p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">どちらを使うか判断する基準</h2>
          <p className="text-stone-600 leading-relaxed">食品の特性によってどちらを使うか決まります。</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-start gap-3 bg-cream-50 rounded-xl p-3">
              <span className="text-brand-500 font-bold text-sm mt-0.5">消費期限</span>
              <p className="text-stone-600 text-sm">製造日から概ね5日以内に品質が劣化する食品（弁当、惣菜、生菓子、サンドイッチなど）</p>
            </div>
            <div className="flex items-start gap-3 bg-cream-50 rounded-xl p-3">
              <span className="text-brand-500 font-bold text-sm mt-0.5">賞味期限</span>
              <p className="text-stone-600 text-sm">比較的品質が保たれる食品（焼き菓子、缶詰、スナック、チーズなど）</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-800 mt-6 mb-3">期限の表示ルール</h2>
          <div className="space-y-3">
            <div className="bg-cream-50 rounded-xl p-4">
              <p className="font-bold text-stone-800 mb-1">3ヶ月以内の食品</p>
              <p className="text-stone-600 text-sm">「年月日」で表示する必要があります。例：「2026.04.15」「2026年4月15日」</p>
            </div>
            <div className="bg-cream-50 rounded-xl p-4">
              <p className="font-bold text-stone-800 mb-1">3ヶ月を超える食品</p>
              <p className="text-stone-600 text-sm">「年月」の表示でも可能です。例：「2026.04」「2026年4月」</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-bold text-amber-800 mb-1">製菓・製パン店での一般的な目安</p>
          <div className="space-y-1 text-sm text-stone-600 mt-2">
            <p>・ 生クリーム使用のケーキ・デザート → 消費期限 当日〜2日</p>
            <p>・ 焼き菓子（クッキー・フィナンシェ等） → 賞味期限 2週間〜1ヶ月</p>
            <p>・ 生食パン → 消費期限 2〜3日</p>
            <p>・ 惣菜パン → 消費期限 当日〜翌日</p>
          </div>
          <p className="text-xs text-stone-400 mt-2">※ 保存方法・製造環境によって異なります。自社商品に合わせた品質検査を行ってください。</p>
        </div>

        <div className="text-xs text-stone-400 border-t pt-4">
          <p>参考：消費者庁「食品期限表示の設定のためのガイドライン」</p>
          <p className="mt-1">※ 本記事は一般的な情報提供を目的としています。最終的な表示内容は事業者様ご自身の責任において関係法令をご確認ください。</p>
        </div>
      </div>

  );
}
