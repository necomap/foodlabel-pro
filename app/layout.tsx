import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { SessionProvider } from 'next-auth/react';

const notoSansJP = Noto_Sans_JP({
  subsets:  ['latin'],
  variable: '--font-noto-sans',
  display:  'swap',
  weight:   ['400', '500', '700'],
});

export const metadata: Metadata = {
  title:       'FoodLabel Pro',
  description: '成分表示ラベル管理システム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={notoSansJP.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="font-sans bg-cream-100 text-stone-800 antialiased">
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontFamily: 'var(--font-noto-sans)', fontSize: '14px' },
            success: { iconTheme: { primary: '#d4891f', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}
