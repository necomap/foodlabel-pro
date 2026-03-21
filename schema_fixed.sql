
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


DO $$ BEGIN
  CREATE TYPE user_plan AS ENUM ('free', 'premium', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE shelf_life_type AS ENUM ('BEST_BEFORE', 'USE_BY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE storage_type AS ENUM ('ROOM_TEMP', 'FRIDGE', 'FROZEN', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE unit_type AS ENUM ('g', 'ml', 'ko', 'mai', 'hon', 'fukuro', 'kan', 'cc', 'kg', 'L');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE print_device_type AS ENUM ('label_printer', 'a4_printer', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255) NOT NULL UNIQUE,
  email_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash     TEXT NOT NULL,
  company_name      VARCHAR(200) NOT NULL,        
  representative    VARCHAR(100),                  
  postal_code       VARCHAR(8),                    
  address           TEXT,                          
  phone             VARCHAR(20),                   
  plan              user_plan NOT NULL DEFAULT 'free',
  stripe_customer_id VARCHAR(100),                
  email_verify_token TEXT,                         
  password_reset_token TEXT,                       
  password_reset_expires TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS shops (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name          VARCHAR(200) NOT NULL,        
  company_name       VARCHAR(200),                 
  postal_code        VARCHAR(8),
  address            TEXT,
  phone              VARCHAR(20),
  email              VARCHAR(255),
  show_phone         BOOLEAN NOT NULL DEFAULT TRUE,
  show_representative BOOLEAN NOT NULL DEFAULT FALSE,
  show_email         BOOLEAN NOT NULL DEFAULT FALSE,
  is_default         BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS nutrition_data (
  id               INTEGER PRIMARY KEY,            
  food_group       VARCHAR(10),                    
  food_name        TEXT NOT NULL,                  
  index_name       VARCHAR(200),                   
  waste_ratio      DECIMAL(5,2) DEFAULT 0,         
  energy_kcal      DECIMAL(8,1),                   
  energy_kj        DECIMAL(8,1),                   
  water            DECIMAL(6,2),                   
  protein          DECIMAL(6,2),                   
  fat              DECIMAL(6,2),                   
  cholesterol      DECIMAL(6,2),                   
  carbohydrate     DECIMAL(6,2),                   
  dietary_fiber_soluble   DECIMAL(6,2),            
  dietary_fiber_insoluble DECIMAL(6,2),            
  dietary_fiber    DECIMAL(6,2),                   
  sugar            DECIMAL(6,2),                   
  ash              DECIMAL(6,2),                   
  sodium           DECIMAL(8,2),                   
  salt_equivalent  DECIMAL(6,2),                   
  potassium        DECIMAL(8,2),                   
  calcium          DECIMAL(8,2),                   
  magnesium        DECIMAL(8,2),                   
  alcohol          DECIMAL(6,2),                   
  notes            TEXT,                           
  data_version     VARCHAR(20) DEFAULT '2020',     
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS ingredients (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  name             VARCHAR(200) NOT NULL,          
  name_kana        VARCHAR(200),                   
  name_search      TEXT,                           
  nutrition_id     INTEGER REFERENCES nutrition_data(id),
  nutrition_variant VARCHAR(100),                  
  purchase_unit_g  INTEGER,                        
  purchase_price   DECIMAL(10,2),                  
  unit_price       DECIMAL(10,4),                  
  storage          storage_type DEFAULT 'ROOM_TEMP',
  supplier         VARCHAR(100),                   
  product_code     VARCHAR(100),                   
  allergens        TEXT[] DEFAULT '{}',            
  is_public        BOOLEAN NOT NULL DEFAULT FALSE, 
  is_approved      BOOLEAN NOT NULL DEFAULT FALSE, 
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


CREATE TABLE IF NOT EXISTS recipes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id       UUID REFERENCES categories(id),
  name              VARCHAR(200) NOT NULL,          
  name_kana         VARCHAR(200),                   
  unit_count        INTEGER NOT NULL DEFAULT 1,     
  waste_ratio       DECIMAL(5,2) DEFAULT 0,         
  sale_price        INTEGER,                        
  shelf_life_days   INTEGER,                        
  shelf_life_type   shelf_life_type DEFAULT 'BEST_BEFORE',
  content_amount    VARCHAR(50),                    
  storage_method    TEXT DEFAULT 'Keep away from direct sunlight and humidity.',
  notes             TEXT,                           
  print_comment     TEXT,                           
  quality_control   VARCHAR(100),                   
  baking_conditions JSONB,                          
  total_cost        DECIMAL(10,2),                  
  unit_cost         DECIMAL(10,2),                  
  cost_rate         DECIMAL(5,4),                   
  total_weight_g    DECIMAL(10,2),                  
  energy_kcal       DECIMAL(8,1),
  protein           DECIMAL(6,2),
  fat               DECIMAL(6,2),
  carbohydrate      DECIMAL(6,2),
  sodium            DECIMAL(8,2),
  salt_equivalent   DECIMAL(6,2),
  dietary_fiber     DECIMAL(6,2),
  sugar             DECIMAL(6,2),
  cholesterol       DECIMAL(6,2),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id               UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id           UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  ingredient_name_override VARCHAR(200),            
  amount                  DECIMAL(10,3) NOT NULL,   
  unit                    VARCHAR(10) DEFAULT 'g',  
  display_order           INTEGER DEFAULT 0,        
  sort_by_weight          BOOLEAN DEFAULT TRUE,     
  origin_country          VARCHAR(100),             
  is_primary_ingredient   BOOLEAN DEFAULT FALSE,    
  cost_price              DECIMAL(10,4),            
  cost_total              DECIMAL(10,2),            
  allergen_override       TEXT[],                   
  energy_kcal             DECIMAL(8,1),
  protein                 DECIMAL(6,2),
  fat                     DECIMAL(6,2),
  carbohydrate            DECIMAL(6,2),
  sodium                  DECIMAL(8,2),
  salt_equivalent         DECIMAL(6,2),
  dietary_fiber           DECIMAL(6,2),
  sugar                   DECIMAL(6,2),
  cholesterol             DECIMAL(6,2),
  nutrition_unconfirmed   BOOLEAN DEFAULT FALSE,    
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS recipe_steps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id   UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS labels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id         UUID NOT NULL REFERENCES recipes(id),
  shop_id           UUID REFERENCES shops(id),
  user_id           UUID NOT NULL REFERENCES users(id),
  manufacture_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date       DATE,                           
  print_count       INTEGER DEFAULT 1,              
  font_size_pt      DECIMAL(4,1) DEFAULT 8,         
  device_type       print_device_type DEFAULT 'label_printer',
  label_width_mm    DECIMAL(6,1),                   
  label_height_mm   DECIMAL(6,1),                   
  is_precut         BOOLEAN DEFAULT TRUE,           
  cut_margin_mm     DECIMAL(4,1),                   
  a4_cols           INTEGER,                        
  a4_rows           INTEGER,                        
  margin_top_mm     DECIMAL(4,1),                   
  margin_bottom_mm  DECIMAL(4,1),                   
  margin_left_mm    DECIMAL(4,1),                   
  margin_right_mm   DECIMAL(4,1),                   
  start_position    INTEGER DEFAULT 1,              
  display_settings  JSONB,                          
  generated_html    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id),
  stripe_subscription_id VARCHAR(100) UNIQUE,
  stripe_price_id     VARCHAR(100),
  plan                user_plan NOT NULL,
  status              VARCHAR(50),                  
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,                
  target_type VARCHAR(50),                          
  target_id   TEXT,                                 
  details     JSONB,                                
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS allergen_master (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(50) NOT NULL UNIQUE,      
  category        VARCHAR(20) NOT NULL,             
  keywords        TEXT[],                           
  display_order   INTEGER DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);

CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category_id ON recipes(category_id);
CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_recipes_is_active ON recipes(is_active);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_ingredients_user_id ON ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ingredients_is_public ON ingredients(is_public, is_approved);

CREATE INDEX IF NOT EXISTS idx_nutrition_food_name ON nutrition_data USING gin(food_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_nutrition_food_group ON nutrition_data(food_group);

CREATE INDEX IF NOT EXISTS idx_labels_recipe_id ON labels(recipe_id);
CREATE INDEX IF NOT EXISTS idx_labels_user_id ON labels(user_id);
CREATE INDEX IF NOT EXISTS idx_labels_manufacture_date ON labels(manufacture_date);

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
  EXISTS(
    SELECT 1 FROM recipe_ingredients ri 
    WHERE ri.recipe_id = r.id AND ri.nutrition_unconfirmed = TRUE
  ) AS has_unconfirmed_nutrition
FROM recipes r
LEFT JOIN categories c ON r.category_id = c.id;


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



-- ============================================================
-- Initial data (ASCII-safe values only)
-- Full data is loaded by: npm run db:seed
-- ============================================================

INSERT INTO categories (id, user_id, name, sort_order) VALUES
  (gen_random_uuid(), NULL, 'Western pastry', 10),
  (gen_random_uuid(), NULL, 'Japanese confectionery', 20),
  (gen_random_uuid(), NULL, 'Baked goods', 30),
  (gen_random_uuid(), NULL, 'Cookie', 35),
  (gen_random_uuid(), NULL, 'Scone', 38),
  (gen_random_uuid(), NULL, 'Pound cake', 40),
  (gen_random_uuid(), NULL, 'Hard bread', 50),
  (gen_random_uuid(), NULL, 'Table bread', 60),
  (gen_random_uuid(), NULL, 'Deli bread', 70),
  (gen_random_uuid(), NULL, 'Sweet bread', 80),
  (gen_random_uuid(), NULL, 'Roll bread', 85),
  (gen_random_uuid(), NULL, 'Sandwich', 90),
  (gen_random_uuid(), NULL, 'Fermented pastry', 95),
  (gen_random_uuid(), NULL, 'Quiche', 100),
  (gen_random_uuid(), NULL, 'Chocolate', 110)
ON CONFLICT DO NOTHING;

DO $$ BEGIN RAISE NOTICE 'FoodLabel Pro schema created. Run npm run db:seed to load initial data.'; END $$;
