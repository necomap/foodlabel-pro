'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface RecipeForPrint {
  id: string; name: string; unitCount: number; categoryName: string|null;
  ingredients: Array<{ingredientName:string; amount:number; unit:string}>;
  steps: string[];
  bakingConditions: Array<{steam:string|null;topHeat:number|null;bottomHeat:number|null;timeMin:number|null}>|null;
  totalWeightG: number|null;
  shelfLifeDays: number|null; shelfLifeType: string;
  notes: string|null;
}

// useSearchParams は Suspense 内で使う必要がある
function PrintContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
  const [recipes, setRecipes] = useState<RecipeForPrint[]>([]);
  const [loading, setLoading] = useState(true);
  const [cols,    setCols]    = useState<1|2>(1);

  useEffect(() => {
    if (ids.length === 0) { router.push('/dashboard/recipes'); return; }
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          ids.map(id => fetch(`/api/recipes/${id}`).then(r => r.json()))
        );
        const valid = results
          .filter(r => r.success)
          .map(r => {
            const d = r.data;
            if (d.bakingConditions && typeof d.bakingConditions === 'string') {
              try { d.bakingConditions = JSON.parse(d.bakingConditions); } catch { d.bakingConditions = []; }
            }
            if (!Array.isArray(d.bakingConditions)) d.bakingConditions = [];
            return d;
          });
        setRecipes(valid);
      } catch { toast.error('レシピの取得に失敗しました'); }
      finally  { setLoading(false); }
    })();
  }, []);

  const handlePrint = () => {
    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 10mm; size: A4; }
  body { font-family: 'Hiragino Sans', Meiryo, sans-serif; font-size: 10pt; color: #333; margin:0; }
  .grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 8mm; }
  .recipe-card { border: 0.3mm solid #ccc; padding: 5mm; border-radius: 3mm; break-inside: avoid; }
  .recipe-name { font-size: 13pt; font-weight: bold; border-bottom: 0.5mm solid #ddd; padding-bottom: 2mm; margin-bottom: 3mm; }
  .section-title { font-weight: bold; font-size: 9pt; color: #666; margin: 3mm 0 1mm; border-bottom: 0.3mm solid #eee; }
  table { width: 100%; font-size: 9pt; border-collapse: collapse; }
  td { padding: 1mm 2mm; border-bottom: 0.2mm solid #eee; }
  .baking-row { display: flex; gap: 4mm; font-size: 9pt; background:#f9f5f0; padding:2mm; border-radius:2mm; margin:1mm 0; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="grid">
${recipes.map(r => `
  <div class="recipe-card">
    <div class="recipe-name">${r.name}</div>
    <div style="font-size:9pt;color:#888;margin-bottom:2mm;">${[r.categoryName, `${r.unitCount}個分`, r.totalWeightG ? `全重量${r.totalWeightG}g` : null].filter(Boolean).join(' / ')}</div>
    <div class="section-title">材料</div>
    <table>
      ${r.ingredients.map(i=>`<tr><td>${i.ingredientName}</td><td style="text-align:right;white-space:nowrap;">${i.amount}${i.unit}</td></tr>`).join('')}
      ${r.totalWeightG ? `<tr style="font-weight:bold;border-top:0.3mm solid #ccc;"><td>合計重量</td><td style="text-align:right;">${r.totalWeightG}g</td></tr>` : ''}
    </table>
    ${r.bakingConditions && r.bakingConditions.length > 0 ? `
      <div class="section-title">焼成条件</div>
      ${r.bakingConditions.map((b,i)=>`<div class="baking-row"><span>段階${i+1}</span>${b.steam?`<span>スチーム:${b.steam}</span>`:''}${b.topHeat!=null?`<span>上火:${b.topHeat}℃</span>`:''}${b.bottomHeat!=null?`<span>下火:${b.bottomHeat}℃</span>`:''}${b.timeMin!=null?`<span>${b.timeMin}分</span>`:''}</div>`).join('')}
    ` : ''}
    ${r.steps.length > 0 ? `
      <div class="section-title">作り方</div>
      <ol style="margin:0;padding-left:5mm;font-size:9pt;">
        ${r.steps.map(s=>`<li style="margin-bottom:1mm;">${s}</li>`).join('')}
      </ol>
    ` : ''}
    ${r.shelfLifeDays ? `<div style="font-size:9pt;color:#666;margin-top:2mm;">${r.shelfLifeType==='BEST_BEFORE'?'賞味期限':'消費期限'}: ${r.shelfLifeDays}日</div>` : ''}
    ${r.notes ? `<div style="font-size:9pt;color:#666;margin-top:1mm;">備考: ${r.notes}</div>` : ''}
  </div>
`).join('')}
</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('ポップアップがブロックされています。ブラウザの設定でポップアップを許可してください。'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-stone-800 font-display">レシピ印刷</h1>
          <p className="text-stone-500 text-sm">{recipes.length}件のレシピを印刷します</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="section-title">印刷設定</h2>
        <div>
          <label className="field-label">A4レイアウト</label>
          <div className="flex gap-3">
            {([1, 2] as const).map(n => (
              <label key={n}
                className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all
                  ${cols === n ? 'border-brand-400 bg-brand-50' : 'border-cream-200 hover:border-brand-300'}`}>
                <input type="radio" checked={cols === n} onChange={() => setCols(n)} className="accent-brand-500" />
                <span className="text-sm font-medium">1ページに{n}列（{n === 1 ? '大きく' : 'コンパクト'}）</span>
              </label>
            ))}
          </div>
        </div>
        <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
          <Printer className="w-5 h-5" />印刷する（新しいタブで開く）
        </button>
        <p className="text-xs text-stone-400">※ ポップアップがブロックされる場合はブラウザのアドレスバー右端のポップアップ許可をクリックしてください</p>
      </div>

      {/* プレビュー */}
      <div className={`grid ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
        {recipes.map(recipe => (
          <div key={recipe.id} className="card border-2 border-stone-200">
            <div className="font-bold text-stone-800 text-lg border-b border-cream-200 pb-2 mb-3">{recipe.name}</div>
            <div className="text-xs text-stone-400 mb-2">
              {[recipe.categoryName, `${recipe.unitCount}個分`, recipe.totalWeightG ? `全重量${recipe.totalWeightG}g` : null].filter(Boolean).join(' / ')}
            </div>
            <div className="text-xs font-semibold text-stone-500 uppercase mb-2">材料</div>
            <div className="space-y-1 mb-3">
              {recipe.ingredients.map((ing, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{ing.ingredientName}</span>
                  <span className="font-medium">{ing.amount}{ing.unit}</span>
                </div>
              ))}
              {recipe.totalWeightG && (
                <div className="flex justify-between text-sm font-bold border-t border-cream-200 pt-1">
                  <span>合計重量</span><span>{recipe.totalWeightG}g</span>
                </div>
              )}
            </div>
            {recipe.steps.length > 0 && (
              <>
                <div className="text-xs font-semibold text-stone-500 uppercase mb-2">作り方</div>
                <ol className="space-y-1 list-decimal list-inside">
                  {recipe.steps.map((s, i) => <li key={i} className="text-sm text-stone-700">{s}</li>)}
                </ol>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Suspenseでラップ（useSearchParams使用時の必須要件）
export default function RecipePrintPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    }>
      <PrintContent />
    </Suspense>
  );
}
