ALTER TABLE cms_brands
  ADD COLUMN IF NOT EXISTS country_origin      text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hero_image_url      text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gallery_images      jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS seo_title_he        text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_title_en        text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description_he  text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description_en  text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS featured_products   jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS related_category_slugs jsonb    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cta_text_he         text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_text_en         text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_link            text        NOT NULL DEFAULT '#business';
