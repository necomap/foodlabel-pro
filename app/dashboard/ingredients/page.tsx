'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Search, Plus, Edit2, Trash2, AlertTriangle, CheckCircle2, Loader2, FlaskConical, Package, Tag, ChevronDown, ChevronUp, ExternalLink, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

interface Ingredient {
  id: string; name: string; nameKana: string|null; allergens: string[];
  nutritionId: number|null; purchaseUnitG: number|null; purchasePrice: number|null;
  unitPrice: number|null; storage: string|null; supplier: string|null;
  isPublic: boolean; isOwnRecord: boolean; hasPurchaseSetting: boolean;
  ingredientCategoryId: string|null; ingredientCategoryName: string|null;
  recipeUsageCount: number;
  nutrition: { energyKcal:number|null; protein:number|null; fat:number|null; carbohydrate:number|null; saltEquivalent:number|null; dietaryFiber:number|null; sugar:number|null; cholesterol:number|null; } | null;
}
interface IngredientCategory { id: string; name: string; isShared?: boolean; }
interface RecipeUsage { id: string; name: string; variationName: string|null; isActive: boolean; amount: number; unit: string; }

const STORAGE_LABELS: Record<string,string> = { ROOM_TEMP:'常温', FRIDGE:'冷蔵', FROZEN:'冷凍', OTHER:'その他' };
const REQUIRED = ['えび','かに','小麦','そば','卵','乳','落花生','くるみ'];

// ---- カテゴリ管理モーダル ----
// カテゴリは「全ユーザー共通の基本カテゴリ（管理者のみ追加・編集可）」と
// 「各ユーザーが自分用に追加するカテゴリ」のハイブリッド方式。
function CategoryManager({ isAdmin, onClose }: { isAdmin: boolean; onClose: () => void }) {
  const [cats,     setCats]    = useState<IngredientCategory[]>([]);
  const [newName,  setNewName] = useState('');
  const [newShared,setNewShared] = useState(false);
  const [editId,   setEditId]  = useState<string|null>(null);
  const [editName, setEditName]= useState('');

  const fetch_ = useCallback(async () => {
    const r = await fetch('/api/ingredient-categories'); const d = await r.json();
    if (d.success) setCats(d.data);
  },[]);
  useEffect(()=>{fetch_();},[fetch_]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const r = await fetch('/api/ingredient-categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newName.trim(), shared:newShared})});
    const d = await r.json();
    if(d.success){toast.success('追加しました');setNewName('');setNewShared(false);fetch_();}
    else toast.error(d.error??'失敗しました');
  };
  const handleUpdate = async (id:string) => {
    const r = await fetch(`/api/ingredient-categories/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:editName.trim()})});
    const d = await r.json();
    if(d.success){toast.success('更新しました');setEditId(null);fetch_();}
    else toast.error(d.error??'更新に失敗しました');
  };
  const handleDelete = async (id:string) => {
    if(!confirm('このカテゴリを削除しますか？')) return;
    const r = await fetch(`/api/ingredient-categories/${id}`,{method:'DELETE'});
    const d = await r.json();
    if(d.success){toast.success('削除しました');fetch_();}
    else toast.error(d.error??'削除に失敗しました');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-warm-lg w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-cream-200">
          <h3 className="font-bold text-stone-800">食材カテゴリ管理</h3>
          <button onClick={onClose} className="text-stone-400 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="text" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()}
                className="field-input flex-1" placeholder="新しいカテゴリ名（例: 小麦粉類）" />
              <button onClick={handleAdd} disabled={!newName.trim()} className="btn-primary flex items-center gap-1 whitespace-nowrap"><Plus className="w-4 h-4" />追加</button>
            </div>
            {isAdmin && (
              <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
                <input type="checkbox" checked={newShared} onChange={e=>setNewShared(e.target.checked)} className="accent-brand-500" />
                全ユーザー共通の基本カテゴリとして追加する
              </label>
            )}
          </div>
          <div className="space-y-2">
            {cats.length===0 && <p className="text-stone-400 text-sm text-center py-4">カテゴリがありません</p>}
            {cats.map(cat=>{
              const canManage = isAdmin || !cat.isShared;
              return (
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
                      {cat.isShared && <span className="badge badge-gray text-[10px]">共通</span>}
                      {canManage && (
                        <>
                          <button onClick={()=>{setEditId(cat.id);setEditName(cat.name);}} className="p-1.5 text-stone-300 hover:text-brand-500 opacity-0 group-hover:opacity-100"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={()=>handleDelete(cat.id)} className="p-1.5 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
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
function IngredientModal({ ingredient, categories, isAdmin, onClose, onSaved }: {
  ingredient: Ingredient|null; categories: IngredientCategory[]; isAdmin: boolean;
  onClose: ()=>void; onSaved: ()=>void;
}) {
  const isNew = !ingredient;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name:            ingredient?.name ?? '',
    nameKana:        ingredient?.nameKana ?? '',
    genericName:     (ingredient as any)?.genericName ?? '',
    alwaysHideFromLabel: (ingredient as any)?.alwaysHideFromLabel ?? false,
    ingredientCategoryId: ingredient?.ingredientCategoryId ?? '',
    purchaseUnitG:   ingredient?.purchaseUnitG ? String(ingredient.purchaseUnitG) : '',
    purchasePrice:   ingredient?.purchasePrice ? String(ingredient.purchasePrice) : '',
    storage:         ingredient?.storage ?? 'ROOM_TEMP',
    supplier:        ingredient?.supplier ?? '',
    originCountry:   (ingredient as any)?.originCountry ?? '',
    isPublic:        ingredient?.isPublic ?? false,
    allergens:       ingredient?.allergens.join('、') ?? '',
    energyKcal:      ingredient?.nutrition?.energyKcal ? String(ingredient.nutrition.energyKcal) : '',
    protein:         ingredient?.nutrition?.protein    ? String(ingredient.nutrition.protein)    : '',
    fat:             ingredient?.nutrition?.fat        ? String(ingredient.nutrition.fat)        : '',
    carbohydrate:    ingredient?.nutrition?.carbohydrate ? String(ingredient.nutrition.carbohydrate) : '',
    saltEquivalent:  ingredient?.nutrition?.saltEquivalent ? String(ingredient.nutrition.saltEquivalent) : '',
    dietaryFiber:    ingredient?.nutrition?.dietaryFiber ? String(ingredient.nutrition.dietaryFiber) : '',
    sugar:           ingredient?.nutrition?.sugar        ? String(ingredient.nutrition.sugar)        : '',
    cholesterol:     ingredient?.nutrition?.cholesterol  ? String(ingredient.nutrition.cholesterol)  : '',
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
      // 新規作成時はzodスキーマがnullを受け付けないフィールドがあるためundefined（未指定）で送る。
      // 編集時は「一度入力してから空にした」を区別する必要があるため、明示的にnullを送って
      // 「クリアした」ことをサーバー側に伝える（undefinedのままだとPUT側で「その項目は触らない」と
      // 解釈されてしまい、解除・削除操作が保存されないバグになっていたため）。
      const emptyValue = isNew ? undefined : null;
      const payload = {
        name:          form.name.trim(),
        nameKana:      form.nameKana.trim() || emptyValue,
        genericName:   form.genericName.trim() || emptyValue,
        alwaysHideFromLabel: form.alwaysHideFromLabel,
        nutritionId:   selectedNutritionId ?? emptyValue,
        ingredientCategoryId: form.ingredientCategoryId || emptyValue,
        purchaseUnitG: form.purchaseUnitG ? parseInt(form.purchaseUnitG) : emptyValue,
        purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : emptyValue,
        storage:       form.storage,
        supplier:      form.supplier.trim() || emptyValue,
        originCountry: form.originCountry.trim() || emptyValue,
        isPublic:      form.isPublic,
        allergens:     form.allergens ? form.allergens.split(/[,、,]/).map(a=>a.trim()).filter(Boolean) : [],
        energyKcalManual:   form.energyKcal    ? parseFloat(form.energyKcal)    : emptyValue,
        proteinManual:      form.protein       ? parseFloat(form.protein)       : emptyValue,
        fatManual:          form.fat           ? parseFloat(form.fat)           : emptyValue,
        carbohydrateManual: form.carbohydrate  ? parseFloat(form.carbohydrate)  : emptyValue,
        saltEquivalentManual: form.saltEquivalent ? parseFloat(form.saltEquivalent) : emptyValue,
        dietaryFiberManual: form.dietaryFiber ? parseFloat(form.dietaryFiber) : emptyValue,
        sugarManual:        form.sugar        ? parseFloat(form.sugar)        : emptyValue,
        cholesterolManual:  form.cholesterol   ? parseFloat(form.cholesterol)  : emptyValue,
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
            <div className="sm:col-span-2">
              <label className="field-label">
                ラベル表示用の一般名
                <span className="text-stone-400 text-xs ml-1">（任意・空欄なら食材名をそのまま表示）</span>
              </label>
              <input type="text" value={form.genericName}
                onChange={e => setForm(f => ({...f, genericName: e.target.value}))}
                className="field-input" placeholder="例: 無塩バター よつ葉 → バター" />
              {(ingredient as any)?.genericNameConfirmed === false && (
                <p className="field-hint text-amber-600">⚠ 自動推測された仮の値です。内容を確認してください</p>
              )}
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={form.alwaysHideFromLabel}
                  onChange={e => setForm(f => ({...f, alwaysHideFromLabel: e.target.checked}))}
                  className="accent-brand-500" />
                <span className="text-sm text-stone-600">常にラベルの原材料表示から除外する（水・浄水など）</span>
              </label>
              <p className="field-hint">ONにすると、この食材を使っているすべてのレシピで、原材料名の表示から自動的に除かれます（栄養成分・アレルゲン表示には影響しません）。特定のレシピだけで除外したい場合は、レシピ編集画面の原材料ごとの設定を使ってください。</p>
            </div>
          </div>
          <div>
            <label className="field-label">食材カテゴリ</label>
            <select value={form.ingredientCategoryId} onChange={e=>setForm(f=>({...f,ingredientCategoryId:e.target.value}))} className="field-select">
              <option value="">カテゴリなし</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}{c.isShared?'（共通）':''}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">食品成分表との紐付け
              <span className="text-stone-400 text-xs ml-1">（食材名入力で自動検索）</span>
            </label>
            <input type="text" value={nutritionSearch} onChange={e=>{setNutritionSearch(e.target.value);searchNutrition(e.target.value);}} className="field-input" placeholder="例: 薄力粉、バター、卵 で検索" />
            {!selectedNutritionId && nutritionResults.length === 0 && nutritionSearch === '' && (
              <p className="text-xs text-amber-600 mt-1">
                ※ 成分表データが未インポートの場合は検索結果が表示されません。
                {isAdmin ? '管理者画面からインポートしてください。' : '見つからない場合は栄養成分を手入力してください。'}
              </p>
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
            <label className="field-label">栄養成分（100gあたり・表示義務5項目）{!selectedNutritionId && <span className="text-yellow-600 text-xs ml-1">※手動入力</span>}</label>
            <div className="grid grid-cols-3 gap-2">
              {[{key:'energyKcal',label:'熱量(kcal)',step:'1'},{key:'protein',label:'たんぱく質(g)',step:'0.1'},{key:'fat',label:'脂質(g)',step:'0.1'},{key:'carbohydrate',label:'炭水化物(g)',step:'0.1'},{key:'saltEquivalent',label:'食塩相当量(g)',step:'0.01'}].map(field=>(
                <div key={field.key}>
                  <label className="text-xs text-stone-500 mb-0.5 block">{field.label}</label>
                  <input type="number" value={(form as any)[field.key]} onChange={e=>setForm(p=>({...p,[field.key]:e.target.value}))} className="field-input text-sm py-1.5" step={field.step} min="0" placeholder={selectedNutritionId?'成分表値':'入力'} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">任意項目（食物繊維・糖質・コレステロール）
              <span className="text-stone-400 text-xs ml-1">（ラベルの表示設定でONにしている場合のみ入力してください）</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[{key:'dietaryFiber',label:'食物繊維(g)',step:'0.1'},{key:'sugar',label:'糖質(g)',step:'0.1'},{key:'cholesterol',label:'コレステロール(mg)',step:'1'}].map(field=>(
                <div key={field.key}>
                  <label className="text-xs text-stone-500 mb-0.5 block">{field.label}</label>
                  <input type="number" value={(form as any)[field.key]} onChange={e=>setForm(p=>({...p,[field.key]:e.target.value}))} className="field-input text-sm py-1.5" step={field.step} min="0" placeholder={selectedNutritionId?'成分表値':'入力'} />
                </div>
              ))}
            </div>
            {!selectedNutritionId && (
              <p className="field-hint text-amber-600">
                ⚠ 食品成分表と紐付いていない食材でこの3項目を空欄のままラベルに表示すると、実際は含まれていても0として計算されてしまいます。表示する場合は入力してください。
              </p>
            )}
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
            <div>
              <label className="field-label">原産地（デフォルト）</label>
              <input type="text" value={form.originCountry} onChange={e=>setForm(f=>({...f,originCountry:e.target.value}))} className="field-input" placeholder="例: 国産、アメリカ産" />
              <p className="field-hint">この食材が使用レシピの中で最も重量の多い原材料になったとき、レシピ側の原産国表示欄に自動で入力されます（レシピごとに個別に変更も可能）</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
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

// ---- 共有食材の仕入れ設定モーダル ----
// 共有食材そのもの（名前・栄養成分・アレルゲン等）は作成者しか編集できないが、
// 仕入れ単位・価格・保管方法・仕入れ先は使う事業者ごとに違うので、ここだけ自分専用に設定できる。
function PurchaseSettingModal({ ingredient, onClose, onSaved }: {
  ingredient: Ingredient; onClose: ()=>void; onSaved: ()=>void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    purchaseUnitG: ingredient.purchaseUnitG ? String(ingredient.purchaseUnitG) : '',
    purchasePrice: ingredient.purchasePrice ? String(ingredient.purchasePrice) : '',
    storage:       ingredient.storage ?? 'ROOM_TEMP',
    supplier:      ingredient.supplier ?? '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        purchaseUnitG: form.purchaseUnitG ? parseInt(form.purchaseUnitG) : null,
        purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : null,
        storage:       form.storage,
        supplier:      form.supplier.trim() || null,
      };
      const res = await fetch(`/api/ingredients/${ingredient.id}/purchase-setting`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data = await res.json();
      if (data.success) { toast.success('仕入れ設定を保存しました'); onSaved(); onClose(); }
      else toast.error(data.error??'保存に失敗しました');
    } catch { toast.error('通信エラー'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-warm-lg w-full max-w-md my-4">
        <div className="flex items-center justify-between p-5 border-b border-cream-200">
          <div>
            <h3 className="font-bold text-stone-800 text-lg">仕入れ設定</h3>
            <p className="text-xs text-stone-500 mt-0.5">{ingredient.name}（共有食材）</p>
          </div>
          <button onClick={onClose} className="text-stone-400 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-stone-500 bg-cream-50 rounded-lg p-2.5">
            この食材はほかのユーザーと共有されています。ここで設定する仕入れ単位・価格・保管方法・仕入れ先はあなたの事業所だけに使われ、他のユーザーには表示されません。
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="field-label">仕入れ単位(g)</label><input type="number" value={form.purchaseUnitG} onChange={e=>setForm(f=>({...f,purchaseUnitG:e.target.value}))} className="field-input" placeholder="例: 1000" /></div>
            <div><label className="field-label">仕入れ価格(円)</label><input type="number" value={form.purchasePrice} onChange={e=>setForm(f=>({...f,purchasePrice:e.target.value}))} className="field-input" placeholder="例: 500" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="field-label">保管方法</label><select value={form.storage} onChange={e=>setForm(f=>({...f,storage:e.target.value}))} className="field-select"><option value="ROOM_TEMP">常温</option><option value="FRIDGE">冷蔵</option><option value="FROZEN">冷凍</option><option value="OTHER">その他</option></select></div>
            <div><label className="field-label">仕入先</label><input type="text" value={form.supplier} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} className="field-input" /></div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-cream-200">
          <button onClick={onClose} className="btn-secondary flex-1">キャンセル</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving?<Loader2 className="w-4 h-4 animate-spin"/>:null}保存する
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- 使用レシピ表示（重複食材整理用） ----
function UsageCell({ ingredient }: { ingredient: Ingredient }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [items,   setItems]   = useState<RecipeUsage[]|null>(null);

  const toggle = async () => {
    if (ingredient.recipeUsageCount === 0) return;
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (items === null) {
      setLoading(true);
      try {
        const r = await fetch(`/api/ingredients/${ingredient.id}/usage`);
        const d = await r.json();
        if (d.success) setItems(d.data);
        else { setItems([]); toast.error(d.error ?? '取得に失敗しました'); }
      } catch { setItems([]); toast.error('通信エラー'); }
      finally { setLoading(false); }
    }
  };

  if (ingredient.recipeUsageCount === 0) {
    return <span className="text-stone-300 text-xs">未使用</span>;
  }

  return (
    <div>
      <button type="button" onClick={toggle} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
        {ingredient.recipeUsageCount}件のレシピで使用
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 bg-cream-50 rounded-lg p-2 max-w-[220px]">
          {loading ? (
            <div className="flex items-center gap-1.5 text-stone-400 text-xs py-1"><Loader2 className="w-3 h-3 animate-spin" />読み込み中...</div>
          ) : items && items.length > 0 ? (
            items.map(r => (
              <Link key={r.id} href={`/dashboard/recipes/${r.id}/edit`}
                className="flex items-center justify-between gap-1 text-xs text-stone-600 hover:text-brand-600 hover:underline py-0.5">
                <span className="truncate">
                  {r.name}{r.variationName ? `（${r.variationName}）` : ''}
                  {!r.isActive && <span className="text-stone-400 ml-1">（無効）</span>}
                </span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </Link>
            ))
          ) : (
            <p className="text-xs text-stone-400 py-1">レシピが見つかりません</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- メインページ ----
export default function IngredientsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.plan === 'admin';

  const [ingredients,  setIngredients]  = useState<Ingredient[]>([]);
  const [categories,   setCategories]   = useState<IngredientCategory[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [catFilter,    setCatFilter]    = useState('');
  const [page,         setPage]         = useState(1);
  const [total,        setTotal]        = useState(0);
  const [modal,        setModal]        = useState<{open:boolean;ingredient:Ingredient|null}>({open:false,ingredient:null});
  const [purchaseModal,setPurchaseModal]= useState<Ingredient|null>(null);
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

  const handleDelete = async (id: string, name: string, usageCount: number) => {
    const message = usageCount > 0
      ? `「${name}」を削除しますか？\n\nこの食材は${usageCount}件のレシピで使用されています。削除すると、それらのレシピの材料情報が未確認（栄養成分・原価が計算されない状態）になります。\n先に「使用レシピ」から各レシピを開いて食材の紐付けを修正することをおすすめします。`
      : `「${name}」を削除しますか？\n\nこの食材は現在どのレシピにも使用されていません。`;
    if (!confirm(message)) return;
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
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}{c.isShared?'（共通）':''}</option>)}
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
                <th className="hidden lg:table-cell">使用レシピ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map(ing=>(
                <tr key={ing.id} className="group">
                  <td>
                    <div className="font-medium text-stone-800">{ing.name}</div>
                    {(ing as any).genericName && (
                      <div className="text-xs text-brand-600">
                        表示名: {(ing as any).genericName}
                        {(ing as any).genericNameConfirmed === false && <span className="text-amber-500 ml-1">（要確認）</span>}
                      </div>
                    )}
                    {ing.nameKana && <div className="text-xs text-stone-400">{ing.nameKana}</div>}
                    {!ing.isOwnRecord && <span className="badge badge-gray text-[10px] mt-0.5">共有</span>}
                    {(ing as any).alwaysHideFromLabel && <span className="badge badge-gray text-[10px] mt-0.5 ml-1">表示除外中</span>}
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
                  <td className="hidden sm:table-cell text-sm text-stone-500">
                    {ing.storage ? (STORAGE_LABELS[ing.storage]??ing.storage) : <span className="text-stone-300 text-xs">未設定</span>}
                  </td>
                  <td className="hidden lg:table-cell align-top pt-2.5">
                    <UsageCell ingredient={ing} />
                  </td>
                  <td>
                    {ing.isOwnRecord ? (
                      <div className="flex gap-1">
                        <button onClick={()=>setModal({open:true,ingredient:ing})} className="p-1.5 text-stone-400 hover:text-brand-500"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={()=>handleDelete(ing.id,ing.name,ing.recipeUsageCount)} className="p-1.5 text-stone-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={()=>setPurchaseModal(ing)}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${ing.hasPurchaseSetting ? 'text-stone-500 hover:text-brand-600 hover:bg-cream-50' : 'text-brand-600 bg-brand-50 hover:bg-brand-100'}`}>
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {ing.hasPurchaseSetting ? '仕入れ設定' : '仕入れ設定を追加'}
                      </button>
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

      {modal.open && <IngredientModal ingredient={modal.ingredient} categories={categories} isAdmin={isAdmin} onClose={()=>setModal({open:false,ingredient:null})} onSaved={fetchIngredients} />}
      {purchaseModal && <PurchaseSettingModal ingredient={purchaseModal} onClose={()=>setPurchaseModal(null)} onSaved={fetchIngredients} />}
      {showCatMgr && <CategoryManager isAdmin={isAdmin} onClose={()=>{setShowCatMgr(false);fetchCategories();}} />}
    </div>
  );
}
