// ============================================================
// app/dashboard/labels/page.tsx - シール印刷ページ
// ============================================================
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, RefreshCw, Settings, AlertTriangle, Eye, Loader2, CheckCircle2, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface RecipeOption { id: string; name: string; shelfLifeDays: number | null; shelfLifeType: string; contentAmount: string | null; }
interface ShopOption   { id: string; shopName: string; isDefault: boolean; }


// レシピ検索付きセレクト
function RecipeSearchSelect({ recipes, value, onChange }: {
  recipes: Array<{id:string;name:string}>;
  value:    string;
  onChange: (v:string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open,   setOpen]   = useState(false);
  const filtered = recipes.filter(r => r.name.includes(search) || search === '');
  const selected = recipes.find(r => r.id === value);
  return (
    <div className="relative">
      <div className="field-input flex items-center gap-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <span className={selected ? 'text-stone-800' : 'text-stone-400'}>{selected?.name ?? 'レシピを選択...'}</span>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-cream-300 rounded-xl shadow-warm-lg overflow-hidden">
          <div className="p-2 border-b border-cream-200">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="field-input py-1.5 text-sm" placeholder="レシピ名で検索..." autoFocus />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button type="button" className="w-full text-left px-3 py-2 text-sm text-stone-400 hover:bg-cream-50"
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}>
              選択解除
            </button>
            {filtered.map(r => (
              <button key={r.id} type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-cream-50 ${value===r.id?'bg-brand-50 text-brand-700 font-medium':''}`}
                onClick={() => { onChange(r.id); setOpen(false); setSearch(''); }}>
                {r.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-3 text-sm text-stone-400">見つかりません</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LabelsPage() {
  const searchParams = useSearchParams();
  const iframeRef    = useRef<HTMLIFrameElement>(null);

  const [recipes,  setRecipes]  = useState<RecipeOption[]>([]);
  const [shops,    setShops]    = useState<ShopOption[]>([]);
  const [recipeId, setRecipeId] = useState(searchParams.get('recipeId') ?? '');
  const [shopId,   setShopId]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generated, setGenerated] = useState(false);
  const [printStats, setPrintStats] = useState<{used: number; limit: number; resetDate: string} | null>(null);

  // 印刷設定
  const [mfgDate,       setMfgDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [shelfOverride, setShelfOverride] = useState('');
  const [printCount,    setPrintCount]    = useState('1');
  const [fontSizePt,    setFontSizePt]    = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_fontSizePt') ?? '8' : '8');
  const [deviceType,    setDeviceType]    = useState<'LABEL_PRINTER'|'A4_PRINTER'>(() => {
    if (typeof window === 'undefined') return 'LABEL_PRINTER';
    return (localStorage.getItem('label_deviceType') as any) ?? 'LABEL_PRINTER';
  });
  // ラベルプリンタ
  const [labelW,        setLabelW]        = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_labelW') ?? '60' : '60');
  const [labelH,        setLabelH]        = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_labelH') ?? '60' : '60');
  // A4プリンタ
  const [a4Cols,   setA4Cols]   = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_a4Cols') ?? '3' : '3');
  const [a4Rows,   setA4Rows]   = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_a4Rows') ?? '5' : '5');
  const [marginT,  setMarginT]  = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_marginT') ?? '10' : '10');
  const [marginB,  setMarginB]  = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_marginB') ?? '10' : '10');
  const [marginL,  setMarginL]  = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_marginL') ?? '10' : '10');
  const [marginR,  setMarginR]  = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_marginR') ?? '10' : '10');
  const [startPos, setStartPos] = useState('1');
  // A4 シールサイズ（指定時はセルサイズより優先）
  const [a4SealW,  setA4SealW]  = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_a4SealW') ?? '' : '');
  const [a4SealH,  setA4SealH]  = useState(() => typeof window !== 'undefined' ? localStorage.getItem('label_a4SealH') ?? '' : '');
  // 栄養成分表示
  // 表示設定
  const loadBool = (key: string, def: boolean) => {
    if (typeof window === 'undefined') return def;
    const v = localStorage.getItem('label_' + key);
    return v !== null ? v === 'true' : def;
  };
  const [showPhone,    setShowPhone]    = useState(() => loadBool('showPhone', true));
  const [showRep,      setShowRep]      = useState(() => loadBool('showRep', false));
  const [showFiber,    setShowFiber]    = useState(() => loadBool('showFiber', true));
  const [showSugar,    setShowSugar]    = useState(() => loadBool('showSugar', true));
  const [showCholest,  setShowCholest]  = useState(() => loadBool('showCholest', false));
  const [showComment,  setShowComment]  = useState(() => loadBool('showComment', true));
  const [showQC,       setShowQC]       = useState(() => loadBool('showQC', true));
  const [showNutrition, setShowNutrition] = useState(() => loadBool('showNutrition', true));

  useEffect(() => {
    // 印刷枚数の残り確認
    fetch('/api/labels/print-stats')
      .then(r => r.json())
      .then(d => { if (d.success) setPrintStats(d.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // レシピ一覧を取得
    fetch('/api/recipes?perPage=200').then(r => r.json()).then(d => {
      if (d.success) setRecipes(d.data.items.map((r: RecipeOption) => ({ id: r.id, name: r.name, shelfLifeDays: r.shelfLifeDays, shelfLifeType: r.shelfLifeType, contentAmount: r.contentAmount })));
    });
    // 店舗一覧を取得
    fetch('/api/shops').then(r => r.json()).then(d => {
      if (d.success) { setShops(d.data); const def = d.data.find((s: ShopOption) => s.isDefault); if (def) setShopId(def.id); }
    });
  }, []);

  // レシピ選択時に賞味期限日数を自動セット
  useEffect(() => {
    // 印刷枚数の残り確認
    fetch('/api/labels/print-stats')
      .then(r => r.json())
      .then(d => { if (d.success) setPrintStats(d.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const r = recipes.find(r => r.id === recipeId);
    if (r?.shelfLifeDays != null) setShelfOverride(String(r.shelfLifeDays));
  }, [recipeId, recipes]);

  const handlePreview = async () => {
    if (!recipeId) { toast.error('レシピを選択してください'); return; }
    setLoading(true);
    setGenerated(false);
    try {
      const fs = parseFloat(fontSizePt);
      const payload = {
        recipeId,
        shopId: shopId || undefined,
        manufactureDate: mfgDate,
        shelfLifeDays: shelfOverride ? parseInt(shelfOverride) : undefined,
        printCount: 1,  // プレビューは1枚固定
        isPreview: true, // カウントしない
        fontSizePt: fs,
        deviceType,
        ...(deviceType === 'LABEL_PRINTER' ? {
          labelWidthMm:  parseFloat(labelW),
          labelHeightMm: parseFloat(labelH),
        } : {
          a4Cols:       parseInt(a4Cols),
          a4Rows:       parseInt(a4Rows),
          marginTopMm:  parseFloat(marginT),
          marginBottomMm: parseFloat(marginB),
          marginLeftMm: parseFloat(marginL),
          marginRightMm: parseFloat(marginR),
          startPosition: 1,
          a4SealWidthMm:  a4SealW ? parseFloat(a4SealW) : undefined,
          a4SealHeightMm: a4SealH ? parseFloat(a4SealH) : undefined,
        }),
        displaySettings: {
          showPhone, showRepresentative: showRep, showEmail: false,
          showNutrition: true, showDietaryFiber: showFiber,
          showSugar, showCholesterol: showCholest,
          showQualityControl: showQC, showComment,
          nutritionNote: '※推定値',
        },
      };
      const res = await fetch('/api/labels/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        setPreviewHtml(data.data.html);
        setGenerated(true);
        toast.success('プレビューを生成しました（印刷枚数にカウントされません）');
      } else {
        toast.error(data.error ?? 'プレビュー生成に失敗しました');
      }
    } catch { toast.error('通信エラーが発生しました'); }
    finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    if (!recipeId) { toast.error('レシピを選択してください'); return; }

    // フォントサイズ警告
    const fs = parseFloat(fontSizePt);
    if (fs < 7 && fs >= 6) {
      if (!confirm(`フォントサイズ${fontSizePt}ptは規定（8pt）より小さい設定です。\nこのサイズは貼付け面が小さい商品のみ使用可能です。続けますか？`)) return;
    }

    setLoading(true);
    setGenerated(false);
    try {
      const payload = {
        recipeId,
        shopId: shopId || undefined,
        manufactureDate: mfgDate,
        shelfLifeDays:   shelfOverride ? parseInt(shelfOverride) : undefined,
        printCount:      parseInt(printCount) || 1,
        fontSizePt:      fs,
        deviceType,
        ...(deviceType === 'LABEL_PRINTER' ? {
          labelWidthMm:  parseFloat(labelW),
          labelHeightMm: parseFloat(labelH),
        } : {
          a4Cols:       parseInt(a4Cols),
          a4Rows:       parseInt(a4Rows),
          marginTopMm:  parseFloat(marginT),
          marginBottomMm: parseFloat(marginB),
          marginLeftMm: parseFloat(marginL),
          marginRightMm: parseFloat(marginR),
          startPosition: parseInt(startPos) || 1,
          a4SealWidthMm:  a4SealW ? parseFloat(a4SealW) : undefined,
          a4SealHeightMm: a4SealH ? parseFloat(a4SealH) : undefined,
        }),
        displaySettings: {
          showPhone, showRepresentative: showRep, showEmail: false,
          showNutrition: true, showDietaryFiber: showFiber,
          showSugar, showCholesterol: showCholest,
          showQualityControl: showQC, showComment,
          nutritionNote: '※推定値',
        },
      };

      const res  = await fetch('/api/labels/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();

      if (data.success) {
        setPreviewHtml(data.data.html);
        setWarnings(data.data.warnings ?? []);
        setGenerated(true);
        if (data.data.warnings?.length > 0) toast.error(`${data.data.warnings.length}件の警告があります`);
        else toast.success('シールを生成しました');
      } else {
        toast.error(data.error ?? 'シール生成に失敗しました');
      }
    } catch { toast.error('通信エラーが発生しました'); }
    finally   { setLoading(false); }
  };

  const handlePrint = () => {
    if (!previewHtml) return;
    const win = window.open('', '_blank');
    if (!win) { toast.error('ポップアップがブロックされました'); return; }
    win.document.write(previewHtml);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800 font-display">シール印刷</h1>
        <p className="text-stone-500 text-sm mt-0.5">製造日を入力してシールを生成・印刷します</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* ============ 設定パネル ============ */}
        <div className="lg:col-span-2 space-y-4">

          {/* レシピ選択 */}
          <div className="card space-y-4">
            <h2 className="section-title">基本設定</h2>
            <div>
              <label className="field-label">レシピ <span className="text-red-500">*</span></label>
              <RecipeSearchSelect
                recipes={recipes}
                value={recipeId}
                onChange={setRecipeId}
              />
            </div>
            <div>
              <label className="field-label">店舗</label>
              <select value={shopId} onChange={e => setShopId(e.target.value)} className="field-select">
                <option value="">デフォルト店舗</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.shopName}{s.isDefault ? '（デフォルト）' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">製造日</label>
              <input type="date" value={mfgDate} onChange={e => setMfgDate(e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label">賞味/消費期限（日数）</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={shelfOverride} onChange={e => setShelfOverride(e.target.value)}
                className="field-input" placeholder="レシピ設定値を使用" min="0" />
              <p className="field-hint">空欄の場合はレシピの設定値を使用</p>
            </div>
            <div>
              <label className="field-label">印刷枚数</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={printCount} onChange={e => setPrintCount(e.target.value)}
                className="field-input" min="1" max="200" />
            </div>
          </div>

          {/* プリンタ設定 */}
          <div className="card space-y-4">
            <h2 className="section-title">プリンタ設定</h2>
            <div>
              <label className="field-label">プリンタ種別</label>
              <select value={deviceType} onChange={e => setDeviceType(e.target.value as 'LABEL_PRINTER'|'A4_PRINTER')} className="field-select">
                <option value="LABEL_PRINTER">ラベルプリンタ（サーマル等）</option>
                <option value="A4_PRINTER">A4プリンタ（レーザー・インクジェット）</option>
              </select>
            </div>
            <div>
              <label className="field-label">フォントサイズ（pt）</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={fontSizePt} onChange={e => { setFontSizePt(e.target.value); localStorage.setItem('label_fontSizePt', e.target.value); }}
                className="field-input" min="6" max="12" step="0.5" />
              <p className="field-hint">規定値: 8pt（最小: 6pt ※貼付面が小さい場合のみ）</p>
            </div>

            {deviceType === 'LABEL_PRINTER' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">シール幅（mm）</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={labelW} onChange={e => { setLabelW(e.target.value); localStorage.setItem('label_labelW', e.target.value); }} className="field-input" />
                </div>
                <div>
                  <label className="field-label">シール高さ（mm）</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={labelH} onChange={e => { setLabelH(e.target.value); localStorage.setItem('label_labelH', e.target.value); }} className="field-input" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">横（列数）</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={a4Cols} onChange={e => { setA4Cols(e.target.value); localStorage.setItem('label_a4Cols', e.target.value); }} className="field-input" min="1" max="6" />
                  </div>
                  <div>
                    <label className="field-label">縦（行数）</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={a4Rows} onChange={e => { setA4Rows(e.target.value); localStorage.setItem('label_a4Rows', e.target.value); }} className="field-input" min="1" max="10" />
                  </div>
                </div>
　　　　　　　　<div>
                  <label className="field-label">シール1枚のサイズ（任意・mm）</label>
                  <div className="flex items-center gap-2">
                    <input type="text" inputMode="decimal" value={a4SealW} onChange={e => { setA4SealW(e.target.value); localStorage.setItem('label_a4SealW', e.target.value); }} className="field-input" placeholder="幅" />
                    <span className="text-stone-400 text-sm">×</span>
                    <input type="text" inputMode="decimal" value={a4SealH} onChange={e => { setA4SealH(e.target.value); localStorage.setItem('label_a4SealH', e.target.value); }} className="field-input" placeholder="高さ" />
                    <span className="text-xs text-stone-400">mm</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">入力するとシール枠に合わせて配置します</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">上余白（mm）</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={marginT} onChange={e => { setMarginT(e.target.value); localStorage.setItem('label_marginT', e.target.value); }} className="field-input" />
                  </div>
                  <div>
                    <label className="field-label">左余白（mm）</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={marginL} onChange={e => { setMarginL(e.target.value); localStorage.setItem('label_marginL', e.target.value); }} className="field-input" />
                  </div>
                </div>
                <div>
                  <label className="field-label">印刷開始位置</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={startPos} onChange={e => setStartPos(e.target.value)}
                    className="field-input" min="1" placeholder="1（左上から）" />
                  <p className="field-hint">使用済みシール用紙を使う場合に指定</p>
                </div>
              </div>
            )}
          </div>

          {/* 表示設定 */}
          <div className="card space-y-3">
            <h2 className="section-title">表示項目設定</h2>
            {[
              { label: '電話番号を表示', value: showPhone,   onChange: (v:boolean)=>{setShowPhone(v);localStorage.setItem('label_showPhone',String(v));} },
              { label: '代表者名を表示', value: showRep,     onChange: (v:boolean)=>{setShowRep(v);localStorage.setItem('label_showRep',String(v));}, note: '個人事業主は法的義務を確認してください' },
              { label: '食物繊維を表示', value: showFiber,   onChange: (v:boolean)=>{setShowFiber(v);localStorage.setItem('label_showFiber',String(v));} },
              { label: '糖質を表示',     value: showSugar,   onChange: (v:boolean)=>{setShowSugar(v);localStorage.setItem('label_showSugar',String(v));} },
              { label: 'コレステロールを表示', value: showCholest, onChange: (v:boolean)=>{setShowCholest(v);localStorage.setItem('label_showCholest',String(v));} },
              { label: '品質管理を表示', value: showQC,      onChange: (v:boolean)=>{setShowQC(v);localStorage.setItem('label_showQC',String(v));} },
              { label: 'コメントを表示', value: showComment, onChange: (v:boolean)=>{setShowComment(v);localStorage.setItem('label_showComment',String(v));} },
            ].map(item => (
              <label key={item.label} className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={item.value} onChange={e => item.onChange(e.target.checked)}
                  className="mt-0.5 accent-brand-500" />
                <div>
                  <span className="text-sm font-medium text-stone-700">{item.label}</span>
                  {item.note && <p className="text-xs text-yellow-600 mt-0.5">{item.note}</p>}
                </div>
              </label>
            ))}
          </div>

          <button onClick={handleGenerate} disabled={loading || !recipeId}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" />生成中...</> :
              <><RefreshCw className="w-5 h-5" />シールを生成</>}
          </button>
        </div>

        {/* ============ プレビュー ============ */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card min-h-64">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title mb-0 flex items-center gap-2">
                <Eye className="w-5 h-5 text-brand-500" />
                プレビュー
              </h2>
              {generated && (
                <button onClick={handlePrint}
                  className="btn-primary flex items-center gap-2 text-sm">
                  <Printer className="w-4 h-4" />
                  印刷する
                </button>
              )}
            </div>

            {warnings.length > 0 && (
              <div className="alert-warning mb-4">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-medium">確認が必要な項目があります</p>
                  <ul className="text-sm mt-1 space-y-0.5">
                    {warnings.map((w, i) => <li key={i}>• {w}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {generated && previewHtml ? (
              <div className="border border-cream-200 rounded-xl overflow-hidden bg-white">
                <iframe
                  ref={iframeRef}
                  srcDoc={previewHtml}
                  className="w-full"
                  style={{ height: '600px' }}
                  title="シールプレビュー"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-stone-400">
                <Printer className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">左のパネルで設定してシールを生成してください</p>
              </div>
            )}
          </div>

          {generated && (
            <div className="alert-info">
              <Info className="w-5 h-5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">印刷方法</p>
                <p>「印刷する」ボタンをクリックするとブラウザの印刷ダイアログが開きます。</p>
                <p className="mt-1">ラベルプリンタの場合: 用紙サイズを手動でシールサイズに合わせてください。</p>
                <p className="mt-1">A4プリンタの場合: 「拡大縮小なし（100%）」で印刷してください。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
