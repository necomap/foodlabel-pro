'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Loader2, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface RecipeForPrint {
  id: string; name: string; unitCount: number; categoryName: string|null;
  ingredients: Array<{
    ingredientName: string; amount: number; unit: string;
    genericName: string|null; genericNameConfirmed: boolean|null;
    processLabel: string|null;
  }>;
  steps: string[];
  bakingConditions: Array<{steam:string|null;topHeat:number|null;bottomHeat:number|null;timeMin:number|null}>|null;
  totalWeightG: number|null;
  shelfLifeDays: number|null; shelfLifeType: string;
  notes: string|null;
}

interface ScaleFactor { factor: number; label: string; }

// 分量を倍率でスケーリングして表示用に丸める（小数第1位まで。整数なら小数点は出さない）
function scaleAmount(amount: number, factor: number): number {
  return Math.round(amount * factor * 10) / 10;
}
function formatAmount(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// 材料テーブルの行HTMLを生成。processLabel（工程・用途、例：湯種／本ごね／仕上げ）が
// 前の材料と変わったタイミングで、見出し行を差し込む。
function buildIngredientRowsHtml(
  ingredients: RecipeForPrint['ingredients'],
  factors: ScaleFactor[],
  displayName: (ing: RecipeForPrint['ingredients'][number]) => string
): string {
  let html = '';
  let prevLabel = '';
  for (const i of ingredients) {
    const label = i.processLabel || '';
    if (label && label !== prevLabel) {
      html += `<tr><td colspan="${1 + factors.length}" style="padding-top:2mm;font-weight:bold;font-size:8pt;color:#a56a3a;border-bottom:0.3mm solid #e8ddd0;">${label}</td></tr>`;
    }
    prevLabel = label;
    html += `<tr><td>${displayName(i)}</td>${factors.map(f=>`<td style="text-align:right;white-space:nowrap;">${formatAmount(scaleAmount(i.amount,f.factor))}${i.unit}</td>`).join('')}</tr>`;
  }
  return html;
}

// useSearchParams は Suspense 内で使う必要がある
function PrintContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
  const [recipes, setRecipes] = useState<RecipeForPrint[]>([]);
  const [loading, setLoading] = useState(true);
  const [cols,    setCols]    = useState<1|2>(1);

  // 表示名：自分用（食材名そのまま）／提出用（一般名）
  const [nameMode, setNameMode] = useState<'raw'|'generic'>('raw');

  // 倍率（少量仕込み・倍量仕込み用の複数列表示）。×1（基準）は常に表示。
  const [scalePresets, setScalePresets] = useState([
    { factor: 1/3, label: '1/3', enabled: false },
    { factor: 1/2, label: '1/2', enabled: false },
    { factor: 2,   label: '×2',  enabled: false },
    { factor: 3,   label: '×3',  enabled: false },
  ]);
  const [customFactors, setCustomFactors] = useState<number[]>([]);
  const [customInput, setCustomInput] = useState('');

  const activeFactors: ScaleFactor[] = useMemo(() => {
    const base: ScaleFactor = { factor: 1, label: '×1（基準）' };
    const fromPresets = scalePresets.filter(p => p.enabled).map(p => ({ factor: p.factor, label: p.label }));
    const fromCustom  = customFactors.map(f => ({ factor: f, label: `×${f}` }));
    return [base, ...fromPresets, ...fromCustom].sort((a, b) => a.factor - b.factor);
  }, [scalePresets, customFactors]);
  const multiScale = activeFactors.length > 1;

  const addCustomFactor = () => {
    const v = parseFloat(customInput);
    if (!v || v <= 0) { toast.error('正しい倍率を入力してください（例: 1.5）'); return; }
    if (activeFactors.some(f => f.factor === v)) { toast.error('すでに追加済みの倍率です'); return; }
    setCustomFactors(f => [...f, v]);
    setCustomInput('');
  };

  const displayName = (ing: RecipeForPrint['ingredients'][number]) =>
    nameMode === 'generic' ? (ing.genericName || ing.ingredientName) : ing.ingredientName;

  // 提出用（一般名）表示のとき、一般名が未設定／未確認の食材を洗い出して確認を促す
  const { missingGenericNames, unconfirmedGenericNames } = useMemo(() => {
    const missing = new Set<string>();
    const unconfirmed = new Set<string>();
    if (nameMode === 'generic') {
      for (const r of recipes) {
        for (const ing of r.ingredients) {
          if (!ing.genericName) missing.add(ing.ingredientName);
          else if (ing.genericNameConfirmed === false) unconfirmed.add(ing.ingredientName);
        }
      }
    }
    return { missingGenericNames: Array.from(missing), unconfirmedGenericNames: Array.from(unconfirmed) };
  }, [nameMode, recipes]);

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
    const factors = activeFactors;
    const headerRow = multiScale
      ? `<tr><td></td>${factors.map(f => `<td style="text-align:right;font-size:7.5pt;color:#888;font-weight:normal;">${f.label}</td>`).join('')}</tr>`
      : '';
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
    <div style="font-size:9pt;color:#888;margin-bottom:2mm;">${[r.categoryName, `${r.unitCount}個分`, r.totalWeightG ? `全重量${r.totalWeightG}g` : null].filter(Boolean).join(' / ')}${nameMode==='generic' ? ' / 一般名表示（提出用）' : ''}</div>
    <div class="section-title">材料</div>
    <table>
      ${headerRow}
      ${buildIngredientRowsHtml(r.ingredients, factors, displayName)}
      ${r.totalWeightG ? `<tr style="font-weight:bold;border-top:0.3mm solid #ccc;"><td>合計重量</td>${factors.map(f=>`<td style="text-align:right;">${formatAmount(scaleAmount(r.totalWeightG as number,f.factor))}g</td>`).join('')}</tr>` : ''}
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

        <div>
          <label className="field-label">材料の表示名</label>
          <div className="flex gap-3">
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all
                ${nameMode === 'raw' ? 'border-brand-400 bg-brand-50' : 'border-cream-200 hover:border-brand-300'}`}>
              <input type="radio" checked={nameMode === 'raw'} onChange={() => setNameMode('raw')} className="accent-brand-500" />
              <span className="text-sm font-medium">食材名（自分用）</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all
                ${nameMode === 'generic' ? 'border-brand-400 bg-brand-50' : 'border-cream-200 hover:border-brand-300'}`}>
              <input type="radio" checked={nameMode === 'generic'} onChange={() => setNameMode('generic')} className="accent-brand-500" />
              <span className="text-sm font-medium">一般名（保健所などへの提出用）</span>
            </label>
          </div>
          {nameMode === 'generic' && (missingGenericNames.length > 0 || unconfirmedGenericNames.length > 0) && (
            <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
              <div className="flex items-start gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>一般名の確認をおすすめします（未設定・未確認の場合は食材名がそのまま印字されます）</span>
              </div>
              {missingGenericNames.length > 0 && <div>一般名が未設定：{missingGenericNames.join('、')}</div>}
              {unconfirmedGenericNames.length > 0 && <div>一般名が未確認：{unconfirmedGenericNames.join('、')}</div>}
              <div>食材マスタの編集画面で一般名を設定・確認してから提出用に印刷してください。</div>
            </div>
          )}
        </div>

        <div>
          <label className="field-label">倍率（少量・倍量仕込み用）</label>
          <div className="flex flex-wrap gap-3">
            <span className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-brand-400 bg-brand-50 text-sm font-medium text-stone-500">
              ×1（基準・常時表示）
            </span>
            {scalePresets.map((p, idx) => (
              <label key={p.label}
                className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-xl border-2 transition-all
                  ${p.enabled ? 'border-brand-400 bg-brand-50' : 'border-cream-200 hover:border-brand-300'}`}>
                <input type="checkbox" checked={p.enabled}
                  onChange={e => setScalePresets(list => list.map((x,i) => i===idx ? {...x, enabled: e.target.checked} : x))}
                  className="accent-brand-500" />
                <span className="text-sm font-medium">{p.label}</span>
              </label>
            ))}
            {customFactors.map((f, idx) => (
              <span key={f} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-brand-400 bg-brand-50 text-sm font-medium">
                ×{f}
                <button onClick={() => setCustomFactors(list => list.filter((_,i) => i!==idx))} className="text-stone-400 hover:text-stone-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1.5">
              <input type="number" step="0.1" min="0" value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                placeholder="その他の倍率"
                className="field-input w-28 text-sm py-2" />
              <button onClick={addCustomFactor} className="btn-secondary text-sm px-3 py-2">追加</button>
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-1">複数選択すると、材料名の右側に倍率ごとの分量を並べて印刷します（1つの用紙で仕込み量を切り替えられます）。</p>
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
              {multiScale && (
                <div className="flex justify-between text-[10px] text-stone-400">
                  <span></span>
                  <span className="flex gap-3">
                    {activeFactors.map(f => <span key={f.label} className="w-14 text-right">{f.label}</span>)}
                  </span>
                </div>
              )}
              {recipe.ingredients.map((ing, i) => {
                const prevLabel = i > 0 ? (recipe.ingredients[i-1].processLabel || '') : '';
                const label = ing.processLabel || '';
                const showGroupHeader = !!label && label !== prevLabel;
                return (
                <div key={i}>
                  {showGroupHeader && (
                    <div className="text-[10px] font-bold text-amber-700 mt-2 mb-0.5 first:mt-0">{label}</div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>{displayName(ing)}</span>
                    {multiScale ? (
                      <span className="flex gap-3">
                        {activeFactors.map(f => (
                          <span key={f.label} className="w-14 text-right font-medium">
                            {formatAmount(scaleAmount(ing.amount, f.factor))}{ing.unit}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="font-medium">{ing.amount}{ing.unit}</span>
                    )}
                  </div>
                </div>
                );
              })}
              {recipe.totalWeightG && (
                <div className="flex justify-between text-sm font-bold border-t border-cream-200 pt-1">
                  <span>合計重量</span>
                  {multiScale ? (
                    <span className="flex gap-3">
                      {activeFactors.map(f => (
                        <span key={f.label} className="w-14 text-right">
                          {formatAmount(scaleAmount(recipe.totalWeightG as number, f.factor))}g
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span>{recipe.totalWeightG}g</span>
                  )}
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
