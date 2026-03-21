// app/dashboard/debug/page.tsx
import { auth } from '@/lib/auth';

export default async function DebugPage() {
  const session = await auth();
  return (
    <div className="card max-w-lg">
      <h1 className="text-xl font-bold mb-4">セッションデバッグ（サーバー）</h1>
      <div className="space-y-2 text-sm">
        <div><strong>ログイン状態:</strong> {session ? 'ログイン済み' : '未ログイン'}</div>
        <div><strong>email:</strong> {session?.user?.email ?? 'なし'}</div>
        <div><strong>plan:</strong> <span className="text-red-600 font-bold text-lg">{(session?.user as any)?.plan ?? 'なし'}</span></div>
        <div><strong>id:</strong> {(session?.user as any)?.id ?? 'なし'}</div>
        <div><strong>isAdmin:</strong> {String((session?.user as any)?.plan === 'admin')}</div>
      </div>
      <pre className="mt-4 bg-cream-100 p-3 rounded text-xs overflow-auto">
        {JSON.stringify(session, null, 2)}
      </pre>
    </div>
  );
}
