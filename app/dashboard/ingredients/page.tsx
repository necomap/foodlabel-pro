'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, AlertTriangle, CheckCircle2, Loader2, FlaskConical, Package, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

interface Ingredient {
  id: string; name: string; nameKana: string|null; allergens: string[];
  nutritionId: number|null; purchaseUnitG: number|null; purchasePrice: number|null;
  unitPrice: number|null; storage: string; supplier: string|null;
  isPublic: boolean; isOwnRecord: boolean;
  ingredientCategoryId: string|null; ingredientCategoryName: string|null;
  nutrition: { energyKcal:number|null; protein:number|null; fat:number|null; carbohydrate:number|null; saltEquivalent:number|null; } | null;
}
interface IngredientCategory { id: string; name: string; }

const STORAGE_LABELS: Record<string,string> = { ROOM_TEMP:'常温', FRIDGE:'冷蔵', FROZEN:'冷凍', OTHER:'その他' };
const REQUIRED = ['えび','かに','小麦','そば','卵','乳','落花生','くるみ'];

// ---- カテゴリ管理モーダル ----
function CategoryManager({ onClose }: { onClose: () => void }) {
  const [cats,     setCats]    = useState<IngredientCategory[]>([]);
  const [newName,  setNewName] = useState('');
  const [editId,   setEditId]  = useState<string|null>(null);
  const [editName, setEditName]= useState('');

  const fetch_ = useCallback(async () => {
    const r = await fetch('/api/ingredient-categories'); const d = await r.json();
    if (d.success) setCats(d.data);
  },[]);
  useEffect(()=>{fetch_();},[fetch_]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const r = await fetch('/api/ingredient-categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newName.trim()})});
    const d = await r.json();
    if(d.success){toast.success('追加しました');setNewName('');fetch_();}
    else toast.error(d.error??'失敗しました');
  };
  const handleUpdate = async (id:string) => {
    const r = await fetch(`/api/ingredient-categories/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:editName.trim()})});
    const d = await r.json();
    if(d.success){toast.success('更新しました');setEditId(null);fetch_();}
  };
  const handleDelete = async (id:string) => {
    if(!confirm('このカテゴリを削除しますか？')) return;
    const r = await fetch(`/api/ingredient-categories/${id}`,{method:'DELETE'});
    const d = await r.json();
    if(d.success){toast.success('削除しました');fetch_();}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-warm-lg w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-cream-200">
          <h3 className="font-bold text-stone-800">食材カテゴリ管理</h3>
          <button onClick={onClose} className="text-stone-400 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex gap-2">
            <input type="text" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()}
              className="field-input flex-1" placeholder="新しいカテゴリ名（例: 小麦粉類）" />
            <button onClick={handleAdd} disabled={!newName.trim()} className="btn-primary flex items-center gap-1 whitespace-nowrap"><Plus className="w-4 h-4" />追加</button>
          </div>
          <div className="space-y-2">
            {cats.length===0 && <p className="text-stone-400 text-sm text-center py-4">カテゴリがありません</p>}
            {cats.map(cat=>(
              <div key={cat.id} className="flex items-center gap-2 p-2.5 bg-cream-50 rounded-xl group">
                {editId===cat.id ? (
                  <>
                    <input type="text" value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleUpdate(cat.id)}
                      className="field-input flex-1 py-1.5 text-sm" autoFocus />
                    <button onClick={()=>handleUpdate(cat.id)} className="btn-primary text-sm px-3 py-1.5">保存</button>
                    <button onClick={()=>setEditId(null)} className="btn-secondary text-sm px-3 py-1.5">取消</button>
                  </>
                ) : (
                  <>
                    <Tag className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium">{cat.name}</span>
                    <button onClick={()=>{setEditId(cat.id);setEditName(cat.name);}} className="p-1.5 text-stone-300 hover:text-brand-500 opacity-0 group-hover:opacity-100"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={()=>handleDelete(cat.id)} className="p-1.5 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-cream-200">
          <button onClick={onClose} className="btn-secondary w-full">閉じる</button>
        </div>
      </div>
    </div>
  );
}

// ---- 食材編集モーダル ----
function IngredientModal({ ingredient, categories, onClose, onSaved }: {
  ingredient: Ingredient|null; categories: IngredientCategory[];
  onClose: ()=>void; onSaved: ()=>void;
}) {
  const isNew = !ingredient;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name:            ingredient?.name ?? '',
    nameKana:        ingredient?.nameKana ?? '',
    ingredientCategoryId: ingredient?.ingredientCategoryId ?? '',
    purchaseUnitG:   ingredient?.purchaseUnitG ? String(ingredient.purchaseUnitG) : '',
    purchasePrice:   ingredient?.purchasePrice ? String(ingredient.purchasePrice) : '',
    storage:         ingredient?.storage ?? 'ROOM_TEMP',
    supplier:        ingredient?.supplier ?? '',
    isPublic:        ingredient?.isPublic ?? false,
    allergens:       ingredient?.allergens.join('、') ?? '',
    energyKcal:      ingredient?.nutrition?.energyKcal ? String(ingredient.nutrition.energyKcal) : '',
    protein:         ingredient?.nutrition?.protein    ? String(ingredient.nutrition.protein)    : '',
    fat:             ingredient?.nutrition?.fat        ? String(ingredient.nutrition.fat)        : '',
    carbohydrate:    ingredient?.nutrition?.carbohydrate ? String(ingredient.nutrition.carbohydrate) : '',
    saltEquivalent:  ingredient?.nutrition?.saltEquivalent ? String(ingredient.nutrition.saltEquivalent) : '',
  });
  const [nutritionSearch,  setNutritionSearch]  = useState('');
  const [nutritionResults, setNutritionResults] = useState<{id:number;foodName:string;energyKcal:number|null}[]>([]);
  const [selectedNutritionId, setSelectedNutritionId] = useState<number|null>(ingredient?.nutritionId ?? null);

  const searchNutrition = async (q: string) => {
    if (!q.trim()) { setNutritionResults([]); return; }
    const r = await fetch(`/api/nutrition?q=${encodeURIComponent(q)}&perPage=8`);
    const d = await r.json();
    if (d.success) setNutritionResults(d.data.items);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('食材名を入力してください'); return; }
    setSaving(true);
    try {
      const payload = {
        name:          form.name.trim(),
        nameKana:      form.nameKana.trim()||undefined,
        nutritionId:   selectedNutritionId??undefined,
        ingredientCategoryId: form.ingredientCategoryId || undefined,
        purchaseUnitG: form.purchaseUnitG ? parseInt(form.purchaseUnitG) : undefined,
        purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : undefined,
        storage:       form.storage,
        supplier:      form.supplier.trim()||undefined,
        isPublic:      form.isPublic,
        allergens:     form.allergens ? form.allergens.split(/[,、,]/).map(a=>a.trim()).filter(Boolean) : [],
        energyKcalManual:   form.energyKcal    ? parseFloat(form.energyKcal)    : undefined,
        proteinManual:      form.protein       ? parseFloat(form.protein)       : undefined,
        fatManual:          form.fat           ? parseFloat(form.fat)           : undefined,
        carbohydrateManual: form.carbohydrate  ? parseFloat(form.carbohydrate)  : undefined,
        saltEquivalentManual: form.saltEquivalent ? parseFloat(form.saltEquivalent) : undefined,
      };
      const url = ingredient ? `/api/ingredients/${ingredient.id}` : '/api/ingredients';
      const method = ingredient ? 'PUT' : 'POST';
      const res = await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data = await res.json();
      if (data.success) { toast.success(isNew?'食材を登録しました':'食材を更新しました'); onSaved(); onClose(); }
      else toast.error(data.error??'保存に失敗しました');
    } catch { toast.error('通信エラー'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-warm-lg w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-cream-200">
          <h3 className="font-bold text-stone-800 text-lg">{isNew?'食材を追加':'食材を編集'}</h3>
          <button onClick={onClose} className="text-stone-400 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">食材名 <span className="text-red-500">*</span></label>
              <input type="text" value={form.name}
                onChange={e => setForm(f => ({...f, name: e.target.value}))}
                onBlur={e => {
                  const val = e.target.value;
                  if (val) searchNutrition(val);
                }}
                className="field-input" placeholder="例: 準強力粉" />
            </div>
            <div>
              <label className="field-label">
                読み仮名（カナ）
                <span className="text-stone-400 text-xs ml-1">（手入力）</span>
              </label>
              <input type="text" value={form.nameKana}
                onChange={e => setForm(f => ({...f, nameKana: e.target.value}))}
                onBlur={e => {
                  // ひらがなが入力された場合はカタカナに変換
                  const val = e.target.value;
                  if (val) {
                    const katakana = val.replace(/[ぁ-ゖ]/g, ch =>
                      String.fromCharCode(ch.charCodeAt(0) + 0x60)
                    );
                    if (katakana !== val) setForm(f => ({...f, nameKana: katakana}));
                  }
                }}
                className="field-input" placeholder="例: ジュンキョウリキコ" />
              <p className="field-hint">ひらがなで入力するとカタカナに自動変換されます</p>
            </div>
          </div>
          <div>
            <label className="field-label">食材カテゴリ</label>
            <select value={form.ingredientCategoryId} onChange={e=>setForm(f=>({...f,ingredientCategoryId:e.target.value}))} className="field-select">
              <option value="">カテゴリなし</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">食品成分表との紐付け
              <span className="text-stone-400 text-xs ml-1">（食材名入力で自動検索）</span>
            </label>
            <input type="text" value={nutritionSearch} onChange={e=>{setNutritionSearch(e.target.value);searchNutrition(e.target.value);}} className="field-input" placeholder="例: 薄力粉、バター、卵 で検索" />
            {!selectedNutritionId && nutritionResults.length === 0 && nutritionSearch === '' && (
              <p className="text-xs text-amber-600 mt-1">※ 成分表データが未インポートの場合は検索結果が表示されません。管理者画面からインポートしてください。</p>
            )}
            {nutritionResults.length > 0 && (
              <div className="border border-cream-200 rounded-xl mt-1 overflow-hidden">
                {nutritionResults.map(n=>(
                  <button key={n.id} type="button" onClick={()=>{setSelectedNutritionId(n.id);setNutritionSearch(n.foodName);setNutritionResults([]);}}
                    className={`w-full flex justify-between px-3 py-2 text-sm hover:bg-cream-50 text-left ${selectedNutritionId===n.id?'bg-brand-50 text-brand-700':''}`}>
                    <span>{n.foodName}</span>
                    {n.energyKcal!=null && <span className="text-stone-400">{n.energyKcal}kcal</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedNutritionId && (
              <div className="flex items-center gap-2 mt-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-700">成分表ID: {selectedNutritionId}</span>
                <button type="button" onClick={()=>{setSelectedNutritionId(null);setNutritionSearch('');}} className="text-xs text-stone-400 hover:text-red-500">解除</button>
              </div>
            )}
          </div>
          <div>
            <label className="field-label">栄養成分（100gあたり）{!selectedNutritionId && <span className="text-yellow-600 text-xs ml-1">※手動入力</span>}</label>
            <div className="grid grid-cols-3 gap-2">
              {[{key:'energyKcal',label:'熱量(kcal)',step:'1'},{key:'protein',label:'たんぱく質(g)',step:'0.1'},{key:'fat',label:'脂質(g)',step:'0.1'},{key:'carbohydrate',label:'炭水化物(g)',step:'0.1'},{key:'saltEquivalent',label:'食塩相当量(g)',step:'0.01'}].map(field=>(
                <div key={field.key}>
                  <label className="text-xs text-stone-500 mb-0.5 block">{field.label}</label>
                  <input type="number" value={(form as Record<string,string>)[field.key]} onChange={e=>setForm(p=>({...p,[field.key]:e.target.value}))} className="field-input text-sm py-1.5" step={field.step} min="0" placeholder={selectedNutritionId?'成分表値':'入力'} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">アレルゲン（カンマ区切り）</label>
            <input type="text" value={form.allergens} onChange={e=>setForm(f=>({...f,allergens:e.target.value}))} className="field-input" placeholder="例: 小麦、乳" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="field-label">仕入れ単位(g)</label><input type="number" value={form.purchaseUnitG} onChange={e=>setForm(f=>({...f,purchaseUnitG:e.target.value}))} className="field-input" placeholder="例: 1000" /></div>
            <div><label className="field-label">仕入れ価格(円)</label><input type="number" value={form.purchasePrice} onChange={e=>setForm(f=>({...f,purchasePrice:e.target.value}))} className="field-input" placeholder="例: 500" /></div>
            <div><label className="field-label">保管方法</label><select value={form.storage} onChange={e=>setForm(f=>({...f,storage:e.target.value}))} className="field-select"><option value="ROOM_TEMP">常温</option><option value="FRIDGE">冷蔵</option><option value="FROZEN">冷凍</option><option value="OTHER">その他</option></select></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="field-label">仕入先</label><input type="text" value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} className="field-input" /></div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublic} onChange={e=>setForm(f=>({...f,isPublic:e.target.checked}))} className="accent-brand-500" />
                <div><span className="text-sm font-medium text-stone-700">コミュニティに共有</span><p className="text-xs text-stone-500">承認後に他ユーザーも使用できます</p></div>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-cream-200">
          <button onClick={onClose} className="btn-secondary flex-1">キャンセル</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving?<Loader2 className="w-4 h-4 animate-spin"/>:null}{isNew?'登録する':'更新する'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- メインページ ----
export default function IngredientsPage() {
  const [ingredients,  setIngredients]  = useState<Ingredient[]>([]);
  const [categories,   setCategories]   = useState<IngredientCategory[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [catFilter,    setCatFilter]    = useState('');
  const [page,         setPage]         = useState(1);
  const [total,        setTotal]        = useState(0);
  const [modal,        setModal]        = useState<{open:boolean;ingredient:Ingredient|null}>({open:false,ingredient:null});
  const [showCatMgr,   setShowCatMgr]   = useState(false);

  const fetchCategories = useCallback(async () => {
    const r = await fetch('/api/ingredient-categories'); const d = await r.json();
    if (d.success) setCategories(d.data);
  },[]);

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: search, page: String(page), perPage: '30', ...(catFilter && { categoryId: catFilter }) });
      const res = await fetch(`/api/ingredients?${params}`);
      const data = await res.json();
      if (data.success) { setIngredients(data.data.items); setTotal(data.data.total); }
    } finally { setLoading(false); }
  },[search, page, catFilter]);

  useEffect(()=>{ fetchCategories(); },[fetchCategories]);
  useEffect(()=>{ fetchIngredients(); },[fetchIngredients]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？\n\nこの食材を使用しているレシピがある場合、その材料の成分情報が未確認になります。`)) return;
    try {
      const res = await fetch(`/api/ingredients/${id}`,{method:'DELETE'});
      const data = await res.json();
      if (data.success) { toast.success('削除しました'); fetchIngredients(); }
      else toast.error(data.error??'削除に失敗しました');
    } catch { toast.error('通信エラー'); }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 font-display">食材マスタ</h1>
          <p className="text-stone-500 text-sm mt-0.5">登録食材 {total}件</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setShowCatMgr(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Tag className="w-4 h-4" />カテゴリ管理
          </button>
          <button onClick={()=>setModal({open:true,ingredient:null})} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />食材を追加
          </button>
        </div>
      </div>

      {/* 検索・カテゴリフィルタ */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="field-input pl-10" placeholder="食材名・カナで検索..." />
          </div>
          <select value={catFilter} onChange={e=>{setCatFilter(e.target.value);setPage(1);}} className="field-select w-full sm:w-44">
            <option value="">すべてのカテゴリ</option>
            <option value="__none__">カテゴリなし</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* テーブル */}
      {loading ? (
        <div className="card flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
      ) : ingredients.length === 0 ? (
        <div className="card text-center py-16">
          <Package className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500">食材が見つかりません</p>
          <button onClick={()=>setModal({open:true,ingredient:null})} className="btn-primary inline-flex items-center gap-2 mt-4"><Plus className="w-4 h-4" />最初の食材を追加</button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>食材名</th>
                <th className="hidden sm:table-cell">カテゴリ</th>
                <th className="hidden sm:table-cell">栄養（100g）</th>
                <th className="hidden md:table-cell">原価</th>
                <th>アレルゲン</th>
                <th className="hidden sm:table-cell">保管</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map(ing=>(
                <tr key={ing.id} className="group">
                  <td>
                    <div className="font-medium text-stone-800">{ing.name}</div>
                    {ing.nameKana && <div className="text-xs text-stone-400">{ing.nameKana}</div>}
                    {!ing.isOwnRecord && <span className="badge badge-gray text-[10px] mt-0.5">共有</span>}
                  </td>
                  <td className="hidden sm:table-cell">
                    {ing.ingredientCategoryName
                      ? <span className="badge badge-brand text-xs">{ing.ingredientCategoryName}</span>
                      : <span className="text-stone-300 text-xs">—</span>
                    }
                  </td>
                  <td className="hidden sm:table-cell">
                    {ing.nutrition?.energyKcal != null
                      ? <span className="text-sm text-stone-600"><FlaskConical className="w-3 h-3 inline mr-1 text-orange-400" />{ing.nutrition.energyKcal}kcal</span>
                      : <span className="flex items-center gap-1 text-yellow-600 text-xs"><AlertTriangle className="w-3.5 h-3.5" />未設定</span>
                    }
                  </td>
                  <td className="hidden md:table-cell text-sm text-stone-600">{ing.unitPrice != null ? `¥${(ing.unitPrice*100).toFixed(1)}/100g` : '—'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {ing.allergens.slice(0,3).map(a=><span key={a} className={`badge text-[10px] ${REQUIRED.includes(a)?'badge-red':'badge-yellow'}`}>{a}</span>)}
                      {ing.allergens.length > 3 && <span className="badge badge-gray text-[10px]">+{ing.allergens.length-3}</span>}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell text-sm text-stone-500">{STORAGE_LABELS[ing.storage]??ing.storage}</td>
                  <td>
                    {ing.isOwnRecord && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={()=>setModal({open:true,ingredient:ing})} className="p-1.5 text-stone-300 hover:text-brand-500"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={()=>handleDelete(ing.id,ing.name)} className="p-1.5 text-stone-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ページネーション */}
      {Math.ceil(total/30) > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40">前へ</button>
          <span className="text-sm text-stone-500">{page} / {Math.ceil(total/30)}</span>
          <button onClick={()=>setPage(p=>Math.min(Math.ceil(total/30),p+1))} disabled={page>=Math.ceil(total/30)} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40">次へ</button>
        </div>
      )}

      {modal.open && <IngredientModal ingredient={modal.ingredient} categories={categories} onClose={()=>setModal({open:false,ingredient:null})} onSaved={fetchIngredients} />}
      {showCatMgr && <CategoryManager onClose={()=>{setShowCatMgr(false);fetchCategories();}} />}
    </div>
  );
}
