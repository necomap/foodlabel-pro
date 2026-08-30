// app/admin/_update-notes-manager.tsx
// 管理画面の「更新情報の管理」セクション。仕様変更・新機能・不具合修正などをまとめて投稿し、
// ダッシュボードの /dashboard/updates にユーザー向けに掲示する（下書き保存も可能）。
'use client';

import { useState, useEffect } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface UpdateNote {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function UpdateNotesManager() {
  const [notes,   setNotes]   = useState<UpdateNote[]>([]);
  const [loading, setLoading] = useState(true);
  // null = 一覧のみ表示 / undefined相当で新規作成 / UpdateNoteで既存編集
  const [editing, setEditing] = useState<UpdateNote | 'new' | null>(null);

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/update-notes');
      const data = await res.json();
      if (data.success) setNotes(data.data);
    } finally { setLoading(false); }
  };

  const togglePublish = async (note: UpdateNote) => {
    const res  = await fetch(`/api/admin/update-notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publish: !note.publishedAt }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(note.publishedAt ? '下書きに戻しました' : '公開しました');
      fetchNotes();
    } else {
      toast.error(data.error ?? '更新に失敗しました');
    }
  };

  const deleteNote = async (note: UpdateNote) => {
    if (!confirm(`「${note.title}」を削除します。よろしいですか？`)) return;
    const res  = await fetch(`/api/admin/update-notes/${note.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      toast.success('削除しました');
      setNotes(prev => prev.filter(n => n.id !== note.id));
    } else {
      toast.error(data.error ?? '削除に失敗しました');
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title flex items-center gap-2 mb-0 pb-0 border-0">
          <Megaphone className="w-5 h-5 text-pink-500" />更新情報の管理
        </h2>
        <button onClick={() => setEditing('new')} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus className="w-4 h-4" />新規作成
        </button>
      </div>
      <p className="text-sm text-stone-500 mb-4">
        ここで投稿・公開した内容が、ユーザーのダッシュボード「更新情報」ページに新しい順で表示されます。下書き保存しておいて、まとめてから公開することもできます。
      </p>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8 text-stone-400">
          <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>まだ更新情報がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="bg-cream-50 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-stone-800">{note.title}</span>
                    {note.publishedAt
                      ? <span className="badge badge-green text-[10px]">公開中</span>
                      : <span className="badge badge-gray text-[10px]">下書き</span>}
                  </div>
                  <p className="text-xs text-stone-500 mt-1 whitespace-pre-wrap line-clamp-2">{note.body}</p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    {note.publishedAt
                      ? `公開日: ${new Date(note.publishedAt).toLocaleString('ja-JP')}`
                      : `作成日: ${new Date(note.createdAt).toLocaleString('ja-JP')}`}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => togglePublish(note)}
                    title={note.publishedAt ? '下書きに戻す' : '公開する'}
                    className="p-2 rounded-lg text-stone-500 hover:bg-cream-200 hover:text-stone-700">
                    {note.publishedAt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setEditing(note)} title="編集"
                    className="p-2 rounded-lg text-stone-500 hover:bg-cream-200 hover:text-stone-700">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteNote(note)} title="削除"
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <UpdateNoteFormModal
          note={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchNotes(); }}
        />
      )}
    </div>
  );
}

function UpdateNoteFormModal({ note, onClose, onSaved }: {
  note: UpdateNote | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title,   setTitle]   = useState(note?.title ?? '');
  const [body,    setBody]    = useState(note?.body ?? '');
  const [saving,  setSaving]  = useState(false);

  const save = async (publish: boolean) => {
    if (!title.trim()) { toast.error('タイトルを入力してください'); return; }
    if (!body.trim())  { toast.error('本文を入力してください'); return; }
    setSaving(true);
    try {
      const url    = note ? `/api/admin/update-notes/${note.id}` : '/api/admin/update-notes';
      const method = note ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), publish }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(publish ? '公開しました' : '下書き保存しました');
        onSaved();
      } else {
        toast.error(data.error ?? '保存に失敗しました');
      }
    } catch {
      toast.error('通信エラー');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-warm-lg w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-cream-200">
          <h3 className="font-bold text-stone-800">{note ? '更新情報を編集' : '更新情報を新規作成'}</h3>
          <button onClick={onClose} className="text-stone-400 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="field-label">タイトル <span className="text-red-500">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="field-input"
              placeholder="例：ロット番号トレース検索機能を追加しました" maxLength={200} />
          </div>
          <div>
            <label className="field-label">本文 <span className="text-red-500">*</span></label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} className="field-input"
              placeholder={'変更内容を箇条書きなどで入力してください。改行はそのまま表示されます。\n\n例：\n・Proプランでロット番号のトレース検索ができるようになりました\n・食材マスタの検索が高速化しました'} />
            <p className="field-hint">Markdown記法ではなく、改行がそのまま表示されるシンプルなテキストです。</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 p-5 border-t border-cream-200">
          <button onClick={onClose} className="btn-secondary flex-1">キャンセル</button>
          <button onClick={() => save(false)} disabled={saving} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}下書き保存
          </button>
          <button onClick={() => save(true)} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}公開する
          </button>
        </div>
      </div>
    </div>
  );
}
