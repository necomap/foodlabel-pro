// components/AmazonRecommend.tsx
// フリープラン向け：ダッシュボード下部の「食品ラベル作りに役立つアイテム」（Amazonアソシエイト）
// 表示の可否は呼び出し側（app/dashboard/layout.tsx）でプランを見て決める。
// サーバーコンポーネント（クライアントJSなし）。
import Link from 'next/link';
import { AMAZON_DISCLOSURE, amazonSearchUrl, pickAmazonItems } from '@/lib/amazon-associate';

export default function AmazonRecommend() {
  const items = pickAmazonItems(4);

  return (
    <aside aria-label="広告" className="mt-10 rounded-xl border border-cream-400 bg-white/70 p-4 lg:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <p className="text-sm font-bold text-stone-700">
          <span className="mr-2 rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 align-middle">PR</span>
          食品ラベル作りに役立つアイテム
        </p>
        <Link href="/dashboard/upgrade" className="text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2">
          スタンダードプラン（月額980円〜）で広告を非表示に
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        {items.map((item) => (
          <li key={item.keyword}>
            <a
              href={amazonSearchUrl(item.keyword)}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="flex h-full flex-col gap-1 rounded-lg border border-cream-300 bg-cream-50 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="text-xl leading-none" aria-hidden="true">{item.icon}</span>
              <span className="text-sm font-semibold text-stone-800 leading-snug">{item.title}</span>
              <span className="text-xs text-stone-500 leading-snug">{item.note}</span>
              <span className="mt-auto pt-1 text-xs font-medium text-brand-600">Amazonで見る →</span>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-stone-400">{AMAZON_DISCLOSURE}</p>
    </aside>
  );
}
