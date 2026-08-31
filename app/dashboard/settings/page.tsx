'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Plus, Store, User, Tag, CheckCircle2, Trash2, AlertTriangle, Edit2, GripVertical, Zap, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

interface Shop { id: string; shopName: string; companyName: string|null; representative: string|null; postalCode: string|null; address: string|null; phone: string|null; email: string|null; showPhone: boolean; showRepresentative: boolean; isDefault: boolean; qrUrl: string|null; logoUrl: string|null; logoHeightMm: number; qrSizeMm: number; }
interface Category { id: string; name: string; sortOrder: number; }

const TABS = [
  { id: 'profile',    label: 'プロフィール', icon: User },
  { id: 'shops',      label: '店舗管理',     icon: Store },
  { id: 'categories', label: 'カテゴリ',     icon: Tag },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile'|'shops'|'categories'>('profile');
  return (
    <div className="animate-fade-in max-w-2xl space-y-5">
      <div><h1 className="text-2xl font-bold text-stone-800 font-display">設定</h1><p className="text-stone-500 text-sm mt-0.5">アカウント・店舗・カテゴリを管理します</p></div>
      <div className="flex bg-cream-200 rounded-xl p-1 w-fit flex-wrap gap-1">
        {TABS.map(t => { const Icon = t.icon; return (
          <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === t.id ? 'bg-white shadow-sm text-brand-700' : 'text-stone-500 hover:text-stone-700'}`}>
            <Icon className="w-4 h-4" />{t.label}
          </button>
        );})}
      </div>
      {activeTab === 'profile'    && <ProfileTab />}
      {activeTab === 'shops'      && <ShopsTab />}
      {activeTab === 'categories' && <CategoriesTab />}
    </div>
  );
}

function ProfileTab() {
  const { data: session, update } = useSession();
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [profile, setProfile] = useState({ companyName:'', representative:'', postalCode:'', address:'', phone:'', electricityUnitPrice:'', ovenPowerKw:'', ovenSteamExtraKw:'', bpacTemplatePath:'' });
  const isPremium = session?.user?.plan === 'premium' || session?.user?.plan === 'pro' || session?.user?.plan === 'admin';
  // 請求ポータル（解約・プラン変更）から ?billing_updated=1 付きで戻ってきた時だけ、
  // セッション（plan）をDBの最新値で明示的に再取得する。ログアウト→ログインし直さないと
  // 画面上のプラン表示が変わらない不具合の対策（lib/auth.ts のjwtコールバック参照）。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing_updated') === '1') {
      update();
      params.delete('billing_updated');
      const qs = params.toString();
      window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res  = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.url) window.location.href = data.url;
      else toast.error(data.error ?? 'エラーが発生しました');
    } catch { toast.error('通信エラーが発生しました'); }
    finally   { setPortalLoading(false); }
  };
  useEffect(() => {
    fetch('/api/user/profile').then(r=>r.json()).then(d => {
      if (d.success && d.data) {
        setProfile({
          companyName: d.data.companyName??'', representative: d.data.representative??'', postalCode: d.data.postalCode??'', address: d.data.address??'', phone: d.data.phone??'',
          electricityUnitPrice: d.data.electricityUnitPrice != null ? String(d.data.electricityUnitPrice) : '',
          ovenPowerKw:           d.data.ovenPowerKw           != null ? String(d.data.ovenPowerKw)           : '',
          ovenSteamExtraKw:      d.data.ovenSteamExtraKw      != null ? String(d.data.ovenSteamExtraKw)      : '',
          bpacTemplatePath:      d.data.bpacTemplatePath ?? '',
        });
      }
      setLoaded(true);
    }).catch(()=>setLoaded(true));
  }, []);
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(profile) });
      const data = await res.json();
      if (data.success) { toast.success('プロフィールを更新しました'); await update(); }
      else toast.error(data.error ?? '更新に失敗しました');
    } catch { toast.error('通信エラー'); } finally { setSaving(false); }
  };
  if (!loaded) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>;
  return (
    <div className="card space-y-5">
      <h2 className="section-title">アカウント情報</h2>
      <div className="bg-cream-50 rounded-xl p-4 text-sm space-y-3">
        <div>
          <div className="font-medium text-stone-700">{session?.user?.email}</div>
          <div className="text-stone-500 mt-0.5">プラン: <span className="text-brand-600 font-medium capitalize">{session?.user?.plan ?? 'free'}</span></div>
        </div>
        {isPremium ? (
          <button onClick={handlePortal} disabled={portalLoading}
            className="btn-secondary text-sm flex items-center gap-2">
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            請求・解約の管理
          </button>
        ) : (
          <a href="/dashboard/upgrade" className="text-brand-600 text-sm font-medium hover:underline inline-flex items-center gap-1">
            スタンダードにアップグレード →
          </a>
        )}
      </div>

      {/* 2026-08新設: バックアップ・保健所提出用の導線をまとめて設置。
          Excelエクスポートは既存機能（全レシピ対応済み）をそのままバックアップ用途に案内し、
          全レシピ一括印刷は保健所への立入検査時などの事業者控え用（Pro限定）。 */}
      <h2 className="section-title">データのバックアップ・保健所提出</h2>
      <div className="bg-cream-50 rounded-xl p-4 text-sm space-y-3">
        <div>
          <div className="font-medium text-stone-700">Excelでバックアップ</div>
          <p className="text-stone-500 mt-0.5">全レシピのデータをExcelファイルとして保存できます。定期的なバックアップにご利用ください。</p>
          <a href="/dashboard/import?tab=export" className="text-brand-600 font-medium hover:underline inline-flex items-center gap-1 mt-1">
            エクスポート画面へ →
          </a>
        </div>
        <div className="pt-3 border-t border-cream-200">
          <div className="font-medium text-stone-700 flex items-center gap-1.5">
            全レシピを保健所提出用に印刷
            <span className="badge bg-brand-100 text-brand-700 text-[10px]">Pro</span>
          </div>
          <p className="text-stone-500 mt-0.5">非表示レシピを含む全レシピを、原材料・アレルゲン等がわかる形で一括印刷できます。立入検査時の事業者控えなどにご利用ください。</p>
          <a href="/dashboard/recipes/print?all=1" className="text-brand-600 font-medium hover:underline inline-flex items-center gap-1 mt-1">
            印刷画面へ →
          </a>
        </div>
      </div>

      <h2 className="section-title">基本情報（ラベル製造者欄）</h2>
      <p className="text-sm text-stone-500 -mt-2">ラベルの製造者欄に印字される情報です</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="field-label">店舗名・社名</label><input type="text" value={profile.companyName} onChange={e=>setProfile(p=>({...p,companyName:e.target.value}))} className="field-input" placeholder="例: ○○ベーカリー" /></div>
        <div><label className="field-label">代表者名</label><input type="text" value={profile.representative} onChange={e=>setProfile(p=>({...p,representative:e.target.value}))} className="field-input" placeholder="例: 田中 太郎" /><p className="field-hint text-yellow-600">個人事業主は表示義務があります</p></div>
        <div><label className="field-label">電話番号</label><input type="tel" value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))} className="field-input" placeholder="000-0000-0000" /></div>
        <div><label className="field-label">郵便番号</label><input type="text" value={profile.postalCode} onChange={e=>setProfile(p=>({...p,postalCode:e.target.value}))} className="field-input" placeholder="000-0000" /></div>
        <div className="sm:col-span-2"><label className="field-label">住所</label><input type="text" value={profile.address} onChange={e=>setProfile(p=>({...p,address:e.target.value}))} className="field-input" /></div>
      </div>

      <h2 className="section-title flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" />電気代目安の設定（任意）</h2>
      <p className="text-sm text-stone-500 -mt-2">
        レシピ詳細画面の焼成条件から、電気代の目安を概算表示します（全プランで利用可）。オーブンの機種によって実際の消費電力は大きく異なるため、あくまで参考値です。未入力の場合は表示されません。
      </p>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="field-label">電力量単価（円/kWh）</label>
          <input type="number" step="0.01" min="0" value={profile.electricityUnitPrice} onChange={e=>setProfile(p=>({...p,electricityUnitPrice:e.target.value}))} className="field-input" placeholder="例: 31" />
        </div>
        <div>
          <label className="field-label">オーブン消費電力（kW）</label>
          <input type="number" step="0.1" min="0" value={profile.ovenPowerKw} onChange={e=>setProfile(p=>({...p,ovenPowerKw:e.target.value}))} className="field-input" placeholder="例: 3.0" />
        </div>
        <div>
          <label className="field-label">スチームON時の追加消費電力（kW・任意）</label>
          <input type="number" step="0.1" min="0" value={profile.ovenSteamExtraKw} onChange={e=>setProfile(p=>({...p,ovenSteamExtraKw:e.target.value}))} className="field-input" placeholder="例: 0.5" />
        </div>
      </div>

      <h2 className="section-title flex items-center gap-2"><Printer className="w-4 h-4 text-stone-500" />b-PACラベル印刷の設定（任意）</h2>
      <p className="text-sm text-stone-500 -mt-2">
        Windows＋Brother b-PAC Extensionを導入済みの場合のみ使う設定です。P-touch Editorで作成したテンプレート（.lbx）ファイルのパスを入力すると、ラベル印刷画面に「b-PAC印刷」ボタンが表示されます。未入力の場合、このボタンは表示されません。
      </p>
      <div>
        <label className="field-label">テンプレートファイル（.lbx）のパス</label>
        <input type="text" value={profile.bpacTemplatePath} onChange={e=>setProfile(p=>({...p,bpacTemplatePath:e.target.value}))} className="field-input font-mono text-sm"
          placeholder={'例: F:\\My Labels\\食品表示ラベル62mm.lbx'} />
        <p className="field-hint">このPC上の絶対パスです。他のPCでb-PAC印刷を使う場合は、そのPC側でこの設定を入力し直してください。</p>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}保存する
      </button>
    </div>
  );
}

function ShopsTab() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [saving, setSaving] = useState(false);
  const [editShop, setEditShop] = useState<Shop|null>(null);
  const [showModal, setShowModal] = useState(false);
  const fetchShops = useCallback(async () => { const res=await fetch('/api/shops'); const d=await res.json(); if(d.success) setShops(d.data); },[]);
  useEffect(()=>{ fetchShops(); },[fetchShops]);
  const handleSave = async (shopData: Partial<Shop>&{id?:string}) => {
    setSaving(true);
    try {
      const url = shopData.id ? `/api/shops/${shopData.id}` : '/api/shops';
      const method = shopData.id ? 'PUT' : 'POST';
      const res = await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(shopData)});
      const data = await res.json();
      if (data.success) { toast.success(shopData.id?'店舗を更新しました':'店舗を追加しました'); await fetchShops(); setShowModal(false); }
      else toast.error(data.error??'保存に失敗しました');
    } catch { toast.error('通信エラー'); } finally { setSaving(false); }
  };
  const handleSetDefault = async (shopId: string, isDefault: boolean) => {
    const endpoint = isDefault ? `/api/shops/${shopId}/unset-default` : `/api/shops/${shopId}/set-default`;
    await fetch(endpoint, {method:'POST'});
    await fetchShops();
    toast.success(isDefault ? 'デフォルト設定を解除しました' : 'デフォルト店舗を変更しました');
  };
  return (
    <div className="space-y-4">
      {shops.map(shop => (
        <div key={shop.id} className={`card ${shop.isDefault?'border-brand-300 bg-brand-50/30':''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-stone-800">{shop.shopName}</h3>
                {shop.isDefault && <span className="badge badge-brand text-xs">デフォルト</span>}
              </div>
              {shop.representative && <p className="text-sm text-stone-600 mt-0.5">代表者: {shop.representative}</p>}
              {shop.address && <p className="text-sm text-stone-500 mt-0.5">{shop.postalCode&&`〒${shop.postalCode} `}{shop.address}</p>}
              {shop.phone && <p className="text-sm text-stone-500">{shop.phone}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={()=>handleSetDefault(shop.id, shop.isDefault)} className="btn-secondary text-xs px-3 py-1.5">
                {shop.isDefault ? '解除' : 'デフォルトに設定'}
              </button>
              <button onClick={()=>{setEditShop(shop);setShowModal(true);}} className="btn-ghost p-2"><Edit2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      ))}
      <button onClick={()=>{setEditShop(null);setShowModal(true);}} className="btn-secondary w-full flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" />店舗を追加
      </button>
      {showModal && <ShopModal shop={editShop} saving={saving} onClose={()=>setShowModal(false)} onSave={handleSave} />}
    </div>
  );
}

function ShopModal({ shop, saving, onClose, onSave }: { shop:Shop|null; saving:boolean; onClose:()=>void; onSave:(d:Partial<Shop>&{id?:string})=>void; }) {
  const [form, setForm] = useState({ shopName:shop?.shopName??'', companyName:shop?.companyName??'', representative:shop?.representative??'', postalCode:shop?.postalCode??'', address:shop?.address??'', phone:shop?.phone??'', email:shop?.email??'', showPhone:shop?.showPhone??true, showRepresentative:shop?.showRepresentative??false, qrUrl:(shop as any)?.qrUrl??'', logoUrl:(shop as any)?.logoUrl??"", logoHeightMm:(shop as any)?.logoHeightMm??8, qrSizeMm:(shop as any)?.qrSizeMm??6 });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-warm-lg w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-cream-200 flex-shrink-0">
          <h3 className="font-bold text-stone-800">{shop?'店舗を編集':'店舗を追加'}</h3>
          <button onClick={onClose} className="text-stone-400 text-2xl leading-none">x</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div><label className="field-label">店舗名 <span className="text-red-500">*</span></label><input type="text" value={form.shopName} onChange={e=>setForm(f=>({...f,shopName:e.target.value}))} className="field-input" /></div>
          <div><label className="field-label">法人名（任意）</label><input type="text" value={form.companyName} onChange={e=>setForm(f=>({...f,companyName:e.target.value}))} className="field-input" placeholder="店舗名と異なる場合のみ" /><p className="field-hint">食品表示基準では屋号（店舗名）のみの表示は認められていません。法人の場合は正式な法人名、個人事業主の場合は個人名の入力が必要です。未入力の場合は店舗名がそのまま印字されます。</p></div>
          <div><label className="field-label">代表者名</label><input type="text" value={form.representative} onChange={e=>setForm(f=>({...f,representative:e.target.value}))} className="field-input" placeholder="例: 田中 太郎" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">郵便番号</label><input type="text" value={form.postalCode} onChange={e=>setForm(f=>({...f,postalCode:e.target.value}))} className="field-input" /></div>
            <div><label className="field-label">電話番号</label><input type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="field-input" /></div>
          </div>
          <div><label className="field-label">住所</label><input type="text" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} className="field-input" /></div>
          <div><label className="field-label">メールアドレス</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="field-input" /></div>
          <div><label className="field-label">QRコード用URL（任意）</label><input type="url" value={(form as any).qrUrl ?? ''} onChange={e=>setForm(f=>({...f,qrUrl:e.target.value}))} className="field-input" placeholder="https://www.instagram.com/yourshop" /><p className="text-xs text-stone-400 mt-1">InstagramやショップのURLを入力するとラベルにQRコードが印刷されます</p></div>
          <div><label className="field-label">QRコードサイズ（mm）</label><input type="number" min="4" max="20" value={(form as any).qrSizeMm ?? 6} onChange={e=>setForm(f=>({...f,qrSizeMm:Number(e.target.value)}))} className="field-input" /><p className="text-xs text-stone-400 mt-1">推奨：6mm以上（小さすぎるとスマホで読み込めない場合があります）</p></div>
          {/* ロゴ画像アップロード */}
              <div>
                <label className="field-label">ロゴ画像（任意）</label>
                {(form as any).logoUrl && (
                  <div className="mb-2 flex items-center gap-3">
                    <img src={(form as any).logoUrl} alt="ロゴ" className="h-12 object-contain border rounded-lg p-1" />
                    <button type="button" onClick={()=>setForm(f=>({...f,logoUrl:''}))} className="text-xs text-red-500 hover:underline">削除</button>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={async(e)=>{
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // ローカルプレビューをすぐに表示（blob URLは一時的）
                  const localUrl = URL.createObjectURL(file);
                  setForm(f=>({...f,logoUrl:localUrl,_uploading:true}));
                  // Supabaseにアップロード
                  const fd = new FormData();
                  fd.append('file', file);
                  try {
                    const res = await fetch('/api/upload', {method:'POST',body:fd});
                    const data = await res.json();
                    if (data.success) {
                      setForm(f=>({...f,logoUrl:data.url,_uploading:false}));
                    } else {
                      alert(data.error ?? 'アップロードに失敗しました');
                      setForm(f=>({...f,logoUrl:'',_uploading:false}));
                    }
                  } catch {
                    alert('アップロードに失敗しました');
                    setForm(f=>({...f,logoUrl:'',_uploading:false}));
                  }
                }} className="field-input" />
                {(form as any)._uploading && <p className="text-xs text-amber-600 mt-1">⏳ アップロード中...完了後に保存してください</p>}
                <p className="text-xs text-stone-400 mt-1">推奨：横長PNG・透過背景・2MB以下</p>
              </div>
                    <div>
                      <label className="field-label">ロゴの高さ（mm）</label>
                      <input type="number" min="4" max="20" value={(form as any).logoHeightMm ?? 8} onChange={e=>setForm(f=>({...f,logoHeightMm:Number(e.target.value)}))} className="field-input" />
                      <p className="text-xs text-stone-400 mt-1">ラベルに印刷するロゴの高さです（幅は自動調整）</p>
                    </div>
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.showPhone} onChange={e=>setForm(f=>({...f,showPhone:e.target.checked}))} className="accent-brand-500" /><span className="text-sm text-stone-700">電話番号をラベルに表示する</span></label>
            <div>
              <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.showRepresentative} onChange={e=>setForm(f=>({...f,showRepresentative:e.target.checked}))} className="accent-brand-500" /><span className="text-sm text-stone-700">代表者名をラベルに表示する</span></label>
              <p className="text-xs text-yellow-600 mt-1 ml-7 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />個人事業主は代表者名の表示義務があります</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-cream-200 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1">キャンセル</button>
          <button onClick={()=>onSave({...form,id:shop?.id})} disabled={saving || !!(form as any)._uploading} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving?<Loader2 className="w-4 h-4 animate-spin" />:null}{shop?'更新する':'追加する'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [editName, setEditName] = useState('');
  const fetch_ = useCallback(async () => { const r=await fetch('/api/categories?own=true'); const d=await r.json(); if(d.success) setCategories(d.data); },[]);
  useEffect(()=>{fetch_();},[fetch_]);
  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res=await fetch('/api/categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newName.trim()})});
      const d=await res.json();
      if(d.success){toast.success('追加しました');setNewName('');await fetch_();}
      else toast.error(d.error??'失敗しました');
    } catch{toast.error('通信エラー');}finally{setSaving(false);}
  };
  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const res=await fetch(`/api/categories/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:editName.trim()})});
      const d=await res.json();
      if(d.success){toast.success('更新しました');setEditId(null);await fetch_();}
    } catch{toast.error('通信エラー');}
  };
  const handleDelete = async (id: string) => {
    if (!confirm('このカテゴリを削除しますか？')) return;
    try {
      const res=await fetch(`/api/categories/${id}`,{method:'DELETE'});
      const d=await res.json();
      if(d.success){toast.success('削除しました');await fetch_();}
      else toast.error(d.error??'削除に失敗しました');
    } catch{toast.error('通信エラー');}
  };
  return (
    <div className="card space-y-5">
      <h2 className="section-title">レシピカテゴリ管理</h2>
      <p className="text-sm text-stone-500">レシピを分類するカテゴリを自由に追加・編集できます。</p>
      <div className="flex gap-2">
        <input type="text" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()} className="field-input flex-1" placeholder="新しいカテゴリ名（例: チョコレート）" />
        <button onClick={handleAdd} disabled={saving||!newName.trim()} className="btn-primary flex items-center gap-2 whitespace-nowrap"><Plus className="w-4 h-4" />追加</button>
      </div>
      <div className="space-y-2">
        {categories.length===0 && <p className="text-stone-400 text-sm text-center py-4">カテゴリがありません</p>}
        {categories.map(cat=>(
          <div key={cat.id} className="flex items-center gap-3 p-3 bg-cream-50 rounded-xl group">
            <GripVertical className="w-4 h-4 text-stone-300" />
            {editId===cat.id ? (
              <>
                <input type="text" value={editName} onChange={e=>setEditName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleUpdate(cat.id)} className="field-input flex-1 py-1.5 text-sm" autoFocus />
                <button onClick={()=>handleUpdate(cat.id)} className="btn-primary text-sm px-3 py-1.5">保存</button>
                <button onClick={()=>setEditId(null)} className="btn-secondary text-sm px-3 py-1.5">取消</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-stone-700">{cat.name}</span>
                <button onClick={()=>{setEditId(cat.id);setEditName(cat.name);}} className="p-1.5 text-stone-300 hover:text-brand-500 opacity-0 group-hover:opacity-100 transition-all"><Edit2 className="w-4 h-4" /></button>
                <button onClick={()=>handleDelete(cat.id)} className="p-1.5 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
