import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { Providers } from './providers';

const notoSansJP = Noto_Sans_JP({
  subsets:  ['latin'],
  variable: '--font-noto-sans',
  display:  'swap',
  weight:   ['400', '500', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://foodlabel.lucke.jp'),
  title: {
    default: 'FoodLabel Pro | 食品成分表示ラベル管理システム',
    template: '%s | FoodLabel Pro',
  },
  description: '製菓・製パン・総菜・弁当など食品を販売するすべての事業者向けの食品成分表示ラベル管理システム。アレルゲン自動判定・栄養成分計算・ラベル印刷まで対応。月額980円から。',
  keywords: ['食品表示', 'ラベル印刷', 'アレルゲン', '栄養成分', '食品表示法', '製菓', '製パン', '惣菜', '弁当', '食品ラベル', 'ラベル印刷'],
  authors: [{ name: 'Bummeln' }],
  openGraph: {
    title: 'FoodLabel Pro | 食品成分表示ラベル管理システム',
    description: '食品を販売するすべての事業者向けの食品成分表示ラベル管理システム。アレルゲン自動判定・栄養成分計算・ラベル印刷に対応。',
    url: 'https://foodlabel.lucke.jp',
    siteName: 'FoodLabel Pro',
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'FoodLabel Pro | 食品成分表示ラベル管理システム',
    description: '食品を販売するすべての事業者向けの食品成分表示ラベル管理システム。',
  },
  alternates: {
    canonical: 'https://foodlabel.lucke.jp',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={notoSansJP.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2277926623752174" crossOrigin="anonymous"></script>
</head>
      <body className="font-sans bg-cream-100 text-stone-800 antialiased">
        <Providers>
          {children}
        </Providers>
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

