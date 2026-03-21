'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = ['バグ報告', '機能要望', '使い方の質問', 'その他'];

export default function ContactPage() {
  const [form, setForm] = useState({ category: 'バグ報告', subject: '', body: '' });
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleSend = async () => {
    if (!form.subject.trim() || !form.body.trim()) {
      toast.error('件名と内容を入力してください');
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
      } else {
        toast.error(data.error ?? '送信に失敗しました');
      }
    } catch { toast.error('通信エラーが発生しました'); }
    finally   { setLoading(false); }
  };

  if (done) {
    return (
      <div className="max-w-lg animate-fade-in">
        <div className="card text-center py-10">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-stone-800 mb-2">送信しました</h2>
          <p className="text-stone-500 text-sm mb-6">
            お問い合わせを受け付けました。<br />
            内容を確認後、対応いたします。
          </p>
          <Link href="/dashboard/help" className="btn-primary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />ヘルプに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/help" className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-stone-800 font-display flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-500" />
            お問い合わせ・機能要望
          </h1>
          <p className="text-stone-500 text-xs mt-0.5">バグ報告・機能要望・使い方の質問など</p>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="field-label">カテゴリ</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({...f, category: c}))}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
                  ${form.category === c
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white text-stone-600 border-cream-300 hover:border-brand-300'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">件名 <span className="text-red-500">*</span></label>
          <input type="text" value={form.subject}
            onChange={e => setForm(f => ({...f, subject: e.target.value}))}
            className="field-input" placeholder="例: レシピ編集でエラーが発生する" />
        </div>

        <div>
          <label className="field-label">内容 <span className="text-red-500">*</span></label>
          <textarea value={form.body}
            onChange={e => setForm(f => ({...f, body: e.target.value}))}
            className="field-input resize-none" rows={6}
            placeholder="できるだけ詳しく教えてください。&#10;&#10;バグ報告の場合：&#10;・どの画面で発生しましたか？&#10;・どんな操作をしましたか？&#10;・エラーメッセージは何と表示されましたか？" />
        </div>

        <button onClick={handleSend} disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" />送信中...</>
            : <><MessageSquare className="w-4 h-4" />送信する</>
          }
        </button>
      </div>
    </div>
  );
}
