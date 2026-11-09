ALTER TABLE cms_categories
  ADD COLUMN IF NOT EXISTS icon             text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS color            text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_title_he     text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_title_en     text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description_he text  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description_en text  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_slugs      jsonb   NOT NULL DEFAULT '[]';
