'use client';
// ============================================================
// app/dashboard/recipes/spec-sheet/page.tsx - 商品規格書（2026-11新設・全プラン）
// ============================================================
// /dashboard/recipes/spec-sheet?ids=<id>,<id>...  1商品A4縦1ページ。複数指定すると1件ずつ改ページ。
// データは /api/recipes/spec-sheet（ラベル印刷と同じ buildRecipeLabel で組み立て）。
// 配合表は企業秘密のため初期値OFF。提出先・担当者・備考などの設定は localStorage に保存（提出先は保存しない）。
// 印刷は lib/print-html.ts の printHtmlDocument（PDF保存はブラウザの印刷画面から）。
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, Loader2, AlertTriangle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { printHtmlDocument } from '@/lib/print-html';
import { parseGramsFromContentAmount } from '@/lib/nutrition-claims';

interface NutLabel {
  label: string; energyKcal: number; protein: number; fat: number; carbohydrate: number;
  saltEquivalent: number; dietaryFiber?: number; sugar?: number; cholesterol?: number;
}
type NutRaw = Record<string, number | null> | null;

interface SpecItem {
  id: string; name: string; variationName: string | null; categoryName: string;
  ingredientsText: string; allergens: string[]; contentAmount: string; unitCount: number;
  shelfLifeDays: number | null; shelfLifeType: string; storageMethod: string; barcode: string | null;
  nutritionLabel: NutLabel; nutritionPerUnitRaw: NutRaw; nutritionTotal: NutRaw;
  totalWeightG: number | null; isEstimated: boolean;
  manufacturer: { name: string; postalCode: string; address: string; phone: string };
  formula: { name: string; amount: number; unit: string }[];
  warnings: string[];
}
interface ShopOption { id: string; shopName: string; isDefault?: boolean }

const SETTINGS_KEY = 'foodlabel:specSheetSettings';
interface Settings { showFormula: boolean; showPer100: boolean; staff: string; note: string }
const DEFAULT_SETTINGS: Settings = { showFormula: false, showPer100: true, staff: '', note: '' };

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${y}年${m}月${d}日`; };
const n1 = (v: number | null | undefined) => (v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1));
const n0 = (v: number | null | undefined) => (v == null ? '—' : String(Math.round(v)));
const n2 = (v: number | null | undefined) => (v == null ? '—' : (Math.round(v * 100) / 100).toFixed(2));
const colLabel = (a: string) => (a === '乳' ? '乳成分' : a);

// 100gあたり：内容量に重量（g）があれば「1個あたり ÷ 重量」、無ければ「全体 ÷ 材料の合計重量」
function per100Of(it: SpecItem): { v: Record<string, number | null>; basis: string } | null {
  const keys = ['energyKcal', 'protein', 'fat', 'carbohydrate', 'saltEquivalent', 'dietaryFiber', 'sugar'];
  const w = parseGramsFromContentAmount(it.contentAmount);
  const src = w ? it.nutritionPerUnitRaw : it.nutritionTotal;
  const base = w ?? it.totalWeightG;
  if (!src || !base) return null;
  const v: Record<string, number | null> = {};
  keys.forEach(k => { const x = src[k]; v[k] = x == null ? null : (Number(x) * 100) / base; });
  return { v, basis: w ? `内容量（${w}g）から換算` : '材料の合計重量から換算（焼成による水分の減少は含まない）' };
}

function shelfLifeText(it: SpecItem): string {
  const type = it.shelfLifeType === 'USE_BY' ? '消費期限' : '賞味期限';
  return it.shelfLifeDays != null ? `${type}：製造日から${it.shelfLifeDays}日` : `${type}：—`;
}

function buildSheetHtml(it: SpecItem, opt: Settings & { required: string[]; optional: string[]; today: string; recipient: string }): string {
  const name = it.variationName ? `${it.name}（${it.variationName}）` : it.name;
  const allergenCells = (list: string[], req: boolean) => list.map(a => {
    const on = it.allergens.includes(a);
    return `<td class="ac ${req ? 'req' : ''}"><div class="an">${esc(colLabel(a))}</div><div class="am">${on ? '●' : '－'}</div></td>`;
  }).join('');
  // アレルゲン表は1行10品目で折り返す
  const rowsOf = (list: string[], req: boolean) => {
    const out: string[] = [];
    for (let i = 0; i < list.length; i += 10) {
      const chunk = list.slice(i, i + 10);
      out.push(`<tr>${allergenCells(chunk, req)}${'<td class="ac empty"></td>'.repeat(10 - chunk.length)}</tr>`);
    }
    return out.join('');
  };
  const others = it.allergens.filter(a => !opt.required.includes(a) && !opt.optional.includes(a));

  const nl = it.nutritionLabel;
  const p100 = opt.showPer100 ? per100Of(it) : null;
  const nutRow = (label: string, unit: string, a: string, b: string | null) =>
    `<tr><th>${label}</th><td class="num">${a}${unit}</td>${p100 ? `<td class="num">${b ?? '—'}${b && b !== '—' ? unit : ''}</td>` : ''}</tr>`;

  const formulaTotalG = it.formula.reduce((s, f) => s + (f.unit === 'g' || f.unit === 'ml' ? f.amount : f.unit === 'kg' || f.unit === 'L' ? f.amount * 1000 : 0), 0);
  const formulaHtml = opt.showFormula && it.formula.length ? `
    <h2>配合表</h2>
    <table class="formula">
      <thead><tr><th>材料</th><th class="num">分量</th><th class="num">配合比</th></tr></thead>
      <tbody>${it.formula.map(f => {
        const g = f.unit === 'g' || f.unit === 'ml' ? f.amount : f.unit === 'kg' || f.unit === 'L' ? f.amount * 1000 : null;
        const ratio = g != null && formulaTotalG > 0 ? `${((g / formulaTotalG) * 100).toFixed(1)}%` : '—';
        return `<tr><td>${esc(f.name)}</td><td class="num">${esc(String(f.amount))}${esc(f.unit)}</td><td class="num">${ratio}</td></tr>`;
      }).join('')}</tbody>
    </table>
    <p class="small">配合比は重量（g・kg・ml・L）で入力された材料の合計に対する割合です。仕込み${it.unitCount}個分。</p>` : '';

  const m = it.manufacturer;
  return `
<section class="sheet">
  <div class="top">
    <div class="recipient">${opt.recipient ? `${esc(opt.recipient)}　御中` : ''}</div>
    <div class="date">作成日：${fmtDate(opt.today)}</div>
  </div>
  <h1>商品規格書</h1>
  <table class="info">
    <tr><th>商品名</th><td class="pname">${esc(name)}</td></tr>
    <tr><th>名称</th><td>${esc(it.categoryName || '—')}</td></tr>
    <tr><th>原材料名</th><td>${esc(it.ingredientsText || '—')}</td></tr>
    <tr><th>内容量</th><td>${esc(it.contentAmount || '—')}</td></tr>
    <tr><th>期限</th><td>${esc(shelfLifeText(it))}</td></tr>
    <tr><th>保存方法</th><td>${esc(it.storageMethod || '—')}</td></tr>
    ${it.barcode ? `<tr><th>JANコード</th><td>${esc(it.barcode)}</td></tr>` : ''}
    <tr><th>製造者</th><td>${esc(m.name || '—')}<br>${m.postalCode ? `〒${esc(m.postalCode)} ` : ''}${esc(m.address)}${m.phone ? `<br>TEL ${esc(m.phone)}` : ''}</td></tr>
  </table>

  <h2>アレルゲン（特定原材料等）　<span class="small">●＝含む　－＝含まない</span></h2>
  <div class="sub">特定原材料（表示義務 ${opt.required.length}品目）</div>
  <table class="allergen">${rowsOf(opt.required, true)}</table>
  <div class="sub">特定原材料に準ずるもの（表示推奨 ${opt.optional.length}品目）</div>
  <table class="allergen">${rowsOf(opt.optional, false)}</table>
  ${others.length ? `<p class="small">上記以外：${esc(others.join('・'))}</p>` : ''}

  <div class="row2">
  <div class="col-nut">
  <h2>栄養成分表示${it.isEstimated ? '（推定値）' : ''}</h2>
  <table class="nut">
    <thead><tr><th></th><th class="num">${esc(nl.label || '1個あたり')}</th>${p100 ? '<th class="num">100gあたり</th>' : ''}</tr></thead>
    <tbody>
      ${nutRow('熱量', 'kcal', n0(nl.energyKcal), p100 ? n0(p100.v.energyKcal) : null)}
      ${nutRow('たんぱく質', 'g', n1(nl.protein), p100 ? n1(p100.v.protein) : null)}
      ${nutRow('脂質', 'g', n1(nl.fat), p100 ? n1(p100.v.fat) : null)}
      ${nutRow('炭水化物', 'g', n1(nl.carbohydrate), p100 ? n1(p100.v.carbohydrate) : null)}
      ${nutRow('食塩相当量', 'g', n2(nl.saltEquivalent), p100 ? n2(p100.v.saltEquivalent) : null)}
    </tbody>
  </table>
  <p class="small">${it.isEstimated ? 'この表示値は、日本食品標準成分表等をもとにした推定値です。' : ''}${p100 ? `100gあたりは${esc(p100.basis)}した参考値です。` : ''}</p>
  </div>
  ${formulaHtml ? `<div class="col-formula">${formulaHtml}</div>` : ''}
  </div>

  ${opt.note.trim() ? `<h2>備考</h2><div class="note">${esc(opt.note.trim()).replace(/\n/g, '<br>')}</div>` : ''}
  <div class="footer">${opt.staff.trim() ? `担当：${esc(opt.staff.trim())}` : ''}</div>
</section>`;
}

const SHEET_CSS = `
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body { font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; color: #222; margin: 0; font-size: 9pt; }
  .sheet { page-break-after: always; break-after: page; }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  .top { display: flex; justify-content: space-between; font-size: 9.5pt; }
  .recipient { font-size: 10.5pt; border-bottom: 0.3mm solid #333; min-width: 60mm; }
  h1 { text-align: center; font-size: 16pt; letter-spacing: 4pt; margin: 3mm 0 3mm; }
  h2 { font-size: 10pt; margin: 3mm 0 1.2mm; border-left: 1.2mm solid #555; padding-left: 2mm; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 0.2mm solid #888; padding: 0.9mm 1.8mm; vertical-align: top; }
  .info th { width: 24mm; background: #f2f2f2; text-align: left; white-space: nowrap; }
  .pname { font-size: 11pt; font-weight: bold; }
  .sub { font-size: 8pt; margin: 1.2mm 0 0.6mm; color: #444; }
  .allergen td.ac { width: 10%; text-align: center; padding: 0.5mm 0.3mm; }
  .allergen td.req { background: #fdecec; }
  .allergen td.empty { border: none; background: none; }
  .an { font-size: 7.5pt; white-space: nowrap; letter-spacing: -0.3pt; }
  .am { font-size: 10.5pt; line-height: 1.15; }
  .row2 { display: flex; gap: 5mm; align-items: flex-start; }
  .col-nut { flex: 0 0 78mm; }
  .col-formula { flex: 1; min-width: 0; }
  .nut th { text-align: left; background: #f7f7f7; font-weight: normal; }
  .nut thead th { background: #eee; font-weight: bold; }
  .num { text-align: right; white-space: nowrap; }
  .formula { font-size: 8pt; }
  .formula th, .formula td { padding: 0.35mm 1.5mm; line-height: 1.25; }
  .formula thead th { background: #eee; }
  .small { font-size: 7pt; color: #555; margin: 0.8mm 0; }
  .note { border: 0.2mm solid #888; padding: 1.5mm 2mm; min-height: 8mm; }
  .footer { text-align: right; margin-top: 3mm; font-size: 9pt; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

export default function SpecSheetPage() {
  const [ids, setIds]           = useState<string[]>([]);
  const [shops, setShops]       = useState<ShopOption[]>([]);
  const [shopId, setShopId]     = useState('');
  const [items, setItems]       = useState<SpecItem[]>([]);
  const [required, setRequired] = useState<string[]>([]);
  const [optional, setOptional] = useState<string[]>([]);
  const [today, setToday]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [recipient, setRecipient] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ids は URL から（useSearchParams を使うと Suspense 境界が必要になるため window から読む）
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('ids') ?? '';
    setIds(q.split(',').filter(Boolean));
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch { /* 初期値のまま */ }
    setSettingsLoaded(true);
    fetch('/api/shops').then(r => r.json()).then(d => {
      if (d.success) {
        setShops(d.data);
        const def = d.data.find((s: ShopOption) => s.isDefault);
        if (def) setShopId(def.id);
      }
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!settingsLoaded) return;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 保存できなくても続行 */ }
  }, [settings, settingsLoaded]);

  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ ids: ids.join(',') });
    if (shopId) params.set('shopId', shopId);
    fetch(`/api/recipes/spec-sheet?${params}`).then(r => r.json()).then(d => {
      if (!d.success) { toast.error(d.error ?? '読み込みに失敗しました'); return; }
      setItems(d.data.items); setRequired(d.data.required); setOptional(d.data.optional); setToday(d.data.today);
    }).catch(() => toast.error('通信エラー')).finally(() => setLoading(false));
  }, [ids, shopId]);

  const docHtml = useMemo(() => {
    if (!items.length) return '';
    const opt = { ...settings, required, optional, today, recipient };
    return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>商品規格書</title><style>${SHEET_CSS}</style></head><body>${items.map(it => buildSheetHtml(it, opt)).join('')}</body></html>`;
  }, [items, settings, required, optional, today, recipient]);

  // 画面プレビュー用：ページ区切りを見やすくする
  const previewHtml = useMemo(() => docHtml.replace('</style>',
    `@media screen { body { background:#e7e5e4; padding:12px; } .sheet { background:#fff; width:186mm; min-height:273mm; margin:0 auto 12px; padding:12mm; box-shadow:0 1px 4px rgba(0,0,0,.15); } }</style>`), [docHtml]);

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings(s => ({ ...s, [k]: v }));
  const allWarnings = items.flatMap(it => it.warnings.map(w => `${it.name}：${w}`));

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href={ids.length === 1 ? `/dashboard/recipes/${ids[0]}` : '/dashboard/recipes'}
            className="text-sm text-stone-500 hover:text-stone-700 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" />{ids.length === 1 ? 'レシピ詳細' : 'レシピ一覧'}
          </Link>
          <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-600" />商品規格書
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">卸先・道の駅・百貨店などへの提出用。1商品A4縦1ページで印刷・PDF保存できます。</p>
        </div>
        <button onClick={() => printHtmlDocument(docHtml)} disabled={!docHtml}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <Printer className="w-4 h-4" />{items.length > 1 ? `${items.length}件を` : ''}印刷・PDF保存
        </button>
      </div>

      <div className="card space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-stone-500">提出先（「御中」は自動で付きます・保存しません）</label>
            <input className="field-input" value={recipient} onChange={e => setRecipient(e.target.value)} maxLength={60} placeholder="例: 道の駅〇〇" />
          </div>
          <div>
            <label className="text-xs text-stone-500">製造者として載せる店舗</label>
            <select className="field-select" value={shopId} onChange={e => setShopId(e.target.value)}>
              <option value="">（デフォルト店舗／ユーザー情報）</option>
              {shops.map(s => <option key={s.id} value={s.id}>{s.shopName}{s.isDefault ? '（デフォルト）' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500">担当者（右下に印刷）</label>
            <input className="field-input" value={settings.staff} onChange={e => update('staff', e.target.value)} maxLength={40} />
          </div>
        </div>
        <div>
          <label className="text-xs text-stone-500">備考（全ページ共通・空欄なら印刷しない）</label>
          <textarea className="field-input min-h-[60px]" value={settings.note} onChange={e => update('note', e.target.value)} maxLength={400}
            placeholder="例: 同じ製造場所でそば・落花生を含む製品を製造しています。" />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-700">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={settings.showPer100} onChange={e => update('showPer100', e.target.checked)} />
            栄養成分に100gあたりも載せる
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={settings.showFormula} onChange={e => update('showFormula', e.target.checked)} />
            配合表（材料の分量）を載せる
          </label>
        </div>
        {settings.showFormula && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            配合表には材料の分量がそのまま載ります。提出先に開示してよいか確認してから印刷してください。
          </p>
        )}
      </div>

      {allWarnings.length > 0 && (
        <div className="card bg-amber-50 border-amber-200 text-amber-800 text-sm">
          <div className="flex gap-2 font-medium mb-1"><AlertTriangle className="w-4 h-4 mt-0.5" />ラベルと同じ注意事項があります</div>
          <ul className="list-disc pl-6 space-y-0.5 text-xs">
            {allWarnings.slice(0, 10).map((w, i) => <li key={i}>{w}</li>)}
            {allWarnings.length > 10 && <li>ほか{allWarnings.length - 10}件</li>}
          </ul>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
        ) : !items.length ? (
          <div className="p-10 text-center text-stone-400 text-sm">
            レシピが選ばれていません。レシピ詳細の「商品規格書」、またはレシピ一覧の「商品規格書」から開いてください。
          </div>
        ) : (
          <iframe title="商品規格書プレビュー" srcDoc={previewHtml} className="w-full h-[75vh] border-0 bg-stone-200" />
        )}
      </div>
    </div>
  );
}
