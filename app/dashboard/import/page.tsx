'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, Info, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImportResult { imported: number; skipped: number; total: number; errors: Array<{row:number;message:string}>; warnings: Array<{row:number;message:string}>; }

export default function ImportExportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [tab, setTab] = useState<'import'|'export'>(searchParams?.get('tab') === 'export' ? 'export' : 'import');
  const [file, setFile] = useState<File|null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult|null>(null);
  const [exportOpts, setExportOpts] = useState({ includeNutrition: true, includeSteps: true, includeCost: true });

  const handleImport = async () => {
    if (!file) { toast.error('ファイルを選択してください'); return; }
    setLoading(true); setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('overwrite', String(overwrite));
    try {
      const res = await fetch('/api/import-export', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) { setResult(data.data); toast.success(data.message); }
      else toast.error(data.error ?? 'インポートに失敗しました');
    } catch { toast.error('通信エラーが発生しました'); } finally { setLoading(false); }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ nutrition: String(exportOpts.includeNutrition), steps: String(exportOpts.includeSteps), cost: String(exportOpts.includeCost) });
      const res = await fetch(`/api/import-export?${params}`);
      if (!res.ok) {
        try {
          const errData = await res.json();
          if (errData.upgradeRequired) {
            toast.error('Excelエクスポートはプレミアムプランの機能です。アップグレードしてください。');
            window.location.href = '/dashboard/upgrade';
          } else {
            toast.error(errData.error ?? 'エクスポートに失敗しました');
          }
        } catch {
          toast.error('エクスポートに失敗しました');
        }
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = res.headers.get('Content-Disposition')?.match(/filename\*=UTF-8''(.+)/)?.[1] ?? 'foodlabel_export.xlsx';
      const a = Object.assign(document.createElement('a'), { href: url, download: decodeURIComponent(filename) });
      a.click(); URL.revokeObjectURL(url);
      toast.success('エクスポートしました');
    } catch { toast.error('通信エラーが発生しました'); } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800 font-display">インポート / エクスポート</h1>
        <p className="text-stone-500 text-sm mt-0.5">Excelファイルでレシピデータの一括管理ができます</p>
      </div>
      <div className="flex bg-cream-200 rounded-xl p-1 w-fit">
        {(['import','export'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab===t?'bg-white shadow-sm text-brand-700':'text-stone-500 hover:text-stone-700'}`}>
            {t === 'import' ? <><Download className="w-4 h-4 inline mr-1.5" />インポート</> : <><Upload className="w-4 h-4 inline mr-1.5" />エクスポート</>}
          </button>
        ))}
      </div>

      {tab === 'import' && (
        <div className="space-y-4">
          <div className="alert-info"><Info className="w-5 h-5 flex-shrink-0 mt-0.5" /><p>本システムでエクスポートした .xlsx ファイルが読み込めます。</p></div>
          <div className="card">
            <h3 className="font-semibold text-stone-700 mb-3">Excelファイルを選択</h3>
            <div onClick={() => fileRef.current?.click()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file?'border-brand-400 bg-brand-50':'border-cream-300 hover:border-brand-300 hover:bg-cream-50'}`}>
              <FileSpreadsheet className={`w-10 h-10 mx-auto mb-3 ${file?'text-brand-500':'text-stone-300'}`} />
              {file ? (<div><p className="font-medium text-brand-700">{file.name}</p><p className="text-sm text-stone-500 mt-1">{(file.size/1024).toFixed(0)} KB</p></div>) : (<div><p className="font-medium text-stone-600">クリックしてファイルを選択</p><p className="text-sm text-stone-400 mt-1">.xlsx, .xlsm, .xls</p></div>)}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={e=>{setFile(e.target.files?.[0]??null);setResult(null);}} />
          </div>
          <div className="card">
            <h3 className="font-semibold text-stone-700 mb-3">インポートオプション</h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)} className="mt-0.5 accent-brand-500" />
              <div><span className="font-medium text-stone-700">同名レシピを上書きする</span><p className="text-sm text-stone-500 mt-0.5">OFFの場合、既存のレシピと同名のものはスキップされます</p></div>
            </label>
          </div>
          <button onClick={handleImport} disabled={!file||loading} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {loading?<><Loader2 className="w-4 h-4 animate-spin" />取り込み中...</>:<><Upload className="w-4 h-4" />インポート実行</>}
          </button>
          {result && (
            <div className="card animate-fade-in space-y-4">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-green-500" /><h3 className="font-semibold text-stone-800">インポート完了</h3></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-green-600">{result.imported}</div><div className="text-xs text-green-700 mt-1">取り込み成功</div></div>
                <div className="bg-yellow-50 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-yellow-600">{result.skipped}</div><div className="text-xs text-yellow-700 mt-1">スキップ</div></div>
                <div className="bg-red-50 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-red-600">{result.errors.length}</div><div className="text-xs text-red-700 mt-1">エラー</div></div>
              </div>
              {result.errors.length > 0 && <div className="alert-error"><AlertTriangle className="w-5 h-5 flex-shrink-0" /><div><p className="font-medium mb-1">エラー ({result.errors.length}件)</p><ul className="text-sm space-y-0.5">{result.errors.slice(0,5).map((e,i)=><li key={i}>行{e.row}: {e.message}</li>)}</ul></div></div>}
              {result.imported > 0 && <Link href="/dashboard/recipes" className="btn-secondary flex items-center gap-2 w-fit">レシピ一覧を確認 <ArrowRight className="w-4 h-4" /></Link>}
            </div>
          )}
        </div>
      )}

      {tab === 'export' && (
        <div className="space-y-4">
          <div className="alert-info"><Info className="w-5 h-5 flex-shrink-0 mt-0.5" /><p>登録されているすべてのレシピをExcel形式（.xlsx）でエクスポートします。同じ形式でインポートも可能です。</p></div>
          <div className="card">
            <h3 className="font-semibold text-stone-700 mb-4">エクスポートする項目</h3>
            <div className="space-y-3">
              {[{key:'includeNutrition',label:'栄養成分データ',desc:'熱量・たんぱく質・脂質・炭水化物・食塩相当量など'},{key:'includeSteps',label:'作り方（手順）',desc:'最大35手順のレシピ手順テキスト'},{key:'includeCost',label:'原価情報',desc:'各材料の原価・合計原価・原価率'}].map(opt=>(
                <label key={opt.key} className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={exportOpts[opt.key as keyof typeof exportOpts]} onChange={e=>setExportOpts(o=>({...o,[opt.key]:e.target.checked}))} className="mt-0.5 accent-brand-500" />
                  <div><span className="font-medium text-stone-700">{opt.label}</span><p className="text-sm text-stone-500 mt-0.5">{opt.desc}</p></div>
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleExport} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading?<><Loader2 className="w-4 h-4 animate-spin" />準備中...</>:<><Download className="w-4 h-4" />Excelファイルをダウンロード</>}
          </button>
        </div>
      )}
    </div>
  );
}
