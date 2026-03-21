'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, AlertTriangle, ChevronRight, Flame, Tag, TrendingUp, RefreshCw, Package, Printer, EyeOff, Eye, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';

interface RecipeSummary {
  id: string; name: string; nameKana: string|null; categoryName: string|null;
  unitCount: number; shelfLifeDays: number|null; shelfLifeType: string;
  salePrice: number|null; unitCost: number|null; costRate: number|null;
  energyKcal: number|null; saltEquivalent: number|null; totalWeightG: number|null;
  allergens: string[]; hasUnconfirmedNutrition: boolean; isActive: boolean;
  createdAt: Date; updatedAt: Date;
}

const REQUIRED_ALLERGENS = ['えび','かに','小麦','そば','卵','乳','落花生','くるみ'];

function AllergenBadge({ name }: { name: string }) {
  const req = REQUIRED_ALLERGENS.includes(name);
  return <span className={`badge text-[10px] ${req ? 'badge-red' : 'badge-yellow'}`}>{name}</span>;
}

function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <div className="flex justify-between"><div className="skeleton h-5 w-48 rounded" /><div className="skeleton h-5 w-16 rounded-full" /></div>
      <div className="skeleton h-4 w-32 rounded" />
      <div className="flex gap-2"><div className="skeleton h-5 w-12 rounded-full" /><div className="skeleton h-5 w-12 rounded-full" /></div>
    </div>
  );
}

export default function RecipesPage() {
  const router = useRouter();
  const [recipes,    setRecipes]    = useState<RecipeSummary[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('');
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [categories, setCategories] = useState<{id:string;name:string}[]>([]);
  // 非表示モード
  const [showHidden, setShowHidden] = useState(false);
  // 複数選択
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const PERPAGE = 24;

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const params = new URLSearchParams({ page: String(page), perPage: String(PERPAGE), search, category, active: showHidden ? 'false' : 'true', hiddenOnly: showHidden ? 'true' : 'false' });
      const res  = await fetch(`/api/recipes?${params}`);
      const data = await res.json();
      if (data.success) { setRecipes(data.data.items); setTotal(data.data.total); }
    } catch { toast.error('取得に失敗しました'); } finally { setLoading(false); }
  }, [page, search, category, showHidden]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);
  useEffect(() => { fetch('/api/categories').then(r=>r.json()).then(d=>{if(d.success) setCategories(d.data);}); }, []);

  const toggleSelect = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const selectAll = () => setSelected(new Set(recipes.map(r=>r.id)));
  const clearSelection = () => { setSelected(new Set()); setSelectMode(false); };

  // 複数レシピ印刷
  const handlePrintSelected = () => {
    if (selected.size === 0) { toast.error('印刷するレシピを選択してください'); return; }
    const ids = Array.from(selected).join(',');
    router.push(`/dashboard/recipes/print?ids=${ids}`);
  };

  // レシピ非表示/再表示
  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    const action = currentlyActive ? '非表示' : '再表示';
    if (!confirm(`このレシピを${action}にしますか？`)) return;
    try {
      const res  = await fetch(`/api/recipes/${id}/toggle-active`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { toast.success(`${action}にしました`); fetchRecipes(); }
      else toast.error(data.error ?? '失敗しました');
    } catch { toast.error('通信エラー'); }
  };

  const totalPages = Math.ceil(total / PERPAGE);
  const getCostColor = (r: number|null) => !r ? 'text-stone-400' : r < 0.3 ? 'text-green-600' : r < 0.4 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className={`animate-fade-in space-y-5 ${showHidden ? 'bg-gray-100 p-4 rounded-2xl' : ''}`}>
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-2">
            レシピ一覧
            {showHidden && <span className="badge badge-gray text-sm">非表示レシピ</span>}
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">{showHidden ? '非表示' : '登録'}レシピ {total}件</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!showHidden && (
            <>
              {!selectMode ? (
                <button onClick={() => setSelectMode(true)} className="btn-secondary flex items-center gap-2 text-sm">
                  <Printer className="w-4 h-4" />レシピを印刷
                </button>
              ) : (
                <>
                  <button onClick={handlePrintSelected} disabled={selected.size === 0}
                    className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                    <Printer className="w-4 h-4" />{selected.size > 0 ? `${selected.size}件を印刷` : '印刷するレシピを選択'}
                  </button>
                  <button onClick={clearSelection} className="btn-secondary text-sm">
                    キャンセル
                  </button>
                </>
              )}
              <Link href="/dashboard/recipes/new" className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />新規作成
              </Link>
            </>
          )}
          <button onClick={() => { setShowHidden(!showHidden); setPage(1); setSelectMode(false); }}
            className={`btn-secondary flex items-center gap-2 text-sm ${showHidden ? 'bg-amber-100 border-amber-300 text-amber-700' : ''}`}>
            {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showHidden ? '通常表示に戻る' : '非表示レシピ'}
          </button>
        </div>
      </div>

      {/* 検索・フィルタ */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="field-input pl-10" placeholder="レシピ名で検索..." />
          </div>
          <div className="relative w-full sm:w-44">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <select value={category} onChange={e=>{setCategory(e.target.value);setPage(1);}} className="field-select pl-10">
              <option value="">すべてのカテゴリ</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button onClick={fetchRecipes} className="btn-secondary flex items-center gap-2 w-fit">
            <RefreshCw className="w-4 h-4" />更新
          </button>
        </div>
        {selectMode && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-cream-200">
            <button onClick={selectAll} className="text-sm text-brand-600 hover:underline">全選択</button>
            <button onClick={clearSelection} className="text-sm text-stone-500 hover:underline">解除</button>
            <span className="text-sm text-stone-500">{selected.size}件選択中</span>
          </div>
        )}
      </div>

      {/* レシピカード一覧 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{Array(6).fill(0).map((_,i)=><SkeletonCard key={i} />)}</div>
      ) : recipes.length === 0 ? (
        <div className="card text-center py-16">
          <Package className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <p className="text-stone-500 font-medium">{showHidden ? '非表示レシピはありません' : 'レシピが見つかりません'}</p>
          {!search && !showHidden && (
            <Link href="/dashboard/recipes/new" className="btn-primary inline-flex items-center gap-2 mt-4"><Plus className="w-4 h-4" />最初のレシピを作成する</Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {recipes.map(recipe => (
              <div key={recipe.id} className={`card-hover group relative ${showHidden ? 'opacity-60' : ''} ${selected.has(recipe.id) ? 'ring-2 ring-brand-400' : ''}`}>
                {selectMode && (
                  <button onClick={() => toggleSelect(recipe.id)} className="absolute top-3 left-3 z-10">
                    {selected.has(recipe.id)
                      ? <CheckSquare className="w-5 h-5 text-brand-500" />
                      : <Square className="w-5 h-5 text-stone-300" />
                    }
                  </button>
                )}
                <Link href={showHidden ? '#' : `/dashboard/recipes/${recipe.id}`}
                  onClick={e => { if(selectMode){e.preventDefault();toggleSelect(recipe.id);} if(showHidden) e.preventDefault(); }}
                  className="block">
                  <div className={`flex items-start justify-between mb-2 ${selectMode ? 'pl-7' : ''}`}>
                    <div className="flex-1 min-w-0 pr-3">
                      <h3 className="font-semibold text-stone-800 truncate group-hover:text-brand-700 transition-colors">{recipe.name}</h3>
                      {recipe.categoryName && <span className="text-xs text-stone-400">{recipe.categoryName}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {recipe.hasUnconfirmedNutrition && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                      {!showHidden && <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand-400" />}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-stone-500 mb-3">
                    {recipe.energyKcal != null && <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-400" />{Math.round(recipe.energyKcal/recipe.unitCount)}kcal/個</span>}
                    {recipe.totalWeightG != null && <span className="flex items-center gap-1 text-stone-500">全重量{recipe.totalWeightG}g</span>}
                    {recipe.shelfLifeDays != null && <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5 text-green-400" />{recipe.shelfLifeType==='BEST_BEFORE'?'賞味':'消費'}{recipe.shelfLifeDays}日</span>}
                    {recipe.costRate != null && <span className={`flex items-center gap-1 font-medium ${getCostColor(recipe.costRate)}`}><TrendingUp className="w-3.5 h-3.5" />原価率{(recipe.costRate*100).toFixed(0)}%</span>}
                  </div>
                  {recipe.allergens?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recipe.allergens.slice(0,5).map(a=><AllergenBadge key={a} name={a} />)}
                      {recipe.allergens.length > 5 && <span className="badge badge-gray">+{recipe.allergens.length-5}</span>}
                    </div>
                  )}
                </Link>
                {/* 非表示/再表示ボタン */}
                <button onClick={() => handleToggleActive(recipe.id, recipe.isActive)}
                  className="absolute bottom-3 right-3 p-1.5 text-stone-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all"
                  title={recipe.isActive ? '非表示にする' : '再表示する'}>
                  {recipe.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40">前へ</button>
              <span className="text-sm text-stone-500">{page} / {totalPages} ページ</span>
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40">次へ</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
