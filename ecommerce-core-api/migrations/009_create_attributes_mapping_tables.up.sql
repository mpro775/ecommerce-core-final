CREATE TABLE IF NOT EXISTS category_attributes (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_attributes_store_category_attr_unique
  ON category_attributes (store_id, category_id, attribute_id);

CREATE INDEX IF NOT EXISTS idx_category_attributes_store_category
  ON category_attributes (store_id, category_id);

CREATE TABLE IF NOT EXISTS variant_attribute_values (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  attribute_value_id UUID NOT NULL REFERENCES attribute_values(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_attr_values_store_variant_attr_unique
  ON variant_attribute_values (store_id, variant_id, attribute_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_attr_values_store_variant_value_unique
  ON variant_attribute_values (store_id, variant_id, attribute_value_id);

CREATE INDEX IF NOT EXISTS idx_variant_attr_values_store_attr_value
  ON variant_attribute_values (store_id, attribute_id, attribute_value_id);

CREATE INDEX IF NOT EXISTS idx_variant_attr_values_store_variant
  ON variant_attribute_values (store_id, variant_id);
