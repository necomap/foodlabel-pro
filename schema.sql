-- ============================================================
-- FoodLabel Pro - データベーススキーマ定義
-- PostgreSQL 15+
-- 実行方法: psql -U postgres -d foodlabel_pro -f schema.sql
-- ============================================================

-- UUID拡張の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 日本語あいまい検索用

-- ============================================================
-- ENUM型の定義
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_plan AS ENUM ('free', 'premium', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE shelf_life_type AS ENUM ('賞味', '消費');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE storage_type AS ENUM ('常温', '冷蔵', '冷凍', 'その他');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE unit_type AS ENUM ('g', 'ml', '個', '枚', '本', '袋', '缶', 'cc', 'kg', 'L');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE print_device_type AS ENUM ('label_printer', 'a4_printer', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 1. users テーブル（会員情報）
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255) NOT NULL UNIQUE,
  email_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash     TEXT NOT NULL,
  company_name      VARCHAR(200) NOT NULL,         -- 社名・店舗名（主）
  representative    VARCHAR(100),                   -- 代表者名
  postal_code       VARCHAR(8),                     -- 〒000-0000 形式
  address           TEXT,                           -- 住所
  phone             VARCHAR(20),                    -- 電話番号
  plan              user_plan NOT NULL DEFAULT 'free',
  stripe_customer_id VARCHAR(100),                 -- Stripe 顧客ID
  email_verify_token TEXT,                          -- メール認証トークン
  password_reset_token TEXT,                        -- パスワードリセットトークン
  password_reset_expires TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE users IS 'ユーザー（製造者・店舗オーナー）情報';
COMMENT ON COLUMN users.plan IS 'free=無料, premium=有料, admin=管理者';

-- ============================================================
-- 2. shops テーブル（複数店舗対応）
-- ============================================================
CREATE TABLE IF NOT EXISTS shops (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name          VARCHAR(200) NOT NULL,         -- シール印字用店舗名
  company_name       VARCHAR(200),                  -- 法人名（店舗名と異なる場合）
  postal_code        VARCHAR(8),
  address            TEXT,
  phone              VARCHAR(20),
  email              VARCHAR(255),
  -- 表示設定
  show_phone         BOOLEAN NOT NULL DEFAULT TRUE,
  show_representative BOOLEAN NOT NULL DEFAULT FALSE,
  show_email         BOOLEAN NOT NULL DEFAULT FALSE,
  -- デフォルト設定
  is_default         BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ
);

COMMENT ON TABLE shops IS '店舗情報（1ユーザーが複数店舗を持てる）';

-- ============================================================
-- 3. categories テーブル（カテゴリマスタ）
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE, -- NULLは共通カテゴリ
  name        VARCHAR(100) NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- 初期データ（共通カテゴリ）
INSERT INTO categories (id, user_id, name, sort_order) VALUES
  (uuid_generate_v4(), NULL, '洋生菓子', 10),
  (uuid_generate_v4(), NULL, '和菓子', 20),
  (uuid_generate_v4(), NULL, '焼菓子', 30),
  (uuid_generate_v4(), NULL, 'ハードパン', 40),
  (uuid_generate_v4(), NULL, '食事パン', 50),
  (uuid_generate_v4(), NULL, '総菜パン', 60),
  (uuid_generate_v4(), NULL, '菓子パン', 70),
  (uuid_generate_v4(), NULL, 'サンドイッチ', 80),
  (uuid_generate_v4(), NULL, '発酵菓子', 90),
  (uuid_generate_v4(), NULL, 'クッキー', 100),
  (uuid_generate_v4(), NULL, 'スコーン', 110),
  (uuid_generate_v4(), NULL, 'パウンドケーキ', 120),
  (uuid_generate_v4(), NULL, 'キッシュ', 130),
  (uuid_generate_v4(), NULL, 'チョコレート', 140)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. nutrition_data テーブル（日本食品標準成分表）
-- ============================================================
CREATE TABLE IF NOT EXISTS nutrition_data (
  id               INTEGER PRIMARY KEY,             -- 食品番号（成分表準拠）
  food_group       VARCHAR(10),                     -- 食品群コード
  food_name        TEXT NOT NULL,                   -- 食品名
  index_name       VARCHAR(200),                    -- 索引番号
  waste_ratio      DECIMAL(5,2) DEFAULT 0,          -- 廃棄率（%）
  energy_kcal      DECIMAL(8,1),                    -- エネルギー（kcal/100g）
  energy_kj        DECIMAL(8,1),                    -- エネルギー（kJ/100g）
  water            DECIMAL(6,2),                    -- 水分（g/100g）
  protein          DECIMAL(6,2),                    -- たんぱく質（g/100g）
  fat              DECIMAL(6,2),                    -- 脂質（g/100g）
  cholesterol      DECIMAL(6,2),                    -- コレステロール（mg/100g）
  carbohydrate     DECIMAL(6,2),                    -- 炭水化物（g/100g）
  dietary_fiber_soluble   DECIMAL(6,2),             -- 水溶性食物繊維（g/100g）
  dietary_fiber_insoluble DECIMAL(6,2),             -- 不溶性食物繊維（g/100g）
  dietary_fiber    DECIMAL(6,2),                    -- 食物繊維総量（g/100g）
  sugar            DECIMAL(6,2),                    -- 糖質（g/100g）
  ash              DECIMAL(6,2),                    -- 灰分（g/100g）
  sodium           DECIMAL(8,2),                    -- ナトリウム（mg/100g）
  salt_equivalent  DECIMAL(6,2),                    -- 食塩相当量（g/100g）
  potassium        DECIMAL(8,2),                    -- カリウム（mg/100g）
  calcium          DECIMAL(8,2),                    -- カルシウム（mg/100g）
  magnesium        DECIMAL(8,2),                    -- マグネシウム（mg/100g）
  alcohol          DECIMAL(6,2),                    -- アルコール（g/100g）
  notes            TEXT,                            -- 備考
  data_version     VARCHAR(20) DEFAULT '2020',      -- 成分表バージョン
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE nutrition_data IS '日本食品標準成分表データ（文科省公開データ）';

-- ============================================================
-- 5. ingredients テーブル（食材マスタ）
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredients (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL, -- NULLは公開共有マスタ
  name             VARCHAR(200) NOT NULL,           -- 食材名（全角統一）
  name_kana        VARCHAR(200),                    -- 読み仮名（ひらがな）
  name_search      TEXT,                            -- 検索用（全角・半角・カナ混在対応）
  -- 成分表との対応
  nutrition_id     INTEGER REFERENCES nutrition_data(id),
  nutrition_variant VARCHAR(100),                   -- 「生」「乾燥」「ゆで」等の選択値
  -- 原価情報（ユーザー別）
  purchase_unit_g  INTEGER,                         -- 仕入れ単位（g, ml）
  purchase_price   DECIMAL(10,2),                   -- 仕入れ価格（円）
  unit_price       DECIMAL(10,4),                   -- 1gあたり単価（自動計算）
  -- 保管・仕入れ
  storage          storage_type DEFAULT '常温',
  supplier         VARCHAR(100),                    -- 仕入先
  product_code     VARCHAR(100),                    -- 商品番号
  -- アレルゲン（手動オーバーライド用）
  allergens        TEXT[] DEFAULT '{}',             -- 例: ['小麦', '乳']
  -- 共有設定
  is_public        BOOLEAN NOT NULL DEFAULT FALSE,  -- コミュニティ共有
  is_approved      BOOLEAN NOT NULL DEFAULT FALSE,  -- 管理者承認済み
  -- 手動栄養入力（成分表にない場合）
  energy_kcal_manual   DECIMAL(8,1),
  protein_manual       DECIMAL(6,2),
  fat_manual           DECIMAL(6,2),
  carbohydrate_manual  DECIMAL(6,2),
  sodium_manual        DECIMAL(8,2),
  salt_equivalent_manual DECIMAL(6,2),
  dietary_fiber_manual DECIMAL(6,2),
  sugar_manual         DECIMAL(6,2),
  cholesterol_manual   DECIMAL(6,2),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ
);

COMMENT ON TABLE ingredients IS '食材マスタ（日本食品標準成分表 + ユーザー独自 + 共有）';
COMMENT ON COLUMN ingredients.user_id IS 'NULLは全ユーザー共有マスタ';

-- ============================================================
-- 6. recipes テーブル（レシピ本体）
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id       UUID REFERENCES categories(id),
  -- 基本情報
  name              VARCHAR(200) NOT NULL,           -- 品名（全角）
  name_kana         VARCHAR(200),                    -- 品名カナ
  unit_count        INTEGER NOT NULL DEFAULT 1,      -- 仕上げ数量
  waste_ratio       DECIMAL(5,2) DEFAULT 0,          -- 廃棄率（%）
  -- 原価・販売
  sale_price        INTEGER,                         -- 販売価格（円）
  -- 賞味期限設定
  shelf_life_days   INTEGER,                         -- 賞味/消費期限日数
  shelf_life_type   shelf_life_type DEFAULT '賞味',
  -- ラベル表示情報
  content_amount    VARCHAR(50),                     -- 内容量（例: 1個, 200g）
  storage_method    TEXT DEFAULT '直射日光・高温多湿を避けて保存してください。',
  notes             TEXT,                            -- 注意事項
  print_comment     TEXT,                            -- シール印字コメント
  quality_control   VARCHAR(100),                    -- 品質管理（脱酸素剤等）
  -- 焼成情報（DB管理上はJSON）
  baking_conditions JSONB,                           -- [{steam:ON, top:230, bottom:0, time:20}, ...]
  -- 計算済みキャッシュ（材料更新時に再計算）
  total_cost        DECIMAL(10,2),                   -- 材料合計原価
  unit_cost         DECIMAL(10,2),                   -- 1個原価
  cost_rate         DECIMAL(5,4),                    -- 原価率
  -- 栄養成分（仕上げ数量全体）
  total_weight_g    DECIMAL(10,2),                   -- 焼成前全体量（g）
  energy_kcal       DECIMAL(8,1),
  protein           DECIMAL(6,2),
  fat               DECIMAL(6,2),
  carbohydrate      DECIMAL(6,2),
  sodium            DECIMAL(8,2),
  salt_equivalent   DECIMAL(6,2),
  dietary_fiber     DECIMAL(6,2),
  sugar             DECIMAL(6,2),
  cholesterol       DECIMAL(6,2),
  -- 管理
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE recipes IS 'レシピ情報（材料・焼成・栄養・原価）';

-- ============================================================
-- 7. recipe_ingredients テーブル（材料明細）
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id               UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id           UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  -- 食材情報（ingredient_id がNULLの場合は手入力）
  ingredient_name_override VARCHAR(200),             -- 手入力食材名
  -- 使用量
  amount                  DECIMAL(10,3) NOT NULL,    -- 使用量
  unit                    VARCHAR(10) DEFAULT 'g',   -- 単位
  -- 表示設定
  display_order           INTEGER DEFAULT 0,         -- 手動表示順（0=重量順自動）
  sort_by_weight          BOOLEAN DEFAULT TRUE,      -- TRUEなら重量降順で自動ソート
  -- 原産国（一番多い材料に必須）
  origin_country          VARCHAR(100),              -- 例: 国産, 北海道産, アメリカ産
  is_primary_ingredient   BOOLEAN DEFAULT FALSE,     -- 最も重量の多い食材フラグ
  -- 原価
  cost_price              DECIMAL(10,4),             -- 1gあたり仕入れ単価（計算用）
  cost_total              DECIMAL(10,2),             -- この材料の合計原価
  -- アレルゲン（この食材に対する手動設定）
  allergen_override       TEXT[],                    -- 手動設定（NULLは食材マスタから自動）
  -- 栄養成分キャッシュ（この材料の使用量分）
  energy_kcal             DECIMAL(8,1),
  protein                 DECIMAL(6,2),
  fat                     DECIMAL(6,2),
  carbohydrate            DECIMAL(6,2),
  sodium                  DECIMAL(8,2),
  salt_equivalent         DECIMAL(6,2),
  dietary_fiber           DECIMAL(6,2),
  sugar                   DECIMAL(6,2),
  cholesterol             DECIMAL(6,2),
  -- 成分未確認フラグ
  nutrition_unconfirmed   BOOLEAN DEFAULT FALSE,     -- TRUEの場合シール生成時に警告
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE recipe_ingredients IS 'レシピの材料明細（正規化）';

-- ============================================================
-- 8. recipe_steps テーブル（作り方）
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_steps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id   UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE recipe_steps IS 'レシピの作り方（手順）';

-- ============================================================
-- 9. labels テーブル（シール印刷設定・履歴）
-- ============================================================
CREATE TABLE IF NOT EXISTS labels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id         UUID NOT NULL REFERENCES recipes(id),
  shop_id           UUID REFERENCES shops(id),
  user_id           UUID NOT NULL REFERENCES users(id),
  -- 製造日・期限
  manufacture_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date       DATE,                            -- 賞味/消費期限（自動計算または手動）
  -- 印刷設定
  print_count       INTEGER DEFAULT 1,               -- 印刷枚数
  font_size_pt      DECIMAL(4,1) DEFAULT 8,          -- フォントサイズ（pt）
  device_type       print_device_type DEFAULT 'label_printer',
  -- ラベルプリンタ設定
  label_width_mm    DECIMAL(6,1),                    -- シール幅（mm）
  label_height_mm   DECIMAL(6,1),                    -- シール高さ（mm）
  is_precut         BOOLEAN DEFAULT TRUE,            -- プレカット済みか
  cut_margin_mm     DECIMAL(4,1),                    -- カット隙間（mm）
  -- A4プリンタ設定
  a4_cols           INTEGER,                         -- 横のシール数
  a4_rows           INTEGER,                         -- 縦のシール数
  margin_top_mm     DECIMAL(4,1),                    -- 上余白
  margin_bottom_mm  DECIMAL(4,1),                    -- 下余白
  margin_left_mm    DECIMAL(4,1),                    -- 左余白
  margin_right_mm   DECIMAL(4,1),                    -- 右余白
  start_position    INTEGER DEFAULT 1,               -- 印刷開始位置（1始まり）
  -- 表示項目カスタム（JSON）
  display_settings  JSONB,                           -- {showPhone: true, showRepresentative: false, ...}
  -- 生成されたHTML/PDF
  generated_html    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE labels IS 'シール印刷設定・生成履歴';

-- ============================================================
-- 10. subscriptions テーブル（課金）
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id),
  stripe_subscription_id VARCHAR(100) UNIQUE,
  stripe_price_id     VARCHAR(100),
  plan                user_plan NOT NULL,
  status              VARCHAR(50),                   -- active, canceled, past_due
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ
);

-- ============================================================
-- 11. admin_logs テーブル（管理者操作ログ）
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,                 -- 操作種別
  target_type VARCHAR(50),                           -- 対象テーブル
  target_id   TEXT,                                  -- 対象ID
  details     JSONB,                                 -- 詳細情報
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. allergen_master テーブル（アレルゲンマスタ）
-- ============================================================
CREATE TABLE IF NOT EXISTS allergen_master (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(50) NOT NULL UNIQUE,       -- アレルゲン名
  category        VARCHAR(20) NOT NULL,              -- 'required8' or 'optional20'
  keywords        TEXT[],                            -- 食材名に含まれるキーワード（自動判定用）
  display_order   INTEGER DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- 初期データ（特定原材料8品目）
INSERT INTO allergen_master (name, category, keywords, display_order) VALUES
  ('えび', 'required8', ARRAY['えび', 'エビ', '海老', '蝦'], 10),
  ('かに', 'required8', ARRAY['かに', 'カニ', '蟹'], 20),
  ('小麦', 'required8', ARRAY['小麦', '強力粉', '薄力粉', '中力粉', '準強力粉', 'ライ麦', '全粒粉', 'ふすま'], 30),
  ('そば', 'required8', ARRAY['そば', 'ソバ', '蕎麦'], 40),
  ('卵', 'required8', ARRAY['卵', '全卵', '卵黄', '卵白', 'たまご', 'タマゴ', '乾燥卵白', 'メレンゲ'], 50),
  ('乳', 'required8', ARRAY['牛乳', '生クリーム', 'バター', 'チーズ', 'ヨーグルト', 'クリームチーズ', 'マスカルポーネ', 'ホワイトチョコ', '乳', 'バターミルク'], 60),
  ('落花生', 'required8', ARRAY['落花生', 'ピーナッツ', 'ピーナツ'], 70),
  ('くるみ', 'required8', ARRAY['くるみ', 'クルミ', '胡桃'], 80)
ON CONFLICT (name) DO NOTHING;

-- 特定原材料に準ずるもの20品目
INSERT INTO allergen_master (name, category, keywords, display_order) VALUES
  ('アーモンド', 'optional20', ARRAY['アーモンド'], 110),
  ('あわび', 'optional20', ARRAY['あわび', 'アワビ', '鮑'], 120),
  ('いか', 'optional20', ARRAY['いか', 'イカ', '烏賊'], 130),
  ('いくら', 'optional20', ARRAY['いくら', 'イクラ'], 140),
  ('オレンジ', 'optional20', ARRAY['オレンジ', 'オレンジピール', '柑橘'], 150),
  ('カシューナッツ', 'optional20', ARRAY['カシューナッツ'], 160),
  ('キウイフルーツ', 'optional20', ARRAY['キウイ', 'キウイフルーツ'], 170),
  ('牛肉', 'optional20', ARRAY['牛肉', 'ビーフ', '牛'], 180),
  ('ごま', 'optional20', ARRAY['ごま', 'ゴマ', '胡麻', 'セサミ'], 190),
  ('さけ', 'optional20', ARRAY['さけ', 'サケ', '鮭', 'サーモン'], 200),
  ('さば', 'optional20', ARRAY['さば', 'サバ', '鯖'], 210),
  ('大豆', 'optional20', ARRAY['大豆', '豆乳', '豆腐', '味噌', 'みそ', 'しょうゆ', '醤油', '枝豆', '酒粕'], 220),
  ('鶏肉', 'optional20', ARRAY['鶏肉', 'チキン', '鶏'], 230),
  ('バナナ', 'optional20', ARRAY['バナナ'], 240),
  ('豚肉', 'optional20', ARRAY['豚肉', 'ポーク', 'ベーコン', 'ハム', 'ウインナー', 'ソーセージ', '豚'], 250),
  ('まつたけ', 'optional20', ARRAY['まつたけ', 'マツタケ', '松茸'], 260),
  ('もも', 'optional20', ARRAY['もも', 'モモ', '桃', 'ピーチ'], 270),
  ('やまいも', 'optional20', ARRAY['やまいも', 'ヤマイモ', '山芋', '長芋'], 280),
  ('りんご', 'optional20', ARRAY['りんご', 'リンゴ', '林檎', 'アップル'], 290),
  ('ゼラチン', 'optional20', ARRAY['ゼラチン', 'コラーゲン'], 300)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- インデックス定義
-- ============================================================

-- users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- shops
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);

-- recipes
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category_id ON recipes(category_id);
CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_recipes_is_active ON recipes(is_active);

-- recipe_ingredients
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);

-- ingredients
CREATE INDEX IF NOT EXISTS idx_ingredients_user_id ON ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ingredients_is_public ON ingredients(is_public, is_approved);

-- nutrition_data
CREATE INDEX IF NOT EXISTS idx_nutrition_food_name ON nutrition_data USING gin(food_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_nutrition_food_group ON nutrition_data(food_group);

-- labels
CREATE INDEX IF NOT EXISTS idx_labels_recipe_id ON labels(recipe_id);
CREATE INDEX IF NOT EXISTS idx_labels_user_id ON labels(user_id);
CREATE INDEX IF NOT EXISTS idx_labels_manufacture_date ON labels(manufacture_date);

-- ============================================================
-- トリガー: updated_at 自動更新
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['users', 'shops', 'recipes', 'ingredients', 'subscriptions']
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at ON %I;
      CREATE TRIGGER trg_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- ビュー: レシピ一覧（栄養・アレルゲン付き）
-- ============================================================
CREATE OR REPLACE VIEW v_recipes_summary AS
SELECT
  r.id,
  r.user_id,
  r.name,
  r.name_kana,
  c.name AS category_name,
  r.unit_count,
  r.shelf_life_days,
  r.shelf_life_type,
  r.sale_price,
  r.unit_cost,
  r.cost_rate,
  r.energy_kcal,
  r.protein,
  r.fat,
  r.carbohydrate,
  r.salt_equivalent,
  r.is_active,
  r.created_at,
  r.updated_at,
  -- 材料のアレルゲンを集約
  (
    SELECT array_agg(DISTINCT a_val) 
    FROM recipe_ingredients ri
    CROSS JOIN LATERAL unnest(
      COALESCE(ri.allergen_override, 
               (SELECT i.allergens FROM ingredients i WHERE i.id = ri.ingredient_id),
               ARRAY[]::TEXT[])
    ) AS a_val
    WHERE ri.recipe_id = r.id
  ) AS allergens,
  -- 未確認成分フラグ
  EXISTS(
    SELECT 1 FROM recipe_ingredients ri 
    WHERE ri.recipe_id = r.id AND ri.nutrition_unconfirmed = TRUE
  ) AS has_unconfirmed_nutrition
FROM recipes r
LEFT JOIN categories c ON r.category_id = c.id;

COMMENT ON VIEW v_recipes_summary IS 'レシピ一覧ビュー（アレルゲン集約付き）';

-- ============================================================
-- ビュー: 材料の原材料表示順（重量降順）
-- ============================================================
CREATE OR REPLACE VIEW v_recipe_ingredients_ordered AS
SELECT
  ri.recipe_id,
  ri.ingredient_id,
  COALESCE(i.name, ri.ingredient_name_override) AS ingredient_name,
  ri.amount,
  ri.unit,
  ri.origin_country,
  ri.is_primary_ingredient,
  ri.nutrition_unconfirmed,
  COALESCE(ri.allergen_override, i.allergens, ARRAY[]::TEXT[]) AS allergens,
  -- 重量ベースのg換算（g, ml のみ）
  CASE WHEN ri.unit IN ('g', 'ml') THEN ri.amount ELSE NULL END AS amount_g,
  ROW_NUMBER() OVER (
    PARTITION BY ri.recipe_id 
    ORDER BY 
      CASE WHEN ri.sort_by_weight AND ri.unit IN ('g', 'ml') THEN ri.amount ELSE 0 END DESC,
      ri.display_order ASC,
      ri.created_at ASC
  ) AS sort_order
FROM recipe_ingredients ri
LEFT JOIN ingredients i ON ri.ingredient_id = i.id;

COMMENT ON VIEW v_recipe_ingredients_ordered IS '原材料表示順（重量降順）ビュー';

-- ============================================================
-- 完了メッセージ
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ FoodLabel Pro スキーマ作成完了！';
  RAISE NOTICE '   テーブル: users, shops, categories, nutrition_data, ingredients,';
  RAISE NOTICE '            recipes, recipe_ingredients, recipe_steps, labels,';
  RAISE NOTICE '            subscriptions, admin_logs, allergen_master';
  RAISE NOTICE '   ビュー: v_recipes_summary, v_recipe_ingredients_ordered';
  RAISE NOTICE '   初期データ: categories(14件), allergen_master(28件)';
END $$;
