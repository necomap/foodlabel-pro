'use client';
// ============================================================
// app/dashboard/recipes/pop/page.tsx - POP・プライスカード印刷（2026-11新設・全プラン）
// ============================================================
// /dashboard/recipes/pop?ids=<id>,<id>...  A4用紙に面付けして印刷（切り取り線つき）。
// データは /api/recipes/pop（商品名・販売価格・アレルゲン）。アレルゲンはラベルと同じ集計。
// 販売価格はDB上で税込/税抜の区別がないため、画面で「登録額は税込か税抜か」と税率を選ぶ。
// 価格は総額表示（税込）を大きく表示する（消費税法の総額表示義務）。
// 商品ごとの価格・キャッチコピー・枚数の上書きと全体設定は localStorage に保存する。
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, Loader2, Tag, Minus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { printHtmlDocument } from '@/lib/print-html';

interface PopItem {
  id: string; name: string; variationName: string | null; nameEn: string | null;
  salePrice: number | null; allergens: string[]; otherAllergens: string[];
}
interface Override { price?: string; catchCopy?: string; copies?: number; displayName?: string }

type SizeKey = 'S' | 'M' | 'L';
// A4（余白8mm → 194×281mm）に収まる面付け
const SIZES: Record<SizeKey, { label: string; w: number; h: number; cols: number; rows: number; name: number; price: number }> = {
  S: { label: '小（91×55mm・A4に10枚）',  w: 91, h: 55,  cols: 2, rows: 5, name: 7,  price: 9  },
  M: { label: '中（97×70mm・A4に8枚）',   w: 97, h: 70,  cols: 2, rows: 4, name: 8.5, price: 12 },
  L: { label: '大（97×140mm・A4に4枚）',  w: 97, h: 140, cols: 2, rows: 2, name: 12, price: 20 },
};
const THEMES = {
  simple:  { label: 'シンプル',   accent: '#222222', sub: '#555555', bg: '#ffffff' },
  natural: { label: 'ナチュラル', accent: '#6b4423', sub: '#8a6a4a', bg: '#fbf6ee' },
  pop:     { label: 'ポップ',     accent: '#d0342c', sub: '#b45309', bg: '#fffdf5' },
} as const;
type ThemeKey = keyof typeof THEMES;

interface Settings {
  size: SizeKey; theme: ThemeKey;
  registeredIncl: boolean;   // 登録している販売価格が税込か
  taxRate: 8 | 10;
  showBase: boolean;         // 本体価格を併記
  showAllergen: boolean;
  showEn: boolean;
  showCut: boolean;          // 切り取り線
  shopName: string;
}
const DEFAULT_SETTINGS: Settings = {
  size: 'M', theme: 'simple', registeredIncl: true, taxRate: 8,
  showBase: true, showAllergen: true, showEn: false, showCut: true, shopName: '',
};
const SETTINGS_KEY  = 'foodlabel:popSettings';
const OVERRIDES_KEY = 'foodlabel:popOverrides';

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}`;
const allergenLabel = (a: string) => (a === '乳' ? '乳成分' : a);

/** 税込価格と本体価格を出す（税抜→税込は1円未満切り捨て） */
function prices(base: number | null, s: Settings): { incl: number; excl: number } | null {
  if (base == null || !(base > 0)) return null;
  const r = s.taxRate / 100;
  return s.registeredIncl
    ? { incl: base, excl: Math.round(base / (1 + r)) }
    : { incl: Math.floor(base * (1 + r) + 1e-9), excl: base };
}

// 商品名の文字数に応じて文字サイズ（mm）を縮める。
// 単語の途中で折り返さないよう、できるだけ1行に収める（最大サイズの6割より小さくなる場合だけ2行にする）
function fitFont(text: string, widthMm: number, maxMm: number, allowTwoLines: boolean): number {
  const len = Array.from(text).reduce((n, ch) => n + (/[ -~]/.test(ch) ? 0.55 : 1), 0) || 1;
  const one = Math.min(maxMm, (widthMm * 0.94) / len);
  if (!allowTwoLines || one >= maxMm * 0.6) return Math.max(2.5, one);
  return Math.max(2.5, Math.min(maxMm, (widthMm * 2 * 0.9) / len));
}

/** バリエーション名を別行に出すか（商品名に同じ語が含まれていれば重複するので出さない） */
function showVariation(it: PopItem): boolean {
  const v = it.variationName?.trim();
  if (!v) return false;
  const norm = (x: string) => x.replace(/[\s　（）()]/g, '');
  return !norm(it.name).includes(norm(v));
}
/** 商品ごとの設定表に出す名前（自動表示の内容） */
function autoName(it: PopItem): string {
  return showVariation(it) ? `${it.name}（${it.variationName!.trim()}）` : it.name;
}

function buildCardHtml(it: PopItem, ov: Override, s: Settings): string {
  const size = SIZES[s.size];
  const innerW = size.w - 8;

  const priceBase = ov.price != null && ov.price !== '' ? Number(ov.price) : it.salePrice;
  const p = prices(Number.isFinite(priceBase as number) ? (priceBase as number) : null, s);
  // 表示名を入力していればそれだけを1つの名前として出す（バリエーション行は出さない）
  const custom = ov.displayName?.trim();
  const mainName = custom || it.name;
  const varText = !custom && showVariation(it) ? `（${it.variationName!.trim()}）` : '';
  const nameFs = fitFont(mainName, innerW, size.name, s.size !== 'S');
  const varFs  = varText ? fitFont(varText, innerW, size.name * 0.6, false) : 0;
  const all = [...it.allergens.map(allergenLabel), ...it.otherAllergens];
  const allergenText = all.length ? `アレルゲン：${all.join('・')}` : 'アレルゲン（28品目）：なし';
  return `<div class="card">
    ${ov.catchCopy ? `<div class="catch">${esc(ov.catchCopy)}</div>` : ''}
    <div class="name" style="font-size:${nameFs.toFixed(2)}mm">${esc(mainName)}</div>
    ${varText ? `<div class="var" style="font-size:${varFs.toFixed(2)}mm">${esc(varText)}</div>` : ''}
    ${s.showEn && it.nameEn ? `<div class="en">${esc(it.nameEn)}</div>` : ''}
    <div class="spacer"></div>
    ${p ? `<div class="price"><span class="yen">¥</span>${yen(p.incl)}<span class="tax">税込</span></div>
           ${s.showBase ? `<div class="base">（本体価格 ¥${yen(p.excl)}）</div>` : ''}`
        : '<div class="price none">価格未設定</div>'}
    ${s.showAllergen ? `<div class="allergen">${esc(allergenText)}</div>` : ''}
    ${s.shopName.trim() ? `<div class="shop">${esc(s.shopName.trim())}</div>` : ''}
  </div>`;
}

function buildDocHtml(items: PopItem[], overrides: Record<string, Override>, s: Settings): string {
  const size = SIZES[s.size];
  const t = THEMES[s.theme];
  const perPage = size.cols * size.rows;
  const cards: string[] = [];
  items.forEach(it => {
    const ov = overrides[it.id] ?? {};
    const copies = Math.max(0, Math.min(perPage * 5, ov.copies ?? 1));
    for (let i = 0; i < copies; i++) cards.push(buildCardHtml(it, ov, s));
  });
  const pages: string[] = [];
  for (let i = 0; i < cards.length; i += perPage) {
    pages.push(`<div class="page">${cards.slice(i, i + perPage).join('')}</div>`);
  }
  const css = `
    @page { size: A4 portrait; margin: 8mm; }
    body { margin: 0; font-family: 'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; color: #222; }
    .page { display: grid; grid-template-columns: repeat(${size.cols}, ${size.w}mm); grid-auto-rows: ${size.h}mm;
            justify-content: center; align-content: start; page-break-after: always; break-after: page; }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .card { box-sizing: border-box; width: ${size.w}mm; height: ${size.h}mm; padding: 3mm 4mm; overflow: hidden;
            display: flex; flex-direction: column; align-items: center; text-align: center; background: ${t.bg};
            outline: ${s.showCut ? '0.2mm dashed #bbb' : 'none'}; outline-offset: -0.1mm; }
    .catch { font-size: ${(size.name * 0.5).toFixed(2)}mm; color: ${t.sub}; font-weight: bold; margin-bottom: 1mm; line-height: 1.2; }
    .name { font-weight: bold; color: ${t.accent}; line-height: 1.2; word-break: break-all; }
    .var { font-weight: bold; color: ${t.accent}; line-height: 1.2; margin-top: 0.3mm; }
    .en { font-size: ${(size.name * 0.42).toFixed(2)}mm; color: ${t.sub}; font-style: italic; margin-top: 0.5mm; }
    .spacer { flex: 1; min-height: 1mm; }
    .price { font-size: ${size.price}mm; font-weight: bold; color: ${t.accent}; line-height: 1; white-space: nowrap; }
    .price .yen { font-size: 0.6em; margin-right: 0.3mm; }
    .price .tax { font-size: 0.32em; margin-left: 1mm; font-weight: normal; }
    .price.none { font-size: ${(size.price * 0.4).toFixed(2)}mm; color: #aaa; }
    .base { font-size: ${(size.price * 0.22).toFixed(2)}mm; color: #555; margin-top: 0.8mm; }
    .allergen { font-size: ${s.size === 'S' ? 2.2 : s.size === 'M' ? 2.5 : 3.2}mm; color: #444; margin-top: 1.5mm; line-height: 1.3;
                border-top: 0.2mm solid ${t.sub}55; padding-top: 1mm; width: 100%; }
    .shop { font-size: ${s.size === 'L' ? 3 : 2.2}mm; color: ${t.sub}; margin-top: 1mm; }
    @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`;
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>POP・プライスカード</title><style>${css}</style></head><body>${pages.join('')}</body></html>`;
}

export default function PopPage() {
  const [ids, setIds]           = useState<string[]>([]);
  const [items, setItems]       = useState<PopItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('ids') ?? '';
    setIds(q.split(',').filter(Boolean));
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) });
      const o = localStorage.getItem(OVERRIDES_KEY);
      if (o) setOverrides(JSON.parse(o));
    } catch { /* 初期値のまま */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    } catch { /* 保存できなくても続行 */ }
  }, [settings, overrides, loaded]);

  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/recipes/pop?ids=${encodeURIComponent(ids.join(','))}`).then(r => r.json()).then(d => {
      if (!d.success) { toast.error(d.error ?? '読み込みに失敗しました'); return; }
      setItems(d.data.items);
    }).catch(() => toast.error('通信エラー')).finally(() => setLoading(false));
  }, [ids]);

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings(s => ({ ...s, [k]: v }));
  const setOv = (id: string, patch: Override) => setOverrides(o => ({ ...o, [id]: { ...o[id], ...patch } }));

  const docHtml = useMemo(() => (items.length ? buildDocHtml(items, overrides, settings) : ''), [items, overrides, settings]);
  const previewHtml = useMemo(() => docHtml.replace('</style>',
    '@media screen { body { background:#e7e5e4; padding:12px; } .page { background:#fff; width:194mm; min-height:281mm; margin:0 auto 12px; padding:0; box-shadow:0 1px 4px rgba(0,0,0,.15); } }</style>'), [docHtml]);

  const perPage = SIZES[settings.size].cols * SIZES[settings.size].rows;
  const totalCards = items.reduce((n, it) => n + Math.max(0, overrides[it.id]?.copies ?? 1), 0);
  const sheets = Math.ceil(totalCards / perPage);

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href={ids.length === 1 ? `/dashboard/recipes/${ids[0]}` : '/dashboard/recipes'}
            className="text-sm text-stone-500 hover:text-stone-700 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" />{ids.length === 1 ? 'レシピ詳細' : 'レシピ一覧'}
          </Link>
          <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-2">
            <Tag className="w-6 h-6 text-brand-600" />POP・プライスカード
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">商品名・税込価格・アレルゲンを入れたカードをA4用紙にまとめて印刷します。</p>
        </div>
        <button onClick={() => printHtmlDocument(docHtml)} disabled={!docHtml || totalCards === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <Printer className="w-4 h-4" />{totalCards}枚を印刷（A4 {sheets}枚）
        </button>
      </div>

      {/* 全体設定 */}
      <div className="card space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-stone-500">サイズ</label>
            <select className="field-select" value={settings.size} onChange={e => update('size', e.target.value as SizeKey)}>
              {(Object.keys(SIZES) as SizeKey[]).map(k => <option key={k} value={k}>{SIZES[k].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500">デザイン</label>
            <select className="field-select" value={settings.theme} onChange={e => update('theme', e.target.value as ThemeKey)}>
              {(Object.keys(THEMES) as ThemeKey[]).map(k => <option key={k} value={k}>{THEMES[k].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500">店名（カードの下に小さく・空欄なら印刷しない）</label>
            <input className="field-input" value={settings.shopName} onChange={e => update('shopName', e.target.value)} maxLength={30} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-500">レシピに登録している販売価格は</label>
            <select className="field-select" value={settings.registeredIncl ? 'incl' : 'excl'}
              onChange={e => update('registeredIncl', e.target.value === 'incl')}>
              <option value="incl">税込価格</option>
              <option value="excl">税抜価格（本体価格）</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500">消費税率</label>
            <select className="field-select" value={settings.taxRate} onChange={e => update('taxRate', Number(e.target.value) as 8 | 10)}>
              <option value={8}>8%（軽減税率：持ち帰りの飲食料品）</option>
              <option value={10}>10%（標準税率：イートイン・酒類など）</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-700">
          {([
            ['showBase', '本体価格（税抜）も併記する'],
            ['showAllergen', 'アレルゲンを載せる'],
            ['showEn', '英語名を載せる（登録がある商品のみ）'],
            ['showCut', '切り取り線を印刷する'],
          ] as const).map(([k, label]) => (
            <label key={k} className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={settings[k]} onChange={e => update(k, e.target.checked)} />{label}
            </label>
          ))}
        </div>
      </div>

      {/* 商品ごとの設定 */}
      {!loading && items.length > 0 && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-500 border-b border-cream-200 bg-cream-50">
                <th className="text-left px-3 py-2">商品</th>
                <th className="text-left px-3 py-2">カードの表示名（任意）</th>
                <th className="text-left px-3 py-2 w-32">価格（円）</th>
                <th className="text-left px-3 py-2">キャッチコピー（任意）</th>
                <th className="text-center px-3 py-2 w-28">枚数</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const ov = overrides[it.id] ?? {};
                const copies = ov.copies ?? 1;
                return (
                  <tr key={it.id} className="border-b border-cream-100">
                    <td className="px-3 py-2 whitespace-nowrap">{it.variationName ? `${it.name}（${it.variationName}）` : it.name}</td>
                    <td className="px-3 py-2 min-w-[12rem]">
                      <input className="field-input py-1" value={ov.displayName ?? ''} maxLength={40}
                        placeholder={autoName(it)} onChange={e => setOv(it.id, { displayName: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" inputMode="numeric" className="field-input py-1"
                        value={ov.price ?? ''} placeholder={it.salePrice != null ? String(it.salePrice) : '未設定'}
                        onChange={e => setOv(it.id, { price: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input className="field-input py-1" value={ov.catchCopy ?? ''} maxLength={30}
                        placeholder="例: 当店人気No.1" onChange={e => setOv(it.id, { catchCopy: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" className="p-1 rounded hover:bg-cream-100" onClick={() => setOv(it.id, { copies: Math.max(0, copies - 1) })}><Minus className="w-4 h-4" /></button>
                        <span className="w-6 text-center">{copies}</span>
                        <button type="button" className="p-1 rounded hover:bg-cream-100" onClick={() => setOv(it.id, { copies: Math.min(perPage * 5, copies + 1) })}><Plus className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-stone-400 px-3 py-2">
            価格を空欄にするとレシピの販売価格を使います。表示名を空欄にすると商品名（バリエーション名が商品名に含まれていない場合は下に小さく）を載せます。
            表示名・価格・キャッチコピー・枚数はこのブラウザに保存されます。
          </p>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
        ) : !items.length ? (
          <div className="p-10 text-center text-stone-400 text-sm">
            レシピが選ばれていません。レシピ一覧の「POP・値札」、またはレシピ詳細の「POP」から開いてください。
          </div>
        ) : (
          <iframe title="POPプレビュー" srcDoc={previewHtml} className="w-full h-[75vh] border-0 bg-stone-200" />
        )}
      </div>
    </div>
  );
}

