'use client';
// ============================================================
// components/label/PrintGuide.tsx - 印刷手順ガイド（2026-09-30新設）
// ============================================================
// 「アプリの設定」「ブラウザの印刷画面」「プリンタ本体（ドライバ）」の3か所の設定が
// 噛み合わないと、小さく印刷される・はみ出す・白紙が出るといったトラブルになる。
// ラベル印刷画面から開ける手順ガイドとして、3か所それぞれの設定とよくあるトラブルをまとめる。
import { useState } from 'react';

const TABS = [
  { id: 'browser', label: '① 印刷画面' },
  { id: 'driver',  label: '② プリンタ本体' },
  { id: 'trouble', label: '③ よくあるトラブル' },
] as const;

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">{n}</span>
      <div className="text-sm text-stone-700 leading-relaxed">{children}</div>
    </li>
  );
}

export default function PrintGuide({ deviceType, onClose }: { deviceType: 'LABEL_PRINTER' | 'A4_PRINTER'; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('browser');
  const isLabel = deviceType === 'LABEL_PRINTER';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-warm-lg w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-cream-200">
          <h3 className="font-bold text-stone-800 text-lg">印刷手順ガイド（{isLabel ? 'ラベルプリンタ' : 'A4プリンタ'}）</h3>
          <button onClick={onClose} className="text-stone-400 text-2xl leading-none" aria-label="閉じる">×</button>
        </div>

        <div className="px-5 pt-4">
          <p className="text-xs text-stone-500 mb-3">
            きれいに印刷するには「このアプリの用紙設定」「印刷画面」「プリンタ本体」の3か所で、<strong>同じ用紙サイズ</strong>になっている必要があります。
          </p>
          <div className="flex gap-1 border-b border-cream-200">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === t.id ? 'border-brand-500 text-brand-700 font-medium' : 'border-transparent text-stone-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {tab === 'browser' && (
            <ol className="space-y-3">
              <Step n={1}>「印刷する」を押すと、ブラウザの印刷画面が開きます（Chrome・Edgeの場合）。</Step>
              <Step n={2}><strong>送信先（プリンター）</strong>で、使うプリンタを選びます。</Step>
              {isLabel
                ? <Step n={3}><strong>用紙サイズ</strong>が選べる場合は、アプリで設定したラベルと同じサイズ（例：62×60mm）を選びます。一覧に無いときは「② プリンタ本体」でサイズを登録してください。</Step>
                : <Step n={3}><strong>用紙サイズ</strong>が選べる場合は「A4」を選びます。</Step>}
              <Step n={4}>「詳細設定」を開き、<strong>余白：なし</strong>、<strong>倍率：デフォルト（100%）</strong>にします。「ページに合わせる」は選ばないでください（縮小されます）。</Step>
              <Step n={5}><strong>ヘッダーとフッター</strong>のチェックを外します（日付やURLが印字されるのを防ぎます）。</Step>
              <Step n={6}>まずは1枚だけ印刷して、はみ出しや欠けがないか確認してから枚数を増やしてください。</Step>
              <li className="text-xs text-stone-500 pt-2 border-t border-cream-200">
                Safari（Mac）の場合：印刷画面の「詳細を表示」から用紙サイズ・拡大縮小（100%）を設定します。一覧に無い用紙サイズは「用紙サイズ」→「カスタムサイズを管理」で追加できます。
              </li>
            </ol>
          )}

          {tab === 'driver' && (
            isLabel ? (
              <ol className="space-y-3">
                <Step n={1}>ラベルプリンタは、<strong>プリンタ本体（ドライバ）側にも用紙サイズの設定</strong>があります。ここがアプリの設定と違うと、縮小・余白・白紙の原因になります。</Step>
                <Step n={2}><strong>Windows 11</strong>：「設定」→「Bluetoothとデバイス」→「プリンターとスキャナー」→ 使うプリンタ →「印刷設定」を開きます。</Step>
                <Step n={3}>用紙サイズを、アプリで設定したラベル幅×高さと同じにします。一覧に無いサイズは、ドライバの用紙サイズ登録（ユーザー定義サイズ）機能で追加します。</Step>
                <Step n={4}><strong>連続（長尺）ロール紙</strong>を使う場合も、1枚の長さをアプリの「ラベル高さ」と同じにしておくと、毎回同じ長さでカットされます。</Step>
                <Step n={5}>設定後、印刷画面の送信先で同じプリンタを選び直すと反映されます。</Step>
                <li className="text-xs text-stone-500 pt-2 border-t border-cream-200">
                  ドライバの画面はメーカー・機種ごとに異なります。詳しくはプリンタの取扱説明書（「用紙サイズの登録」「ユーザー定義用紙」などの項目）をご確認ください。
                  Mac の場合は、印刷画面の「用紙サイズ」→「カスタムサイズを管理」で追加できます。
                </li>
              </ol>
            ) : (
              <ol className="space-y-3">
                <Step n={1}>A4プリンタは、通常プリンタ側の設定変更は不要です。用紙の種類を「普通紙」または「ラベル紙」にしておきます。</Step>
                <Step n={2}>市販のラベル用紙は、パッケージに書かれた<strong>1枚のサイズ・余白・シール同士のスキマ</strong>をアプリの「用紙の細かい寸法」に入力すると、枠にぴったり合います。</Step>
                <Step n={3}>ずれる場合は、普通紙に1枚印刷してラベル用紙と重ね、光に透かして位置を確認しながら上余白・左余白を調整してください。</Step>
              </ol>
            )
          )}

          {tab === 'trouble' && (
            <dl className="space-y-4 text-sm">
              {[
                ['小さく印刷される', '印刷画面の倍率が「ページに合わせる」になっていないか、用紙サイズがA4など大きいサイズになっていないか確認してください。'],
                ['2枚目に続きが出る・白紙が出る', 'プリンタ側の用紙の長さが、アプリの「ラベル高さ」より短い（または長い）ことが原因です。両方を同じ長さにそろえてください。内容が多すぎる場合は文字サイズを下げるか、ラベル高さを大きくします。'],
                ['端が欠ける', 'ラベルプリンタは印字できない余白があります。「詳細設定」→「印字位置の微調整」で、欠ける側の余白を少し増やしてください。'],
                ['日付やURLが印字される', '印刷画面の「ヘッダーとフッター」のチェックを外してください。'],
                ['バーコードが読み取れない', 'バーコードの縦幅を大きくするか、数値表示をOFFにしてください。印刷の濃度が薄い場合はプリンタ側で濃度を上げます。'],
                ['A4ラベルで位置がずれる', '用紙の細かい寸法（シールサイズ・スキマ・余白）をパッケージ記載の数値にそろえてください。'],
              ].map(([q, a]) => (
                <div key={q}>
                  <dt className="font-medium text-stone-800">{q}</dt>
                  <dd className="text-stone-600 mt-0.5 leading-relaxed">{a}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 p-5 border-t border-cream-200">
          <a href="/manual/FoodLabelPro_manual.pdf" target="_blank" rel="noopener" className="text-sm text-brand-600 hover:underline">PDFマニュアルを開く</a>
          <button onClick={onClose} className="btn-secondary">閉じる</button>
        </div>
      </div>
    </div>
  );
}
