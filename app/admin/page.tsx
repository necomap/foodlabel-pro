// app/admin/page.tsx - 管理者ダッシュボード
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, ShoppingBasket, FileText, Shield, Loader2,
  CheckCircle2, XCircle, RefreshCw, Upload, Database,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Stats {
  totalUsers: number; premiumUsers: number;
  totalRecipes: number; totalIngredients: number; pendingIngredients: number;
}
interface PendingIngredient {
  id: string; name: string; userId: string; userEmail?: string;
  allergens: string[]; createdAt: string;
}

export default function AdminPage() {
  const router  = useRouter();
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/ingredients?status=pending'),
      ]);
      const [statsData, pendingData] = await Promise.all([
        statsRes.json(), pendingRes.json(),
      ]);
      if (statsData.success)   setStats(statsData.data);
      if (pendingData.success) setPending(pendingData.data);
    } finally { setLoading(false); }
  };

  const approveIngredient = async (id: string, approve: boolean) => {
    const res  = await fetch(`/api/admin/ingredients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: approve, isPublic: approve }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(approve ? '承認しました' : '却下しました');
      setPending(prev => prev.filter(i => i.id !== id));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>;
  }

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-500" />管理者ダッシュボード
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">システム全体の管理</p>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" />更新
        </button>
      </div>

      {/* 統計 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: '総ユーザー数', value: stats.totalUsers,       icon: Users,          color: 'text-blue-600',   bg: 'bg-blue-50'   },
            { label: 'プレミアム',   value: stats.premiumUsers,     icon: Shield,         color: 'text-brand-600',  bg: 'bg-brand-50'  },
            { label: '総レシピ数',   value: stats.totalRecipes,     icon: FileText,       color: 'text-green-600',  bg: 'bg-green-50'  },
            { label: '食材マスタ',   value: stats.totalIngredients, icon: ShoppingBasket, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${s.bg} mb-3`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
                <div className="text-xs text-stone-500 mt-0.5">{s.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* 成分表マスタ更新 */}
      <div className="card">
        <h2 className="section-title flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" />食品成分表マスタ更新
        </h2>
        <div className="space-y-3">
          <div className="alert-info">
            <div className="text-sm space-y-1">
              <p className="font-medium">文部科学省 日本食品標準成分表より更新</p>
              <p>以下URLからExcelをダウンロードしてアップロードしてください：</p>
              <a href="https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html"
                target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all text-xs">
                https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html
              </a>
              <p className="text-xs text-stone-500">※ カテゴリ別複数シートにも対応しています</p>
            </div>
          </div>
          <NutritionImporter />
        </div>
      </div>

      {/* 共有食材承認 */}
      <div className="card">
        <h2 className="section-title flex items-center gap-2">
          <ShoppingBasket className="w-5 h-5 text-purple-500" />
          共有食材の承認待ち
          {pending.length > 0 && <span className="badge badge-red">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="text-center py-8 text-stone-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>承認待ちの食材はありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(ing => (
              <div key={ing.id} className="flex items-center justify-between p-3 bg-cream-50 rounded-xl">
                <div>
                  <span className="font-medium text-stone-800">{ing.name}</span>
                  {ing.userEmail && <span className="text-xs text-stone-400 ml-2">by {ing.userEmail}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveIngredient(ing.id, true)}
                    className="flex items-center gap-1 text-sm text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />承認
                  </button>
                  <button onClick={() => approveIngredient(ing.id, false)}
                    className="flex items-center gap-1 text-sm text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg">
                    <XCircle className="w-4 h-4" />却下
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 法令確認 */}
      <div className="card bg-amber-50 border-amber-200">
        <h2 className="section-title text-amber-800">法令確認チェックリスト</h2>
        <div className="space-y-2 text-sm text-amber-900">
          {[
            '食品表示基準（最終確認日を記録してください）',
            'アレルゲン表示の特定原材料 8品目（義務）・20品目（推奨）',
            '栄養成分表示の必須5項目（熱量・たんぱく質・脂質・炭水化物・食塩相当量）',
          ].map((item, i) => (
            <label key={i} className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-amber-600" />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function NutritionImporter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file,    setFile]    = useState<File|null>(null);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{imported:number;skipped:number;sheetsProcessed:number}|null>(null);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true); setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res  = await fetch('/api/admin/nutrition-import', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) { setResult(data.data); toast.success(data.message); }
      else toast.error(data.error ?? 'インポートに失敗しました');
    } catch { toast.error('通信エラー'); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <div onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
          ${file ? 'border-blue-400 bg-blue-50' : 'border-cream-300 hover:border-blue-300'}`}>
        <Upload className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-blue-500' : 'text-stone-300'}`} />
        {file ? (
          <div><p className="font-medium text-blue-700">{file.name}</p><p className="text-xs text-stone-500">{(file.size/1024/1024).toFixed(1)} MB</p></div>
        ) : (
          <div><p className="text-sm font-medium text-stone-600">クリックしてExcelファイルを選択</p><p className="text-xs text-stone-400">20230428-mxt_kagsei-mext_00001_012.xlsx など</p></div>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
      <button onClick={handleImport} disabled={!file || loading}
        className="btn-primary flex items-center gap-2 disabled:opacity-50">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />インポート中...</> : <><Upload className="w-4 h-4" />インポート実行</>}
      </button>
      {result && (
        <div className="alert-success">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">インポート完了</p>
            <p>登録・更新: {result.imported}件 / 処理シート数: {result.sheetsProcessed}</p>
          </div>
        </div>
      )}
    </div>
  );
}
