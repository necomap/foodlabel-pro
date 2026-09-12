# FoodLabel Pro — b-PAC連携（不定長ラベル印刷）引き継ぎ文書

作成日：2026年8月30日
対象：FoodLabel Proの「不定長ラベル印刷（brother b-PAC連携）」機能を別チャットで引き継ぐ人
前提：この文書は「FoodLabel Pro — 引き継ぎ文書.md」（2026年8月19日作成）の続きです。プロジェクト概要・絶対厳守事項（`prisma migrate dev`禁止など）はそちらを参照してください。

---

## 0. この機能の目的

ユーザーから「brotherのP-PAC（正しくはb-PAC）を使って不定長ラベル印刷ができないか」という相談があり、調査した結果、**技術的に可能**と判断。現在、FoodLabel Pro上で管理しているレシピデータを使い、ユーザー自身のPC上でBrother QL-820NWBに62mm幅の不定長（無定長）ラベルを印刷する機能の実装を進めている。

---

## 1. 確認済みの技術的事実

### 1.1 b-PACとは
- ブラザー公式の無料SDK。P-touch/QL/TDシリーズのラベルプリンターを自作アプリから直接制御できる。
- **Windows限定**。ブラウザ（Chrome/Edge/Firefox）から使う場合は「Brother b-PAC Extension」という拡張機能に加えて、**b-PAC本体（ランタイム）とプリンタードライバーもユーザーのPCに別途インストールが必要**（拡張機能だけでは動かない）。

### 1.2 不定長印刷の実現方法
- `IDocument.Length`プロパティに**0以下を設定すると無定長になり、印刷領域内のオブジェクトに合わせて長さが自動調整される**（単位1440dpi）。
- JavaScript版でも`objDoc.Length = 0;`という代入で同じ動作（`bpac.js`内で`static set Length(n){IDocument.SetLength(n)}`として実装されている）。
- `Width`（幅）は取得専用（get only）。幅は実際にセットされたテープ（メディア）依存で、コードから自由に変更はできない。

### 1.3 JavaScript側の基本コードパターン（実機のサンプルで確認済み）
```js
import * as bpac from './bpac.js';

const objDoc = bpac.IDocument;
const opened = await objDoc.Open(templatePath);   // .lbx/.lblファイルを開く
const obj = await objDoc.GetObject('objectName');  // 名前でオブジェクト取得
obj.Text = '差し込みたい文字列';

objDoc.Length = 0; // 無定長指定

objDoc.StartPrint('', 0);
objDoc.PrintOut(1, 0);
objDoc.EndPrint();
await objDoc.Close();
```

### 1.4 バーコードの扱い（重要・要注意）
- バーコードは`GetObject().Text`では扱えない。専用の2ステップが必要：
  ```js
  const idx = await objDoc.GetBarcodeIndex('barcode');   // オブジェクト名→インデックス取得
  await objDoc.SetBarcodeData(idx, 'レシピのバーコード文字列');
  ```
- **バーコードの規格（CODE128 / JANなど）は実行時に変更できない**。b-PACの`SetAttribute`はテキストオプション（`boaTextOption`）と日付加減算（`boaDateTimeAddSubtract`）の2種類しか設定不可で、バーコードプロトコルの動的変更に対応する手段は公式リファレンス上に見当たらなかった。**バーコード規格はP-touch Editorでテンプレートを作った時点で固定**。ユーザーごとにJAN/CODE128を切り替えたい場合は、規格違いのテンプレートファイルを複数用意し、ショップの設定に応じてどちらを開くかアプリ側で振り分ける方式になる（未実装）。

### 1.5 .lbxファイルの正体
- 実体はZIPファイル。展開すると`label.xml`（レイアウト本体）と`prop.xml`（メタデータ）が入っている。
- フォーマットは非公開だが、XMLを直接編集して再度.lbxとして固めることは技術的に可能（有志による実証あり）。ただし非公式・非サポートの方法なので、**レイアウトの初期設計はP-touch Editorで手作業、動的な中身の差し込みはb-PACの公式APIで行う**という役割分担を採用する。

### 1.6 テンプレートに関する重要な制限
- **データベース結合（差し込み印刷）されたレイアウトファイルはb-PACのテンプレートとして使用できない**（ブラザー公式ドキュメントに明記）。
- ユーザーが従来使っていた`食品表示ラベル62mm_1日.lbx`等は、`F:\★My Labels\★resipi.xlsm`という独自のExcelマクロファイルとデータベース結合されていたことが判明（`<database:database type="FILE" databasePath="F:\★My Labels\★resipi.xlsm" ...>`が実際に埋め込まれていた）。→ **2026年8月30日時点でユーザーが全ファイルの結合を解除済み**。

---

## 2. インストール済み環境（ユーザーのPC）

- Brother QL-820NWB（プリンター本体）
- b-PAC SDK：`C:\Program Files\Brother bPAC3 SDK`にインストール済み（Ver.3.4.015、64bit版）
  - ヘルプファイル：`Doc\bPAC34.chm`
  - JSサンプル：`Samples\JavaScript\bpac.js`, `JS_NamePlate.html`
- 対象テンプレートファイル（`F:\★My Labels\`フォルダ内）：
  - `食品表示ラベル62mm_1日.lbx`（通常サイズ、固定長・`autoLength="false"`）
  - `食品表示ラベル62mm_30日_小サイズ.lbx`（すでに`autoLength="true"`で保存されていた実例）
  - 他にも2日・3日・7日・12日・14日・20日・30日・40日・45日・90日・冷凍・39mm幅版など多数の派生ファイルが同フォルダに存在（すべて同様にExcel結合されていたテンプレート）

---

## 3. 決定事項

1. **テンプレートは1つの62mmファイルに集約する方針**。日数ごとにファイルを分けていた「日付と時刻」オブジェクト（印刷日＋N日を自動計算する機能）は廃止し、代わりにアプリ側ですでに計算済みの`expiryDateStr`（`lib/label.ts`の`generateLabelContent()`が生成）をテキストとして流し込む方式に変更する。これにより日数が何日でもテンプレートファイルは1つで済む。
2. データベース結合はユーザー側で解除済み。残作業は、各オブジェクトに意味のある「オブジェクト名」を手動で設定し直すこと。
3. ロゴ・リサイクルマークは今回はひとまず固定画像のまま（差し替えなし）で進める。

---

## 4. オブジェクト名の対応表（確定・コピペ用）

| テンプレート上の表示内容 | オブジェクト名 | 値の元 |
|---|---|---|
| 品名 | `productName` | `content.productName` |
| 原材料 | `ingredientsText` | `content.ingredientsText` |
| 内容量 | `contentAmount` | `content.contentAmount` |
| 保存方法 | `storageMethod` | `content.storageMethod` |
| カテゴリ | `categoryName` | `content.categoryName` |
| あたり（〇gあたり表記） | `nutritionLabel` | `content.nutritionPerUnit.label` |
| 熱量 | `nutritionEnergyKcal` | `content.nutritionPerUnit.energyKcal` |
| たんぱく質 | `nutritionProtein` | `content.nutritionPerUnit.protein` |
| 脂質 | `nutritionFat` | `content.nutritionPerUnit.fat` |
| 炭水化物 | `nutritionCarbohydrate` | `content.nutritionPerUnit.carbohydrate` |
| 糖質 | `nutritionSugar` | `content.nutritionPerUnit.sugar` |
| 食塩相当量 | `nutritionSalt` | `content.nutritionPerUnit.saltEquivalent` |
| 賞味期限/消費期限（旧：日付と時刻） | `expiryLine` | `${content.expiryType}　${content.expiryDate}` |
| 製造者（屋号・住所・電話等） | `manufacturerBlock` | 既存の`generateLabelHtml`と同じ組み立てロジックを流用（HP URL行は除外でOKとユーザー了承済み） |
| バーコード | `barcode`（※Text方式ではなく`GetBarcodeIndex`＋`SetBarcodeData`を使う） | `content.barcode` |
| ロゴ画像 | 変更なし（固定画像のまま） | — |
| リサイクルマーク画像 | 変更なし（固定画像のまま。将来的にレシピごと切替の要望あり→4章参照） | — |
| 「No」オブジェクト | 用途不明。ユーザーが探索中。今回の印刷処理には含めない | — |

---

## 5. 印刷処理コード（ドラフト・未テスト）

```js
import * as bpac from './bpac.js';

async function printFoodLabel(templatePath, content) {
  if (!bpac.IsExtensionInstalled()) {
    // ユーザーに拡張機能インストールを促す処理をここに
    return false;
  }

  const objDoc = bpac.IDocument;
  const opened = await objDoc.Open(templatePath);
  if (!opened) return false;

  try {
    (await objDoc.GetObject('productName')).Text = content.productName;
    (await objDoc.GetObject('ingredientsText')).Text = content.ingredientsText;
    (await objDoc.GetObject('contentAmount')).Text = content.contentAmount;
    (await objDoc.GetObject('storageMethod')).Text = content.storageMethod;
    (await objDoc.GetObject('categoryName')).Text = content.categoryName ?? '';
    (await objDoc.GetObject('nutritionLabel')).Text = content.nutritionPerUnit.label;
    (await objDoc.GetObject('nutritionEnergyKcal')).Text = `${content.nutritionPerUnit.energyKcal}kcal`;
    (await objDoc.GetObject('nutritionProtein')).Text = `${content.nutritionPerUnit.protein}g`;
    (await objDoc.GetObject('nutritionFat')).Text = `${content.nutritionPerUnit.fat}g`;
    (await objDoc.GetObject('nutritionCarbohydrate')).Text = `${content.nutritionPerUnit.carbohydrate}g`;
    (await objDoc.GetObject('nutritionSugar')).Text = content.nutritionPerUnit.sugar != null ? `${content.nutritionPerUnit.sugar}g` : '';
    (await objDoc.GetObject('nutritionSalt')).Text = `${content.nutritionPerUnit.saltEquivalent}g`;
    (await objDoc.GetObject('expiryLine')).Text = `${content.expiryType}　${content.expiryDate}`;
    (await objDoc.GetObject('manufacturerBlock')).Text = buildManufacturerBlockText(content); // 既存ロジックから流用して実装する関数（未作成）

    if (content.barcode) {
      const idx = await objDoc.GetBarcodeIndex('barcode');
      await objDoc.SetBarcodeData(idx, content.barcode);
    }

    objDoc.Length = 0; // 不定長指定

    objDoc.StartPrint('', 0);
    objDoc.PrintOut(1, 0);
    objDoc.EndPrint();
  } finally {
    await objDoc.Close();
  }
  return true;
}
```

**未確定・要検討事項**：
- `templatePath`は現状ユーザー自身のPC上の固定パス（`F:\★My Labels\食品表示ラベル62mm.lbx`のようなイメージ）を想定。将来的に他の店舗ユーザーにも展開する場合、各ユーザーのPCで同じパスにファイルが無いと動かないため、パスの扱い方（固定の推奨フォルダを案内する／ダウンロードしてもらう等）を別途検討する必要がある。
- `buildManufacturerBlockText()`は未実装。既存の`lib/label.ts`の`generateLabelHtml`が製造者情報をどう組み立てているかを確認し、同じ内容になるよう実装する。

---

## 6. 未解決・保留にした論点

1. **バーコード規格（CODE128 / JAN）のユーザーごとの切り替え**：b-PACのAPIでは動的変更不可と判明。対応する場合は規格違いのテンプレートを複数用意し、ショップ設定で振り分ける方式が必要（未着手）。
2. **リサイクルマークのレシピごと設定機能**：`lib/label.ts`は`(recipe as any).recycleMarks`を参照しているが、`app/api/recipes/[id]/route.ts`には保存処理が無く、**実際にはまだ機能として存在しない**（受け皿のみ）。レシピ編集画面・保存APIへの追加が必要。
3. **リサイクルマーク横の空きスペースの活用案**：リサイクルマークが1個の場合はその横にHP URLを表示、2個の場合はそのスペースに2つ目のマークを表示、という出し分けのアイデアが出ている。実装するなら、同じ場所にテキストオブジェクト（URL用）と画像オブジェクト（2つ目のマーク用）を重ねて用意し、印刷時にどちらかにだけ内容を入れる方式になる。上記2の機能が前提。
4. **不定長化した際のバーコード位置ズレの可能性**：現在バーコードは「左下、右端・下端の余白ギリギリ」に固定座標（top-left基準のx,y）で配置されている。無定長にした際、テキスト量が少ない場合にバーコードの位置が想定と変わる可能性がある（オブジェクトの座標は上端基準の絶対値のため、印刷全体の長さが伸縮してもバーコード自体は動かない）。実際にP-touch Editorで印刷プレビューを見ながら検証が必要。
5. **「No」オブジェクトの用途**：不明。データベース結合のフィールドとしては存在が確認できたが、どのオブジェクトに対応するかは特定できず、ユーザーが引き続き確認中。

---

## 7. 次のチャットで最初にやること

1. ユーザーに、テンプレートのオブジェクト名変更作業が完了したか確認する（4章の対応表通りに設定できたか）。
2. `buildManufacturerBlockText()`の実装（`lib/label.ts`の`generateLabelHtml`を参照）。
3. 実際にブラウザ＋b-PAC拡張機能でテスト印刷を行い、5章のドラフトコードが動くか検証する。
4. 6章の未解決事項について、優先順位をユーザーに確認しながら順次対応する。
