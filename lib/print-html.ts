// lib/print-html.ts - 生成済みHTML文字列をブラウザで印刷する共通ヘルパー（2026-09新設）
// ============================================================
// 以前はapp/dashboard/labels/page.tsx・app/dashboard/recipes/print/page.tsxの両方で
// window.open('', '_blank') → document.write() → win.print() という
// 「別タブを開いて印刷する」方式を個別に実装していた。
// これはPCのブラウザでは問題なく動くが、スマートフォン（特にiOS Safari。Android版Chrome等でも
// 発生しうる）では、window.openで開いた別タブにdocument.writeで流し込んだ内容が正しく読み込まれず
// 印刷（共有）シートが一切表示されない、という不具合があった。PC側の動作確認だけでは気づけない。
//
// 新しいウィンドウ/タブを一切開かず、現在のページの中に非表示のiframeを1つ生成して
// その中にHTMLを流し込み、iframe自身に対してprint()を呼ぶ方式に変更する。
// ポップアップブロックの影響を受けず、モバイルブラウザでもOSの印刷・共有シートが正しく開く。
export function printHtmlDocument(html: string): void {
  const iframe = document.createElement('iframe');
  // display:noneだと印刷対象として認識されないブラウザがあるため、画面外に配置して隠す。
  iframe.style.position = 'fixed';
  iframe.style.right  = '0';
  iframe.style.bottom = '0';
  iframe.style.width  = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.parentNode?.removeChild(iframe);
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    win.focus();
    win.print();
    // 印刷ダイアログを閉じたタイミングでafterprintが発火するブラウザはそれで片付ける。
    // afterprintが発火しないモバイルブラウザもあるため、フォールバックとして
    // 印刷操作に十分な時間（60秒）が経ったら必ずクリーンアップする
    // （印刷ダイアログの操作中にiframeを消してしまうと印刷が中断される可能性があるため、
    // 短い時間では待たない）。
    if ('onafterprint' in win) {
      win.onafterprint = cleanup;
    }
    setTimeout(cleanup, 60000);
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { cleanup(); return; }
  doc.open();
  doc.write(html);
  doc.close();
}
