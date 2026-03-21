// ============================================================
// app/dashboard/recipes/[id]/page.tsx - レシピ詳細
// ============================================================
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Edit2, Tag, Trash2, Flame, Wheat,
  AlertTriangle, CheckCircle2, Loader2, Printer,
  ChevronRight, Info, TrendingUp, Copy,
} from 'lucide-react';
import type { RecipeDetail } from '@/types';

// アレルゲン表示
function AllergenChip({ name, required }: { name: string; required: boolean }) {
  return (
    <span className={`badge text-xs ${required ? 'badge-red' : 'badge-yellow'}`}>
      {required && '⚑ '}{name}
    </span>
  );
}

// 栄養成分テーブル行
function NutritionRow({ label, value, unit, highlight }: { label: string; value: number | null; unit: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-2 text-sm border-b border-cream-100 last:border-0 ${highlight ? 'font-semibold' : ''}`}>
      <span className="text-stone-600">{label}</span>
      <span className={highlight ? 'text-stone-800' : 'text-stone-700'}>
        {value != null ? `${value}${unit}` : <span className="text-stone-300">—</span>}
      </span>
    </div>
  );
}

const REQUIRED_ALLERGENS = ['えび','かに','小麦','そば','卵','乳','落花生','くるみ'];

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [recipe,  setRecipe]  = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/recipes/${id}`);
        const data = await res.json();
        if (data.success) {
          const r = data.data;
          if (r.bakingConditions && typeof r.bakingConditions === 'string') {
            try { r.bakingConditions = JSON.parse(r.bakingConditions); } catch { r.bakingConditions = []; }
          }
          if (!Array.isArray(r.bakingConditions)) r.bakingConditions = [];
          if (Array.isArray(r.allergens)) {
            r.allergens = { required: [], optional: [], all: r.allergens };
          }
          r.allergens = r.allergens ?? { required: [], optional: [], all: [] };
          setRecipe(r);
        } else {
          toast.error('レシピが見つかりません');
          router.push('/dashboard/recipes');
        }
      } catch { toast.error('取得に失敗しました'); }
      finally  { setLoading(false); }
    })();
  }, [id, router]);

  const handleCopy = async () => {
    try {
      const res  = await fetch(`/api/recipes/${id}/copy`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`「${data.data.name}」を作成しました`);
        router.push(`/dashboard/recipes/${data.data.id}/edit`);
      } else {
        toast.error(data.error ?? 'コピーに失敗しました');
      }
    } catch { toast.error('通信エラー'); }
  };

    const handleDelete = async () => {
    setDeleting(true);
    try {
      const res  = await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { toast.success('レシピを削除しました'); router.push('/dashboard/recipes'); }
      else toast.error(data.error ?? '削除に失敗しました');
    } catch { toast.error('通信エラー'); }
    finally { setDeleting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }
  if (!recipe) return null;

  const per1 = recipe.nutritionPerUnit;
  const allergens = (recipe.allergens as unknown as { required: string[]; optional: string[]; all: string[] }) ?? { required: [], optional: [], all: [] };

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/recipes" className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-stone-800 font-display">{recipe.name}</h1>
          {recipe.categoryName && (
            <span className="text-xs text-stone-400">{recipe.categoryName}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/labels?recipeId=${id}`}
            className="btn-primary flex items-center gap-2 text-sm">
            <Printer className="w-4 h-4" />
            シール印刷
          </Link>
          <button onClick={handleCopy}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Copy className="w-4 h-4" />
            コピー
          </button>
          <Link href={`/dashboard/recipes/${id}/edit`}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Edit2 className="w-4 h-4" />
            編集
          </Link>
          <button onClick={() => setShowDeleteConfirm(true)}
            className="p-2.5 rounded-xl border border-cream-300 text-stone-400 hover:text-red-500 hover:border-red-200 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 未確認成分の警告 */}
      {recipe.hasUnconfirmedNutrition && (
        <div className="alert-warning">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">成分未確認の食材があります</p>
            <p className="text-sm mt-0.5">栄養成分値は不完全です。
              <Link href="/dashboard/ingredients" className="underline ml-1">食材マスタ</Link>
              で成分情報を設定してください。
            </p>
          </div>
        </div>
      )}

      {/* ============================================================
          原材料・アレルゲン（シール表示内容）
          ============================================================ */}
      <div className="card space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <Tag className="w-5 h-5 text-brand-500" />
          ラベル表示内容
        </h2>

        <div>
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">原材料名（重量順）</label>
          <div className="mt-1.5 p-3 bg-cream-50 rounded-xl text-sm leading-relaxed border border-cream-200">
            {recipe.ingredientsLabel || <span className="text-stone-400">原材料が登録されていません</span>}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">アレルゲン</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {allergens.all?.length > 0 ? (
              allergens.all.map((a: string) => (
                <AllergenChip key={a} name={a} required={REQUIRED_ALLERGENS.includes(a)} />
              ))
            ) : (
              <span className="text-sm text-stone-400">アレルゲンなし（または未確認）</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {recipe.contentAmount && (
            <div className="bg-cream-50 rounded-xl p-3">
              <div className="text-xs text-stone-400 mb-1">内容量</div>
              <div className="font-medium">{recipe.contentAmount}</div>
            </div>
          )}
          {recipe.shelfLifeDays != null && (
            <div className="bg-cream-50 rounded-xl p-3">
              <div className="text-xs text-stone-400 mb-1">{recipe.shelfLifeType === 'BEST_BEFORE' ? '賞味期限' : '消費期限'}</div>
              <div className="font-medium">{recipe.shelfLifeDays}日間</div>
            </div>
          )}
          {recipe.storageMethod && (
            <div className="bg-cream-50 rounded-xl p-3 sm:col-span-2">
              <div className="text-xs text-stone-400 mb-1">保存方法</div>
              <div className="font-medium text-xs">{recipe.storageMethod}</div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          材料一覧
          ============================================================ */}
      <div className="card">
        <h2 className="section-title flex items-center gap-2">
          <Wheat className="w-5 h-5 text-amber-500" />
          材料（{recipe.unitCount}個分）
        </h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>材料名</th>
              <th className="text-right">分量</th>
              <th className="text-right hidden sm:table-cell">原価</th>
              <th className="hidden sm:table-cell">アレルゲン</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recipe.ingredients.map(ing => (
              <tr key={ing.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ing.ingredientName}</span>
                    {ing.nutritionUnconfirmed && (
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" title="成分未確認" />
                    )}
                    {ing.isPrimaryIngredient && ing.originCountry && (
                      <span className="badge badge-brand text-xs">{ing.originCountry}</span>
                    )}
                  </div>
                </td>
                <td className="text-right font-medium">{ing.amount}{ing.unit}</td>
                <td className="text-right text-stone-500 hidden sm:table-cell">
                  {ing.costTotal != null ? `¥${Math.round(ing.costTotal)}` : '—'}
                </td>
                <td className="hidden sm:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {ing.allergenOverride?.map(a => (
                      <span key={a} className={`badge text-[10px] ${REQUIRED_ALLERGENS.includes(a) ? 'badge-red' : 'badge-yellow'}`}>{a}</span>
                    ))}
                  </div>
                </td>
                <td></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="font-semibold text-stone-700">合計重量</td>
              <td className="text-right font-semibold text-stone-600">{recipe.totalWeightG != null ? `${recipe.totalWeightG}g` : '—'}</td>
              <td className="text-right font-semibold text-brand-600 hidden sm:table-cell">
                {recipe.totalCost != null ? `¥${Math.round(recipe.totalCost)}` : '—'}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ============================================================
          栄養成分 & 原価
          ============================================================ */}
      <div className="grid sm:grid-cols-2 gap-5">
        {/* 栄養成分 */}
        <div className="card">
          <h2 className="section-title flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            栄養成分（1個あたり）
          </h2>
          <div className="text-xs text-stone-400 mb-3">※推定値</div>
          <NutritionRow label="熱量"       value={per1?.energyKcal    ?? null} unit="kcal" highlight />
          <NutritionRow label="たんぱく質" value={per1?.protein       ?? null} unit="g" />
          <NutritionRow label="脂質"       value={per1?.fat           ?? null} unit="g" />
          <NutritionRow label="炭水化物"   value={per1?.carbohydrate  ?? null} unit="g" />
          <NutritionRow label="　糖質"     value={per1?.sugar         ?? null} unit="g" />
          <NutritionRow label="　食物繊維" value={per1?.dietaryFiber  ?? null} unit="g" />
          <NutritionRow label="食塩相当量" value={per1?.saltEquivalent ?? null} unit="g" highlight />
          <NutritionRow label="コレステロール" value={per1?.cholesterol ?? null} unit="mg" />
        </div>

        {/* 原価 */}
        <div className="card">
          <h2 className="section-title flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            原価計算
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-cream-100">
              <span className="text-stone-600 text-sm">材料合計原価</span>
              <span className="font-medium">{recipe.totalCost != null ? `¥${Math.round(recipe.totalCost)}` : '—'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-cream-100">
              <span className="text-stone-600 text-sm">1個あたり原価</span>
              <span className="font-medium text-brand-600">{recipe.unitCost != null ? `¥${Math.round(recipe.unitCost)}` : '—'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-cream-100">
              <span className="text-stone-600 text-sm">販売価格</span>
              <span className="font-medium">{recipe.salePrice != null ? `¥${recipe.salePrice}` : '未設定'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-cream-100">
              <span className="text-stone-600 text-sm">原価率</span>
              {recipe.costRate != null ? (
                <span className={`font-bold text-lg ${recipe.costRate < 0.3 ? 'text-green-600' : recipe.costRate < 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {(recipe.costRate * 100).toFixed(1)}%
                </span>
              ) : <span className="text-stone-400">—</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          焼成条件
          ============================================================ */}
      {recipe.bakingConditions && recipe.bakingConditions.length > 0 && (
        <div className="card">
          <h2 className="section-title">焼成条件</h2>
          <div className="space-y-2">
            {recipe.bakingConditions.map((step, idx) => (
              <div key={idx} className="flex gap-4 p-3 bg-cream-50 rounded-xl text-sm">
                <span className="font-medium text-stone-500">段階{idx+1}</span>
                <span>スチーム: <strong>{step.steam ?? '—'}</strong></span>
                {step.topHeat    != null && <span>上火: <strong>{step.topHeat}℃</strong></span>}
                {step.bottomHeat != null && <span>下火: <strong>{step.bottomHeat}℃</strong></span>}
                {step.timeMin    != null && <span>時間: <strong>{step.timeMin}分</strong></span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 作り方 */}
      {recipe.steps.length > 0 && (
        <div className="card">
          <h2 className="section-title">作り方</h2>
          <ol className="space-y-2">
            {recipe.steps.map((step, idx) => (
              <li key={idx} className="flex gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-stone-700 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-warm-lg p-6 max-w-sm w-full">
            <h3 className="font-bold text-stone-800 text-lg mb-2">レシピを削除しますか？</h3>
            <p className="text-stone-500 text-sm mb-5">「{recipe.name}」を削除します。この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">キャンセル</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1 flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
