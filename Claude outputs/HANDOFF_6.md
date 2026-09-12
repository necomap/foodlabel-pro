# HACCPアプリ 引き継ぎ文書（HACCP経由3アプリ自動連携・実装編）

作成日時: 2026-09-06（この文書を新しいチャットの最初に添付してください。課金プランの経緯はHANDOFF_5.md、連携安全化・解約バグ修正の詳細はHANDOFF_3.md、3アプリ連携の元々の構想はHANDOFF_2.md 7章を参照）

このセッションでは、HANDOFF_2.md 7章・HANDOFF_3.md 6-1に書かれていた本題「foodlabel-proで印刷した分を自動で在庫から引く（HACCP連携時はHACCP経由、未連携時は在庫アプリ直接）」を設計・実装しました。**コードは3アプリとも完成し、ユーザーのPCへの書き込みも完了済みです。ただし、実際に動かすには下記4章の「ユーザー側の必須作業」が残っています（Stripeの時と同様、環境変数の設定やデプロイはこちらからは実行できません）。**

---

## 1. 実装した機能の概要

foodlabel-proでラベルを印刷すると、印刷ボタン付近の「在庫を差し引く」チェックボックス（デフォルトON）がONの場合に、印刷枚数に応じて材料の在庫を自動で差し引きます。

- **foodlabel-proの設定画面で「HACCP連携用店舗コード」が設定されている場合**: HACCP経由で差し引く。HACCPの「製造記録」にも自動で記録が残る（ユーザー確認済みの仕様）。HACCPが在庫アプリと連携済みならそちらの在庫を、未連携ならHACCP自身の在庫を差し引く。
- **HACCP未連携・「在庫アプリ連携用ユーザーID」のみ設定されている場合**: 在庫アプリへ直接、材料在庫の差し引き＋完成品在庫の増加を行う。
- **どちらも未設定の場合**: 何もしない（印刷は通常どおり成功する）。

再印刷・修正印刷で二重に差し引かれるのを防ぐため、チェックボックスは印刷のたびにON/OFFを選べます（前回値はブラウザに保存）。

品名マッピング（HACCP管理設定画面）は、従来の「HACCP側の品名⇔在庫アプリ側の品名」の2つに加えて、「foodlabel-pro側の材料名」を任意で追加できるように拡張しました。未設定の項目は名前が完全一致していれば自動で連携されます。

この機能はfoodlabel-pro側・HACCP側ともにプロプラン／スタンダードプラン限定です（在庫アプリ側は既存のプロプラン限定機能をそのまま使用）。

---

## 2. 変更したファイル（全てユーザーのPCへ書き込み済み）

### HACCP（`C:\Users\emma\Documents\haccp-app`）
- `models/inventorySync.js` … 在庫アプリへの「消費（差し引き）」通信用に`reportConsumption()`を追加
- `utils/nameMatch.js` … foodlabel-pro側の品名マッピング解決用に`buildFoodlabelNameMapLookup()`・`resolveFromFoodlabelName()`を追加
- `routes/admin.js` … 品名マッピング登録フォームに`foodlabelName`（任意）を追加、管理画面に店舗コード表示用の`canUseAppIntegration`判定を追加
- `views/admin/index.ejs` … 品名マッピング表の3列目、および「foodlabel-pro連携」カード（店舗コード表示・プラン制限の案内）を新設
- `routes/external.js`（新規） … foodlabel-proから呼ばれる`POST /api/external/consume`（共有シークレット認証、在庫差し引き＋製造記録の自動登録）
- `server.js` … 上記ルートを`/api/external`にマウント

### 在庫アプリ（`C:\Users\emma\Documents\inventory-app`）
- `src/app/api/items/consume/route.ts`（新規） … `POST /api/items/receive`（納品＝加算）の逆方向、まとめて材料を差し引く＋完成品を増やすAPI（共有シークレット認証、プロプラン限定チェックあり）

### foodlabel-pro（`C:\Users\emma\Documents\foodlabel-pro`）
- `prisma/schema.prisma` … `User`に`inventoryUserId`・`haccpStoreCode`（ともに任意）を追加
- `lib/plan-limits.ts` … 各プランに`canUseStockSync`フラグを追加（pro/adminのみtrue）
- `lib/stock-sync.ts`（新規） … 印刷後にHACCPまたは在庫アプリへ差し引きリクエストを送る`deductStockForPrint()`
- `app/api/labels/generate/route.ts` … 印刷完了後に`deductStockForPrint()`を呼び出し、結果をレスポンスの`data.stockSync`に含める
- `app/api/labels/print-stats/route.ts` … `canUseStockSync`・`stockSyncConfigured`をレスポンスに追加（印刷画面のチェックボックス表示制御用）
- `app/api/user/profile/route.ts` … `inventoryUserId`・`haccpStoreCode`の読み書きに対応
- `app/dashboard/settings/page.tsx` … 「印刷時の在庫自動差し引き」欄（HACCP連携用店舗コード・在庫アプリ連携用ユーザーID）を追加
- `app/dashboard/labels/page.tsx` … 「在庫を差し引く」チェックボックス・印刷結果のトースト通知を追加

---

## 3. 実施したテスト

- HACCP側の新ルート（`routes/external.js`）: モックDB＋モックfetchによる単体テストを作成・実行（13アサーション全パス）。シークレット不一致→401、店舗未発見→404、freeプラン→403、premiumかつ在庫アプリ未連携→HACCP自身の在庫を減算、premiumかつ在庫アプリ連携済み→在庫アプリへの呼び出し内容（品名マッピング解決含む）を検証済み。
- HACCP側の管理画面（`views/admin/index.ejs`）: 実際にEJSでレンダリングし、premium/freeプラン双方で正しく表示されることを確認済み。
- foodlabel-pro側の変更ファイル（TypeScript/TSX）: 全てesbuildで構文チェック済み（型チェックは、このクラウド作業環境からはprismaのエンジンバイナリ取得がブロックされるため実施できていません。HANDOFF_2.md 5章参照の既知の制約）。
- **本番相当の統合テスト（実際にfoodlabel-proのVercelから印刷し、HACCP・在庫アプリの本番/開発環境まで実際に反映されるか）は未実施**。4章の設定が終わったあと、実際に試してみることを推奨します。

---

## 4. ユーザー側の必須作業（これが終わらないと動きません）

1. **foodlabel-proのDBスキーマ反映**: `foodlabel-pro`フォルダで`npm run db:push`を実行してください（`User`に`inventoryUserId`・`haccpStoreCode`列を追加するコマンド。以前の`externalApiKey`追加時と同じ要領です）。
2. **共有シークレットの環境変数設定（Vercel）**:
   - `FOODLABEL_SYNC_SECRET`: 新規に決めた値を、**HACCPとfoodlabel-pro両方のVercelプロジェクト**に同じ値で設定してください（`INVENTORY_SYNC_SECRET`と同じ考え方です）。
   - `INVENTORY_SYNC_SECRET`: 既存の値を**foodlabel-proのVercelプロジェクトにも追加**してください（在庫アプリへ直接連携する場合に使います。HACCP経由のみで使うなら省略可）。
   - 環境変数はVercelに設定しただけでは反映されません。設定後、3アプリともGitHub Desktopでコミット→push→Vercel自動デプロイ、まで行ってください（Redeployボタンのみは不可、というこれまでの運用ルールのままです）。
3. **連携設定の入力**:
   - foodlabel-proの設定画面で、「HACCP連携用店舗コード」（HACCPの管理者設定画面に表示されています）または「在庫アプリ連携用ユーザーID」を入力・保存してください。
   - 品名の呼び方がアプリ間で違う材料があれば、HACCPの管理者設定画面「品名マッピング」で、HACCP側・在庫アプリ側に加えてfoodlabel-pro側の材料名（レシピで使っている名前）も登録してください（任意ですが、精度が上がります）。
4. **実際に試す**: foodlabel-proでラベルを1枚印刷し、「在庫を差し引く」にチェックが入っていることを確認してから印刷 → 材料在庫が減っているか、（HACCP経由の場合は）HACCPの製造記録に自動で1件増えているかを確認してください。

---

## 5. まだ決まっていない・残っていること（HANDOFF_5.mdからの持ち越し）

1. 在庫アプリのproプランの月額（現状コード上は暫定¥2,980）。「機能と他アプリとのバランスを見て決めたい」とのことで保留中。
2. foodlabel-pro / HACCPのStripeカスタマーポータル有効化。ユーザーから「カスタマーポータル有効化＝商品の追加のことか」という質問があったため、これはStripeダッシュボードの「設定→請求→カスタマーポータル」で行う、商品登録とは別の設定であることを説明済み。実際に有効化されたかは未確認のまま。
3. HACCPのテスト用「プレミアム契約中」アカウントの扱い（実害なし、優先度低）。
4. 在庫アプリの実際の一般公開（コードは¥980で確定済み、リリースのタイミングの問題）。
5. 特商法・プライバシーポリシー等の事業者情報未記入、カレンダーデータの最終確認は、引き続き持ち越しです。

---

## 6. 仕様書・マニュアルについて

3アプリ連携の本題が形になったタイミングのため、次のチャットで「仕様書・ユーザーマニュアル・インストールマニュアルを作成するか」を改めて確認してください（ユーザーの標準的な希望）。特にfoodlabel-pro側は今回、設定画面に新しい入力欄（HACCP連携用店舗コード・在庫アプリ連携用ユーザーID）が増えたため、既存の`usage_manual.md`・`HACCP_manual.md`への追記が必要になります。

---

## 7. 新しいチャットで最初にやるべきこと

1. この文書を読む（必要に応じてHANDOFF_5.md・HANDOFF_3.mdも）。
2. ユーザーに、4章の1〜4（環境変数設定・デプロイ・連携設定・実機テスト）が完了したか確認する。
3. 完了していれば、実際の動作結果（うまく差し引かれたか、エラーは出ていないか）を聞き、問題があれば調査・修正する。未完了なら、必要な作業を案内する。
4. 落ち着いたら5章の残課題、または仕様書・マニュアル作成に進む。
