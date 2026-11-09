import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface VideoItem {
  type: 'youtube' | 'vimeo' | 'mp4';
  url: string;
  title: string;
}

export interface ProductFile {
  label: string;
  url: string;
  file_type: 'pdf' | 'sheet' | 'catalog' | 'cert' | 'other';
  filename: string;
}

export interface CmsProduct {
  id: string;
  slug: string;
  brand_slug: string;
  category_slug: string;
  name_he: string;
  name_en: string;
  weight: string;
  country_origin: string;
  featured: boolean;
  active: boolean;
  sort_order: number;
  main_image_url: string;
  gallery_images: string[];
  videos: VideoItem[];
  short_description_he: string;
  short_description_en: string;
  description_he: string;
  description_en: string;
  ingredients_he: string;
  ingredients_en: string;
  nutritional_he: string;
  nutritional_en: string;
  feeding_guide_he: string;
  feeding_guide_en: string;
  package_sizes: string[];
  suitable_for: string;
  life_stage: string;
  benefits: string[];
  files: ProductFile[];
  seo_title_he: string;
  seo_title_en: string;
  seo_description_he: string;
  seo_description_en: string;
  og_image_url: string;
  canonical_url: string;
  created_at?: string;
  updated_at?: string;
}

export function normalizeProduct(p: Record<string, unknown>): CmsProduct {
  return {
    ...(p as CmsProduct),
    gallery_images: Array.isArray(p.gallery_images) ? p.gallery_images as string[] : [],
    videos: Array.isArray(p.videos) ? p.videos as VideoItem[] : [],
    package_sizes: Array.isArray(p.package_sizes) ? p.package_sizes as string[] : [],
    benefits: Array.isArray(p.benefits) ? p.benefits as string[] : [],
    files: Array.isArray(p.files) ? p.files as ProductFile[] : [],
  };
}

export interface HeroBanner {
  id: string;
  title_he: string;
  title_en: string;
  subtitle_he: string;
  subtitle_en: string;
  image_url: string;
  sort_order: number;
  active: boolean;
}

export interface FeaturedProduct {
  name_en: string;
  name_he: string;
  desc_en: string;
  desc_he: string;
  image_url: string;
}

export interface CmsBrand {
  id: string;
  name: string;
  slug: string;
  tagline_he: string;
  tagline_en: string;
  description_he: string;
  description_en: string;
  logo_url: string | null;
  accent_color: string;
  featured: boolean;
  active: boolean;
  sort_order: number;
  features_he: string[];
  features_en: string[];
  // Brand page fields
  country_origin: string;
  hero_image_url: string;
  gallery_images: string[];
  seo_title_he: string;
  seo_title_en: string;
  seo_description_he: string;
  seo_description_en: string;
  featured_products: FeaturedProduct[];
  related_category_slugs: string[];
  cta_text_he: string;
  cta_text_en: string;
  cta_link: string;
}

export interface CmsCategory {
  id: string;
  slug: string;
  name_he: string;
  name_en: string;
  description_he: string;
  description_en: string;
  image_url: string;
  sku_count: number;
  sort_order: number;
  active: boolean;
  icon: string;
  color: string;
  seo_title_he: string;
  seo_title_en: string;
  seo_description_he: string;
  seo_description_en: string;
  brand_slugs: string[];
}

export interface CmsSection {
  id: string;
  slug: string;
  label_en: string;
  visible: boolean;
  sort_order: number;
}

export interface CmsMedia {
  id: string;
  filename: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  section: string | null;
  uploaded_at: string;
}

interface CmsContextValue {
  heroBanners: HeroBanner[];
  brands: CmsBrand[];
  categories: CmsCategory[];
  contact: Record<string, string>;
  sections: CmsSection[];
  settings: Record<string, string>;
  media: CmsMedia[];
  loading: boolean;
  refresh: () => void;
}

const CmsContext = createContext<CmsContextValue | null>(null);

export function CmsProvider({ children }: { children: React.ReactNode }) {
  const [heroBanners, setHeroBanners] = useState<HeroBanner[]>([]);
  const [brands, setBrands] = useState<CmsBrand[]>([]);
  const [categories, setCategories] = useState<CmsCategory[]>([]);
  const [contact, setContact] = useState<Record<string, string>>({});
  const [sections, setSections] = useState<CmsSection[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<CmsMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase.from('cms_hero_banners').select('*').order('sort_order'),
      supabase.from('cms_brands').select('*').order('sort_order'),
      supabase.from('cms_categories').select('*').order('sort_order'),
      supabase.from('cms_contact').select('*'),
      supabase.from('cms_sections').select('*').order('sort_order'),
      supabase.from('cms_settings').select('*'),
      supabase.from('cms_media').select('*').order('uploaded_at', { ascending: false }),
    ]).then(([banners, brandsRes, catsRes, contactRes, sectionsRes, settingsRes, mediaRes]) => {
      if (cancelled) return;

      if (banners.data) setHeroBanners(banners.data);

      if (brandsRes.data) {
        setBrands(brandsRes.data.map((b) => ({
          ...b,
          features_he: Array.isArray(b.features_he) ? b.features_he : [],
          features_en: Array.isArray(b.features_en) ? b.features_en : [],
          gallery_images: Array.isArray(b.gallery_images) ? b.gallery_images : [],
          featured_products: Array.isArray(b.featured_products) ? b.featured_products : [],
          related_category_slugs: Array.isArray(b.related_category_slugs) ? b.related_category_slugs : [],
          country_origin: b.country_origin ?? '',
          hero_image_url: b.hero_image_url ?? '',
          seo_title_he: b.seo_title_he ?? '',
          seo_title_en: b.seo_title_en ?? '',
          seo_description_he: b.seo_description_he ?? '',
          seo_description_en: b.seo_description_en ?? '',
          cta_text_he: b.cta_text_he ?? '',
          cta_text_en: b.cta_text_en ?? '',
          cta_link: b.cta_link ?? '#business',
        })));
      }

      if (catsRes.data) setCategories(catsRes.data.map((c) => ({
        ...c,
        icon: c.icon ?? '',
        color: c.color ?? '',
        seo_title_he: c.seo_title_he ?? '',
        seo_title_en: c.seo_title_en ?? '',
        seo_description_he: c.seo_description_he ?? '',
        seo_description_en: c.seo_description_en ?? '',
        brand_slugs: Array.isArray(c.brand_slugs) ? c.brand_slugs : [],
      })));
      if (sectionsRes.data) setSections(sectionsRes.data);
      if (mediaRes.data) setMedia(mediaRes.data);

      if (contactRes.data) {
        const map: Record<string, string> = {};
        contactRes.data.forEach((r: { field_key: string; value: string }) => { map[r.field_key] = r.value; });
        setContact(map);
      }

      if (settingsRes.data) {
        const map: Record<string, string> = {};
        settingsRes.data.forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
        setSettings(map);
      }

      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tick]);

  return (
    <CmsContext.Provider value={{ heroBanners, brands, categories, contact, sections, settings, media, loading, refresh }}>
      {children}
    </CmsContext.Provider>
  );
}

export function useCms(): CmsContextValue {
  const ctx = useContext(CmsContext);
  if (!ctx) throw new Error('useCms must be used inside CmsProvider');
  return ctx;
}
