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
  const [overwrite,  setOverwrite]  = useState(false);
  const [clearAll,   setClearAll]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult|null>(null);
  // 2026-08新設: 1回のAPI呼び出しでは最大80件までしか処理できないため、80件を超える
  // ファイルはoffsetを進めながら自動的に複数回リクエストする（＝ボタンは1回押すだけでよい）。
  // processed/totalは進捗表示用（大きいファイルだと数分〜数十分かかることがあるため）。
  const [progress, setProgress] = useState<{processed:number; total:number}|null>(null);
  const [exportOpts, setExportOpts] = useState({ includeNutrition: true, includeSteps: true, includeCost: true });

  // インポート中にタブを閉じる／移動すると、そこで処理が止まってしまう（それまでに
  // 取り込まれた分はDBに残る＝再度同じファイルをインポートし直せば続きから進められるが、
  // 誤操作を防ぐため一応警告を出す）。
  useEffect(() => {
    if (!loading) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [loading]);

  const handleImport = async () => {
    if (!file) { toast.error('ファイルを選択してください'); return; }
    setLoading(true); setResult(null); setProgress(null);

    // 2026-08新設: 80件を超えるファイルにも対応するため、offsetを進めながら
    // サーバーが「done」を返すまで自動的に繰り返し呼び出す。1回目（offset=0）で
    // clearAll・overwriteを指定し、2回目以降は同じ操作の続きとして扱われる
    // （サーバー側で全削除や月間回数カウントが2回以上走らないようガードしている）。
    let offset = 0;
    const agg: ImportResult = { imported: 0, skipped: 0, total: 0, errors: [], warnings: [] };
    try {
      while (true) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('overwrite', String(overwrite));
        formData.append('clearAll', String(clearAll));
        formData.append('offset', String(offset));
        const res = await fetch('/api/import-export', { method: 'POST', body: formData });
        const data = await res.json();

        if (!data.success) {
          if (data.upgradeRequired) {
            toast.error(data.error ?? 'この操作にはプランのアップグレードが必要です。');
            window.location.href = '/dashboard/upgrade';
          } else {
            toast.error(data.error ?? 'インポートに失敗しました');
          }
          // それまでのチャンクで取り込めた分は結果として残しておく
          if (agg.total > 0 || agg.imported > 0) setResult({ ...agg });
          return;
        }

        agg.imported += data.data.imported ?? 0;
        agg.skipped  += data.data.skipped  ?? 0;
        agg.total     = data.data.total ?? agg.total;
        agg.errors    = [...agg.errors,   ...(data.data.errors   ?? [])];
        agg.warnings  = [...agg.warnings, ...(data.data.warnings ?? [])];
        setResult({ ...agg });
        setProgress({ processed: data.data.processedSoFar ?? agg.total, total: data.data.total ?? agg.total });

        if (data.data.done) {
          toast.success(`インポート完了: ${agg.imported}件追加、${agg.skipped}件スキップ`);
          break;
        }
        offset = data.data.nextOffset;
      }
    } catch { toast.error('通信エラーが発生しました'); } finally { setLoading(false); setProgress(null); }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ nutrition: String(exportOpts.includeNutrition), steps: String(exportOpts.includeSteps), cost: String(exportOpts.includeCost) });
      const res = await fetch(`/api/import-export?${params}`);
      if (!res.ok) {
        try {
          const errData = await res.json();
          // 2026-08: 「プランが足りない」と「今月の回数上限に達した」で文言が異なるため、
          // 固定文言ではなくサーバーが返すerrorメッセージをそのまま表示するように変更。
          toast.error(errData.error ?? 'エクスポートに失敗しました');
          if (errData.upgradeRequired) {
            window.location.href = '/dashboard/upgrade';
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
              {file ? (<div><p className="font-medium text-brand-700">{file.name}</p><p className="text-sm text-stone-500 mt-1">{(file.size/1024).toFixed(0)} KB</p></div>) : (<div><p className="font-medium text-stone-600">クリックしてファイルを選択</p><p className="text-sm text-stone-400 mt-1">.xlsx, .xlsm, .xls</p><p className="text-xs text-stone-400 mt-1">「DB」シートがある場合はDBシートを、ない場合は一番左のシートを読み込みます</p>
                  {/* 2026-08: 以前は「1回あたり80件まで、ファイルを分割してください」という注意書き
                      だったが、80件を超えるファイルも自動的に分割してインポートするよう対応したため、
                      分割が必要な旨の案内は不要になった。件数が多い場合の所要時間の目安のみ案内する。 */}
                  <p className="text-xs text-stone-400 mt-1">件数が多い場合（100件超など）は取り込みに数分〜数十分かかることがあります。ボタンを押した後、完了までタブを閉じずにお待ちください。</p></div>)}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={e=>{setFile(e.target.files?.[0]??null);setResult(null);}} />
          </div>
          <div className="card">
            <h3 className="font-semibold text-stone-700 mb-3">インポートオプション</h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)} className="mt-0.5 accent-brand-500" />
              <div><span className="font-medium text-stone-700">同名レシピを上書きする</span><p className="text-sm text-stone-500 mt-0.5">OFFの場合、既存のレシピと同名のものはスキップされます</p></div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer mt-3">
              <input type="checkbox" checked={clearAll} onChange={e=>{setClearAll(e.target.checked); if(e.target.checked) setOverwrite(true);}} className="mt-0.5 accent-red-500" />
              <div>
                <p className="text-sm font-medium text-stone-700">全データをクリアして上書き</p>
                <p className="text-xs text-stone-400 mt-0.5">既存のレシピをすべて削除してからインポートします。元に戻せません。</p>
              </div>
            </label>
          </div>
          <button onClick={handleImport} disabled={!file||loading} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />
                  {progress ? `取り込み中... (${progress.processed}/${progress.total}件)` : '取り込み中...'}
                </>
              : <><Upload className="w-4 h-4" />インポート実行</>}
          </button>
          {loading && progress && progress.total > 0 && (
            <div className="w-full h-2 bg-cream-200 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, Math.round(progress.processed / progress.total * 100))}%` }} />
            </div>
          )}
          {result && (
            <div className="card animate-fade-in space-y-4">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-green-500" /><h3 className="font-semibold text-stone-800">インポート完了</h3></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-green-600">{result.imported}</div><div className="text-xs text-green-700 mt-1">取り込み成功</div></div>
                <div className="bg-yellow-50 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-yellow-600">{result.skipped}</div><div className="text-xs text-yellow-700 mt-1">スキップ</div></div>
                <div className="bg-red-50 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-red-600">{result.errors.length}</div><div className="text-xs text-red-700 mt-1">エラー</div></div>
              </div>
              <p className="text-xs text-stone-400 text-center -mt-2">ファイル内の全{result.total}件のうち{result.imported + result.skipped}件を処理しました</p>
              {result.warnings.length > 0 && <div className="alert-info"><Info className="w-5 h-5 flex-shrink-0" /><div><p className="font-medium mb-1">お知らせ ({result.warnings.length}件)</p><ul className="text-sm space-y-0.5">{result.warnings.slice(0,5).map((w,i)=><li key={i}>行{w.row}: {w.message}</li>)}</ul></div></div>}
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
