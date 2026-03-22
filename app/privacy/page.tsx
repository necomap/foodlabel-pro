import Link from 'next/link';

export const metadata = { title: 'プライバシーポリシー | FoodLabel Pro' };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream-100 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">プライバシーポリシー</h1>
          <p className="text-stone-500 text-sm mt-1">最終更新日：2026年3月23日</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">1. 収集する情報</h2>
          <p className="text-stone-600 text-sm leading-relaxed">本サービスでは、以下の情報を収集します。</p>
          <ul className="list-disc list-inside text-stone-600 text-sm space-y-1 pl-2">
            <li>メールアドレス（アカウント登録時）</li>
            <li>店舗情報（名称・住所・電話番号等）</li>
            <li>レシピ・食材データ（サービス利用時に入力いただいた情報）</li>
            <li>決済情報（Stripeが管理。当方はカード番号を保持しません）</li>
            <li>アクセスログ・利用状況データ</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">2. 利用目的</h2>
          <ul className="list-disc list-inside text-stone-600 text-sm space-y-1 pl-2">
            <li>本サービスの提供・運営</li>
            <li>お問い合わせへの対応</li>
            <li>利用規約に違反した行為への対応</li>
            <li>本サービスの改善・新機能の開発</li>
            <li>メンテナンス・重要なお知らせの送信</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">3. 第三者への提供</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            当方は、以下の場合を除き、個人情報を第三者に提供しません。
          </p>
          <ul className="list-disc list-inside text-stone-600 text-sm space-y-1 pl-2">
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>人の生命・身体・財産の保護のために必要な場合</li>
          </ul>
          <p className="text-stone-600 text-sm leading-relaxed mt-2">
            決済処理はStripe, Inc.に委託しており、Stripeのプライバシーポリシーが適用されます。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">4. Cookie・アクセス解析</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            本サービスでは、Cookieを使用してセッション管理を行っています。
            また、Google AdSenseによる広告配信のためにCookieが使用される場合があります。
            ブラウザの設定でCookieを無効にすることができますが、一部機能が利用できなくなる場合があります。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">5. 個人情報の管理</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            当方は、個人情報の漏洩・滅失・毀損の防止のため、適切なセキュリティ対策を講じます。
            データはSupabase（PostgreSQL）を使用して安全に管理されます。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">6. 開示・訂正・削除</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            ユーザーご本人から個人情報の開示・訂正・削除を求められた場合は、合理的な範囲で対応します。
            お問い合わせフォームまたはメールにてご連絡ください。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">7. お問い合わせ</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            個人情報の取り扱いに関するお問い合わせは下記までご連絡ください。
          </p>
          <div className="bg-cream-50 rounded-xl p-4 text-sm text-stone-600">
            <p>運営者：Bummeln</p>
            <p>所在地：愛知県名古屋市瑞穂区竹田町</p>
            <p>メール：<a href="mailto:info.lucke@gmail.com" className="text-brand-600 hover:underline">info.lucke@gmail.com</a></p>
          </div>
        </section>

        <div className="flex gap-4 text-sm pt-4 border-t border-cream-200">
          <Link href="/terms" className="text-brand-600 hover:underline">利用規約</Link>
          <Link href="/legal" className="text-brand-600 hover:underline">特定商取引法に基づく表記</Link>
        </div>
      </div>
    </div>
  );
}
