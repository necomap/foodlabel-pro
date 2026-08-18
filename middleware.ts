import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
    cookieName: process.env.NODE_ENV === 'production'
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token',
  });

  const { pathname } = req.nextUrl;
  const isLoggedIn = !!token;

  // /api/cron/* はVercel Cronから呼ばれる（ログインセッションを持たない）ため、NextAuthの
  // ログインリダイレクト対象から除外する。認証自体はルート側でCRON_SECRETのBearerトークンを
  // 個別にチェックしているので、ここを公開パスにしてもセキュリティ上は問題ない。
  // 2026-08: ここに/api/cronが無かったため、Cronからのリクエストが常に/auth/loginへ
  // リダイレクトされ、バックアップメールが一度も送信されていなかった不具合を修正。
  const publicPaths = ['/auth/', '/api/auth', '/api/util', '/api/stripe/webhook', '/api/cron', '/terms', '/privacy', '/legal', '/help', '/about', '/features', '/blog'];
  const isPublic = publicPaths.some(p => pathname.startsWith(p));

  if (!isLoggedIn && !isPublic && pathname !== '/' && pathname !== '') {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/dashboard/recipes', req.url));
  }

  if (pathname.startsWith('/admin')) {
    const plan = token?.plan as string | undefined;
    if (plan !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard/recipes', req.url));
    }
    const basicPass = process.env.ADMIN_BASIC_PASS;
    if (basicPass) {
      const basicUser = process.env.ADMIN_BASIC_USER ?? 'admin';
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        return new NextResponse('認証が必要です', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Admin Area"' },
        });
      }
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
      const [user, pass] = decoded.split(':');
      if (user !== basicUser || pass !== basicPass) {
        return new NextResponse('認証に失敗しました', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="Admin Area"' },
        });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public|google|sitemap|robots).*)'],
};

