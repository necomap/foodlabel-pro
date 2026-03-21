// app/dashboard/export/page.tsx - エクスポートページ（インポートと共通ページ）
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExportPage() {
  const router = useRouter();
  useEffect(() => {
    // インポート/エクスポートページはURLパラメータでタブを切り替え
    router.replace('/dashboard/import?tab=export');
  }, [router]);
  return null;
}
