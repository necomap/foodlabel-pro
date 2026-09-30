'use client';
// ============================================================
// components/recipe/SampleRecipePicker.tsx - サンプルレシピ取り込みモーダル（2026-09-30新設）
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

type Sample = {
  key: string; genre: string; name: string; unitCount: number; contentAmount: string;
  ingredients: string[]; imported: boolean;
};

export default function SampleRecipePicker({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [samples,   setSamples]   = useState<Sample[]>([]);
  const [genres,    setGenres]    = useState<string[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [genre,     setGenre]     = useState('');
  const [picked,    setPicked]    = useState<Set<string>>(new Set());
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    fetch('/api/recipes/samples').then(r => r.json()).then(d => {
      if (!d.success) { toast.error(d.error ?? '読み込みに失敗しました'); return; }
      setSamples(d.data.samples);
      setGenres(d.data.genres);
      setRemaining(d.data.remaining);
      setGenre(d.data.genres[0] ?? '');
    }).catch(() => toast.error('読み込みに失敗しました')).finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => samples.filter(s => s.genre === genre), [samples, genre]);
  const overLimit = remaining !== null && picked.size > remaining;

  const toggle = (key: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const handleImport = async () => {
    if (picked.size === 0) return;
    setSaving(true);
    try {
      const res  = await fetch('/api/recipes/samples', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: Array.from(picked) }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error ?? '取り込みに失敗しました'); return; }
      const { imported, skippedLimit } = data.data as { imported: string[]; skippedLimit: string[] };
      if (imported.length) toast.success(`${imported.length}件のサンプルを取り込みました`);
      if (skippedLimit.length) toast.error(`レシピ上限のため${skippedLimit.length}件は取り込めませんでした`);
      onImported();
      onClose();
    } catch {
      toast.error('取り込みに失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-warm-lg w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-cream-200">
          <h3 className="font-bold text-stone-800 text-lg">サンプルレシピから始める</h3>
          <button onClick={onClose} className="text-stone-400 text-2xl leading-none" aria-label="閉じる">×</button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-stone-600">
            選んだサンプルが<strong>あなたのレシピとしてコピー</strong>されます。材料・栄養成分・アレルゲンが入った状態なので、すぐにラベルのプレビューや印刷を試せます。
            分量や商品名を自分の商品に合わせて書き換えて使ってください。
          </p>

          {loading ? (
            <p className="text-sm text-stone-400">読み込み中...</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {genres.map(g => (
                  <button key={g} onClick={() => setGenre(g)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${g === genre ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-stone-600 border-cream-300 hover:bg-cream-50'}`}>
                    {g}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {shown.map(s => (
                  <label key={s.key}
                    className={`flex gap-3 p-3 rounded-xl border ${s.imported ? 'bg-stone-50 border-stone-200 opacity-60' : picked.has(s.key) ? 'border-brand-400 bg-brand-50' : 'border-cream-200 hover:bg-cream-50'} cursor-pointer`}>
                    <input type="checkbox" className="mt-1" disabled={s.imported}
                      checked={picked.has(s.key)} onChange={() => toggle(s.key)} />
                    <div className="min-w-0">
                      <div className="font-medium text-stone-800">
                        {s.name.replace('【サンプル】', '')}
                        {s.imported && <span className="ml-2 text-xs text-stone-500">取り込み済み</span>}
                      </div>
                      <div className="text-xs text-stone-500">{s.unitCount}個分（{s.contentAmount}）／ {s.ingredients.join('、')}</div>
                    </div>
                  </label>
                ))}
              </div>

              {remaining !== null && (
                <p className={`text-xs ${overLimit ? 'text-red-600' : 'text-stone-500'}`}>
                  現在のプランで追加できるレシピはあと{remaining}件です（サンプルも1件として数えます）。
                  {overLimit && '選択数が上限を超えています。'}
                </p>
              )}
              <p className="text-xs text-stone-400">
                ※ 材料は「食材マスタ」にも登録されます（同じ名前の食材が既にあればそれを使います）。数値は日本食品標準成分表2020年版（八訂）に基づく参考値です。
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-cream-200">
          <button onClick={onClose} className="btn-secondary">閉じる</button>
          <button onClick={handleImport} disabled={saving || picked.size === 0 || overLimit}
            className="btn-primary disabled:opacity-50">
            {saving ? '取り込み中...' : picked.size > 0 ? `${picked.size}件を取り込む` : 'サンプルを選んでください'}
          </button>
        </div>
      </div>
    </div>
  );
}
