// app/dashboard/layout.tsx
import { auth } from '@/lib/auth';
import DashboardNav from './_nav';
import AdBanner from '@/components/AdBanner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin   = (session?.user as any)?.plan === 'admin';
  const plan      = ((session?.user as any)?.plan ?? 'free') as string;
  const userName  = session?.user?.name  ?? '';
  const userEmail = session?.user?.email ?? '';

  return (
    <div className="min-h-screen flex bg-cream-100">
      <DashboardNav isAdmin={isAdmin} plan={plan} userName={userName} userEmail={userEmail} />
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="lg:hidden h-14" />
        <div className="max-w-7xl mx-auto p-4 pb-24 lg:pb-6 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
