CREATE TABLE IF NOT EXISTS cms_products (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug                 TEXT        NOT NULL DEFAULT '',
  brand_slug           TEXT        NOT NULL DEFAULT '',
  category_slug        TEXT        NOT NULL DEFAULT '',
  name_he              TEXT        NOT NULL DEFAULT '',
  name_en              TEXT        NOT NULL DEFAULT '',
  weight               TEXT        NOT NULL DEFAULT '',
  country_origin       TEXT        NOT NULL DEFAULT '',
  featured             BOOLEAN     NOT NULL DEFAULT false,
  active               BOOLEAN     NOT NULL DEFAULT true,
  sort_order           INTEGER     NOT NULL DEFAULT 0,
  main_image_url       TEXT        NOT NULL DEFAULT '',
  gallery_images       JSONB       NOT NULL DEFAULT '[]',
  videos               JSONB       NOT NULL DEFAULT '[]',
  short_description_he TEXT        NOT NULL DEFAULT '',
  short_description_en TEXT        NOT NULL DEFAULT '',
  description_he       TEXT        NOT NULL DEFAULT '',
  description_en       TEXT        NOT NULL DEFAULT '',
  ingredients_he       TEXT        NOT NULL DEFAULT '',
  ingredients_en       TEXT        NOT NULL DEFAULT '',
  nutritional_he       TEXT        NOT NULL DEFAULT '',
  nutritional_en       TEXT        NOT NULL DEFAULT '',
  feeding_guide_he     TEXT        NOT NULL DEFAULT '',
  feeding_guide_en     TEXT        NOT NULL DEFAULT '',
  package_sizes        JSONB       NOT NULL DEFAULT '[]',
  suitable_for         TEXT        NOT NULL DEFAULT '',
  life_stage           TEXT        NOT NULL DEFAULT '',
  benefits             JSONB       NOT NULL DEFAULT '[]',
  files                JSONB       NOT NULL DEFAULT '[]',
  seo_title_he         TEXT        NOT NULL DEFAULT '',
  seo_title_en         TEXT        NOT NULL DEFAULT '',
  seo_description_he   TEXT        NOT NULL DEFAULT '',
  seo_description_en   TEXT        NOT NULL DEFAULT '',
  og_image_url         TEXT        NOT NULL DEFAULT '',
  canonical_url        TEXT        NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cms_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_products"  ON cms_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_insert_products" ON cms_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_update_products" ON cms_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_delete_products" ON cms_products FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_cms_products_brand    ON cms_products(brand_slug);
CREATE INDEX IF NOT EXISTS idx_cms_products_category ON cms_products(category_slug);
CREATE INDEX IF NOT EXISTS idx_cms_products_active   ON cms_products(active);
CREATE INDEX IF NOT EXISTS idx_cms_products_sort     ON cms_products(sort_order);
