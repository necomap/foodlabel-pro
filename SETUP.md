# FoodLabel Pro セットアップ・テストガイド

このガイドに従えば、ゼロからローカル環境で動作確認までできます。

---

## 前提条件の確認

```bash
# Node.js バージョン確認（18以上必要）
node --version   # → v18.x.x 以上

# npm確認
npm --version    # → 9.x.x 以上

# PostgreSQL確認
psql --version   # → psql (PostgreSQL) 15.x 以上

# Python確認（Excelインポート時のみ必要）
python3 --version  # → Python 3.10 以上
```

**Node.js が入っていない場合:**
- https://nodejs.org からLTS版をインストール

**PostgreSQL が入っていない場合:**
- Mac: `brew install postgresql@15`
- Ubuntu: `sudo apt install postgresql`
- Windows: https://www.postgresql.org/download/windows/

---

## 手順1: プロジェクト展開

```bash
# zipを展開
unzip foodlabel-pro.zip
cd foodlabel-pro

# ファイル一覧確認
ls -la
```

---

## 手順2: 依存パッケージインストール

```bash
npm install
```

エラーが出た場合:
```bash
# Node.jsのバージョンが古い場合
nvm install 20
nvm use 20
npm install
```

---

## 手順3: データベース作成

### PostgreSQLを起動
```bash
# Mac (Homebrew)
brew services start postgresql@15

# Ubuntu
sudo systemctl start postgresql

# 起動確認
psql -U postgres -c "SELECT version();"
```

### データベース作成
```bash
# データベースを作成
createdb -U postgres foodlabel_pro

# または psql で
psql -U postgres -c "CREATE DATABASE foodlabel_pro;"
```

### スキーマを適用
```bash
# schema.sql を一括実行（foodlabel-pro フォルダの親ディレクトリにある）
psql -U postgres -d foodlabel_pro -f ../schema.sql

# 成功すると末尾に以下が表示される:
# NOTICE:  ✅ FoodLabel Pro スキーマ作成完了！
```
★いまここ
---

## 手順4: 環境変数設定

```bash
# テンプレートをコピー
cp .env.example .env.local

# エディタで開く
nano .env.local
# または
code .env.local
```

### 最低限の設定（ローカル開発用）

```env
# データベース
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/foodlabel_pro"

# NextAuth（ランダム文字列を生成して設定）
NEXTAUTH_SECRET="開発用の適当な文字列でOK例えばdev-secret-key-12345"
NEXTAUTH_URL="http://localhost:3000"

# メール（開発中はコンソール出力でも可 → 後述）
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-gmail@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="FoodLabel Pro <your-gmail@gmail.com>"

# 管理者メールアドレス
ADMIN_EMAIL="admin@example.com"
```

### メール設定の省略方法（開発時）

開発中はメール送信をスキップしたい場合、`lib/email.ts` の関数を一時的に無効化できます:

```typescript
// lib/email.ts の sendVerificationEmail を開発用に変更
export async function sendVerificationEmail(email: string, token: string) {
  // 開発時はコンソールに出力するだけ
  console.log(`[開発用] メール認証URL: http://localhost:3000/api/auth/verify-email?token=${token}`);
  // 本番時は以下のコードを有効にする
  // await transporter.sendMail({ ... });
}
```

### PostgreSQL接続確認
```bash
# 接続テスト（DATABASE_URLを直接指定）
psql "postgresql://postgres:panokashi@localhost:5432/foodlabel_pro" -c "\dt"
# → テーブル一覧が表示されればOK
```

---

## 手順5: Prismaクライアント生成

```bash
# Prismaスキーマからクライアントを生成
npm run db:generate

# DBにPrismaスキーマを反映（開発用）
npm run db:push
```

---

## 手順6: 初期データ投入

```bash
# アレルゲンマスタ・カテゴリ・管理者アカウントを投入
npm run db:seed
```

出力例:
```
🌱 シードデータを投入中...
  ✓ アレルゲンマスタ 28件
  ✓ カテゴリ 15件
  ✓ 管理者アカウント作成: admin@example.com
    初期パスワード: Admin1234!
🎉 シード完了！
```

---

## 手順7: 開発サーバー起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開く。

```
✓ Ready in 3.2s
→ http://localhost:3000
```

---

## 手順8: 動作確認

### 8-1. アカウント登録テスト

1. http://localhost:3000/auth/register を開く
2. フォームに入力して「アカウントを作成する」
3. 開発用メール設定の場合はコンソールに認証URLが表示される
4. URLをブラウザで開いてメール認証を完了
5. ログインページへリダイレクト

### 8-2. ログインテスト

1. http://localhost:3000/auth/login
2. 登録したメアド・パスワードでログイン
3. レシピ一覧ページへ遷移すればOK

### 8-3. Excelインポートテスト

1. **WebUI経由（推奨）:**
   - 「インポート」メニュー → `_resipi.xlsm` をドラッグ&ドロップ
   - 「インポート実行」→ 完了メッセージ確認

2. **コマンドライン経由:**
   ```bash
   # Pythonパッケージをインストール
   pip3 install openpyxl psycopg2-binary
   
   # ユーザーIDを確認
   psql "postgresql://postgres:PASSWORD@localhost/foodlabel_pro" \
     -c "SELECT id, email FROM users;"
   
   # インポート実行
   python3 scripts/migration_from_excel.py \
     --file /path/to/_resipi.xlsm \
     --db "postgresql://postgres:PASSWORD@localhost/foodlabel_pro" \
     --user-id "YOUR_USER_UUID"
   ```

### 8-4. レシピ作成テスト

1. 「新規レシピ作成」をクリック
2. 品名「テストクッキー」を入力
3. 材料に「薄力粉」と入力 → 成分表から選択
4. 分量「100」「g」を入力
5. 「レシピを保存」→ 詳細ページへ遷移

### 8-5. シール印刷テスト

1. レシピ詳細ページで「シール印刷」をクリック
2. 製造日を設定
3. 「シールを生成」→ プレビュー確認
4. 「印刷する」→ ブラウザ印刷ダイアログ

---

## 栄養成分表のインポート（任意・推奨）

初期状態では成分表データが空です。以下の手順でインポートしてください。

### 方法A: 既存Excelから（_resipi.xlsm の「栄養成分表」シート）

```bash
python3 scripts/migration_from_excel.py \
  --file /path/to/_resipi.xlsm \
  --db "postgresql://postgres:PASSWORD@localhost/foodlabel_pro" \
  --user-id "YOUR_USER_UUID" \
  --nutrition-only  # 栄養成分表のみ
```

### 方法B: 文科省の最新データ（推奨）

1. https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html にアクセス
2. 「日本食品標準成分表2020年版（八訂）」のExcelファイルをダウンロード
3. インポート実行:

```bash
python3 scripts/import_nutrition.py \
  --file /path/to/食品成分表2020.xlsx \
  --db "postgresql://postgres:PASSWORD@localhost/foodlabel_pro"
```

---

## よくあるエラーと対処法

### `ECONNREFUSED 127.0.0.1:5432`
PostgreSQLが起動していない
```bash
brew services start postgresql@15  # Mac
sudo systemctl start postgresql     # Ubuntu
```

### `password authentication failed for user "postgres"`
PostgreSQLのパスワードが違う
```bash
# パスワードをリセット
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'newpassword';"
```

### `Module not found: Can't resolve '@prisma/client'`
Prismaクライアントが未生成
```bash
npm run db:generate
```

### `Table 'users' doesn't exist`
DBスキーマが未適用
```bash
psql -U postgres -d foodlabel_pro -f ../schema.sql
# または
npm run db:push
```

### メール送信エラー `EAUTH`
Gmailの場合、「アプリパスワード」が必要
1. Googleアカウント → セキュリティ → 2段階認証を有効化
2. アプリパスワードを生成
3. `.env.local` の `EMAIL_SERVER_PASSWORD` にアプリパスワードを設定

---

## 本番デプロイ（Vercel）

```bash
# Vercel CLIをインストール
npm install -g vercel

# ログイン
vercel login

# デプロイ
vercel

# 環境変数を設定
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET
# ... 他の環境変数も同様に設定
```

Vercel PostgresをDBとして使う場合:
1. Vercelダッシュボード → Storage → Connect Database
2. 「Postgres」を選択して作成
3. 自動的に `DATABASE_URL` が設定される

---

## 開発時の便利コマンド

```bash
# DBの内容をGUIで確認
npm run db:studio   # → http://localhost:5555

# 型チェック
npx tsc --noEmit

# Lint
npm run lint

# ビルドテスト
npm run build
```

---

## ファイル構成の補足

```
重要なファイル:
├── .env.local          ← 環境変数（絶対コミットしない）
├── schema.sql          ← DBスキーマ（psqlで一括実行）
├── prisma/schema.prisma ← Prisma ORMスキーマ
├── lib/
│   ├── allergen.ts     ← アレルゲン判定ロジック（編集しやすい）
│   ├── nutrition.ts    ← 栄養成分計算（編集しやすい）
│   └── label.ts        ← シールHTML生成（カスタマイズ可能）
└── app/
    └── dashboard/
        └── recipes/
            └── _form.tsx  ← レシピ入力フォーム（UIカスタマイズはここ）
```
