'use client';
// ============================================================
// app/dashboard/allergen-table/page.tsx - アレルゲン一覧表（2026-11新設・全プラン）
// ============================================================
// 表示中の全レシピ × 特定原材料等28品目（義務9＋推奨20）の一覧表。店頭掲示・問い合わせ対応用。
// データは /api/recipes/allergen-table（ラベルと同じ collectRecipeAllergens で集約）。
// 印刷は A4横、lib/print-html.ts の printHtmlDocument（スマホでも印刷シートが開く方式）。
// 表題・注意書きなどの設定は localStorage（foodlabel:allergenTableSettings）に保存する。
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Filter, Printer, Search, AlertTriangle, CheckSquare, Square, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { printHtmlDocument } from '@/lib/print-html';

interface Row {
  id: string; name: string; nameKana: string | null; variationName: string | null;
  categoryId: string | null; categoryName: string | null; categorySort: number;
  allergens: string[]; otherAllergens: string[]; ingredientCount: number;
}

const SETTINGS_KEY = 'foodlabel:allergenTableSettings';

const DEFAULT_TITLE = 'アレルゲン一覧表';
const DEFAULT_NOTE = [
  '・この表は、各商品に使用している原材料（原材料メーカーの規格書等を含む）をもとに、特定原材料等28品目の使用の有無を示したものです。',
  '・同じ製造場所・設備で他の商品も製造しているため、●の付いていない品目が微量に混入（コンタミネーション）する可能性があります。',
  '・原材料は予告なく変更する場合があります。重いアレルギーをお持ちの方は、ご購入前にスタッフへお尋ねください。',
].join('\n');

interface Settings {
  title: string;
  shopName: string;
  note: string;
  showOptional: boolean;
  showDate: boolean;
  sortBy: 'category' | 'name';
}

const DEFAULT_SETTINGS: Settings = {
  title: DEFAULT_TITLE, shopName: '', note: DEFAULT_NOTE,
  showOptional: true, showDate: true, sortBy: 'category',
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* 読めなければ初期値 */ }
  return DEFAULT_SETTINGS;
}

function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 表示用：品目名「乳」はラベルと同じく「乳成分」と書く
const colLabel = (a: string) => (a === '乳' ? '乳成分' : a);

const displayName = (r: Row) => r.variationName ? `${r.name}（${r.variationName}）` : r.name;

function todayLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日現在`;
}

export default function AllergenTablePage() {
  const [rows, setRows]         = useState<Row[]>([]);
  const [required, setRequired] = useState<string[]>([]);
  const [optional, setOptional] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch]     = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => { setSettings(loadSettings()); setSettingsLoaded(true); }, []);
  useEffect(() => {
    if (!settingsLoaded) return;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 保存できなくても動作は続ける */ }
  }, [settings, settingsLoaded]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(s => ({ ...s, [key]: value }));

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => { if (d.success) setCategories(d.data); }).catch(() => {});
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      const res  = await fetch(`/api/recipes/allergen-table?${params}`);
      const data = await res.json();
      if (!data.success) { toast.error(data.error ?? '読み込みに失敗しました'); return; }
      setRows(data.data.items);
      setRequired(data.data.required);
      setOptional(data.data.optional);
      setTruncated(!!data.data.truncated);
    } catch {
      toast.error('通信エラー');
    } finally {
      setLoading(false);
    }
  }, [category]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const columns = useMemo(
    () => (settings.showOptional ? [...required, ...optional] : required),
    [settings.showOptional, required, optional],
  );

  // 検索・並べ替え後の表示行
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter(r => displayName(r).toLowerCase().includes(q) || (r.nameKana ?? '').toLowerCase().includes(q))
      : rows;
    const byName = (a: Row, b: Row) => (a.nameKana || a.name).localeCompare(b.nameKana || b.name, 'ja');
    return [...filtered].sort((a, b) => {
      if (settings.sortBy === 'category') {
        if (!!a.categoryName !== !!b.categoryName) return a.categoryName ? -1 : 1; // カテゴリなしは最後
        if (a.categorySort !== b.categorySort) return a.categorySort - b.categorySort;
        const c = (a.categoryName ?? '').localeCompare(b.categoryName ?? '', 'ja');
        if (c !== 0) return c;
      }
      return byName(a, b);
    });
  }, [rows, search, settings.sortBy]);

  const printRows = visibleRows.filter(r => !excluded.has(r.id));
  const hasOthers = printRows.some(r => r.otherAllergens.length > 0);
  const noIngredientRows = printRows.filter(r => r.ingredientCount === 0);

  const toggleRow = (id: string) => setExcluded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allChecked = visibleRows.length > 0 && visibleRows.every(r => !excluded.has(r.id));
  const toggleAll = () => setExcluded(prev => {
    const next = new Set(prev);
    if (allChecked) visibleRows.forEach(r => next.add(r.id));
    else visibleRows.forEach(r => next.delete(r.id));
    return next;
  });

  // ============================================================
  // 印刷（A4横）
  // ============================================================
  const handlePrint = () => {
    if (printRows.length === 0) { toast.error('印刷するレシピがありません'); return; }

    const groupByCategory = settings.sortBy === 'category';
    const colCount = 1 + columns.length + (hasOthers ? 1 : 0);
    let lastCat: string | null | undefined;
    const body = printRows.map(r => {
      let head = '';
      if (groupByCategory && r.categoryName !== lastCat) {
        lastCat = r.categoryName;
        head = `<tr class="cat"><td colspan="${colCount}">${escHtml(r.categoryName ?? 'カテゴリなし')}</td></tr>`;
      }
      const cells = columns.map((a, i) => {
        const req = i < required.length;
        const on  = r.allergens.includes(a);
        return `<td class="mk ${req ? 'req' : 'opt'}${i === required.length ? ' sep' : ''}">${on ? '●' : ''}</td>`;
      }).join('');
      const other = hasOthers ? `<td class="other">${escHtml(r.otherAllergens.join('・'))}</td>` : '';
      return `${head}<tr><td class="name">${escHtml(displayName(r))}</td>${cells}${other}</tr>`;
    }).join('');

    const headCells = columns.map((a, i) => {
      const req = i < required.length;
      return `<th class="ah ${req ? 'req' : 'opt'}${i === required.length ? ' sep' : ''}"><span>${escHtml(colLabel(a))}</span></th>`;
    }).join('');

    const groupHead = `<tr>
      <th rowspan="2" class="nh">商品名</th>
      <th colspan="${required.length}" class="gh req">特定原材料（表示義務 ${required.length}品目）</th>
      ${settings.showOptional ? `<th colspan="${optional.length}" class="gh opt sep">特定原材料に準ずるもの（表示推奨 ${optional.length}品目）</th>` : ''}
      ${hasOthers ? '<th rowspan="2" class="oh">その他</th>' : ''}
    </tr>`;

    const noteHtml = settings.note.trim()
      ? `<div class="note">${escHtml(settings.note.trim()).replace(/\n/g, '<br>')}</div>` : '';

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${escHtml(settings.title || DEFAULT_TITLE)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; color: #222; margin: 0; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2mm; }
  h1 { font-size: 15pt; margin: 0; }
  .meta { font-size: 9pt; color: #444; text-align: right; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5pt; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th, td { border: 0.2mm solid #999; }
  .nh { width: ${hasOthers ? 52 : 62}mm; background: #f3f3f3; font-size: 9pt; }
  .oh { width: 24mm; background: #f3f3f3; font-size: 8pt; }
  .gh { font-size: 8pt; padding: 1mm 0; }
  .gh.req, .ah.req { background: #fde2e2; }
  .gh.opt, .ah.opt { background: #fff3cd; }
  .ah { height: 26mm; padding: 0.5mm 0; vertical-align: bottom; font-weight: bold; }
  .ah span { writing-mode: vertical-rl; text-orientation: upright; letter-spacing: -0.5pt; font-size: 8pt; white-space: nowrap; display: inline-block; }
  .ah.req span { color: #b42318; }
  .sep { border-left: 0.6mm solid #555 !important; }
  .name { padding: 1mm 1.5mm; font-size: 8.5pt; word-break: break-all; }
  .mk { text-align: center; font-size: 10pt; line-height: 1; }
  .mk.req { color: #b42318; }
  tbody tr:nth-child(even) td.mk, tbody tr:nth-child(even) td.name, tbody tr:nth-child(even) td.other { background: #fafafa; }
  .cat td { background: #eee !important; font-weight: bold; font-size: 8.5pt; padding: 0.8mm 1.5mm; }
  .other { font-size: 7.5pt; padding: 0.5mm 1mm; word-break: break-all; }
  .legend { font-size: 8pt; margin-top: 1.5mm; color: #333; }
  .note { font-size: 8pt; margin-top: 1.5mm; line-height: 1.5; color: #333; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="hdr">
  <h1>${escHtml(settings.title || DEFAULT_TITLE)}</h1>
  <div class="meta">${[settings.shopName.trim() ? escHtml(settings.shopName.trim()) : '', settings.showDate ? todayLabel() : ''].filter(Boolean).join('<br>')}</div>
</div>
<table>
<thead>
${groupHead}
<tr>${headCells}</tr>
</thead>
<tbody>
${body}
</tbody>
</table>
<div class="legend">●＝原材料に含む${hasOthers ? '／「その他」は28品目以外で登録されているアレルゲン' : ''}</div>
${noteHtml}
</body>
</html>`;
    printHtmlDocument(html);
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/dashboard/recipes" className="text-sm text-stone-500 hover:text-stone-700 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" />レシピ一覧
          </Link>
          <h1 className="text-2xl font-bold text-stone-800 font-display">アレルゲン一覧表</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            表示中のレシピ × 特定原材料等28品目。店頭掲示やお問い合わせ対応用にA4横で印刷できます。
          </p>
        </div>
        <button onClick={handlePrint} disabled={loading || printRows.length === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <Printer className="w-4 h-4" />{printRows.length}件を印刷（A4横）
        </button>
      </div>

      {/* 絞り込み・表示設定 */}
      <div className="card space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="field-input pl-10" placeholder="レシピ名で絞り込み..." />
          </div>
          <div className="relative w-full sm:w-48">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <select value={category} onChange={e => setCategory(e.target.value)} className="field-select pl-10">
              <option value="">すべてのカテゴリ</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <select value={settings.sortBy} onChange={e => update('sortBy', e.target.value as Settings['sortBy'])}
            className="field-select w-full sm:w-44">
            <option value="category">カテゴリごとに並べる</option>
            <option value="name">名前順</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-700">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={settings.showOptional} onChange={e => update('showOptional', e.target.checked)} />
            推奨20品目も表示する
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={settings.showDate} onChange={e => update('showDate', e.target.checked)} />
            作成日を印刷する
          </label>
        </div>
      </div>

      {/* 印刷時の表題・注意書き */}
      <details className="card">
        <summary className="cursor-pointer font-medium text-stone-700">表題・店名・注意書き（印刷用）</summary>
        <div className="mt-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500">表題</label>
              <input className="field-input" value={settings.title} onChange={e => update('title', e.target.value)} maxLength={60} />
            </div>
            <div>
              <label className="text-xs text-stone-500">店名（右上に印刷・空欄なら印刷しない）</label>
              <input className="field-input" value={settings.shopName} onChange={e => update('shopName', e.target.value)} maxLength={60} />
            </div>
          </div>
          <div>
            <label className="text-xs text-stone-500">表の下の注意書き</label>
            <textarea className="field-input min-h-[96px]" value={settings.note} onChange={e => update('note', e.target.value)} maxLength={600} />
          </div>
          <button type="button" className="btn-secondary text-sm"
            onClick={() => setSettings(s => ({ ...s, title: DEFAULT_TITLE, note: DEFAULT_NOTE }))}>
            表題・注意書きを初期の文面に戻す
          </button>
          <p className="text-xs text-stone-400">この設定はこのブラウザに保存されます。</p>
        </div>
      </details>

      {truncated && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          レシピが1,000件を超えるため、先頭1,000件だけを表示しています。カテゴリで絞り込んでください。
        </div>
      )}
      {noIngredientRows.length > 0 && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>材料が登録されていないレシピがあります（{noIngredientRows.slice(0, 5).map(displayName).join('、')}{noIngredientRows.length > 5 ? ` ほか${noIngredientRows.length - 5}件` : ''}）。アレルゲンなしとして表示されるため、印刷対象から外すか材料を登録してください。</div>
        </div>
      )}

      {/* 一覧表 */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-6 w-full rounded" />)}</div>
        ) : visibleRows.length === 0 ? (
          <div className="p-10 text-center text-stone-400 text-sm">表示するレシピがありません</div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="text-xs border-collapse min-w-full">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 bg-cream-100 border-b border-r border-cream-300 px-2 py-2 text-left min-w-[180px]">
                    <button type="button" onClick={toggleAll} className="inline-flex items-center gap-1 font-medium text-stone-700">
                      {allChecked ? <CheckSquare className="w-4 h-4 text-brand-600" /> : <Square className="w-4 h-4" />}
                      商品名
                    </button>
                  </th>
                  {columns.map((a, i) => {
                    const req = i < required.length;
                    return (
                      <th key={a}
                        className={`border-b border-cream-300 px-0.5 py-1 align-bottom font-medium ${req ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-800'} ${i === required.length ? 'border-l-2 border-l-stone-400' : ''}`}>
                        <span className="inline-block [writing-mode:vertical-rl] [text-orientation:upright] tracking-tighter whitespace-nowrap leading-none">
                          {colLabel(a)}
                        </span>
                      </th>
                    );
                  })}
                  <th className="border-b border-cream-300 bg-cream-100 px-2 py-2 text-left font-medium text-stone-600 min-w-[90px]">その他</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, idx) => {
                  const showCat = settings.sortBy === 'category' && (idx === 0 || visibleRows[idx - 1].categoryName !== r.categoryName);
                  const off = excluded.has(r.id);
                  return (
                    <FragmentRow key={r.id} showCat={showCat} catName={r.categoryName} colSpan={columns.length + 2}>
                      <tr className={`${off ? 'opacity-40' : ''} hover:bg-cream-50`}>
                        <td className="sticky left-0 bg-white border-b border-r border-cream-200 px-2 py-1.5">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={!off} onChange={() => toggleRow(r.id)} />
                            <Link href={`/dashboard/recipes/${r.id}`} className="text-stone-800 hover:text-brand-700 hover:underline">
                              {displayName(r)}
                            </Link>
                          </label>
                        </td>
                        {columns.map((a, i) => {
                          const req = i < required.length;
                          const on = r.allergens.includes(a);
                          return (
                            <td key={a}
                              className={`border-b border-cream-200 text-center w-6 ${i === required.length ? 'border-l-2 border-l-stone-400' : ''} ${on ? (req ? 'text-red-600 font-bold' : 'text-yellow-700 font-bold') : ''}`}>
                              {on ? '●' : ''}
                            </td>
                          );
                        })}
                        <td className="border-b border-cream-200 px-2 text-stone-600">{r.otherAllergens.join('・')}</td>
                      </tr>
                    </FragmentRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-stone-500 flex gap-2">
        <Info className="w-4 h-4 flex-shrink-0" />
        <p>
          ●はラベルの「（一部に〜を含む）」と同じ判定です（食材マスタのアレルゲン・複合原材料の内訳から集計）。
          表に誤りがある場合は、食材マスタのアレルゲンを修正してください。チェックを外したレシピは印刷されません。
        </p>
      </div>
    </div>
  );
}

// カテゴリ見出し行＋本体行をまとめて返す（tbody 内で Fragment に key を付けるため）
function FragmentRow({ showCat, catName, colSpan, children }: {
  showCat: boolean; catName: string | null; colSpan: number; children: ReactNode;
}) {
  return (
    <>
      {showCat && (
        <tr>
          <td colSpan={colSpan} className="bg-cream-100 border-b border-cream-300 px-2 py-1 font-bold text-stone-700 sticky left-0">
            {catName ?? 'カテゴリなし'}
          </td>
        </tr>
      )}
      {children}
    </>
  );
}
