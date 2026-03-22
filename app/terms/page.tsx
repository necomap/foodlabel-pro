import Link from 'next/link';

export const metadata = { title: '利用規約 | FoodLabel Pro' };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream-100 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">利用規約</h1>
          <p className="text-stone-500 text-sm mt-1">最終更新日：2026年3月23日</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">第1条（適用）</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            本利用規約（以下「本規約」）は、Bummeln（以下「当方」）が提供するFoodLabel Pro（以下「本サービス」）の利用条件を定めるものです。
            登録ユーザーの皆さま（以下「ユーザー」）には、本規約に従って本サービスをご利用いただきます。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">第2条（利用登録）</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            登録希望者が当方の定める方法によって利用登録を申請し、当方がこれを承認することによって、利用登録が完了します。
            当方は、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあります。
          </p>
          <ul className="list-disc list-inside text-stone-600 text-sm space-y-1 pl-2">
            <li>虚偽の事項を届け出た場合</li>
            <li>本規約に違反したことがある者からの申請である場合</li>
            <li>その他、当方が利用登録を相当でないと判断した場合</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">第3条（料金・支払い）</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            本サービスは、フリープランと月額1,980円（税込）のプレミアムプランを提供します。
            プレミアムプランの料金は、登録されたクレジットカードに毎月自動で請求されます。
            解約はいつでも可能で、解約後は当月末まで利用できます。
            返金は原則として行いません。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">第4条（禁止事項）</h2>
          <p className="text-stone-600 text-sm leading-relaxed">ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
          <ul className="list-disc list-inside text-stone-600 text-sm space-y-1 pl-2">
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪行為に関連する行為</li>
            <li>当方、他のユーザーまたは第三者の知的財産権を侵害する行為</li>
            <li>本サービスの運営を妨害するような行為</li>
            <li>不正アクセスをし、またはこれを試みる行為</li>
            <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
            <li>その他、当方が不適切と判断する行為</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">第5条（免責事項）</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            当方は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。
            本サービスで提供する栄養成分計算・アレルゲン表示は参考値であり、実際の食品表示については関連法規に基づき事業者自身の責任においてご確認ください。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">第6条（サービス内容の変更等）</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            当方は、ユーザーへの事前通知なく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとします。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-700">第7条（準拠法・裁判管轄）</h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            本規約の解釈にあたっては、日本法を準拠法とします。
            本サービスに関して紛争が生じた場合には、名古屋地方裁判所を専属的合意管轄とします。
          </p>
        </section>

        <div className="pt-4 border-t border-cream-200 text-sm text-stone-400">
          <p>運営者：Bummeln</p>
          <p>お問い合わせ：<a href="mailto:info.lucke@gmail.com" className="text-brand-600 hover:underline">info.lucke@gmail.com</a></p>
        </div>

        <div className="flex gap-4 text-sm">
          <Link href="/privacy" className="text-brand-600 hover:underline">プライバシーポリシー</Link>
          <Link href="/legal" className="text-brand-600 hover:underline">特定商取引法に基づく表記</Link>
        </div>
      </div>
    </div>
  );
}
