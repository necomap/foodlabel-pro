// ============================================================
// app/dashboard/loading.tsx - 画面遷移中の表示（2026-11-18 追加）
// ダッシュボードはログイン確認のため動的ルートになり、loading.tsx が無いと
// リンクの事前読み込み（prefetch）が効かず、サーバー応答まで画面が切り替わらない。
// これを置くとクリック直後にこの表示へ切り替わり、データ取得後に本来の画面が出る。
// 見た目は各画面の読み込み中表示（Loader2 スピナー）と同じにしている。
// ============================================================
import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
    </div>
  );
}
