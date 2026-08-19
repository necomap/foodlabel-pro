// app/dashboard/debug/page.tsx
// 2026-08: セッション情報（plan等）を誰でも閲覧できてしまう開発用デバッグページだったため、
// 仕様書レビューで指摘を受けて廃止。ファイル自体の削除はデバイスブリッジ経由ではできないため、
// アクセスしても404になるようにしている（notFound()）。
import { notFound } from 'next/navigation';

export default function DebugPage() {
  notFound();
}
