'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Cookie, BookOpen, Tag, ShoppingBasket, Settings,
  LogOut, Menu, X, ChevronRight, ArrowLeftRight, HelpCircle, Shield, Crown,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard/recipes',     label: 'レシピ管理',             icon: BookOpen,       color: 'text-amber-600'  },
  { href: '/dashboard/labels',      label: 'シール印刷',             icon: Tag,            color: 'text-green-600'  },
  { href: '/dashboard/ingredients', label: '食材マスタ',             icon: ShoppingBasket, color: 'text-blue-600'   },
  { href: '/dashboard/import',      label: 'インポート/エクスポート', icon: ArrowLeftRight, color: 'text-purple-600' },
  { href: '/dashboard/help',        label: 'ヘルプ・使い方',         icon: HelpCircle,     color: 'text-teal-600'   },
  { href: '/dashboard/settings',    label: '設定',                   icon: Settings,       color: 'text-stone-600'  },
];

interface Props {
  isAdmin:   boolean;
  isPremium: boolean;
  userName:  string;
  userEmail: string;
}

export default function DashboardNav({ isAdmin, isPremium, userName, userEmail }: Props) {
  const pathname    = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLink = ({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) => {
    const Icon   = item.icon;
    const active = pathname.startsWith(item.href);
    return (
      <Link href={item.href} onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
          ${active ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-stone-600 hover:bg-cream-100 hover:text-stone-800'}`}>
        <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-brand-600' : item.color}`} strokeWidth={1.5} />
        <span className="flex-1">{item.label}</span>
        {active && <ChevronRight className="w-4 h-4 text-brand-400" />}
      </Link>
    );
  };

  return (
    <>
      {/* ===== PC サイドバー ===== */}
      <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-cream-300 shadow-sm fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-cream-200">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-warm flex-shrink-0">
            <Cookie className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <div className="font-bold text-stone-800 text-sm leading-tight font-display">FoodLabel Pro</div>
            <div className="text-xs text-stone-400">成分表示管理</div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-0.5">
          {navItems.map(item => <NavLink key={item.href} item={item} />)}
        </nav>

        <div className="p-3 border-t border-cream-200 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-cream-50">
            <div className="w-8 h-8 bg-brand-200 rounded-lg flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
              {userName.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-stone-800 truncate">{userName}</div>
              <div className="text-xs text-stone-400 truncate">{userEmail}</div>
            </div>
          </div>

          {isAdmin && (
            <Link href="/admin"
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-xl transition-colors
                ${pathname.startsWith('/admin') ? 'bg-red-50 text-red-700' : 'text-red-500 hover:bg-red-50 hover:text-red-700'}`}>
              <Shield className="w-4 h-4" />管理者画面
            </Link>
          )}

          <button onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
            <LogOut className="w-4 h-4" />ログアウト
          </button>
        </div>
      </aside>

      {/* ===== モバイルヘッダー ===== */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-cream-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Cookie className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-stone-800 font-display text-sm">FoodLabel Pro</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg text-stone-600 hover:bg-cream-100">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* モバイルドロワー */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
              <span className="font-bold text-stone-800">メニュー</span>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-cream-100">
                <X className="w-5 h-5 text-stone-600" />
              </button>
            </div>
            <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-0.5">
              {navItems.map(item => <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />)}
              {isAdmin && (
                <Link href="/admin" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50">
                  <Shield className="w-5 h-5" />管理者画面
                </Link>
              )}
            </nav>
            <div className="p-3 border-t border-cream-200">
              <button onClick={() => signOut({ callbackUrl: '/auth/login' })}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl">
                <LogOut className="w-4 h-4" />ログアウト
              </button>
            </div>
          </div>
        </div>
      )}

      {/* モバイルボトムナビ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cream-200 shadow-lg z-30">
        <div className="flex">
          {navItems.slice(0, 5).map(item => {
            const Icon   = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors
                  ${active ? 'text-brand-600' : 'text-stone-400'}`}>
                <Icon className={`w-5 h-5 ${active ? 'text-brand-500' : ''}`} strokeWidth={1.5} />
                <span className="truncate text-[10px] max-w-[3.5rem] text-center leading-tight">
                  {item.label.split('/')[0]}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
