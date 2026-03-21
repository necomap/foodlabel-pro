// app/dashboard/page.tsx - ダッシュボードトップ（レシピ一覧へリダイレクト）
import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect('/dashboard/recipes');
}
