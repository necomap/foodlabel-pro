// ============================================================
// app/dashboard/recipes/_form.tsx
// レシピ作成・編集フォーム（新規・編集共用）
// ============================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, GripVertical, Search, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Loader2, ArrowLeft, Info,
  Flame, FlaskConical, Thermometer,
} from 'lucide-react';
import type { BakingStep, RecipeDetail } from '@/types';

// 品名からカタカナ仮名を生成するシンプルなユーティリティ
// (実際の変換はWeb APIを使う。ここでは入力補助として空白を入れないだけ)
async function fetchKana(text: string): Promise<string> {
  try {
    const res = await fetch(`https://jlp.yahooapis.jp/FuriganaService/V2/furigana`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Yahoo AppID: dummy' },
      body: JSON.stringify({ id: '1', jsonrpc: '2.0', method: 'jlp.furiganaservice.furigana', params: { q: text, grade: 1 } }),
    });
    // 外部API失敗時はそのまま返す
    return text;
  } catch { return text; }
}



// ---- 型 ----
interface IngredientRow {
  key:              string;
  ingredientId:     string;
  name:             string;
  amount:           string;
  unit:             string;
  costPrice:        string;
  originCountry:    string;
  allergenOverride: string[];
  nutritionUnconfirmed: boolean;
  isAdditive:       boolean;  // 添加物フラグ
  // computed
  energyKcal: number | null;
  costTotal:  number | null;
}

// ---- 食材検索コンポーネント ----
function IngredientSearch({ value, onChange, onSelect }: {
  value:    string;
  onChange: (v: string) => void;
  onSelect: (ing: { id: string; name: string; allergens: string[]; unitPrice: number | null; nutrition: { energyKcal: number | null } | null; nutritionUnconfirmed: boolean }) => void;
}) {
  const [results, setResults] = useState<{ id: string; name: string; allergens: string[]; unitPrice: number | null; nutrition: { energyKcal: number | null } | null }[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/ingredients?q=${encodeURIComponent(q)}&perPage=8`);
      const data = await res.json();
      if (data.success) {
        setResults(data.data.items);
        setOpen(true);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(value), 300);
    return () => clearTimeout(t);
  }, [value, search]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
        <input
          type="text" value={value}
          onChange={e => { onChange(e.target.value); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="field-input pl-9 text-sm py-2"
          placeholder="食材名を入力（日本食品成分表から検索）"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-stone-400" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-cream-300 rounded-xl shadow-warm-lg overflow-hidden">
          {results.map(r => (
            <button key={r.id} type="button"
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-cream-50 text-sm text-left"
              onMouseDown={() => { onSelect({ ...r, nutritionUnconfirmed: !r.nutrition }); setOpen(false); onChange(r.name); }}>
              <span className="font-medium text-stone-800">{r.name}</span>
              <span className="text-xs text-stone-400 flex items-center gap-2">
                {r.nutrition?.energyKcal != null && <span><Flame className="inline w-3 h-3 text-orange-300" /> {r.nutrition.energyKcal}kcal/100g</span>}
                {r.allergens.length > 0 && <span className="badge badge-red">{r.allergens.slice(0,2).join('・')}</span>}
              </span>
            </button>
          ))}
          <button type="button"
            className="w-full px-3 py-2 text-xs text-brand-600 hover:bg-brand-50 border-t border-cream-200 text-left"
            onMouseDown={() => { onSelect({ id: '', name: value, allergens: [], unitPrice: null, nutrition: null, nutritionUnconfirmed: true }); setOpen(false); }}>
            ＋ 「{value}」を手入力食材として追加（成分未確認）
          </button>
        </div>
      )}
    </div>
  );
}

// ---- メインフォーム ----
export default function RecipeForm() {
  const router = useRouter();
  const params = useParams();
  const editId = params?.id as string | undefined;
  const isEdit = !!editId;

  const [loading,   setLoading]   = useState(false);
  const [fetching,  setFetching]  = useState(isEdit);
  const [showBaking, setShowBaking] = useState(false);

  // 基本情報
  const [name,          setName]          = useState('');
  const [nameKana,      setNameKana]      = useState('');
  const [categoryId,    setCategoryId]    = useState('');
  const [unitCount,     setUnitCount]     = useState('1');
  const [salePrice,     setSalePrice]     = useState('');
  const [shelfLifeDays, setShelfLifeDays] = useState('');
  const [shelfLifeType, setShelfLifeType] = useState<'BEST_BEFORE'|'USE_BY'>('BEST_BEFORE');
  const [contentAmount, setContentAmount] = useState('');
  const [storageMethod, setStorageMethod] = useState('直射日光・高温多湿を避けて保存してください。');
  const [notes,         setNotes]         = useState('');
  const [printComment,  setPrintComment]  = useState('');
  const [qualityControl, setQualityControl] = useState('');

  // 材料
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { key: 'r0', ingredientId: '', name: '', amount: '', unit: 'g', costPrice: '', originCountry: '', allergenOverride: [], nutritionUnconfirmed: false, isAdditive: false, energyKcal: null, costTotal: null },
  ]);

  // 手順
  const [steps, setSteps] = useState<string[]>(['']);

  // 焼成条件
  const [bakingSteps, setBakingSteps] = useState<BakingStep[]>([
    { steam: 'OFF', topHeat: null, bottomHeat: null, timeMin: null },
  ]);

  // カテゴリ一覧
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // 計算済み値
  const [calcResult, setCalcResult] = useState<{
    totalCost: number; unitCost: number; costRate: number | null; energyKcal: number;
  } | null>(null);

  // カテゴリ取得
  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => {
      if (d.success) setCategories(d.data ?? []);
    }).catch(() => {});
  }, []);

  // 編集時：既存データ取得
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setFetching(true);
      try {
        const res  = await fetch(`/api/recipes/${editId}`);
        const data = await res.json();
        if (!data.success) { toast.error('レシピの取得に失敗しました'); router.push('/dashboard/recipes'); return; }
        const r: RecipeDetail = data.data;
        setName(r.name);
        setNameKana(r.nameKana ?? '');
        setCategoryId(r.categoryId ?? '');
        setUnitCount(String(r.unitCount));
        setSalePrice(r.salePrice != null ? String(r.salePrice) : '');
        setShelfLifeDays(r.shelfLifeDays != null ? String(r.shelfLifeDays) : '');
        setShelfLifeType(r.shelfLifeType);
        setContentAmount(r.contentAmount ?? '');
        setStorageMethod(r.storageMethod ?? '');
        setNotes(r.notes ?? '');
        setPrintComment(r.printComment ?? '');
        setQualityControl(r.qualityControl ?? '');
        // bakingConditions: JSON文字列の場合はパース
        let baking = r.bakingConditions;
        if (baking && typeof baking === 'string') {
          try { baking = JSON.parse(baking); } catch { baking = []; }
        }
        if (Array.isArray(baking) && baking.length > 0) {
          setBakingSteps(baking);
          setShowBaking(true);
        } else if (!Array.isArray(baking)) {
          setBakingSteps([{ steam: 'OFF', topHeat: null, bottomHeat: null, timeMin: null }]);
        }
        if (r.ingredients.length > 0) {
          setIngredients(r.ingredients.map((ing, i) => ({
            key:          `r${i}`,
            ingredientId: ing.ingredientId ?? '',
            name:         ing.ingredientName,
            isAdditive:   (ing as any).isAdditive ?? false,
            amount:       String(ing.amount),
            unit:         ing.unit,
            costPrice:    ing.costPrice != null ? String(ing.costPrice) : '',
            originCountry: ing.originCountry ?? '',
            allergenOverride: ing.allergenOverride ?? [],
            nutritionUnconfirmed: ing.nutritionUnconfirmed,
            energyKcal:   ing.nutrition.energyKcal,
            costTotal:    ing.costTotal,
          })));
        }
        if (r.steps.length > 0) setSteps(r.steps);
      } finally { setFetching(false); }
    })();
  }, [isEdit, editId, router]);

  // 原価・栄養のリアルタイム概算（簡易）
  useEffect(() => {
    const cost = ingredients.reduce((s, ing) => {
      const amount = parseFloat(ing.amount) || 0;
      const price  = parseFloat(ing.costPrice) || 0;
      return s + (amount * price);
    }, 0);
    const kcal = ingredients.reduce((s, ing) => s + (ing.energyKcal ?? 0), 0);
    const cnt  = parseInt(unitCount) || 1;
    const sale = parseFloat(salePrice) || null;
    setCalcResult({
      totalCost: cost,
      unitCost:  cost / cnt,
      costRate:  sale ? cost / cnt / sale : null,
      energyKcal: kcal,
    });
  }, [ingredients, unitCount, salePrice]);

  // ---- 材料操作 ----
  const addIngredient = () => {
    setIngredients(prev => [...prev, {
      key: `r${Date.now()}`, ingredientId: '', name: '', amount: '', unit: 'g',
      costPrice: '', originCountry: '', allergenOverride: [], nutritionUnconfirmed: false,
      isAdditive: false, energyKcal: null, costTotal: null,
    }]);
  };

  const removeIngredient = (key: string) => {
    setIngredients(prev => prev.filter(i => i.key !== key));
  };

  const updateIngredient = (key: string, field: keyof IngredientRow, value: string | number | boolean | null | string[]) => {
    setIngredients(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const onIngredientSelect = (key: string, ing: { id: string; name: string; allergens: string[]; unitPrice: number | null; nutrition: { energyKcal: number | null } | null; nutritionUnconfirmed: boolean }) => {
    setIngredients(prev => prev.map(i => {
      if (i.key !== key) return i;
      const amount = parseFloat(i.amount) || 0;
      const kcal   = ing.nutrition?.energyKcal != null ? (ing.nutrition.energyKcal * amount / 100) : null;
      const cost   = ing.unitPrice && amount ? ing.unitPrice * amount : null;
      return {
        ...i, ingredientId: ing.id, name: ing.name, allergenOverride: ing.allergens,
        nutritionUnconfirmed: ing.nutritionUnconfirmed,
        energyKcal: kcal, costTotal: cost,
        costPrice: ing.unitPrice ? String(Math.round(ing.unitPrice * 1000) / 1000) : i.costPrice,
      };
    }));
  };

  // ---- 手順操作 ----
  const addStep    = () => setSteps(prev => [...prev, '']);
  const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx));

  // ---- 保存 ----
  const handleSave = async () => {
    if (!name.trim()) { toast.error('品名を入力してください'); return; }
    const validIngs = ingredients.filter(i => i.name.trim() && parseFloat(i.amount) > 0);
    if (validIngs.length === 0) { toast.error('材料を1つ以上入力してください'); return; }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        nameKana: nameKana.trim() || undefined,
        categoryId: categoryId || undefined,
        unitCount: parseInt(unitCount) || 1,
        wasteRatio: 0,
        salePrice: salePrice ? parseFloat(salePrice) : undefined,
        shelfLifeDays: shelfLifeDays ? parseInt(shelfLifeDays) : undefined,
        shelfLifeType,
        contentAmount: contentAmount.trim() || undefined,
        storageMethod: storageMethod.trim() || undefined,
        notes: notes.trim() || undefined,
        printComment: printComment.trim() || undefined,
        qualityControl: qualityControl.trim() || undefined,
        bakingConditions: showBaking ? bakingSteps : undefined,
        ingredients: validIngs.map((ing, idx) => ({
          ingredientId:           ing.ingredientId || undefined,
          ingredientNameOverride: !ing.ingredientId ? ing.name : undefined,
          amount:                 parseFloat(ing.amount),
          unit:                   ing.unit,
          displayOrder:           idx,
          sortByWeight:           true,
          originCountry:          ing.originCountry || undefined,
          costPrice:              ing.costPrice ? parseFloat(ing.costPrice) : undefined,
          allergenOverride:       ing.allergenOverride,
          isAdditive:            (ing as IngredientRow).isAdditive ?? false,
        })),
        steps: steps.filter(s => s.trim()),
      };

      const url    = isEdit ? `/api/recipes/${editId}` : '/api/recipes';
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(isEdit ? 'レシピを更新しました' : 'レシピを保存しました');
        router.push(`/dashboard/recipes/${isEdit ? editId : data.data?.id ?? ''}`);
      } else {
        toast.error(data.error ?? '保存に失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-stone-800 font-display">
            {isEdit ? 'レシピを編集' : '新規レシピ作成'}
          </h1>
          <p className="text-stone-500 text-xs mt-0.5">材料を入力すると栄養成分・アレルゲンが自動計算されます</p>
        </div>
      </div>

      {/* ============================================================
          基本情報
          ============================================================ */}
      <div className="card space-y-4">
        <h2 className="section-title">基本情報</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="field-label">品名 <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              onBlur={async e => {
                const val = e.target.value;
                if (val && !nameKana) {
                  try {
                    const res = await fetch('/api/util/kana', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: val }),
                    });
                    const data = await res.json();
                    if (data.success && data.kana) setNameKana(data.kana);
                  } catch { setNameKana(val); }
                }
              }}
              className="field-input" placeholder="例: ガレットブルトンヌ" />
          </div>
          <div>
            <label className="field-label">品名（カナ）<span className="text-stone-400 text-xs ml-1">（品名入力後に自動入力）</span></label>
            <input type="text" value={nameKana} onChange={e => setNameKana(e.target.value)}
              className="field-input" placeholder="例: ガレットブルトンヌ" />
          </div>
          <div>
            <label className="field-label">カテゴリ</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="field-select">
              <option value="">カテゴリなし</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">仕上げ数量 <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <input type="number" value={unitCount} onChange={e => setUnitCount(e.target.value)}
                className="field-input w-24" min="1" />
              <span className="text-stone-500 text-sm">個（枚・本）</span>
            </div>
          </div>
          <div>
            <label className="field-label">内容量（ラベル表示）</label>
            <input type="text" value={contentAmount} onChange={e => setContentAmount(e.target.value)}
              className="field-input" placeholder="例: 1個, 200g, 3枚入り" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">賞味/消費期限</label>
            <div className="flex gap-2">
              <select value={shelfLifeType} onChange={e => setShelfLifeType(e.target.value as 'BEST_BEFORE'|'USE_BY')}
                className="field-select w-28 text-sm">
                <option value="BEST_BEFORE">賞味期限</option>
                <option value="USE_BY">消費期限</option>
              </select>
              <div className="flex items-center gap-1 flex-1">
                <input type="number" value={shelfLifeDays} onChange={e => setShelfLifeDays(e.target.value)}
                  className="field-input" placeholder="日数" min="0" />
                <span className="text-stone-500 text-sm whitespace-nowrap">日</span>
              </div>
            </div>
          </div>
          <div>
            <label className="field-label">販売価格（円）</label>
            <input type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)}
              className="field-input" placeholder="例: 380" min="0" />
          </div>
          <div>
            <label className="field-label">品質管理</label>
            <input type="text" value={qualityControl} onChange={e => setQualityControl(e.target.value)}
              className="field-input" placeholder="例: 脱酸素剤" />
          </div>
        </div>

        <div>
          <label className="field-label">保存方法</label>
          <input type="text" value={storageMethod} onChange={e => setStorageMethod(e.target.value)}
            className="field-input" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">注意事項（ラベル印字）</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="field-input resize-none text-sm" rows={2}
              placeholder="例: 解凍後は当日中にお召し上がりください" />
          </div>
          <div>
            <label className="field-label">印字コメント</label>
            <textarea value={printComment} onChange={e => setPrintComment(e.target.value)}
              className="field-input resize-none text-sm" rows={2}
              placeholder="例: バニラビーンズを使用しています" />
          </div>
        </div>
      </div>

      {/* ============================================================
          材料入力
          ============================================================ */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title mb-0">材料</h2>
          {calcResult && (
            <div className="flex gap-3 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                概算 {Math.round(calcResult.energyKcal / (parseInt(unitCount)||1))}kcal/個
              </span>
              {calcResult.totalCost > 0 && (
                <span className="flex items-center gap-1 text-brand-600 font-medium">
                  原価 ¥{Math.round(calcResult.unitCost)}
                  {calcResult.costRate != null && ` (${(calcResult.costRate*100).toFixed(0)}%)`}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <div key={ing.key} className="group flex gap-2 items-start">
              <div className="pt-2.5 text-stone-300 cursor-grab">
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="text-xs text-stone-400 pt-3 w-5 text-center">{idx + 1}</div>

              {/* 食材名 */}
              <div className="flex-1 min-w-0">
                <IngredientSearch
                  value={ing.name}
                  onChange={v => updateIngredient(ing.key, 'name', v)}
                  onSelect={s => onIngredientSelect(ing.key, s)}
                />
                {ing.nutritionUnconfirmed && ing.name && (
                  <p className="text-xs text-yellow-600 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />成分未確認（後から設定可）
                  </p>
                )}
              </div>

              {/* 分量 */}
              <input type="number" value={ing.amount}
                onChange={e => updateIngredient(ing.key, 'amount', e.target.value)}
                className="field-input w-20 text-sm py-2" placeholder="分量" min="0" />

              {/* 単位 */}
              <select value={ing.unit}
                onChange={e => updateIngredient(ing.key, 'unit', e.target.value)}
                className="field-select w-16 text-sm py-2">
                {['g','ml','個','枚','本','袋','缶','cc','kg','L','%'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>

              {/* 添加物フラグ */}
              <label className="flex items-center gap-1 text-xs text-stone-500 whitespace-nowrap cursor-pointer hidden sm:flex">
                <input type="checkbox"
                  checked={!!(ing as IngredientRow).isAdditive}
                  onChange={e => updateIngredient(ing.key, 'isAdditive', e.target.checked)}
                  className="accent-brand-500" />
                添加物
              </label>
              {/* 原価単価 */}
              <input type="number" value={ing.costPrice}
                onChange={e => updateIngredient(ing.key, 'costPrice', e.target.value)}
                className="field-input w-20 text-sm py-2 hidden sm:block" placeholder="単価/g" step="0.001" />

              {/* 削除 */}
              <button type="button" onClick={() => removeIngredient(ing.key)}
                className="mt-2 p-1.5 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={addIngredient}
          className="btn-secondary text-sm flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" />
          材料を追加
        </button>

        {/* 最多重量食材の原産国 */}
        {ingredients.filter(i => i.name).length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              食品表示法：最も重量の多い原材料の原産国表示
            </p>
            {(() => {
              const primary = [...ingredients]
                .filter(i => i.name && (i.unit === 'g' || i.unit === 'ml'))
                .sort((a, b) => (parseFloat(b.amount)||0) - (parseFloat(a.amount)||0))[0];
              return primary ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-amber-800 font-medium">{primary.name}</span>
                  <input type="text" value={primary.originCountry}
                    onChange={e => updateIngredient(primary.key, 'originCountry', e.target.value)}
                    className="field-input text-sm py-1.5 flex-1"
                    placeholder="例: 国産, 北海道産, フランス産" />
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* ============================================================
          焼成条件（任意）
          ============================================================ */}
      <div className="card">
        <button type="button" onClick={() => setShowBaking(!showBaking)}
          className="flex items-center justify-between w-full">
          <h2 className="section-title mb-0 flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-orange-500" />
            焼成条件
            <span className="text-xs font-normal text-stone-400">（任意）</span>
          </h2>
          {showBaking ? <ChevronUp className="w-5 h-5 text-stone-400" /> : <ChevronDown className="w-5 h-5 text-stone-400" />}
        </button>

        {showBaking && (
          <div className="mt-4 space-y-3">
            {bakingSteps.map((step, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-3 p-3 bg-cream-50 rounded-xl">
                <div>
                  <label className="field-label text-xs">スチーム</label>
                  <select value={step.steam ?? 'OFF'}
                    onChange={e => setBakingSteps(prev => prev.map((s, i) => i === idx ? { ...s, steam: e.target.value as 'ON'|'OFF' } : s))}
                    className="field-select text-sm py-1.5">
                    <option value="OFF">OFF</option>
                    <option value="ON">ON</option>
                  </select>
                </div>
                <div>
                  <label className="field-label text-xs">上火（℃）</label>
                  <input type="number" value={step.topHeat ?? ''}
                    onChange={e => setBakingSteps(prev => prev.map((s, i) => i === idx ? { ...s, topHeat: e.target.value ? parseFloat(e.target.value) : null } : s))}
                    className="field-input text-sm py-1.5" placeholder="例: 230" />
                </div>
                <div>
                  <label className="field-label text-xs">下火（℃）</label>
                  <input type="number" value={step.bottomHeat ?? ''}
                    onChange={e => setBakingSteps(prev => prev.map((s, i) => i === idx ? { ...s, bottomHeat: e.target.value ? parseFloat(e.target.value) : null } : s))}
                    className="field-input text-sm py-1.5" placeholder="例: 210" />
                </div>
                <div>
                  <label className="field-label text-xs">時間（分）</label>
                  <div className="flex gap-1">
                    <input type="number" value={step.timeMin ?? ''}
                      onChange={e => setBakingSteps(prev => prev.map((s, i) => i === idx ? { ...s, timeMin: e.target.value ? parseFloat(e.target.value) : null } : s))}
                      className="field-input text-sm py-1.5 flex-1" placeholder="例: 20" />
                    {bakingSteps.length > 1 && (
                      <button type="button"
                        onClick={() => setBakingSteps(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-stone-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {bakingSteps.length < 3 && (
              <button type="button"
                onClick={() => setBakingSteps(prev => [...prev, { steam: 'OFF', topHeat: null, bottomHeat: null, timeMin: null }])}
                className="btn-secondary text-sm flex items-center gap-2 w-fit">
                <Plus className="w-4 h-4" />
                焼成段階を追加（最大3段階）
              </button>
            )}
          </div>
        )}
      </div>

      {/* ============================================================
          作り方
          ============================================================ */}
      <div className="card space-y-3">
        <h2 className="section-title">作り方</h2>
        {steps.map((step, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <span className="mt-2.5 text-xs font-bold text-brand-500 w-5 text-center flex-shrink-0">{idx + 1}</span>
            <input type="text" value={step} onChange={e => setSteps(prev => prev.map((s, i) => i === idx ? e.target.value : s))}
              className="field-input text-sm flex-1" placeholder={`手順${idx + 1}`} />
            {steps.length > 1 && (
              <button type="button" onClick={() => removeStep(idx)}
                className="mt-2 p-1.5 text-stone-300 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addStep}
          className="btn-secondary text-sm flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" />
          手順を追加
        </button>
      </div>

      {/* ============================================================
          保存ボタン
          ============================================================ */}
      <div className="flex gap-3 pb-20 lg:pb-0">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          キャンセル
        </button>
        <button type="button" onClick={handleSave} disabled={loading}
          className="btn-primary flex items-center gap-2 flex-1 sm:flex-initial justify-center">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{isEdit ? '更新中...' : '保存中...'}</>
          ) : (
            <><CheckCircle2 className="w-4 h-4" />{isEdit ? 'レシピを更新' : 'レシピを保存'}</>
          )}
        </button>
      </div>
    </div>
  );
}
