import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = req.nextUrl;
  const isLoggedIn = !!token;

  const publicPaths = ['/auth/', '/api/auth'];
  const isPublic = publicPaths.some(p => pathname.startsWith(p));

  // 未ログイン → ログインページへ
  if (!isLoggedIn && !isPublic && pathname !== '/') {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ログイン済みで認証ページ → ダッシュボードへ
  if (isLoggedIn && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/dashboard/recipes', req.url));
  }

  // 管理者ページ → plan を JWT から直接チェック
  if (pathname.startsWith('/admin')) {
    const plan = token?.plan as string | undefined;
    if (plan !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard/recipes', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
