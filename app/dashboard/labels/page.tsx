// ============================================================
// app/dashboard/labels/page.tsx - ラベル印刷ページ
// ============================================================
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, RefreshCw, Settings, AlertTriangle, ChevronLeft, ChevronDown, Eye, Loader2, CheckCircle2, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface RecipeOption { id: string; name: string; variationName?: string | null; shelfLifeDays: number | null; shelfLifeType: string; contentAmount: string | null; }
interface ShopOption   { id: string; shopName: string; isDefault: boolean; }


// レシピ検索付きセレクト
function RecipeSearchSelect({ recipes, value, onChange }: {
  recipes: Array<{id:string;name:string;variationName?:string|null}>;
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
        <span className={selected ? 'text-stone-800' : 'text-stone-400'}>
          {selected ? `${selected.name}${selected.variationName ? '　' + selected.variationName : ''}` : 'レシピを選択...'}
        </span>
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
                {r.variationName && <span className="text-stone-400 ml-1.5 font-normal">{r.variationName}</span>}
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

  // 補助：localStorageからの取得
  const loadValue = (key: string, def: string) => {
    if (typeof window === 'undefined') return def;
    return localStorage.getItem('label_' + key) ?? def;
  };

  const [recipes,  setRecipes]  = useState<RecipeOption[]>([]);
  const [shops,    setShops]    = useState<ShopOption[]>([]);
  const [recipeId, setRecipeId] = useState('');
  const [shopId,   setShopId]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generated, setGenerated] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [printStats, setPrintStats] = useState<{used: number; limit: number; resetDate: string; isPremium: boolean; todayCount: number} | null>(null);

  // 印刷設定 (初期値はデフォルト)
  const [mfgDate, setMfgDate] = useState('');  const [shelfOverride, setShelfOverride] = useState('');
  const [printCount,    setPrintCount]    = useState('1');
  const [fontSizePt,    setFontSizePt]    = useState('8');
  const [deviceType,    setDeviceType]    = useState<'LABEL_PRINTER'|'A4_PRINTER'>('LABEL_PRINTER');
  
  // ラベルプリンタ
  const [labelW,        setLabelW]        = useState('60');
  const [labelH,        setLabelH]        = useState('60');
  // 無定長（連続）ロール：高さを固定せず、印刷側で内容に応じて自動的に長さを決める
  const [labelHeightAuto, setLabelHeightAuto] = useState(false);

  // A4プリンタ
  const [a4Cols,   setA4Cols]   = useState('3');
  const [a4Rows,   setA4Rows]   = useState('5');
  const [marginT,  setMarginT]  = useState('0');
  const [marginB,  setMarginB]  = useState('0');
  const [marginL,  setMarginL]  = useState('10');
  const [marginR,  setMarginR]  = useState('0');
  const [startPos, setStartPos] = useState('1');
  
  // A4 ラベルサイズ
  const [a4SealW,  setA4SealW]  = useState('');
  const [a4SealH,  setA4SealH]  = useState('');
  // A4 シール同士のスキマ（市販のスキマありラベル用紙向け）
  const [a4ColGap, setA4ColGap] = useState('0');
  const [a4RowGap, setA4RowGap] = useState('0');

  // 表示設定
  const [showPostalCode, setShowPostalCode] = useState(true);
  const [showPhone,    setShowPhone]    = useState(true);
  const [showRep,      setShowRep]      = useState(false);
  const [showFiber,    setShowFiber]    = useState(true);
  const [showSugar,    setShowSugar]    = useState(true);
  const [showCholest,  setShowCholest]  = useState(false);
  const [showComment,  setShowComment]  = useState(true);
  const [showQC,       setShowQC]       = useState(true);
  // 表示可能面積が小さい場合など、栄養成分表示自体を省略できるようにする（食品表示基準上、一定面積以下は省略可）
  const [showNutrition, setShowNutrition] = useState(true);
  const [logoHeightMm,   setLogoHeightMm]   = useState(8);
  const [qrSizeMm,       setQrSizeMm]       = useState(6);
  // シールサイズが小さい場合など、店舗設定（ロゴ/QR URL）を消さずにこの印刷ジョブだけ一時的に非表示にする
  const [showLogo, setShowLogo] = useState(true);
  const [showQr,   setShowQr]   = useState(true);
  const [showBarcode,     setShowBarcode]     = useState(true);
  const [barcodeHeightMm, setBarcodeHeightMm] = useState(7);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  // 識別マーク（リサイクルマーク）：選択中のマーク一覧・マークごとの役割名・マーク自体のサイズ（バーコードとは別設定）
  const [recycleMarks,        setRecycleMarks]        = useState<string[]>([]);
  const [recycleMarkRoles,    setRecycleMarkRoles]    = useState<Record<string,string>>({});
  const [recycleMarkHeightMm, setRecycleMarkHeightMm] = useState(8);

  // 表示可能面積（法令上の文字サイズ下限判定用・任意入力）
  const [packageWidthMm,  setPackageWidthMm]  = useState('');
  const [packageHeightMm, setPackageHeightMm] = useState('');

  // レシピ内容確認パネル（編集画面に飛ばずにその場で確認する用）
  const [recipeDetail,        setRecipeDetail]        = useState<any>(null);
  const [showRecipeDetail,    setShowRecipeDetail]    = useState(false);
  const [loadingRecipeDetail, setLoadingRecipeDetail] = useState(false);
  const [editingGenericFor,   setEditingGenericFor]   = useState<string | null>(null);
  const [genericNameInput,    setGenericNameInput]    = useState('');
  const [savingGeneric,       setSavingGeneric]       = useState(false);

  const saveGenericName = async (ingredientId: string) => {
    setSavingGeneric(true);
    try {
      const res = await fetch(`/api/ingredients/${ingredientId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genericName: genericNameInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('一般名を更新しました（同じ食材を使う他のレシピにも反映されます）');
        setRecipeDetail((prev: any) => prev && ({
          ...prev,
          ingredients: prev.ingredients.map((i: any) =>
            i.ingredientId === ingredientId
              ? { ...i, genericName: genericNameInput.trim() || null, genericNameConfirmed: true }
              : i
          ),
        }));
        setEditingGenericFor(null);
      } else {
        toast.error(data.error ?? '更新に失敗しました');
      }
    } catch { toast.error('通信エラー'); }
    finally { setSavingGeneric(false); }
  };

  // ▼ 初期マウント時にlocalStorageから設定を復元 (Hydration Mismatch防止)
  useEffect(() => {
    const getL = (k: string) => localStorage.getItem('label_' + k);
    const getB = (k: string, def: boolean) => {
      const v = getL(k);
      return v !== null ? v === 'true' : def;
    };

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setMfgDate(`${yyyy}-${mm}-${dd}`);
    const qsRecipeId = searchParams.get('recipeId');
    if (qsRecipeId) {
      setRecipeId(qsRecipeId);
      localStorage.setItem('label_recipeId', qsRecipeId);
    } else if (getL('recipeId')) setRecipeId(getL('recipeId')!);

    if (getL('shopId')) setShopId(getL('shopId')!);
    
    if (getL('printCount')) setPrintCount(getL('printCount')!);
    if (getL('fontSizePt')) setFontSizePt(getL('fontSizePt')!);
    if (getL('deviceType') === 'A4_PRINTER' || getL('deviceType') === 'LABEL_PRINTER') {
      setDeviceType(getL('deviceType') as any);
    }

    if (getL('labelW')) setLabelW(getL('labelW')!);
    if (getL('labelH')) setLabelH(getL('labelH')!);
    if (getL('labelHeightAuto') !== null) setLabelHeightAuto(getL('labelHeightAuto') === 'true');

    if (getL('a4Cols')) setA4Cols(getL('a4Cols')!);
    if (getL('a4Rows')) setA4Rows(getL('a4Rows')!);
    if (getL('marginT')) setMarginT(getL('marginT')!);
    if (getL('marginB')) setMarginB(getL('marginB')!);
    if (getL('marginL')) setMarginL(getL('marginL')!);
    if (getL('marginR')) setMarginR(getL('marginR')!);
    if (getL('startPos')) setStartPos(getL('startPos')!);

    if (getL('a4SealW') !== null) setA4SealW(getL('a4SealW')!);
    if (getL('a4SealH') !== null) setA4SealH(getL('a4SealH')!);
    if (getL('a4ColGap') !== null) setA4ColGap(getL('a4ColGap')!);
    if (getL('a4RowGap') !== null) setA4RowGap(getL('a4RowGap')!);

    if (getL('showPostalCode') !== null) setShowPostalCode(getB('showPostalCode', true));
    setShowPhone(getB('showPhone', true));
    setShowRep(getB('showRep', false));
    setShowFiber(getB('showFiber', true));
    setShowSugar(getB('showSugar', true));
    setShowCholest(getB('showCholest', false));
    setShowComment(getB('showComment', true));
    setShowQC(getB('showQC', true));
    setShowNutrition(getB('showNutrition', true));
    if (getL('logoHeightMm'))    setLogoHeightMm(Number(getL('logoHeightMm')));
    if (getL('qrSizeMm'))        setQrSizeMm(Number(getL('qrSizeMm')));
    if (getL('showLogo') !== null) setShowLogo(getL('showLogo') !== 'false');
    if (getL('showQr')   !== null) setShowQr(getL('showQr') !== 'false');
    if (getL('showBarcode') !== null)     setShowBarcode(getL('showBarcode') !== 'false');
    if (getL('barcodeHeightMm'))          setBarcodeHeightMm(Number(getL('barcodeHeightMm')));
    if (getL('recycleMarks'))             { try { setRecycleMarks(JSON.parse(getL('recycleMarks')!)); } catch {} }
    if (getL('recycleMarkRoles'))         { try { setRecycleMarkRoles(JSON.parse(getL('recycleMarkRoles')!)); } catch {} }
    if (getL('recycleMarkHeightMm'))      setRecycleMarkHeightMm(Number(getL('recycleMarkHeightMm')));
    if (getL('showBarcodeText') !== null) setShowBarcodeText(getL('showBarcodeText') !== 'false');
    if (getL('packageWidthMm') !== null)  setPackageWidthMm(getL('packageWidthMm')!);
    if (getL('packageHeightMm') !== null) setPackageHeightMm(getL('packageHeightMm')!);
  }, [searchParams]);

  useEffect(() => {
    // 印刷枚数の残り確認
    fetch('/api/labels/print-stats')
      .then(r => r.json())
      .then(d => { if (d.success) setPrintStats(d.data); })
      .catch(() => {});

    // レシピ一覧を取得
    fetch('/api/recipes?perPage=1000').then(r => r.json()).then(d => {
      if (d.success) setRecipes(d.data.items.map((r: RecipeOption) => ({ id: r.id, name: r.name, shelfLifeDays: r.shelfLifeDays, shelfLifeType: r.shelfLifeType, contentAmount: r.contentAmount })));
    });
    // 店舗一覧を取得
    fetch('/api/shops').then(r => r.json()).then(d => {
      if (d.success) { 
        setShops(d.data); 
        if (!shopId) { // 初期値がない場合のみデフォルト店舗をセット
          const def = d.data.find((s: ShopOption) => s.isDefault); 
          if (def) setShopId(def.id); 
        }
      }
    });
  }, []);

  const updateLabelStorage = (key: string, val: string) => {
    localStorage.setItem('label_' + key, val);
  };

  // 表示可能面積から法令上の文字サイズ下限を計算
  // 150cm²超: 8pt以上 / 150cm²以下: 5.5pt以上（食品表示基準）
  // 容器全体サイズが未入力の場合はシールサイズから推定（実際の容器全体の面積と異なる場合あり）
  const computeDisplayAreaCm2 = () => {
    const pw = parseFloat(packageWidthMm);
    const ph = parseFloat(packageHeightMm);
    if (pw > 0 && ph > 0) return (pw / 10) * (ph / 10);
    const lw = parseFloat(labelW) || 60;
    const lh = parseFloat(labelH) || 60;
    return (lw / 10) * (lh / 10);
  };
  const computeLegalMinFontPt = () => (computeDisplayAreaCm2() > 150 ? 8 : 5.5);



  useEffect(() => {
    const r = recipes.find(r => r.id === recipeId);
    if (r?.shelfLifeDays != null) setShelfOverride(String(r.shelfLifeDays));
    // レシピを切り替えたら確認パネルは閉じる（古い内容の誤表示防止）
    setShowRecipeDetail(false);
    setRecipeDetail(null);
  }, [recipeId, recipes]);

  const toggleRecipeDetail = async () => {
    if (!recipeId) { toast.error('レシピを選択してください'); return; }
    if (showRecipeDetail) { setShowRecipeDetail(false); return; }
    if (recipeDetail) { setShowRecipeDetail(true); return; }
    setLoadingRecipeDetail(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`);
      const data = await res.json();
      if (data.success) {
        setRecipeDetail(data.data);
        setShowRecipeDetail(true);
      } else {
        toast.error(data.error ?? 'レシピ詳細の取得に失敗しました');
      }
    } catch { toast.error('通信エラーが発生しました'); }
    finally { setLoadingRecipeDetail(false); }
  };

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
          labelHeightAuto,
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
          a4ColGapMm:     a4ColGap ? parseFloat(a4ColGap) : undefined,
          a4RowGapMm:     a4RowGap ? parseFloat(a4RowGap) : undefined,
        }),
        displaySettings: {
          showPostalCode, showPhone, showRepresentative: showRep, showEmail: false,
          showNutrition, showDietaryFiber: showFiber,
          showSugar, showCholesterol: showCholest,
          showQualityControl: showQC, showComment,
          nutritionNote: '※推定値',
        },
        logoHeightMm,
        qrSizeMm,
        showLogo,
        showQr,
        showBarcode,
        barcodeHeightMm,
        recycleMarks: recycleMarks.map(key => ({ key, role: recycleMarkRoles[key]?.trim() || undefined })),
        recycleMarkHeightMm,
        showBarcodeText,
        packageWidthMm:  packageWidthMm  ? parseFloat(packageWidthMm)  : undefined,
        packageHeightMm: packageHeightMm ? parseFloat(packageHeightMm) : undefined,
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

    // フォントサイズ警告（表示可能面積に応じた法令上の下限を下回る場合）
    const fs = parseFloat(fontSizePt);
    const legalMinFontPt = computeLegalMinFontPt();
    if (fs < legalMinFontPt) {
      const areaCm2 = computeDisplayAreaCm2();
      if (!confirm(`フォントサイズ${fontSizePt}ptは、現在の表示可能面積（約${areaCm2.toFixed(1)}cm²）での法令上の下限（${legalMinFontPt}pt）を下回っています。\n続けますか？`)) return;
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
          labelHeightAuto,
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
          a4ColGapMm:     a4ColGap ? parseFloat(a4ColGap) : undefined,
          a4RowGapMm:     a4RowGap ? parseFloat(a4RowGap) : undefined,
        }),
        displaySettings: {
          showPostalCode, showPhone, showRepresentative: showRep, showEmail: false,
          showNutrition, showDietaryFiber: showFiber,
          showSugar, showCholesterol: showCholest,
          showQualityControl: showQC, showComment,
          nutritionNote: '※推定値',
        },
        logoHeightMm,
        qrSizeMm,
        showLogo,
        showQr,
        showBarcode,
        barcodeHeightMm,
        recycleMarks: recycleMarks.map(key => ({ key, role: recycleMarkRoles[key]?.trim() || undefined })),
        recycleMarkHeightMm,
        showBarcodeText,
        packageWidthMm:  packageWidthMm  ? parseFloat(packageWidthMm)  : undefined,
        packageHeightMm: packageHeightMm ? parseFloat(packageHeightMm) : undefined,
      };

      const res  = await fetch('/api/labels/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();

      if (data.success) {
        setPreviewHtml(data.data.html);
        setWarnings(data.data.warnings ?? []);
        setGenerated(true);
        if (data.data.warnings?.length > 0) toast.error(`${data.data.warnings.length}件の警告があります`);
        else toast.success('ラベルを生成しました');
      } else {
        toast.error(data.error ?? 'ラベル生成に失敗しました');
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
      {printStats && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="w-6 h-6 text-brand-500" />
            <div>
              {printStats.isPremium ? (
                <>
                  <p className="text-brand-800 font-medium font-display">本日の印刷枚数</p>
                  <p className="text-brand-600 text-sm mt-0.5">
                    本日: <span className="font-bold">{printStats.todayCount ?? 0}</span>枚
                    　今月合計: <span className="font-bold">{printStats.used}</span>枚
                  </p>
                </>
              ) : (
                <>
                  <p className="text-brand-800 font-medium font-display">今月の残り印刷枚数</p>
                  <p className="text-brand-600 text-sm mt-0.5">
                    使用済み: <span className="font-bold">{printStats.used}</span>枚 / 上限: {printStats.limit}枚
                    <span className="ml-2 px-2 py-0.5 bg-brand-100 text-brand-700 rounded-md font-medium text-xs">
                      残り: {Math.max(0, printStats.limit - printStats.used)}枚
                    </span>
                  </p>
                </>
              )}
            </div>
          </div>
          {!printStats.isPremium && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-brand-500">リセット予定日</p>
              <p className="font-medium text-brand-700 text-sm">{printStats.resetDate}</p>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center gap-3">
          {recipeId && (
            <a href={`/dashboard/recipes/${recipeId}`}
              className="flex items-center gap-1 text-sm text-brand-600 hover:underline">
              <ChevronLeft className="w-4 h-4" />レシピに戻る
            </a>
          )}
          <h1 className="text-2xl font-bold text-stone-800 font-display">ラベル印刷</h1>
        </div>
        <p className="text-stone-500 text-sm mt-0.5">製造日を入力してラベルを生成・印刷します</p>
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
                onChange={(v) => { setRecipeId(v); updateLabelStorage('recipeId', v); }}
              />
            </div>

            {recipeId && (
              <div>
                <button type="button" onClick={toggleRecipeDetail} disabled={loadingRecipeDetail}
                  className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline disabled:opacity-50">
                  {loadingRecipeDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className={`w-4 h-4 transition-transform ${showRecipeDetail ? 'rotate-180' : ''}`} />}
                  レシピ内容を確認
                </button>
                {showRecipeDetail && recipeDetail && (
                  <div className="mt-2 p-3 rounded-lg bg-stone-50 border border-stone-200 text-sm space-y-2 max-h-96 overflow-y-auto">
                    <div><span className="font-medium text-stone-600">名称：</span>{recipeDetail.categoryName || '（未設定）'}</div>
                    <div><span className="font-medium text-stone-600">内容量：</span>{recipeDetail.contentAmount || '（未設定）'}</div>
                    <div><span className="font-medium text-stone-600">{recipeDetail.shelfLifeType === 'BEST_BEFORE' ? '賞味期限' : '消費期限'}：</span>{recipeDetail.shelfLifeDays ?? '（未設定）'}日</div>
                    <div><span className="font-medium text-stone-600">保存方法：</span>{recipeDetail.storageMethod || '（未設定）'}</div>
                    <div><span className="font-medium text-stone-600">バーコード：</span>{recipeDetail.barcode || '（未設定）'}</div>
                    <div><span className="font-medium text-stone-600">原材料名：</span>{recipeDetail.ingredientsLabel || '（未設定）'}</div>
                    <div><span className="font-medium text-stone-600">アレルゲン：</span>{recipeDetail.allergensLabel || 'なし'}</div>
                    <div>
                      <span className="font-medium text-stone-600">栄養成分（1個あたり）：</span>
                      熱量{recipeDetail.nutritionPerUnit?.energyKcal ?? '-'}kcal・
                      たんぱく質{recipeDetail.nutritionPerUnit?.protein ?? '-'}g・
                      脂質{recipeDetail.nutritionPerUnit?.fat ?? '-'}g・
                      炭水化物{recipeDetail.nutritionPerUnit?.carbohydrate ?? '-'}g・
                      食塩相当量{recipeDetail.nutritionPerUnit?.saltEquivalent ?? '-'}g
                      {recipeDetail.nutritionPerUnit?.sugar != null && `・糖質${recipeDetail.nutritionPerUnit.sugar}g`}
                      {recipeDetail.nutritionPerUnit?.dietaryFiber != null && `・食物繊維${recipeDetail.nutritionPerUnit.dietaryFiber}g`}
                      {recipeDetail.nutritionPerUnit?.cholesterol != null && `・コレステロール${recipeDetail.nutritionPerUnit.cholesterol}mg`}
                    </div>
                    {recipeDetail.printComment && <div><span className="font-medium text-stone-600">印字コメント：</span>{recipeDetail.printComment}</div>}
                    {recipeDetail.qualityControl && <div><span className="font-medium text-stone-600">お客様へのお願い・注意事項：</span>{recipeDetail.qualityControl}</div>}
                    {recipeDetail.notes && <div><span className="font-medium text-stone-600">メモ：</span>{recipeDetail.notes}</div>}
                    {recipeDetail.ingredients?.length > 0 && (
                      <details open>
                        <summary className="font-medium text-stone-600 cursor-pointer">原材料明細（{recipeDetail.ingredients.length}件）</summary>
                        <ul className="mt-1 pl-4 space-y-1.5">
                          {recipeDetail.ingredients.map((ing: any) => (
                            <li key={ing.id} className="list-disc">
                              {ing.ingredientName} {ing.amount}{ing.unit}
                              {ing.originCountry ? `（${ing.originCountry}）` : ''}
                              {ing.isAdditive ? `［添加物：${ing.additiveReason ?? ''}］` : ''}
                              {ing.ingredientId ? (
                                editingGenericFor === ing.ingredientId ? (
                                  <span className="flex items-center gap-1 mt-1">
                                    <input type="text" value={genericNameInput} onChange={e => setGenericNameInput(e.target.value)}
                                      placeholder="ラベル表示用の一般名（例:バター）" autoFocus
                                      className="field-input py-1 text-xs w-48" />
                                    <button type="button" disabled={savingGeneric} onClick={() => saveGenericName(ing.ingredientId)}
                                      className="text-xs text-brand-600 font-medium disabled:opacity-50">保存</button>
                                    <button type="button" onClick={() => setEditingGenericFor(null)}
                                      className="text-xs text-stone-400">キャンセル</button>
                                  </span>
                                ) : (
                                  <button type="button"
                                    onClick={() => { setEditingGenericFor(ing.ingredientId); setGenericNameInput(ing.genericName ?? ''); }}
                                    className="ml-2 text-xs text-brand-600 hover:underline">
                                    {ing.genericName
                                      ? `表示名: ${ing.genericName}${ing.genericNameConfirmed === false ? '（要確認）' : ''} を編集`
                                      : '一般名を設定'}
                                  </button>
                                )
                              ) : (
                                <span className="ml-2 text-xs text-stone-400">（食材マスタ未リンクのため一般名は設定できません）</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <a href={`/dashboard/recipes/${recipeId}`} className="inline-block text-brand-600 hover:underline pt-1">編集画面を開く →</a>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="field-label">店舗</label>
              <select value={shopId} onChange={e => { setShopId(e.target.value); updateLabelStorage('shopId', e.target.value); }} className="field-select">
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
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={printCount} onChange={e => { setPrintCount(e.target.value); updateLabelStorage('printCount', e.target.value); }}
                className="field-input" min="1" max="200" />
            </div>
          </div>

          {/* プリンタ設定 */}
          <div className="card space-y-4">
            <h2 className="section-title">プリンタ設定</h2>
            <div>
              <label className="field-label">プリンタ種別</label>
              <select value={deviceType} onChange={e => { setDeviceType(e.target.value as 'LABEL_PRINTER'|'A4_PRINTER'); updateLabelStorage('deviceType', e.target.value); }} className="field-select">
                <option value="LABEL_PRINTER">ラベルプリンタ（サーマル等）</option>
                <option value="A4_PRINTER">A4プリンタ（レーザー・インクジェット）</option>
              </select>
            </div>
            <div>
              <label className="field-label">フォントサイズ（pt）</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={fontSizePt} onChange={e => { setFontSizePt(e.target.value); updateLabelStorage('fontSizePt', e.target.value); }}
                className="field-input" min="6" max="12" step="0.5" />
              <p className="field-hint">法令上の下限（現在の表示可能面積 約{computeDisplayAreaCm2().toFixed(1)}cm²）: {computeLegalMinFontPt()}pt</p>
            </div>
            <div>
              <label className="field-label">容器全体のサイズ（mm・任意）</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="例：150" value={packageWidthMm}
                    onChange={e => { setPackageWidthMm(e.target.value); updateLabelStorage('packageWidthMm', e.target.value); }} className="field-input" />
                  <p className="text-xs text-stone-400 mt-0.5">↔ 幅（横方向）</p>
                </div>
                <div>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="例：100" value={packageHeightMm}
                    onChange={e => { setPackageHeightMm(e.target.value); updateLabelStorage('packageHeightMm', e.target.value); }} className="field-input" />
                  <p className="text-xs text-stone-400 mt-0.5">↕ 高さ（縦方向）</p>
                </div>
              </div>
              <p className="field-hint">シールを貼る容器・袋全体のサイズです。未入力の場合はシールサイズから推定します（実際の容器面積と異なる場合があります）。文字サイズの法令上の下限判定に使用します。</p>
            </div>

            <div>
              <label className="field-label">識別マーク（リサイクルマーク）</label>
              <div className="flex flex-col gap-2 mt-1">
                {[
                  { key: 'plastic',  label: 'プラ',       rolePlaceholder: '例：袋' },
                  { key: 'paper',    label: '紙',         rolePlaceholder: '例：外箱' },
                  { key: 'pet',      label: 'PET',        rolePlaceholder: '例：容器' },
                  { key: 'steel',    label: 'スチール缶',  rolePlaceholder: '例：缶' },
                  { key: 'aluminum', label: 'アルミ缶',    rolePlaceholder: '例：缶' },
                  { key: 'board',    label: '段ボール（任意）', rolePlaceholder: '例：外箱' },
                ].map(m => {
                  const checked = recycleMarks.includes(m.key);
                  return (
                    <div key={m.key} className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer w-32 flex-shrink-0">
                        <input type="checkbox" checked={checked}
                          onChange={e => {
                            const next = e.target.checked ? [...recycleMarks, m.key] : recycleMarks.filter(k => k !== m.key);
                            setRecycleMarks(next);
                            localStorage.setItem('label_recycleMarks', JSON.stringify(next));
                          }}
                          className="accent-brand-500" />
                        {m.label}
                      </label>
                      {checked && (
                        <input type="text" value={recycleMarkRoles[m.key] ?? ''} placeholder={m.rolePlaceholder}
                          maxLength={20}
                          onChange={e => {
                            const next = { ...recycleMarkRoles, [m.key]: e.target.value };
                            setRecycleMarkRoles(next);
                            localStorage.setItem('label_recycleMarkRoles', JSON.stringify(next));
                          }}
                          className="field-input py-1 text-sm flex-1" />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="field-hint">マークの下に、何を分別すればよいか（外箱・袋など）を役割名として任意で印字できます。</p>
              <div className="mt-3">
                <label className="field-label">識別マークのサイズ: {recycleMarkHeightMm}mm</label>
                <input type="range" min="6" max="20" value={recycleMarkHeightMm}
                  onChange={e => { setRecycleMarkHeightMm(Number(e.target.value)); localStorage.setItem('label_recycleMarkHeightMm', e.target.value); }}
                  className="w-full accent-brand-500" />
                <div className="flex justify-between text-xs text-stone-400"><span>6mm（法令上の最小）</span><span>20mm</span></div>
                <p className="field-hint">バーコードとは別に、マーク自体の大きさを指定できます。識別マークは法令上、マーク単体で6mm以上必要です。</p>
              </div>
              <p className="field-hint">バーコードの隣に小さく印字されます（ラベルプリンタ・A4どちらでも表示されます）。</p>
            </div>

            {deviceType === 'LABEL_PRINTER' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">↔ ラベル幅（横方向・mm）</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={labelW} onChange={e => { setLabelW(e.target.value); updateLabelStorage('labelW', e.target.value); }} className="field-input" />
                  </div>
                  <div>
                    <label className="field-label">↕ {labelHeightAuto ? '目安の高さ（縦方向・mm）' : 'ラベル高さ（縦方向・mm）'}</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={labelH} onChange={e => { setLabelH(e.target.value); updateLabelStorage('labelH', e.target.value); }} className="field-input" />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={labelHeightAuto}
                    onChange={e => { setLabelHeightAuto(e.target.checked); localStorage.setItem('label_labelHeightAuto', String(e.target.checked)); }}
                    className="accent-brand-500" />
                  <span className="text-sm font-medium text-stone-700">1枚ずつ印刷の長さを変える（レシートのような可変長印刷）</span>
                </label>
                <p className="text-xs text-amber-600">
                  ※ ご利用のラベル用紙が「無定長ロール」という商品名でも、ここは通常チェック不要です（このチェックと用紙の種類は別の設定です）。
                  用紙が固定サイズ（例：62mm×60mm）のシールなら、下記のとおりチェックは外したままにしてください。
                </p>
                {labelHeightAuto ? (
                  <p className="text-xs text-stone-400">
                    高さを固定せず、印刷内容に応じて1枚ごとに長さが変わります（上の「目安の高さ」は文字サイズ計算の目安としてのみ使われ、実際の印刷長さはこの通りになるとは限りません）。
                    ラベルのサイズをぴったり62×60mmなどに揃えたい場合は、このチェックは外して「ラベル高さ」に固定値を入れてください（内容が長い場合は自動的に文字が縮小されます）。
                  </p>
                ) : (
                  <p className="text-xs text-stone-400">
                    このままでOKです。ラベル幅・高さに固定サイズ（例：62mm×60mm）を入れれば、その通りの大きさで印刷されます。
                    お使いの用紙が無定長（連続）ロール紙であっても、幅・高さの設定はプリンタ本体のドライバ側（Windowsの「デバイスとプリンター」→ 印刷設定/プロパティ）で別途行うものなので、
                    このチェックとは関係ありません。ブラウザの印刷ダイアログの用紙サイズ選択より、ドライバ側の設定が優先されることがあります。
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">横（列数）</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={a4Cols} onChange={e => { setA4Cols(e.target.value); updateLabelStorage('a4Cols', e.target.value); }} className="field-input" min="1" max="6" />
                  </div>
                  <div>
                    <label className="field-label">縦（行数）</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={a4Rows} onChange={e => { setA4Rows(e.target.value); updateLabelStorage('a4Rows', e.target.value); }} className="field-input" min="1" max="10" />
                  </div>
                </div>
                <div>
                  <label className="field-label">ラベル1枚のサイズ（任意・mm）</label>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <input type="text" inputMode="decimal" value={a4SealW} onChange={e => { setA4SealW(e.target.value); updateLabelStorage('a4SealW', e.target.value); }} className="field-input" placeholder="例：70" />
                      <p className="text-xs text-stone-400 mt-0.5">↔ 幅（横方向）</p>
                    </div>
                    <span className="text-stone-400 text-sm pb-5">×</span>
                    <div className="flex-1">
                      <input type="text" inputMode="decimal" value={a4SealH} onChange={e => { setA4SealH(e.target.value); updateLabelStorage('a4SealH', e.target.value); }} className="field-input" placeholder="例：30" />
                      <p className="text-xs text-stone-400 mt-0.5">↕ 高さ（縦方向）</p>
                    </div>
                    <span className="text-xs text-stone-400 pb-5">mm</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">入力するとラベル枠に合わせて配置します</p>
                </div>
                <div>
                  <label className="field-label">シール同士のスキマ（任意・mm）</label>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <input type="text" inputMode="decimal" value={a4ColGap} onChange={e => { setA4ColGap(e.target.value); updateLabelStorage('a4ColGap', e.target.value); }} className="field-input" placeholder="0" />
                      <p className="text-xs text-stone-400 mt-0.5">↔ 横方向のスキマ（列と列の間）</p>
                    </div>
                    <span className="text-stone-400 text-sm pb-5">×</span>
                    <div className="flex-1">
                      <input type="text" inputMode="decimal" value={a4RowGap} onChange={e => { setA4RowGap(e.target.value); updateLabelStorage('a4RowGap', e.target.value); }} className="field-input" placeholder="0" />
                      <p className="text-xs text-stone-400 mt-0.5">↕ 縦方向のスキマ（行と行の間）</p>
                    </div>
                    <span className="text-xs text-stone-400 pb-5">mm</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">市販のスキマありラベル用紙（シールとシールの間に紙の地が見える用紙）を使う場合、その間隔を入力してください。隙間なく並んでいる用紙なら0のままで大丈夫です。</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">上余白（mm）</label>
                    <input type="text" inputMode="decimal" value={marginT} onChange={e => { setMarginT(e.target.value); updateLabelStorage('marginT', e.target.value); }} className="field-input" placeholder="0" />
                  </div>
                  <div>
                    <label className="field-label">左余白（mm）</label>
                    <input type="text" inputMode="decimal" value={marginL} onChange={e => { setMarginL(e.target.value); updateLabelStorage('marginL', e.target.value); }} className="field-input" placeholder="0" />
                  </div>
                </div>
                <p className="text-xs text-stone-400">右余白・下余白はシールサイズから自動計算されます</p>
                <div>
                  <label className="field-label">印刷開始位置</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={startPos} onChange={e => { setStartPos(e.target.value); updateLabelStorage('startPos', e.target.value); }}
                    className="field-input" min="1" placeholder="1（左上から）" />
                  <p className="field-hint">使用済みラベル用紙を使う場合に指定</p>
                </div>
              </div>
            )}
          </div>

          {/* 表示設定 */}
          <div className="card space-y-3">
            <h2 className="section-title">表示項目設定</h2>
            {[
              { label: '栄養成分表示を表示', value: showNutrition, onChange: (v:boolean)=>{setShowNutrition(v);localStorage.setItem('label_showNutrition',String(v));},
                note: `現在の表示可能面積は約${computeDisplayAreaCm2().toFixed(1)}cm²です。食品表示基準上、表示可能面積が30cm²以下の場合は栄養成分表示を省略できます（詳細は最新の基準をご確認ください）。シールが小さいときはOFFにできます。` },
              { label: '郵便番号を表示', value: showPostalCode, onChange: (v:boolean)=>{setShowPostalCode(v);localStorage.setItem('label_showPostalCode',String(v));} },
              { label: '電話番号を表示', value: showPhone,   onChange: (v:boolean)=>{setShowPhone(v);localStorage.setItem('label_showPhone',String(v));} },
              { label: '代表者名を表示', value: showRep,     onChange: (v:boolean)=>{setShowRep(v);localStorage.setItem('label_showRep',String(v));}, note: '個人事業主は法的義務を確認してください' },
              { label: '食物繊維を表示', value: showFiber,   onChange: (v:boolean)=>{setShowFiber(v);localStorage.setItem('label_showFiber',String(v));} },
              { label: '糖質を表示',     value: showSugar,   onChange: (v:boolean)=>{setShowSugar(v);localStorage.setItem('label_showSugar',String(v));} },
              { label: 'コレステロールを表示', value: showCholest, onChange: (v:boolean)=>{setShowCholest(v);localStorage.setItem('label_showCholest',String(v));} },
              { label: 'お客様へのお願い・注意事項を表示', value: showQC,      onChange: (v:boolean)=>{setShowQC(v);localStorage.setItem('label_showQC',String(v));} },
              { label: '印字コメントを表示', value: showComment, onChange: (v:boolean)=>{setShowComment(v);localStorage.setItem('label_showComment',String(v));} },
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

          {/* ロゴ・QRサイズ調整 */}
          <div className="card space-y-3">
            <h2 className="section-title">ロゴ・QRコード・バーコード</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={showLogo} onChange={e => { setShowLogo(e.target.checked); localStorage.setItem('label_showLogo', String(e.target.checked)); }} className="accent-brand-500" />
              <span className="text-sm font-medium text-stone-700">ロゴを表示</span>
            </label>
            {showLogo && (
              <div>
                <label className="field-label">ロゴの高さ: {logoHeightMm}mm</label>
                <input type="range" min="4" max="20" value={logoHeightMm}
                  onChange={e => { setLogoHeightMm(Number(e.target.value)); localStorage.setItem('label_logoHeightMm', e.target.value); }}
                  className="w-full accent-brand-500" />
                <div className="flex justify-between text-xs text-stone-400"><span>4mm</span><span>20mm</span></div>
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={showQr} onChange={e => { setShowQr(e.target.checked); localStorage.setItem('label_showQr', String(e.target.checked)); }} className="accent-brand-500" />
              <span className="text-sm font-medium text-stone-700">QRコードを表示</span>
            </label>
            {showQr && (
              <div>
                <label className="field-label">QRコードサイズ: {qrSizeMm}mm</label>
                <input type="range" min="4" max="20" value={qrSizeMm}
                  onChange={e => { setQrSizeMm(Number(e.target.value)); localStorage.setItem('label_qrSizeMm', e.target.value); }}
                  className="w-full accent-brand-500" />
                <div className="flex justify-between text-xs text-stone-400"><span>4mm（小）</span><span>20mm（大）</span></div>
                <p className="text-xs text-amber-600 mt-1">※6mm未満はスマホで読み込めない場合があります</p>
              </div>
            )}
            <p className="text-xs text-stone-400">ロゴ・QRコードのURL自体は設定画面のまま保持されます。シールサイズが小さいときなど、この印刷ジョブだけ一時的に非表示にしたい場合はチェックを外してください。</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={showBarcode} onChange={e => { setShowBarcode(e.target.checked); localStorage.setItem('label_showBarcode', String(e.target.checked)); }} className="accent-brand-500" />
              <span className="text-sm font-medium text-stone-700">バーコードを表示</span>
            </label>
            {showBarcode && (
              <div>
                <label className="field-label">バーコード縦幅: {barcodeHeightMm}mm</label>
                <input type="range" min="5" max="15" value={barcodeHeightMm}
                  onChange={e => { setBarcodeHeightMm(Number(e.target.value)); localStorage.setItem('label_barcodeHeightMm', e.target.value); }}
                  className="w-full accent-brand-500" />
                <div className="flex justify-between text-xs text-stone-400"><span>5mm（細）</span><span>15mm（太）</span></div>
                {barcodeHeightMm < 7 && showBarcodeText && (
                  <p className="text-xs text-amber-600 mt-1">※7mm未満は数値表示ONだとリーダーで読み取れない場合があります。数値表示をOFFにすると読み取りやすくなります。</p>
                )}
              </div>
            )}
            {showBarcode && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={showBarcodeText} onChange={e => { setShowBarcodeText(e.target.checked); localStorage.setItem('label_showBarcodeText', String(e.target.checked)); }} className="accent-brand-500" />
                <span className="text-sm font-medium text-stone-700">バーコード数値を表示</span>
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handlePreview} disabled={loading || !recipeId}
              className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-brand-500 text-brand-600 hover:bg-brand-50 rounded-xl font-medium transition-all">
              <Eye className="w-5 h-5" />1枚プレビュー
            </button>
            <button onClick={handleGenerate} disabled={loading || !recipeId}
              className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />処理中...</> :
                <><RefreshCw className="w-5 h-5" />ラベルを生成</>}
            </button>
          </div>
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
                <div className="flex items-center gap-3 px-4 py-2 border-b border-cream-200 bg-cream-50">
                  <span className="text-xs text-stone-500">ズーム</span>
                  <input type="range" min="50" max="200" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="flex-1" />
                  <span className="text-xs text-stone-600 w-12 text-right">{zoom}%</span>
                  <button onClick={() => setZoom(100)} className="text-xs text-brand-600 hover:underline">リセット</button>
                </div>
                <div style={{ overflow: 'hidden' }}>
                <iframe
                  ref={iframeRef}
                  srcDoc={previewHtml}
                  className="w-full"
                  style={{ height: '600px', transform: `scale(${zoom/100})`, transformOrigin: 'top left', width: `${10000/zoom}%` }}
                  title="ラベルプレビュー"
                />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-stone-400">
                <Printer className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">左のパネルで設定してラベルを生成してください</p>
              </div>
            )}
          </div>

          {generated && (
            <div className="alert-info">
              <Info className="w-5 h-5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">印刷方法</p>
                <p>「印刷する」ボタンをクリックするとブラウザの印刷ダイアログが開きます。</p>
                <p className="mt-1">ラベルプリンタの場合: 用紙サイズを手動でラベルサイズに合わせてください。</p>
                <p className="mt-1">A4プリンタの場合: 「拡大縮小なし（100%）」で印刷してください。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
