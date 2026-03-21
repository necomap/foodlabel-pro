# FoodLabel Pro 🍞🧁

> **製菓・製パン店向け 食品成分表示ラベル管理システム**

レシピ管理から食品成分計算・シール印刷まで一括管理できるWebアプリケーションです。
食品表示法（食品表示基準）に準拠した成分表示ラベルを自動生成します。

---

## 主な機能

| 機能 | 内容 |
|---|---|
| 📝 レシピ管理 | 材料・手順・焼成条件の入力・編集 |
| 🏷️ シール生成 | 重量順原材料・アレルゲン自動判定・栄養成分自動計算 |
| 🖨️ 印刷対応 | ラベルプリンタ・A4プリンタ・複数サイズ |
| 📊 食材マスタ | 日本食品標準成分表連携・共有マスタ |
| 💰 原価計算 | 材料原価・原価率・推奨販売価格 |
| 🏪 多店舗対応 | 1ユーザーで複数店舗のラベルを管理 |
| 📥 Excel移行 | 既存の _resipi.xlsm からデータを一括インポート |
| 📤 エクスポート | レシピデータをExcel形式でバックアップ |

---

## セットアップ

### 1. 必要なもの

- Node.js 18+ / npm
- PostgreSQL 15+
- Python 3.10+（Excelデータ移行のみ）

### 2. リポジトリのクローン

```bash
git clone https://github.com/your-org/foodlabel-pro.git
cd foodlabel-pro
```

### 3. 依存パッケージのインストール

```bash
npm install
```

### 4. 環境変数の設定

```bash
cp .env.example .env.local
# .env.local を編集して各種設定を入力
```

**最低限必要な設定:**

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/foodlabel_pro"
NEXTAUTH_SECRET="（openssl rand -base64 32 で生成）"
NEXTAUTH_URL="http://localhost:3000"
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="FoodLabel Pro <your-email@gmail.com>"
```

### 5. データベースの作成

```bash
# PostgreSQL でDBを作成
createdb foodlabel_pro

# スキーマを適用（schema.sql）
psql -U postgres -d foodlabel_pro -f schema.sql

# または Prisma を使用
npm run db:generate
npm run db:push
```

### 6. 開発サーバーの起動

```bash
npm run dev
# → http://localhost:3000 で起動
```

---

## 既存 Excel ファイルからの移行

現在 `_resipi.xlsm` で管理している場合は、以下の手順で一括インポートできます。

### 方法A: Webアプリからインポート（推奨）

1. アプリにログイン
2. **インポート** メニューを選択
3. `_resipi.xlsm` をドラッグ&ドロップ
4. 「インポート実行」をクリック

### 方法B: コマンドラインスクリプト（大量データ・初期移行向け）

```bash
# 必要なPythonパッケージをインストール
pip install openpyxl psycopg2-binary

# 移行スクリプトを実行
python3 scripts/migration_from_excel.py \
    --file /path/to/_resipi.xlsm \
    --db  "postgresql://user:pass@localhost/foodlabel_pro" \
    --user-id "YOUR_USER_UUID"

# オプション:
#   --overwrite       既存レシピを上書き
#   --nutrition-only  栄養成分表のみインポート
#   --skip-nutrition  栄養成分表をスキップ
#   --log errors.csv  エラーログの出力先
```

**ユーザーUUIDの確認:**

```sql
-- 登録後に確認
SELECT id, email, company_name FROM users;
```

### 移行後の確認事項

1. **食材マスタの成分情報を確認**  
   未確認食材（⚠️マーク）は `食材マスタ` 画面で成分を設定してください

2. **アレルゲン情報の確認**  
   自動判定されたアレルゲンに誤りがないか確認してください

3. **シール印刷テスト**  
   実際にシールを生成して内容を確認してください

---

## エクスポート

レシピデータをExcel形式でダウンロードできます。

**Webアプリから:**
1. `エクスポート` メニューを選択
2. 出力する項目を選択（栄養成分・手順・原価）
3. 「Excelファイルをダウンロード」をクリック

出力形式は `_resipi.xlsm` と互換性があり、再インポートも可能です。

---

## 印刷設定

### ラベルプリンタ（SATO・ブラザー・ダイモ等）

| 項目 | 推奨値 |
|---|---|
| シール幅 | 60mm |
| シール高さ | 60mm（内容により自動調整） |
| フォントサイズ | 8pt（規定値）/ 6pt（小型商品） |

### A4プリンタ（レーザー・インクジェット）

| 項目 | 例 |
|---|---|
| 縦×横 | 3列 × 5行 = 15枚/ページ |
| 余白 | 上下左右 10mm |
| 開始位置 | 使用済みシートの続きから印刷可能 |

---

## ディレクトリ構成

```
foodlabel-pro/
├── app/
│   ├── auth/           # 認証ページ（ログイン・登録）
│   ├── dashboard/      # メイン画面（要ログイン）
│   │   ├── recipes/    # レシピ管理
│   │   ├── labels/     # シール印刷
│   │   ├── ingredients/ # 食材マスタ
│   │   ├── import/     # インポート
│   │   ├── settings/   # 設定
│   │   └── layout.tsx  # サイドバー付きレイアウト
│   ├── api/            # APIルート（Next.js Route Handlers）
│   └── admin/          # 管理者画面
├── components/         # 共通UIコンポーネント
├── lib/                # ユーティリティ・ロジック
│   ├── db.ts           # Prismaクライアント
│   ├── auth.ts         # NextAuth.js設定
│   ├── nutrition.ts    # 栄養成分計算
│   ├── allergen.ts     # アレルゲン判定
│   ├── label.ts        # シール生成
│   └── excel-import-export.ts  # Excel入出力
├── prisma/
│   └── schema.prisma   # DBスキーマ
├── scripts/
│   └── migration_from_excel.py  # 移行スクリプト
├── types/
│   └── index.ts        # 共通型定義
├── schema.sql          # SQLスキーマ（一括実行用）
├── .env.example        # 環境変数テンプレート
└── README.md
```

---

## 技術スタック

| 技術 | 用途 |
|---|---|
| Next.js 14 (App Router) | フレームワーク |
| TypeScript | 型安全な開発 |
| PostgreSQL | データベース |
| Prisma | ORM（型安全なDBアクセス） |
| NextAuth.js v5 | 認証（JWT + メール認証） |
| Tailwind CSS | スタイリング |
| React Hook Form + Zod | フォームバリデーション |
| Stripe | 課金（プレミアム機能） |
| xlsx | Excel入出力 |

---

## 食品表示法対応

本システムは以下の法令に準拠して設計されています：

- **食品表示法**（2015年施行）
- **食品表示基準**（内閣府令）
- **アレルゲン表示**：特定原材料8品目（義務）・特定原材料に準ずるもの20品目（推奨）

> ⚠️ 法改正には定期的な確認が必要です。管理者画面から最新情報を確認してください。

---

## ライセンス

MIT License

---

## サポート・お問い合わせ

バグ報告・機能要望は GitHub Issues へお気軽にどうぞ。
