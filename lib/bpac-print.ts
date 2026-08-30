// ============================================================
// lib/bpac-print.ts - brother b-PAC経由での不定長ラベル印刷
// ============================================================
// Windows + Brother b-PAC Extension（ブラウザ拡張機能）+ b-PAC SDK/ドライバーが
// ユーザーのPCに導入済みであることが前提。ブラウザ上でのみ動作する（サーバー側では使わない）。
//
// あらかじめ public/bpac.js に、Brother b-PAC SDKのJSサンプル
// （C:\Program Files\Brother bPAC3 SDK\Samples\JavaScript\bpac.js）を配置しておく必要がある。
// テンプレート（.lbx）ファイル内のオブジェクト名の対応は
// docs/handoffs/2026-08-30_bpac-handoff-1.md の4章で確定した内容に準拠している。
// ============================================================

import type { LabelContent } from '@/types';
import { buildManufacturerBlockText, buildCommentBlockText } from './label';

export interface BpacPrintResult {
  success: boolean;
  error?: string;
}

// オブジェクト名 → 差し込むテキストの対応表（バーコード・固定画像を除く）
function buildTextFields(content: LabelContent): Record<string, string> {
  return {
    productName:      content.productName,
    ingredientsText:  content.ingredientsText,
    contentAmount:    content.contentAmount,
    storageMethod:    content.storageMethod,
    categoryName:     content.categoryName ?? '',
    nutritionLabel:   content.nutritionPerUnit.label,
    // テンプレート側のキャプションに単位(kcal/g)が既に含まれているため、数値のみを差し込む
    nutritionEnergyKcal:   String(content.nutritionPerUnit.energyKcal),
    nutritionProtein:      String(content.nutritionPerUnit.protein),
    nutritionFat:          String(content.nutritionPerUnit.fat),
    nutritionCarbohydrate: String(content.nutritionPerUnit.carbohydrate),
    nutritionSugar:  content.nutritionPerUnit.sugar != null ? String(content.nutritionPerUnit.sugar) : '',
    nutritionSalt:   String(content.nutritionPerUnit.saltEquivalent),
    // 「賞味期限」の文言はテンプレート側のキャプションに既に含まれているため、年月日のみ差し込む
    expiryLine:      content.expiryDate,
    manufacturerBlock: buildManufacturerBlockText(content),
    // 注意事項（コメント＋品質管理事項）。テンプレート側のオブジェクト名は「comment」。
    comment:         buildCommentBlockText(content),
  };
}

/**
 * templatePath（.lbx）を開き、contentの内容を差し込んで不定長印刷する。
 * 例外は投げず、成功/失敗を戻り値で返す（呼び出し側でtoast表示するため）。
 */
export async function printFoodLabel(templatePath: string, content: LabelContent): Promise<BpacPrintResult> {
  if (!templatePath.trim()) {
    return { success: false, error: 'b-PACテンプレートのパスが設定されていません（設定画面で入力してください）' };
  }

  let bpac: any;
  try {
    // Next.jsのビルド時解決を避け、ブラウザのネイティブdynamic importとしてpublic/bpac.jsを読み込む。
    // 2026-08修正: webpackIgnoreコメントはwebpack（バンドル）には効くが、next buildの型チェック
    // （tsc）には効かず、import()の引数が文字列リテラルだと「Cannot find module '/bpac.js'」で
    // ビルドが落ちていた。パスを変数に切り出す（リテラルでなくす）ことで、TypeScriptがこの
    // dynamic importの型解決自体をスキップするようにし、ビルドエラーを回避する。
    const bpacJsPath = '/bpac.js';
    bpac = await import(/* webpackIgnore: true */ bpacJsPath);
  } catch {
    return { success: false, error: 'bpac.jsの読み込みに失敗しました（public/bpac.js が配置されているか確認してください）' };
  }

  if (typeof bpac.IsExtensionInstalled !== 'function' || !bpac.IsExtensionInstalled()) {
    return { success: false, error: 'Brother b-PAC Extension（ブラウザ拡張機能）がインストールされていません' };
  }

  const objDoc = bpac.IDocument;
  let opened = false;
  try {
    opened = await objDoc.Open(templatePath);
  } catch (e: any) {
    return { success: false, error: `テンプレートファイルを開けませんでした: ${e?.message ?? e}` };
  }
  if (!opened) {
    return { success: false, error: `テンプレートファイルを開けませんでした（パスを確認してください）: ${templatePath}` };
  }

  try {
    const textFields = buildTextFields(content);
    for (const [name, value] of Object.entries(textFields)) {
      const obj = await objDoc.GetObject(name);
      if (!obj) throw new Error(`テンプレート内にオブジェクト「${name}」が見つかりません`);
      obj.Text = value;
    }

    if (content.showBarcode !== false && content.barcode) {
      const idx = await objDoc.GetBarcodeIndex('barcode');
      await objDoc.SetBarcodeData(idx, content.barcode);
    }

    objDoc.Length = 0; // 不定長指定（印刷領域内のオブジェクトに合わせて長さを自動調整）

    objDoc.StartPrint('', 0);
    objDoc.PrintOut(1, 0);
    objDoc.EndPrint();
  } catch (e: any) {
    await objDoc.Close();
    return { success: false, error: `印刷処理でエラーが発生しました: ${e?.message ?? e}` };
  }

  await objDoc.Close();
  return { success: true };
}
