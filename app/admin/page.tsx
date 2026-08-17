// app/admin/page.tsx - 管理者ダッシュボード
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, ShoppingBasket, FileText, Shield, Loader2,
  CheckCircle2, XCircle, RefreshCw, Upload, Database, Tag,
  ChevronDown, ChevronUp, FlaskConical, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { INGREDIENT_REJECTION_REASONS } from '@/lib/ingredient-rejection-reasons';

interface Stats {
  totalUsers: number; premiumUsers: number;
  totalRecipes: number; totalIngredients: number; pendingIngredients: number;
}
interface PendingIngredient {
  id: string; name: string; genericName: string|null; userId: string; userEmail?: string;
  allergens: string[]; categoryName: string|null; createdAt: string;
  nutritionSource: string; nutritionLinkedFoodName: string|null;
  nutrition: { energyKcal:number|null; protein:number|null; fat:number|null; carbohydrate:number|null; saltEquivalent:number|null; } | null;
}

export default function AdminPage() {
  const router  = useRouter();
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  // 却下理由を選ばせるモーダル。開いている間は対象の食材id・名前を保持する
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);

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

  const approveIngredient = async (id: string) => {
    const res  = await fetch(`/api/admin/ingredients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: true, isPublic: true }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success('承認しました');
      setPending(prev => prev.filter(i => i.id !== id));
    } else {
      toast.error(data.error ?? '承認に失敗しました');
    }
  };

  // 却下は理由の選択が必須なため、直接APIを叩かずRejectReasonModalを開く（rejectTargetをセット）。
  // モーダル側でreason/noteが決まってから、ここでAPIを呼ぶ。
  const rejectIngredient = async (id: string, reason: string, note: string) => {
    const res  = await fetch(`/api/admin/ingredients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: false, isPublic: false, rejectionReason: reason, rejectionNote: note }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success('却下しました（理由はユーザーに通知されます）');
      setPending(prev => prev.filter(i => i.id !== id));
      setRejectTarget(null);
    } else {
      toast.error(data.error ?? '却下に失敗しました');
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

      {/* 基本食材カテゴリ */}
      <div className="card">
        <h2 className="section-title flex items-center gap-2">
          <Tag className="w-5 h-5 text-brand-500" />全ユーザー共通の基本カテゴリ
        </h2>
        <p className="text-sm text-stone-500 mb-3">
          共有食材にも使える「粉類」「乳製品」などの基本カテゴリを一括作成します。すでにある場合はスキップされるので、何度押しても問題ありません。
        </p>
        <SeedCategoriesButton />
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
              <PendingIngredientCard key={ing.id} ing={ing}
                onApprove={approveIngredient}
                onReject={(id, name) => setRejectTarget({ id, name })} />
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

      {rejectTarget && (
        <RejectReasonModal
          ingredientName={rejectTarget.name}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason, note) => rejectIngredient(rejectTarget.id, reason, note)}
        />
      )}
    </div>
  );
}

const REQUIRED_ALLERGENS = ['えび','かに','小麦','そば','卵','乳','落花生','くるみ'];

// ---- 却下理由選択モーダル ----
function RejectReasonModal({ ingredientName, onClose, onConfirm }: {
  ingredientName: string;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => void;
}) {
  const [reason,  setReason]  = useState('');
  const [note,    setNote]    = useState('');
  const [sending, setSending] = useState(false);

  const handleConfirm = () => {
    if (!reason) { toast.error('却下理由を選択してください'); return; }
    if (reason === 'OTHER' && !note.trim()) { toast.error('「その他」を選んだ場合はコメントを入力してください'); return; }
    setSending(true);
    onConfirm(reason, note.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-warm-lg w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-cream-200">
          <h3 className="font-bold text-stone-800">却下理由を選択</h3>
          <button onClick={onClose} className="text-stone-400 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-stone-600">「{ingredientName}」を却下します。理由はユーザーにアプリ内で通知されます。</p>
          <div>
            <label className="field-label">却下理由 <span className="text-red-500">*</span></label>
            <div className="space-y-1.5 mt-1">
              {INGREDIENT_REJECTION_REASONS.map(r => (
                <label key={r.code} className="flex items-center gap-2 p-2 rounded-lg hover:bg-cream-50 cursor-pointer">
                  <input type="radio" name="rejection-reason" checked={reason === r.code}
                    onChange={() => setReason(r.code)} className="accent-brand-500" />
                  <span className="text-sm text-stone-700">{r.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label">
              コメント
              <span className="text-stone-400 text-xs ml-1">{reason === 'OTHER' ? '（「その他」の場合は必須）' : '（任意・補足があれば）'}</span>
            </label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              className="field-input" placeholder="例：既に「〇〇」として登録済みのため、そちらをご利用ください" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-cream-200">
          <button onClick={onClose} className="btn-secondary flex-1">キャンセル</button>
          <button onClick={handleConfirm} disabled={sending} className="btn-primary flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}却下する
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingIngredientCard({ ing, onApprove, onReject }: { ing: PendingIngredient; onApprove: (id:string)=>void; onReject: (id:string, name:string)=>void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-cream-50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3">
        <button onClick={()=>setOpen(o=>!o)} className="flex-1 text-left flex items-center gap-2 min-w-0">
          {open ? <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />}
          <div className="min-w-0">
            <span className="font-medium text-stone-800">{ing.name}</span>
            {ing.genericName && ing.genericName !== ing.name && (
              <span className="text-xs text-brand-600 ml-2">表示名: {ing.genericName}</span>
            )}
            {ing.userEmail && <span className="text-xs text-stone-400 ml-2">by {ing.userEmail}</span>}
          </div>
        </button>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onApprove(ing.id)}
            className="flex items-center gap-1 text-sm text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />承認
          </button>
          <button onClick={() => onReject(ing.id, ing.name)}
            className="flex items-center gap-1 text-sm text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg">
            <XCircle className="w-4 h-4" />却下
          </button>
        </div>
      </div>
      {open && (
        <div className="px-3 pb-3 pt-0 space-y-2 text-sm border-t border-cream-200 mt-0.5">
          <div className="grid sm:grid-cols-2 gap-2 pt-2.5">
            <div>
              <span className="text-xs text-stone-400 block">カテゴリ</span>
              {ing.categoryName ? <span className="badge badge-brand text-xs">{ing.categoryName}</span> : <span className="text-stone-300 text-xs">未設定</span>}
            </div>
            <div>
              <span className="text-xs text-stone-400 block">アレルゲン</span>
              {ing.allergens.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {ing.allergens.map(a => <span key={a} className={`badge text-[10px] ${REQUIRED_ALLERGENS.includes(a)?'badge-red':'badge-yellow'}`}>{a}</span>)}
                </div>
              ) : <span className="text-stone-300 text-xs">なし</span>}
            </div>
          </div>
          <div>
            <span className="text-xs text-stone-400 block mb-0.5">栄養成分（100gあたり・{ing.nutritionSource}{ing.nutritionLinkedFoodName ? `: ${ing.nutritionLinkedFoodName}` : ''}）</span>
            {ing.nutrition ? (
              <div className="flex items-center gap-1 text-stone-600 text-xs">
                <FlaskConical className="w-3.5 h-3.5 text-orange-400" />
                熱量{ing.nutrition.energyKcal ?? '—'}kcal ／ たんぱく質{ing.nutrition.protein ?? '—'}g ／ 脂質{ing.nutrition.fat ?? '—'}g ／ 炭水化物{ing.nutrition.carbohydrate ?? '—'}g ／ 食塩相当量{ing.nutrition.saltEquivalent ?? '—'}g
              </div>
            ) : (
              <div className="flex items-center gap-1 text-yellow-600 text-xs"><AlertTriangle className="w-3.5 h-3.5" />未設定（栄養成分表示ができません）</div>
            )}
          </div>
          <p className="text-xs text-stone-400">申請日時: {new Date(ing.createdAt).toLocaleString('ja-JP')}</p>
        </div>
      )}
    </div>
  );
}

function SeedCategoriesButton() {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ingredient-categories/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) toast.success(data.message ?? '完了しました');
      else toast.error(data.error ?? '失敗しました');
    } catch { toast.error('通信エラー'); } finally { setLoading(false); }
  };

  return (
    <button onClick={handleSeed} disabled={loading} className="btn-secondary flex items-center gap-2 disabled:opacity-50">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
      基本カテゴリを作成
    </button>
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
