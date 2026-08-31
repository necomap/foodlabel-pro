import Link from 'next/link';

export const metadata = { title: '利用規約 | FoodLabel Pro' };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream-100 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">利用規約</h1>
          <p className="text-stone-500 text-sm mt-1">最終更新日：2026年8月31日</p>
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
            本サービスは、フリープラン、月額980円（税込）のスタンダードプラン、月額6,980円（税込）のプロプランを提供します。
            有料プランの料金は、登録されたクレジットカードに毎月自動で請求されます。
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
            当方は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について、当方の故意または重過失による場合を除き、一切責任を負いません。
          </p>
          <ol className="list-decimal list-inside text-stone-600 text-sm space-y-2 pl-2 leading-relaxed">
            <li>
              本サービスが提供する栄養成分計算・アレルゲン自動判定・添加物表示・原産国表示の判定・表示法令コンプライアンスチェックその他の表示支援機能は、ユーザーが入力した情報および文部科学省「食品成分表」等の外部データに基づく参考情報であり、その正確性・完全性・最新の法令への適合性を保証するものではありません。実際に食品に表示する内容の最終確認、および食品表示法をはじめとする関連法令の遵守については、食品を製造・販売する事業者であるユーザー自身の責任において行うものとし、当方が提供する情報を用いたことにより生じた表示の誤り、行政指導・処分、商品回収、アレルギー事故を含む健康被害その他一切の損害について、当方は責任を負いません。
            </li>
            <li>
              本サービスで作成したラベル・帳票等は、印刷または発行前に必ずユーザー自身が表示内容を確認したうえでご使用ください。プリンター本体・プリンタードライバー・OS・ブラウザ・拡張機能等の組み合わせにより生じる印刷内容の欠落、文字化け、レイアウト崩れ、サイズや色調の相違その他の表示不具合、およびこれらに起因して生じた損害について、当方は責任を負いません。
            </li>
            <li>
              通信回線、サーバー、データセンターその他の設備の障害・保守作業、天災、停電、第三者による不正アクセスやサイバー攻撃その他当方の合理的な管理の及ばない事由により本サービスの全部または一部が利用できなくなった場合、また登録データの全部もしくは一部が消失・破損した場合であっても、当方の故意または重過失による場合を除き、当方は責任を負いません。ユーザーは、レシピ・食材等の事業運営上重要なデータについて、本サービスのエクスポート機能等を利用してご自身の責任で定期的にバックアップを取得するものとし、バックアップを取得していなかったことにより生じた損害について当方は責任を負いません。
            </li>
            <li>
              本サービスは、決済処理にStripe, Inc.が提供するサービス、ラベル印刷機能の一部にBrother Industries, Ltd.が提供するb-PAC SDKおよび関連するブラウザ拡張機能など、当方以外の第三者が提供するサービス・ソフトウェアを組み込んで利用しています。これら第三者が提供するサービス・ソフトウェアの障害、仕様変更、提供終了その他の事由により生じた損害について、当方は責任を負いません。
            </li>
            <li>
              前各号のほか、当方が本サービスに関しユーザーに対し損害賠償責任を負う場合であっても、当方の故意または重過失による場合を除き、その賠償額は、損害の原因となる事象が発生した日の属する月から遡る直近12ヶ月間にユーザーが当方に支払った利用料金の合計額を上限とします。また、逸失利益、事業機会の損失、データの復旧・再構築に要した費用その他の間接損害・特別損害・付随的損害については、当方は損害発生の予見可能性の有無にかかわらず一切責任を負いません。
            </li>
            <li>
              食品表示法その他本サービスの機能に関連する法令の改正または行政解釈の変更等が行われてから、本サービスの表示・機能がこれに対応するまでの間に生じた不利益について、当方は責任を負いません。当方は法令改正等に応じて速やかに本サービスを更新するよう努めますが、対応の完了時期を保証するものではありません。
            </li>
            <li>
              本サービスは、食品の製造・販売等を行う事業者による事業目的での利用を前提としています。本規約に違反する態様での利用、本サービス本来の用途を逸脱した利用、またはユーザーが第三者にアカウントを利用させたことにより当該第三者または他のユーザーに生じた損害について、当方は責任を負いません。
            </li>
            <li>
              本条の定めにかかわらず、消費者契約法その他の強行法規により当方が責任を免れないとされる部分については、当該法令の定めに従うものとします。
            </li>
          </ol>
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
