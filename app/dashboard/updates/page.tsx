// app/dashboard/updates/page.tsx - 更新情報（お知らせ）一覧
'use client';

import { useState, useEffect } from 'react';
import { Megaphone, Loader2 } from 'lucide-react';

interface UpdateNote {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

export default function UpdatesPage() {
  const [notes,   setNotes]   = useState<UpdateNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/update-notes');
        const data = await res.json();
        if (data.success) setNotes(data.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-stone-800 font-display flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-pink-500" />更新情報
        </h1>
        <p className="text-stone-500 text-sm mt-0.5">FoodLabel Proの機能追加・変更・不具合修正などをお知らせします。</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-brand-400" /></div>
      ) : notes.length === 0 ? (
        <div className="card text-center text-sm text-stone-400 py-10">
          <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
          まだ更新情報はありません
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map(note => (
            <div key={note.id} className="card">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <h2 className="font-bold text-stone-800">{note.title}</h2>
                <span className="text-xs text-stone-400 whitespace-nowrap">
                  {new Date(note.publishedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <p className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">{note.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
