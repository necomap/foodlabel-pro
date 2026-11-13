// ============================================================
// app/dashboard/labels/batch/page.tsx - まとめてラベル印刷（2026-11新設）
// ============================================================
// レシピ一覧でチェックしたレシピ（?ids=a,b,c）のラベルを、1回の操作でまとめて印刷する。
// - 各行に期限日（直接入力）と枚数。期限日の初期値は「製造日＋レシピの賞味/消費期限日数」
// - 印刷設定（用紙・フォント・表示項目・言語など）はラベル印刷画面で最後に使った設定をそのまま使う（lib/label-settings.ts）
// - A4シールは空きなく続けて詰める。ラベルプリンターは順番に連続出力。b-PAC印刷にも対応
// - 「レシピと枚数」をセットとして名前を付けて保存・呼び出しできる（DB保存。期限日は呼び出し時に再計算）
// ============================================================
'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronUp, ChevronDown, Trash2, Printer, Eye, Loader2, AlertTriangle, Settings, Save, FolderOpen, Plus, Usb, RotateCcw, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import type { LabelContent } from '@/types';
import { loadStoredLabelSettings, type StoredLabelSettings } from '@/lib/label-settings';
import { printHtmlDocument } from '@/lib/print-html';
import { printFoodLabel } from '@/lib/bpac-print';

interface RecipeOption { id: string; name: string; shelfLifeDays: number | null; shelfLifeType: string; }
interface Row { key: string; recipeId: string; count: string; expiryDate: string; expiryEdited: boolean; }
interface PrintSet { id: string; name: string; items: Array<{ recipeId: string; count: number }>; updatedAt: string; }
interface BatchResultItem { recipeId: string; recipeName: string; count: number; expiryDate: string; content: LabelContent; }

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** YYYY-MM-DD に日数を足す（ローカル日付で計算） */
const addDaysStr = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
// 作業中の内容（レシピ・枚数・期限日・製造日）をブラウザに保存しておくキー。
// 「設定はラベル印刷画面で変更」で画面を離れて戻ってきても、選んだレシピが消えないようにする（2026-11-13）。
const DRAFT_KEY = 'foodlabel:labelBatchDraft';
interface Draft { savedOn: string; mfgDate: string; setName: string; rows: Array<{ recipeId: string; count: string; expiryDate: string; expiryEdited: boolean }>; }
const loadDraft = (): Draft | null => {
  try { const v = localStorage.getItem(DRAFT_KEY); return v ? JSON.parse(v) as Draft : null; } catch { return null; }
};
let rowSeq = 0;
const newKey = () => `r${++rowSeq}`;

export default function BatchLabelPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>}>
      <BatchLabelInner />
    </Suspense>
  );
}

function BatchLabelInner() {
  const searchParams = useSearchParams();
  const [recipes, setRecipes] = useState<RecipeOption[] | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [mfgDate, setMfgDate] = useState('');
  const [settings, setSettings] = useState<StoredLabelSettings | null>(null);
  const [addId, setAddId] = useState('');

  const [sets, setSets] = useState<PrintSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [setName, setSetName] = useState('');
  const [savingSet, setSavingSet] = useState(false);

  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState('');
  const [printReady, setPrintReady] = useState(false);   // isPreview:false で生成した印刷用HTMLのときだけ true
  const [resultItems, setResultItems] = useState<BatchResultItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [zoom, setZoom] = useState(100);

  const [printStats, setPrintStats] = useState<{ used: number; limit: number; isPremium: boolean; canUseStockSync?: boolean; stockSyncConfigured?: boolean } | null>(null);
  const [deductStock, setDeductStock] = useState(true);
  const [bpacTemplatePath, setBpacTemplatePath] = useState('');
  const [bpacPrinting, setBpacPrinting] = useState(false);

  const draftReady = useRef(false);   // 初期読み込みが終わるまでは下書きを上書きしない
  const recipeMap = useMemo(() => new Map((recipes ?? []).map(r => [r.id, r])), [recipes]);

  const defaultExpiry = (recipeId: string, mfg: string) => {
    const r = recipeMap.get(recipeId);
    return addDaysStr(mfg, Math.max(0, r?.shelfLifeDays ?? 0));
  };

  /** レシピIDと枚数の並びから行を作る。一覧に無い（削除・非表示）レシピは除外して件数を返す */
  const buildRows = (items: Array<{ recipeId: string; count: number }>, mfg: string, map: Map<string, RecipeOption>) => {
    const out: Row[] = [];
    let excluded = 0;
    const seen = new Set<string>();
    for (const it of items) {
      const r = map.get(it.recipeId);
      if (!r) { excluded++; continue; }
      if (seen.has(it.recipeId)) continue;
      seen.add(it.recipeId);
      out.push({ key: newKey(), recipeId: it.recipeId, count: String(it.count || 1), expiryDate: addDaysStr(mfg, Math.max(0, r.shelfLifeDays ?? 0)), expiryEdited: false });
    }
    return { rows: out, excluded };
  };

  // 初期読み込み
  useEffect(() => {
    const mfg = todayStr();
    setMfgDate(mfg);
    setSettings(loadStoredLabelSettings());
    try { const v = localStorage.getItem('label_deductStock'); if (v !== null) setDeductStock(v === 'true'); } catch {}

    fetch('/api/labels/print-stats').then(r => r.json()).then(d => { if (d.success) setPrintStats(d.data); }).catch(() => {});
    fetch('/api/user/profile').then(r => r.json()).then(d => { if (d.success && d.data?.bpacTemplatePath) setBpacTemplatePath(d.data.bpacTemplatePath); }).catch(() => {});

    Promise.all([
      fetch('/api/recipes?perPage=1000').then(r => r.json()),
      fetch('/api/label-print-sets').then(r => r.json()).catch(() => null),
    ]).then(([rd, sd]) => {
      const list: RecipeOption[] = rd?.success
        ? rd.data.items.map((r: any) => ({ id: r.id, name: r.name, shelfLifeDays: r.shelfLifeDays, shelfLifeType: r.shelfLifeType }))
        : [];
      setRecipes(list);
      const map = new Map(list.map(r => [r.id, r]));
      const setList: PrintSet[] = sd?.success ? sd.data : [];
      setSets(setList);

      const ids = (searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean);
      const setId = searchParams.get('set');
      const draft = loadDraft();
      // 下書きと同じレシピの並び（＝同じ作業の続き）なら、入力した枚数・期限日を復元する
      const draftMatchesIds = !!draft && ids.length > 0 && draft.rows.map(r => r.recipeId).join(',') === ids.join(',');
      if (draft && draft.rows.length > 0 && !setId && (ids.length === 0 || draftMatchesIds)) {
        const sameDay = draft.savedOn === mfg;
        // 別の日の下書きは製造日を今日にし、期限日も計算し直す（前日の日付のまま印刷する事故を防ぐ）
        const useMfg = sameDay && /^\d{4}-\d{2}-\d{2}$/.test(draft.mfgDate) ? draft.mfgDate : mfg;
        const restored: Row[] = [];
        let excluded = 0;
        for (const d of draft.rows) {
          const r = map.get(d.recipeId);
          if (!r) { excluded++; continue; }
          const keepExpiry = sameDay && d.expiryEdited && /^\d{4}-\d{2}-\d{2}$/.test(d.expiryDate);
          restored.push({ key: newKey(), recipeId: d.recipeId, count: d.count || '1',
            expiryDate: keepExpiry ? d.expiryDate : addDaysStr(useMfg, Math.max(0, r.shelfLifeDays ?? 0)), expiryEdited: keepExpiry });
        }
        setMfgDate(useMfg);
        setRows(restored);
        setSetName(draft.setName ?? '');
        if (excluded > 0) toast.error(`${excluded}件のレシピは削除または非表示のため除外しました`);
      } else if (ids.length > 0) {
        const { rows: rs, excluded } = buildRows(ids.map(id => ({ recipeId: id, count: 1 })), mfg, map);
        setRows(rs);
        if (excluded > 0) toast.error(`${excluded}件のレシピは削除または非表示のため除外しました`);
      } else if (setId) {
        const s = setList.find(x => x.id === setId);
        if (s) {
          const { rows: rs, excluded } = buildRows(s.items, mfg, map);
          setRows(rs); setSelectedSetId(s.id); setSetName(s.name);
          if (excluded > 0) toast.error(`${excluded}件のレシピは削除または非表示のため除外しました`);
        }
      }
      draftReady.current = true;
    }).catch(() => { setRecipes([]); toast.error('レシピの読み込みに失敗しました'); });
  }, [searchParams]);

  // 作業中の内容を下書きとして保存
  useEffect(() => {
    if (!draftReady.current) return;
    try {
      const draft: Draft = { savedOn: todayStr(), mfgDate, setName, rows: rows.map(r => ({ recipeId: r.recipeId, count: r.count, expiryDate: r.expiryDate, expiryEdited: r.expiryEdited })) };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch { /* 保存できない環境では下書きなしで動く */ }
  }, [rows, mfgDate, setName]);

  // 内容を変えたら、生成済みのHTMLは古くなるので印刷できないようにする
  const invalidate = () => { setPrintReady(false); setResultItems([]); };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
    invalidate();
  };
  const removeRow = (key: string) => { setRows(prev => prev.filter(r => r.key !== key)); invalidate(); };
  const moveRow = (key: string, dir: -1 | 1) => {
    setRows(prev => {
      const i = prev.findIndex(r => r.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev]; [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    invalidate();
  };
  const addRow = () => {
    if (!addId) return;
    if (rows.some(r => r.recipeId === addId)) { toast.error('すでに追加されています'); return; }
    setRows(prev => [...prev, { key: newKey(), recipeId: addId, count: '1', expiryDate: defaultExpiry(addId, mfgDate), expiryEdited: false }]);
    setAddId('');
    invalidate();
  };
  // 製造日を変えたら、手で書き換えていない行の期限日を計算し直す
  const changeMfgDate = (v: string) => {
    setMfgDate(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      setRows(prev => prev.map(r => r.expiryEdited ? r : { ...r, expiryDate: defaultExpiry(r.recipeId, v) }));
    }
    invalidate();
  };

  const totalCount = rows.reduce((s, r) => s + (parseInt(r.count) || 0), 0);

  // ── セット ─────────────────────────────
  const loadSet = () => {
    const s = sets.find(x => x.id === selectedSetId);
    if (!s) { toast.error('呼び出すセットを選んでください'); return; }
    if (rows.length > 0 && !confirm(`いまの一覧を「${s.name}」の内容に置き換えます。よろしいですか？`)) return;
    const { rows: rs, excluded } = buildRows(s.items, mfgDate, recipeMap);
    setRows(rs); setSetName(s.name); invalidate();
    if (excluded > 0) toast.error(`${excluded}件のレシピは削除または非表示のため除外しました`);
    else toast.success(`「${s.name}」を呼び出しました`);
  };
  const saveSet = async () => {
    const name = setName.trim();
    if (!name) { toast.error('セット名を入力してください'); return; }
    if (rows.length === 0) { toast.error('レシピがありません'); return; }
    const exists = sets.find(s => s.name === name);
    if (exists && !confirm(`「${name}」はすでにあります。上書きしますか？`)) return;
    setSavingSet(true);
    try {
      const res = await fetch('/api/label-print-sets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, items: rows.map(r => ({ recipeId: r.recipeId, count: Math.max(1, parseInt(r.count) || 1) })) }),
      });
      const d = await res.json();
      if (!d.success) { toast.error(d.error ?? '保存に失敗しました'); return; }
      setSets(prev => [...prev.filter(s => s.id !== d.data.id), d.data].sort((a, b) => a.name.localeCompare(b.name, 'ja')));
      setSelectedSetId(d.data.id);
      toast.success(d.data.overwritten ? `「${name}」を上書き保存しました` : `「${name}」を保存しました`);
    } catch { toast.error('通信エラーが発生しました'); }
    finally { setSavingSet(false); }
  };
  const deleteSet = async () => {
    const s = sets.find(x => x.id === selectedSetId);
    if (!s) return;
    if (!confirm(`セット「${s.name}」を削除しますか？`)) return;
    try {
      const res = await fetch(`/api/label-print-sets/${s.id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!d.success) { toast.error(d.error ?? '削除に失敗しました'); return; }
      setSets(prev => prev.filter(x => x.id !== s.id));
      setSelectedSetId('');
      toast.success('削除しました');
    } catch { toast.error('通信エラーが発生しました'); }
  };

  // ── 生成・印刷 ─────────────────────────────
  const validate = (): string | null => {
    if (rows.length === 0) return 'レシピがありません。レシピ一覧でチェックして「ラベルをまとめて印刷」を押すか、下の「レシピを追加」から追加してください';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mfgDate)) return '製造日を入力してください';
    for (const r of rows) {
      const name = recipeMap.get(r.recipeId)?.name ?? '';
      const c = parseInt(r.count);
      if (!c || c < 1) return `「${name}」の枚数を1以上にしてください`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.expiryDate)) return `「${name}」の期限日を入力してください`;
      if (r.expiryDate < mfgDate) return `「${name}」の期限日が製造日より前になっています`;
    }
    return null;
  };

  const generate = async (isPreview: boolean) => {
    const err = validate();
    if (err) { toast.error(err); return; }
    const s = loadStoredLabelSettings();   // 直前にラベル印刷画面で変えた設定も反映する
    setSettings(s);
    if (!isPreview && s.fontSizePt < s.legalMinFontPt) {
      if (!confirm(`フォントサイズ${s.fontSizePt}ptは、法令上の下限（${s.legalMinFontPt}pt）を下回っています。\n続けますか？`)) return;
    }
    setLoading(true);
    try {
      const payload = {
        ...s.payload,
        manufactureDate: mfgDate,
        isPreview,
        deductStock: !isPreview && deductStock,
        items: rows.map(r => ({ recipeId: r.recipeId, count: parseInt(r.count) || 1, expiryDate: r.expiryDate })),
      };
      const res = await fetch('/api/labels/generate-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!d.success) { toast.error(d.error ?? 'ラベル生成に失敗しました'); return; }
      setHtml(d.data.html);
      setWarnings(d.data.warnings ?? []);
      setPrintReady(!isPreview);
      setResultItems(isPreview ? [] : (d.data.items ?? []));
      if ((d.data.missing ?? []).length > 0) toast.error(`${d.data.missing.length}件のレシピが見つからなかったため除外しました`);
      if (d.data.warnings?.length > 0) toast.error(`${d.data.warnings.length}件の警告があります（内容を確認してください）`);
      else toast.success(isPreview ? 'プレビューを作りました（印刷枚数にカウントされません）' : `${d.data.totalCount}枚のラベルを生成しました。「印刷する」を押してください`);
      for (const ss of (d.data.stockSync ?? []) as Array<{ recipeName: string; result: any }>) {
        if (ss.result?.attempted && !ss.result.ok) toast.error(`【${ss.recipeName}】在庫の差し引きに失敗しました: ${ss.result.error ?? '不明なエラー'}`);
      }
      const okCount = (d.data.stockSync ?? []).filter((x: any) => x.result?.attempted && x.result.ok).length;
      if (okCount > 0) toast.success(`${okCount}件のレシピの在庫を差し引きました`);
      if (!isPreview) fetch('/api/labels/print-stats').then(r => r.json()).then(x => { if (x.success) setPrintStats(x.data); }).catch(() => {});
    } catch { toast.error('通信エラーが発生しました'); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    if (!printReady || !html) { toast.error('プレビューは確認用です。先に「ラベルを生成」を押してください'); return; }
    printHtmlDocument(html);
  };

  const handleBpacPrint = async () => {
    if (!printReady || resultItems.length === 0) { toast.error('先に「ラベルを生成」を押してください'); return; }
    setBpacPrinting(true);
    try {
      let done = 0;
      for (const it of resultItems) {
        const r = await printFoodLabel(bpacTemplatePath, it.content, it.count);
        if (!r.success) { toast.error(`【${it.recipeName}】${r.error ?? 'b-PAC印刷に失敗しました'}（${done}件目まで印刷済み）`); return; }
        done++;
      }
      toast.success(`b-PACで${done}件のレシピを印刷しました`);
    } finally { setBpacPrinting(false); }
  };

  const toggleDeduct = (v: boolean) => { setDeductStock(v); try { localStorage.setItem('label_deductStock', String(v)); } catch {} };

  // b-PACはラベルプリンター・日本語ラベルのときだけ（ラベル印刷画面と同じ条件）
  const bpacAvailable = settings?.deviceType === 'LABEL_PRINTER' && settings.payload.language !== 'en';
  const remainingFree = printStats && !printStats.isPremium ? Math.max(0, printStats.limit - printStats.used) : null;
  const usedRecipeIds = new Set(rows.map(r => r.recipeId));

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/recipes" className="p-2 rounded-lg hover:bg-cream-100" aria-label="レシピ一覧へ"><ChevronLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-stone-800 font-display">ラベルをまとめて印刷</h1>
          <p className="text-stone-500 text-sm mt-0.5">複数のレシピのラベルを、期限日と枚数を指定して一度に印刷します</p>
        </div>
      </div>

      {/* 印刷設定の要約 */}
      <div className="card flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-stone-700">印刷設定：ラベル印刷画面で最後に使った設定を使います</p>
            {settings && <p className="text-stone-500 mt-0.5">{settings.summary.join('　／　')}</p>}
            {settings && !settings.hasSaved && <p className="text-amber-600 mt-0.5">まだラベル印刷画面で設定していないため、初期設定で印刷します</p>}
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1">
          <Link href="/dashboard/labels" className="btn-secondary text-sm whitespace-nowrap">設定はラベル印刷画面で変更</Link>
          <span className="text-xs text-stone-400">変更後はラベル印刷画面右上の「複数のレシピをまとめて印刷」で戻れます（選んだレシピは残ります）</span>
        </div>
      </div>

      {/* セット */}
      <div className="card space-y-3">
        <p className="font-medium text-stone-700 flex items-center gap-2"><FolderOpen className="w-4 h-4 text-brand-500" />セット（よく使う組み合わせ）</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={selectedSetId} onChange={e => setSelectedSetId(e.target.value)} className="field-select sm:w-64">
            <option value="">{sets.length === 0 ? '保存したセットはありません' : 'セットを選ぶ'}</option>
            {sets.map(s => <option key={s.id} value={s.id}>{s.name}（{s.items.length}件）</option>)}
          </select>
          <button onClick={loadSet} disabled={!selectedSetId} className="btn-secondary text-sm disabled:opacity-50">呼び出す</button>
          <button onClick={deleteSet} disabled={!selectedSetId} className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1"><Trash2 className="w-4 h-4" />削除</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="text" value={setName} onChange={e => setSetName(e.target.value)} maxLength={100} placeholder="例：朝の焼き菓子セット" className="field-input sm:w-64" />
          <button onClick={saveSet} disabled={savingSet || rows.length === 0} className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1">
            {savingSet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}いまのレシピと枚数をセットに保存
          </button>
        </div>
        <p className="text-xs text-stone-400">保存されるのはレシピと枚数です。期限日は呼び出したときの製造日から計算し直します。同じ名前で保存すると上書きします。</p>
      </div>

      {/* レシピ一覧 */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
          <div>
            <label className="field-label">製造日（全レシピ共通）</label>
            <input type="date" value={mfgDate} onChange={e => changeMfgDate(e.target.value)} className="field-input w-48" />
          </div>
          <div className="text-sm text-stone-600">
            {rows.length}レシピ・合計 <span className="font-bold text-stone-800 text-lg">{totalCount}</span> 枚
            {remainingFree !== null && <span className={`ml-2 ${totalCount > remainingFree ? 'text-red-600 font-medium' : 'text-stone-400'}`}>（今月の残り {remainingFree}枚）</span>}
          </div>
        </div>

        {recipes === null ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center text-stone-400 text-sm py-8">
            レシピがありません。<Link href="/dashboard/recipes" className="text-brand-600 hover:underline">レシピ一覧</Link>でチェックして「ラベルをまとめて印刷」を押すか、セットを呼び出すか、下から追加してください。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-stone-500 border-b border-cream-200">
                  <th className="py-2 pr-2 w-16">順番</th>
                  <th className="py-2 pr-2">レシピ</th>
                  <th className="py-2 pr-2 w-48">期限日</th>
                  <th className="py-2 pr-2 w-24">枚数</th>
                  <th className="py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const rec = recipeMap.get(r.recipeId);
                  const typeLabel = rec?.shelfLifeType === 'USE_BY' ? '消費期限' : '賞味期限';
                  return (
                    <tr key={r.key} className="border-b border-cream-100">
                      <td className="py-2 pr-2">
                        <div className="flex items-center">
                          <button onClick={() => moveRow(r.key, -1)} disabled={i === 0} className="p-1 rounded hover:bg-cream-100 disabled:opacity-30" aria-label="上へ"><ChevronUp className="w-4 h-4" /></button>
                          <button onClick={() => moveRow(r.key, 1)} disabled={i === rows.length - 1} className="p-1 rounded hover:bg-cream-100 disabled:opacity-30" aria-label="下へ"><ChevronDown className="w-4 h-4" /></button>
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <p className="font-medium text-stone-800">{rec?.name ?? '（不明なレシピ）'}</p>
                        <p className="text-xs text-stone-400">{typeLabel}{rec?.shelfLifeDays != null ? `：製造日から${rec.shelfLifeDays}日` : '：日数未設定'}</p>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1">
                          <input type="date" value={r.expiryDate} min={mfgDate || undefined}
                            onChange={e => updateRow(r.key, { expiryDate: e.target.value, expiryEdited: true })}
                            className={`field-input py-1.5 ${r.expiryEdited ? 'border-amber-400 bg-amber-50' : ''}`} />
                          {r.expiryEdited && (
                            <button onClick={() => updateRow(r.key, { expiryDate: defaultExpiry(r.recipeId, mfgDate), expiryEdited: false })}
                              className="p-1 rounded hover:bg-cream-100 text-stone-500" title="初期値（製造日＋日数）に戻す" aria-label="初期値に戻す"><RotateCcw className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={r.count}
                          onChange={e => updateRow(r.key, { count: e.target.value.replace(/[^0-9]/g, '') })}
                          className="field-input py-1.5 w-20 text-right" />
                      </td>
                      <td className="py-2">
                        <button onClick={() => removeRow(r.key)} className="p-1.5 rounded hover:bg-red-50 text-stone-400 hover:text-red-600" aria-label="削除"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {recipes && recipes.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-cream-100">
            <select value={addId} onChange={e => setAddId(e.target.value)} className="field-select sm:w-80">
              <option value="">レシピを追加…</option>
              {recipes.filter(r => !usedRecipeIds.has(r.id)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button onClick={addRow} disabled={!addId} className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1"><Plus className="w-4 h-4" />追加</button>
          </div>
        )}

        {settings?.deviceType === 'A4_PRINTER' && (
          <p className="text-xs text-stone-500 flex items-start gap-1"><Info className="w-4 h-4 flex-shrink-0" />A4シールは上から順に空きなく続けて貼り付けます（シートが埋まったときだけ次のページへ）。開始位置は最初のレシピにだけ使います。</p>
        )}

        {printStats?.canUseStockSync && printStats.stockSyncConfigured && (
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={deductStock} onChange={e => toggleDeduct(e.target.checked)} className="accent-brand-500" />
            印刷時に在庫を差し引く（レシピごと）
          </label>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => generate(true)} disabled={loading || rows.length === 0} className="btn-secondary flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}プレビュー（カウントされません）
          </button>
          <button onClick={() => generate(false)} disabled={loading || rows.length === 0} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}ラベルを生成（{totalCount}枚）
          </button>
          {printReady && (
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700">
              <Printer className="w-4 h-4" />印刷する
            </button>
          )}
          {bpacAvailable && bpacTemplatePath && (
            <button onClick={handleBpacPrint} disabled={bpacPrinting || !printReady} title={printReady ? '' : '先に「ラベルを生成」を押してください'}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50">
              {bpacPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Usb className="w-4 h-4" />}b-PAC印刷
            </button>
          )}
        </div>
        {bpacAvailable && bpacTemplatePath && !printReady && (
          <p className="text-xs text-stone-400">b-PAC印刷は「ラベルを生成」のあとに押せるようになります（レシピごとに順番に印刷します）。</p>
        )}
        {bpacAvailable && !bpacTemplatePath && (
          <p className="text-xs text-stone-400">b-PACで印刷するには、<Link href="/dashboard/settings" className="text-brand-600 hover:underline">設定</Link>の「b-PACラベル印刷の設定」でテンプレートファイルのパスを入力してください。</p>
        )}
        {settings?.deviceType === 'LABEL_PRINTER' && settings.payload.language === 'en' && bpacTemplatePath && (
          <p className="text-xs text-stone-400">英語の補助ラベルはb-PAC印刷に対応していません（ブラウザの「印刷する」をお使いください）。</p>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-medium text-amber-800 flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4" />{warnings.length}件の警告</p>
          <ul className="text-sm text-amber-800 space-y-1 list-disc pl-5">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {html && (
        <div className="border border-cream-200 rounded-xl overflow-hidden bg-white">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-cream-200 bg-cream-50">
            <span className="text-xs font-medium text-stone-600">{printReady ? '印刷用' : 'プレビュー（確認用）'}</span>
            <span className="text-xs text-stone-500 ml-auto">ズーム</span>
            <input type="range" min="50" max="200" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-40" />
            <span className="text-xs text-stone-600 w-12 text-right">{zoom}%</span>
          </div>
          <div style={{ overflow: 'hidden' }}>
            <iframe srcDoc={html} className="w-full" title="まとめて印刷のプレビュー"
              style={{ height: '600px', transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: `${10000 / zoom}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
