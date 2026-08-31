// ============================================================
// app/dashboard/consumption/page.tsx - 材料消費量レポート（Proプラン限定）
// ============================================================
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, Loader2, Lock, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface IngredientTotal { ingredientName: string; unit: string; amount: number; }
interface RecipeBreakdown { recipeId: string; recipeName: string | null; printCount: number; recipeDeleted: boolean; }

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 「今月」「先月」プリセットのfrom/toを計算する
function monthRange(monthsAgo: number): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const last  = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  return { from: toDateInputValue(first), to: toDateInputValue(last) };
}

export default function ConsumptionPage() {
  const thisMonth = monthRange(0);
  const [from, setFrom] = useState(thisMonth.from);
  const [to,   setTo]   = useState(thisMonth.to);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [canUse, setCanUse] = useState(true);
  const [ingredients, setIngredients] = useState<IngredientTotal[]>([]);
  const [recipes, setRecipes] = useState<RecipeBreakdown[]>([]);
  const [totalPrintCount, setTotalPrintCount] = useState(0);

  const applyPreset = (monthsAgo: number) => {
    const r = monthRange(monthsAgo);
    setFrom(r.from);
    setTo(r.to);
  };

  const handleSearch = async () => {
    if (!from || !to) { toast.error('期間を指定してください'); return; }
    if (from > to) { toast.error('開始日は終了日より前にしてください'); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/labels/consumption?from=${from}&to=${to}`);
      const data = await res.json();
      if (!data.success) { toast.error(data.error ?? '集計に失敗しました'); return; }
      setCanUse(data.data.canUse);
      if (data.data.canUse) {
        setIngredients(data.data.ingredients);
        setRecipes(data.data.recipes);
        setTotalPrintCount(data.data.totalPrintCount);
      }
      setSearched(true);
    } catch { toast.error('通信エラーが発生しました'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-500" />
          材料消費量レポート
          <span className="badge bg-brand-100 text-brand-700 text-[10px]">Pro</span>
        </h1>
        <p className="text-stone-500 text-sm mt-0.5">
          指定した期間のラベル印刷枚数（＝製造した個数）から、各材料をどれだけ使ったかを逆算します。
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => applyPreset(0)} className="btn-secondary text-sm px-3 py-1.5">今月</button>
          <button onClick={() => applyPreset(1)} className="btn-secondary text-sm px-3 py-1.5">先月</button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="field-label">開始日</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="field-input pl-9 w-44" />
            </div>
          </div>
          <div>
            <label className="field-label">終了日</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="field-input pl-9 w-44" />
            </div>
          </div>
          <button onClick={handleSearch} disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            集計する
          </button>
        </div>
        <p className="text-xs text-stone-400">
          消費量は現在のレシピ内容（材料・分量）をもとに計算されます。印刷後にレシピを変更した場合は、変更後の内容で計算されます。
        </p>
      </div>

      {!canUse && (
        <div className="card flex items-center justify-between gap-3 bg-cream-50">
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Lock className="w-4 h-4 flex-shrink-0" />
            材料消費量レポートはProプラン限定機能です
          </div>
          <Link href="/dashboard/upgrade" className="text-brand-600 text-sm font-medium hover:underline whitespace-nowrap">
            詳しく見る →
          </Link>
        </div>
      )}

      {canUse && searched && (
        <>
          <div className="card">
            <p className="text-sm text-stone-500">
              期間内の印刷枚数合計: <span className="font-bold text-stone-800">{totalPrintCount}枚</span>
            </p>
          </div>

          <div className="card space-y-3">
            <h2 className="section-title">材料ごとの消費量</h2>
            {ingredients.length === 0 ? (
              <p className="text-sm text-stone-400 py-4 text-center">この期間の印刷記録はありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-400 border-b border-cream-200">
                      <th className="py-2 font-medium">材料名</th>
                      <th className="py-2 font-medium text-right">消費量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((ing, i) => (
                      <tr key={`${ing.ingredientName}-${ing.unit}-${i}`} className="border-b border-cream-100 last:border-0">
                        <td className="py-2 text-stone-700">{ing.ingredientName}</td>
                        <td className="py-2 text-right font-medium text-stone-800">{ing.amount}{ing.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {recipes.length > 0 && (
            <div className="card space-y-3">
              <h2 className="section-title">レシピ別の印刷枚数</h2>
              <div className="space-y-1.5">
                {recipes.map(r => (
                  <div key={r.recipeId} className="flex items-center justify-between text-sm">
                    <span className={r.recipeDeleted ? 'text-stone-400' : 'text-stone-700'}>
                      {r.recipeName ?? '（削除済みレシピ）'}
                      {r.recipeDeleted && <span className="text-xs ml-1.5">※削除済みのため材料内訳は含まれません</span>}
                    </span>
                    <span className="font-medium text-stone-600 whitespace-nowrap ml-3">{r.printCount}枚</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="card bg-cream-50 text-xs text-stone-400 space-y-1">
        <p>・ 実際の仕込みロス・廃棄・試作等は含まれません。あくまで印刷枚数（＝製造個数）ベースの参考値です。</p>
        <p>・ 在庫の残数管理・発注はこの機能の対象外です。</p>
      </div>
    </div>
  );
}
