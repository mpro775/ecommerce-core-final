ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS stock_unlimited BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weight_unit TEXT,
  ADD COLUMN IF NOT EXISTS product_label TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS short_description_ar TEXT,
  ADD COLUMN IF NOT EXISTS short_description_en TEXT,
  ADD COLUMN IF NOT EXISTS detailed_description_ar TEXT,
  ADD COLUMN IF NOT EXISTS detailed_description_en TEXT,
  ADD COLUMN IF NOT EXISTS seo_title_ar TEXT,
  ADD COLUMN IF NOT EXISTS seo_title_en TEXT,
  ADD COLUMN IF NOT EXISTS seo_description_ar TEXT,
  ADD COLUMN IF NOT EXISTS seo_description_en TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS inline_discount_type TEXT,
  ADD COLUMN IF NOT EXISTS inline_discount_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS inline_discount_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inline_discount_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inline_discount_active BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS digital_download_attempts_limit INTEGER,
  ADD COLUMN IF NOT EXISTS digital_download_expires_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_product_type_valid'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT chk_products_product_type_valid
      CHECK (product_type IN ('single', 'bundled', 'digital'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_inline_discount_type_valid'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT chk_products_inline_discount_type_valid
      CHECK (
        inline_discount_type IS NULL
        OR inline_discount_type IN ('percent', 'fixed')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_inline_discount_value_non_negative'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT chk_products_inline_discount_value_non_negative
      CHECK (inline_discount_value IS NULL OR inline_discount_value >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_download_attempts_non_negative'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT chk_products_download_attempts_non_negative
      CHECK (digital_download_attempts_limit IS NULL OR digital_download_attempts_limit > 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_products_store_type
  ON products (store_id, product_type);

CREATE INDEX IF NOT EXISTS idx_products_store_visible
  ON products (store_id, is_visible);

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_unique
  ON product_categories (product_id, category_id);

CREATE INDEX IF NOT EXISTS idx_product_categories_store_product
  ON product_categories (store_id, product_id);

INSERT INTO product_categories (id, store_id, product_id, category_id)
SELECT (
  substring(md5(random()::text || clock_timestamp()::text), 1, 8) || '-' ||
  substring(md5(random()::text || clock_timestamp()::text), 9, 4) || '-' ||
  substring(md5(random()::text || clock_timestamp()::text), 13, 4) || '-' ||
  substring(md5(random()::text || clock_timestamp()::text), 17, 4) || '-' ||
  substring(md5(random()::text || clock_timestamp()::text), 21, 12)
)::uuid,
  p.store_id,
  p.id,
  p.category_id
FROM products p
WHERE p.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM product_categories pc
    WHERE pc.product_id = p.id
      AND pc.category_id = p.category_id
  );

CREATE TABLE IF NOT EXISTS product_related_products (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_related_unique
  ON product_related_products (product_id, related_product_id);

CREATE INDEX IF NOT EXISTS idx_product_related_store_product
  ON product_related_products (store_id, product_id);

CREATE TABLE IF NOT EXISTS product_bundle_items (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  bundle_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bundled_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bundled_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_bundle_items_store_bundle
  ON product_bundle_items (store_id, bundle_product_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_product_bundle_items_quantity_positive'
  ) THEN
    ALTER TABLE product_bundle_items
      ADD CONSTRAINT chk_product_bundle_items_quantity_positive
      CHECK (quantity > 0);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS product_digital_files (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  file_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_digital_files_unique
  ON product_digital_files (product_id, media_asset_id);

CREATE INDEX IF NOT EXISTS idx_product_digital_files_store_product
  ON product_digital_files (store_id, product_id, sort_order);
