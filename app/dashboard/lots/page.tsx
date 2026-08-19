// ============================================================
// app/dashboard/lots/page.tsx - ロット番号トレース検索（Proプラン限定）
// ============================================================
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { History, Search, Loader2, Lock } from 'lucide-react';

interface LotSearchResult {
  id:              string;
  recipeName:      string;
  variationName:   string | null;
  shopName:        string | null;
  manufactureDate: string;
  printCount:      number;
  createdAt:       string;
  lots:            Array<{ ingredientName: string; lotNumber: string }> | null;
}

export default function LotsPage() {
  const [q,        setQ]        = useState('');
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [canUse,   setCanUse]   = useState(true);
  const [results,  setResults]  = useState<LotSearchResult[]>([]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/labels/lot-search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (data.success) {
        setCanUse(data.data.canUse);
        setResults(data.data.results);
        setSearched(true);
      }
    } catch { /* 一覧ページ側の軽微な検索エラーはトーストまで出さず静かに失敗させる */ }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-2">
          <History className="w-6 h-6 text-brand-500" />
          ロット番号トレース検索
          <span className="badge bg-brand-100 text-brand-700 text-[10px]">Pro</span>
        </h1>
        <p className="text-stone-500 text-sm mt-0.5">
          原材料のロット番号や食材名から、そのロットを使って印刷した商品（製造バッチ）を検索します。
        </p>
      </div>

      <form onSubmit={handleSearch} className="card flex gap-2">
        <input type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="ロット番号または食材名で検索（例：LOT20260815、小麦粉）"
          className="field-input flex-1" />
        <button type="submit" disabled={loading || !q.trim()}
          className="btn-primary flex items-center gap-2 whitespace-nowrap">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          検索
        </button>
      </form>

      {!canUse && (
        <div className="card flex items-center justify-between gap-3 bg-cream-50">
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Lock className="w-4 h-4 flex-shrink-0" />
            ロット番号トレーサビリティはProプラン限定機能です
          </div>
          <Link href="/dashboard/upgrade" className="text-brand-600 text-sm font-medium hover:underline whitespace-nowrap">
            詳しく見る →
          </Link>
        </div>
      )}

      {canUse && searched && (
        results.length === 0 ? (
          <div className="card text-center text-sm text-stone-400 py-8">該当する印刷記録は見つかりませんでした</div>
        ) : (
          <div className="space-y-3">
            {results.map(r => (
              <div key={r.id} className="card space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-stone-800">
                    {r.recipeName}
                    {r.variationName && <span className="text-stone-400 text-sm font-normal ml-1">{r.variationName}</span>}
                  </div>
                  <span className="text-xs text-stone-400 whitespace-nowrap">
                    {new Date(r.manufactureDate).toLocaleDateString('ja-JP')} 製造
                  </span>
                </div>
                <div className="text-xs text-stone-500 flex flex-wrap gap-x-4 gap-y-1">
                  {r.shopName && <span>店舗: {r.shopName}</span>}
                  <span>印刷枚数: {r.printCount}枚</span>
                  <span>印刷日時: {new Date(r.createdAt).toLocaleString('ja-JP')}</span>
                </div>
                {r.lots && r.lots.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {r.lots.map((l, i) => (
                      <span key={i} className="badge badge-brand text-xs">{l.ingredientName}: {l.lotNumber}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      <div className="card bg-cream-50 text-xs text-stone-400 space-y-1">
        <p>・ ここに表示されるのは、ラベル印刷時に任意で入力したロット番号のみです（食材マスタの在庫情報とは連動しません）</p>
        <p>・ 在庫数量の管理（残数・期限切れアラート等）はこの機能の対象外です</p>
      </div>
    </div>
  );
}
