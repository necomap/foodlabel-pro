// app/page.tsx - ルートページ（ダッシュボードへリダイレクト）
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function RootPage() {
  const session = await auth();
  if (session) {
    redirect('/dashboard/recipes');
  } else {
    redirect('/auth/login');
  }
}
