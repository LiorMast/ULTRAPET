import { useEffect, useState } from 'react';
import { ArrowLeft, Globe, MapPin, ChevronRight, Mail, X, ZoomIn, Package } from 'lucide-react';
import { useCms, CmsBrand, FeaturedProduct, CmsProduct, normalizeProduct } from '../contexts/CmsContext';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import UltraPetLogo from './UltraPetLogo';
import Header from './Header';
import Footer from './Footer';

/* ─── Fallback brand data (mirrors Brands.tsx) ─────────────────── */
const FALLBACK_BRANDS: CmsBrand[] = [
  { id: '1', name: 'Ultra Pet', slug: 'ultra-pet', tagline_he: 'תזונה מקיפה פרימיום', tagline_en: 'Premium Complete Nutrition', description_he: 'המותג המוביל שלנו מספק תזונה מלאה ומאוזנת לכלבים וחתולים בכל שלבי החיים.', description_en: 'Our flagship brand delivering complete and balanced nutrition for dogs and cats at every life stage. Developed in partnership with leading European veterinary nutritionists.', logo_url: null, accent_color: '#BE1E24', featured: true, active: true, sort_order: 0, features_he: ['פורמולות יבשות ורטובות', 'לכל שלבי החיים', 'הפצה ארצית', 'אישור וטרינרי'], features_en: ['Complete dry & wet formulas', 'All life stages', 'Nationwide distribution', 'Vet-endorsed quality'], country_origin: 'Germany', hero_image_url: '', gallery_images: [], seo_title_he: '', seo_title_en: '', seo_description_he: '', seo_description_en: '', featured_products: [], related_category_slugs: [], cta_text_he: '', cta_text_en: '', cta_link: '#business' },
  { id: '2', name: 'Internutri', slug: 'internutri', tagline_he: 'פורמולות מבוססות מדע', tagline_en: 'Science-Based Formulas', description_he: 'פורמולות תזונה ברמה וטרינרית שפותחו בשיתוף עם מדעני תזונה אירופאים מובילים.', description_en: 'Veterinary-grade nutritional formulas developed in collaboration with leading European nutrition scientists. Precision-crafted for optimal health outcomes.', logo_url: null, accent_color: '#1C4E80', featured: false, active: true, sort_order: 1, features_he: [], features_en: [], country_origin: 'Netherlands', hero_image_url: '', gallery_images: [], seo_title_he: '', seo_title_en: '', seo_description_he: '', seo_description_en: '', featured_products: [], related_category_slugs: [], cta_text_he: '', cta_text_en: '', cta_link: '#business' },
  { id: '3', name: 'Greenheart Premiums', slug: 'greenheart', tagline_he: 'טבעי ואורגני', tagline_en: 'Natural & Organic', description_he: 'מתכונים טבעיים פרמיום מרכיבים ממקורות בר-קיימא מחוות אירופאיות מוסמכות.', description_en: 'Premium natural recipes crafted with sustainably sourced ingredients from certified organic European farms. Pure nutrition, nothing artificial.', logo_url: null, accent_color: '#2D6A4F', featured: false, active: true, sort_order: 2, features_he: [], features_en: [], country_origin: 'Austria', hero_image_url: '', gallery_images: [], seo_title_he: '', seo_title_en: '', seo_description_he: '', seo_description_en: '', featured_products: [], related_category_slugs: [], cta_text_he: '', cta_text_en: '', cta_link: '#business' },
  { id: '4', name: 'Paw', slug: 'paw', tagline_he: 'מצוינות יומיומית', tagline_en: 'Everyday Excellence', description_he: 'תזונה איכותית ונגישה העונה על הצרכים היומיומיים של כל חיית מחמד.', description_en: 'Accessible quality nutrition meeting the daily needs of every pet household, without compromise on ingredients or palatability.', logo_url: null, accent_color: '#C97D30', featured: false, active: true, sort_order: 3, features_he: [], features_en: [], country_origin: 'Poland', hero_image_url: '', gallery_images: [], seo_title_he: '', seo_title_en: '', seo_description_he: '', seo_description_en: '', featured_products: [], related_category_slugs: [], cta_text_he: '', cta_text_en: '', cta_link: '#business' },
  { id: '5', name: 'JR Farm', slug: 'jr-farm', tagline_he: 'מומחי בעלי חיים קטנים', tagline_en: 'Small Animal Specialists', description_he: 'המותג המוביל באירופה לארנבים, שרקנים, אוגרים, ציפורים וחיות מחמד קטנות.', description_en: "Europe's leading brand for rabbits, guinea pigs, hamsters, birds and small pets. Trusted by specialist retailers across the continent.", logo_url: null, accent_color: '#4A7C42', featured: false, active: true, sort_order: 4, features_he: [], features_en: [], country_origin: 'Germany', hero_image_url: '', gallery_images: [], seo_title_he: '', seo_title_en: '', seo_description_he: '', seo_description_en: '', featured_products: [], related_category_slugs: [], cta_text_he: '', cta_text_en: '', cta_link: '#business' },
  { id: '6', name: 'Ultra Clean', slug: 'ultra-clean', tagline_he: 'היגיינה פרימיום לחתולים', tagline_en: 'Premium Cat Hygiene', description_he: 'פתרונות חול מתקדמים עם טכנולוגיית בקרת ריחות עדיפה.', description_en: 'Advanced clumping and non-clumping litter solutions with superior odor-control technology. Designed for modern cat households.', logo_url: null, accent_color: '#4A4A6A', featured: false, active: true, sort_order: 5, features_he: [], features_en: [], country_origin: 'Israel', hero_image_url: '', gallery_images: [], seo_title_he: '', seo_title_en: '', seo_description_he: '', seo_description_en: '', featured_products: [], related_category_slugs: [], cta_text_he: '', cta_text_en: '', cta_link: '#business' },
];

/* ─── Brand logo display ────────────────────────────────────────── */
function BrandLogoDisplay({ brand, size = 80 }: { brand: CmsBrand; size?: number }) {
  if (brand.logo_url) {
    return <img src={brand.logo_url} alt={brand.name} className="object-contain" style={{ width: size, height: size }} />;
  }
  if (brand.slug === 'ultra-pet') {
    return <div style={{ width: size, height: size }}><UltraPetLogo variant="mark" className="w-full h-full" /></div>;
  }
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold text-3xl flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: brand.accent_color }}>
      {brand.name.charAt(0)}
    </div>
  );
}

/* ─── Lightbox ─────────────────────────────────────────────────── */
function Lightbox({ images, index, onClose }: { images: string[]; index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(index);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent((c) => (c + 1) % images.length);
      if (e.key === 'ArrowLeft') setCurrent((c) => (c - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-10" onClick={onClose}>
        <X size={28} />
      </button>
      {images.length > 1 && (
        <>
          <button className="absolute left-6 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors z-10 text-4xl font-thin"
            onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c - 1 + images.length) % images.length); }}>‹</button>
          <button className="absolute right-6 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors z-10 text-4xl font-thin"
            onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c + 1) % images.length); }}>›</button>
        </>
      )}
      <img src={images[current]} alt="" className="max-w-[90vw] max-h-[85vh] object-contain" onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white scale-125' : 'bg-white/40'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Product card ─────────────────────────────────────────────── */
function ProductCard({ product, lang, accentColor }: { product: FeaturedProduct; lang: string; accentColor: string }) {
  const name = lang === 'he' ? product.name_he : product.name_en;
  const desc = lang === 'he' ? product.desc_he : product.desc_en;
  return (
    <div className="group bg-white border border-neutral-100 hover:border-transparent hover:shadow-premium transition-all duration-400 overflow-hidden">
      {product.image_url ? (
        <div className="aspect-square overflow-hidden bg-neutral-50">
          <img src={product.image_url} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      ) : (
        <div className="aspect-square flex items-center justify-center" style={{ backgroundColor: `${accentColor}10` }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: accentColor }} />
          </div>
        </div>
      )}
      <div className="p-5">
        <div className="w-6 h-0.5 mb-3" style={{ backgroundColor: accentColor }} />
        <h4 className="font-heading font-bold text-brand-charcoal text-sm mb-2 leading-tight">{name}</h4>
        {desc && <p className="text-neutral-500 text-xs leading-relaxed line-clamp-3">{desc}</p>}
      </div>
    </div>
  );
}

/* ─── Main BrandPage ───────────────────────────────────────────── */
export default function BrandPage({ slug }: { slug: string }) {
  const { brands, categories } = useCms();
  const { lang, t, isRtl } = useLanguage();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [brandProducts, setBrandProducts] = useState<CmsProduct[]>([]);

  const allBrands = brands.length > 0 ? brands : FALLBACK_BRANDS;
  const brand = allBrands.find((b) => b.slug === slug) ?? null;

  // Update page title for SEO
  useEffect(() => {
    if (!brand) return;
    const title = lang === 'he'
      ? (brand.seo_title_he || `${brand.name} | UltraPet`)
      : (brand.seo_title_en || `${brand.name} | UltraPet`);
    document.title = title;
    return () => { document.title = 'UltraPet'; };
  }, [brand, lang]);

  // Fetch products for this brand
  useEffect(() => {
    if (!brand) return;
    supabase.from('cms_products')
      .select('*')
      .eq('brand_slug', brand.slug)
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setBrandProducts(data.map((p) => normalizeProduct(p as Record<string, unknown>)));
      });
  }, [brand?.slug]);

  if (!brand) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-serif-display text-4xl text-brand-charcoal font-bold">Brand not found</h1>
        <p className="text-neutral-500">The brand you're looking for doesn't exist or hasn't been published yet.</p>
        <a href="/#brands" className="btn-primary py-3 px-6 text-xs mt-2">Back to Brands</a>
      </div>
    );
  }

  const tagline    = lang === 'he' ? brand.tagline_he    : brand.tagline_en;
  const desc       = lang === 'he' ? brand.description_he : brand.description_en;
  const features   = (lang === 'he' ? brand.features_he  : brand.features_en) ?? [];
  const ctaText    = lang === 'he' ? (brand.cta_text_he || 'הפוך ללקוח עסקי') : (brand.cta_text_en || 'Become a Business Customer');
  const seoDesc    = lang === 'he' ? brand.seo_description_he : brand.seo_description_en;

  // Show categories assigned from Brands CMS (brand.related_category_slugs)
  // OR from Categories CMS (category.brand_slugs) — whichever is used
  const relatedCats = categories.filter(
    (c) => c.active && (
      brand.related_category_slugs.includes(c.slug) ||
      c.brand_slugs.includes(brand.slug)
    )
  );
  const hasGallery    = brand.gallery_images.length > 0;
  const hasProducts   = brand.featured_products.length > 0;
  const hasCategories = relatedCats.length > 0;

  const accentRgb = brand.accent_color;

  return (
    <div className="min-h-screen bg-white" dir={isRtl ? 'rtl' : 'ltr'}>
      <Header />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden" style={{ backgroundColor: brand.accent_color }}>
        {brand.hero_image_url && (
          <img
            src={brand.hero_image_url}
            alt={brand.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0"
          style={{ background: brand.hero_image_url
            ? `linear-gradient(to top, ${accentRgb}f0 0%, ${accentRgb}80 40%, ${accentRgb}20 100%)`
            : `linear-gradient(135deg, ${accentRgb} 0%, ${accentRgb}cc 100%)` }} />

        {/* Texture dots */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`, backgroundSize: '28px 28px' }} />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 lg:px-14 pb-16 pt-36">
          {/* Breadcrumb */}
          <a href="/#brands" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-xs font-heading font-semibold tracking-widest uppercase mb-10 transition-colors group">
            <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" />
            {lang === 'he' ? 'כל המותגים' : 'All Brands'}
          </a>

          <div className="flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-16">
            {/* Logo */}
            <div className="bg-white/15 backdrop-blur-sm p-6 flex-shrink-0 self-start lg:self-end">
              <BrandLogoDisplay brand={brand} size={96} />
            </div>

            {/* Identity */}
            <div className="flex-1">
              {brand.country_origin && (
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-1.5 mb-5">
                  <MapPin size={11} className="text-white/70" />
                  <span className="text-white/80 font-heading font-semibold text-2xs tracking-widest uppercase">{brand.country_origin}</span>
                </div>
              )}
              <h1 className="font-serif-display font-bold text-white text-5xl lg:text-7xl leading-none mb-3">{brand.name}</h1>
              <p className="text-white/70 font-heading font-semibold text-sm tracking-widest uppercase mb-4">{tagline}</p>
              {seoDesc && <p className="text-white/60 text-base leading-relaxed max-w-xl">{seoDesc}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* ── Brand Categories + Products ──────────────────────────── */}
      {hasCategories && (
        <section className="py-20 lg:py-28 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-8 lg:px-14">
            <div className="mb-14">
              <div className="eyebrow eyebrow-line mb-4" style={{ color: accentRgb, borderColor: accentRgb }}>
                {lang === 'he' ? 'קטגוריות מוצרים' : 'Brand Categories'}
              </div>
              <h2 className="section-heading text-3xl lg:text-4xl">
                {lang === 'he' ? `מוצרי ${brand.name}` : `${brand.name} Products`}
              </h2>
            </div>

            <div className="space-y-16">
              {relatedCats.map((cat) => {
                const catName  = lang === 'he' ? cat.name_he  : cat.name_en;
                const catDesc  = lang === 'he' ? cat.description_he : cat.description_en;
                const catColor = cat.color || accentRgb;
                const catProducts = brandProducts.filter((p) => p.category_slug === cat.slug);

                return (
                  <div key={cat.id}>
                    {/* Category header */}
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-neutral-200">
                      <div className="flex items-center gap-4">
                        {(cat.image_url || cat.icon) && (
                          <div className="w-12 h-12 overflow-hidden flex-shrink-0 bg-neutral-100 flex items-center justify-center"
                            style={{ borderLeft: `3px solid ${catColor}` }}>
                            {cat.image_url
                              ? <img src={cat.image_url} alt={catName} className="w-full h-full object-cover" />
                              : <span className="text-2xl">{cat.icon}</span>}
                          </div>
                        )}
                        <div>
                          <h3 className="font-serif-display font-bold text-brand-charcoal text-2xl leading-tight">{catName}</h3>
                          {catDesc && <p className="text-neutral-500 text-sm mt-0.5 line-clamp-1">{catDesc}</p>}
                        </div>
                      </div>
                      <a href={`/categories/${cat.slug}`}
                        className="hidden sm:inline-flex items-center gap-2 font-heading font-bold text-xs tracking-widest uppercase transition-all hover:gap-3"
                        style={{ color: catColor }}>
                        {lang === 'he' ? 'כל המוצרים' : 'View All'}
                        <ChevronRight size={12} />
                      </a>
                    </div>

                    {/* Product cards or placeholder */}
                    {catProducts.length > 0 ? (
                      <>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {catProducts.slice(0, 8).map((p) => {
                            const pName  = lang === 'he' ? p.name_he  : p.name_en;
                            const pShort = lang === 'he' ? p.short_description_he : p.short_description_en;
                            return (
                              <a key={p.id} href={`/brands/${brand.slug}/${cat.slug}/${p.slug}`}
                                className="group block bg-white border border-neutral-100 hover:border-transparent hover:shadow-md transition-all duration-300 overflow-hidden">
                                <div className="relative aspect-square bg-neutral-50 overflow-hidden">
                                  {p.main_image_url
                                    ? <img src={p.main_image_url} alt={pName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    : <div className="w-full h-full flex items-center justify-center"><Package size={32} className="text-neutral-200" /></div>}
                                  {p.featured && (
                                    <div className="absolute top-2 left-2 text-white text-2xs font-heading font-bold px-2 py-0.5 tracking-widest uppercase"
                                      style={{ backgroundColor: catColor }}>
                                      {lang === 'he' ? 'נבחר' : 'Featured'}
                                    </div>
                                  )}
                                </div>
                                <div className="p-4">
                                  <div className="w-4 h-0.5 mb-2" style={{ backgroundColor: catColor }} />
                                  <h4 className="font-heading font-bold text-brand-charcoal text-sm leading-tight line-clamp-2 mb-1">{pName}</h4>
                                  {p.weight && <p className="text-neutral-400 text-xs mb-1">{p.weight}</p>}
                                  {pShort && <p className="text-neutral-500 text-xs leading-relaxed line-clamp-2">{pShort}</p>}
                                </div>
                              </a>
                            );
                          })}
                        </div>
                        {catProducts.length > 8 && (
                          <div className="mt-5 text-center">
                            <a href={`/categories/${cat.slug}`}
                              className="inline-flex items-center gap-2 font-heading font-bold text-xs tracking-widest uppercase transition-all hover:gap-3"
                              style={{ color: catColor }}>
                              {lang === 'he' ? `עוד ${catProducts.length - 8} מוצרים` : `${catProducts.length - 8} more products`}
                              <ChevronRight size={12} />
                            </a>
                          </div>
                        )}
                      </>
                    ) : (
                      /* No products yet: show category card */
                      <div className="group bg-white border border-neutral-100 hover:border-transparent hover:shadow-md transition-all duration-300 overflow-hidden flex gap-0">
                        {cat.image_url && (
                          <div className="w-24 flex-shrink-0 overflow-hidden">
                            <img src={cat.image_url} alt={catName} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-5 flex-1 flex items-center justify-between">
                          <p className="text-neutral-500 text-sm">{catDesc || (lang === 'he' ? 'מוצרים בקרוב' : 'Products coming soon')}</p>
                          {cat.sku_count > 0 && (
                            <span className="text-xs font-heading font-bold px-3 py-1 flex-shrink-0"
                              style={{ backgroundColor: `${catColor}15`, color: catColor }}>
                              {cat.sku_count}+ SKUs
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Brand Story ────────────────────────────────────────── */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-8 lg:px-14">
          <div className="grid lg:grid-cols-[3fr_2fr] gap-16 lg:gap-24 items-start">
            <div>
              <div className="eyebrow eyebrow-line mb-5" style={{ color: accentRgb, borderColor: accentRgb }}>
                {lang === 'he' ? 'סיפור המותג' : 'Brand Story'}
              </div>
              <h2 className="section-heading text-4xl lg:text-5xl mb-8">{brand.name}</h2>
              <p className="text-neutral-600 text-lg leading-relaxed">{desc}</p>
            </div>

            {features.length > 0 && (
              <div>
                <h3 className="font-heading font-bold text-xs tracking-widest uppercase text-neutral-400 mb-6">
                  {lang === 'he' ? 'יתרונות מרכזיים' : 'Key Highlights'}
                </h3>
                <div className="space-y-3">
                  {features.map((f) => (
                    <div key={f} className="flex items-start gap-3 group">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 group-hover:scale-150 transition-transform"
                        style={{ backgroundColor: accentRgb }} />
                      <span className="text-neutral-700 text-sm leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>

                {brand.country_origin && (
                  <div className="mt-10 pt-8 border-t border-neutral-100">
                    <div className="text-neutral-400 text-2xs font-heading font-bold tracking-widest uppercase mb-2">
                      {lang === 'he' ? 'מדינת מקור' : 'Country of Origin'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe size={14} style={{ color: accentRgb }} />
                      <span className="font-heading font-semibold text-brand-charcoal">{brand.country_origin}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Featured Products ──────────────────────────────────── */}
      {hasProducts && (
        <section className="py-24 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-8 lg:px-14">
            <div className="mb-12">
              <div className="eyebrow eyebrow-line mb-4" style={{ color: accentRgb, borderColor: accentRgb }}>
                {lang === 'he' ? 'מוצרים נבחרים' : 'Featured Products'}
              </div>
              <h2 className="section-heading text-3xl lg:text-4xl">
                {lang === 'he' ? `מוצרים נבחרים של ${brand.name}` : `${brand.name} Product Range`}
              </h2>
            </div>
            <div className={`grid sm:grid-cols-2 gap-4 ${brand.featured_products.length >= 4 ? 'lg:grid-cols-4' : brand.featured_products.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
              {brand.featured_products.map((p, i) => (
                <ProductCard key={i} product={p} lang={lang} accentColor={accentRgb} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Gallery ────────────────────────────────────────────── */}
      {hasGallery && (
        <section className={`py-24 ${(!hasProducts && !hasCategories) ? 'bg-neutral-50' : 'bg-white'}`}>
          <div className="max-w-7xl mx-auto px-8 lg:px-14">
            <div className="mb-12">
              <div className="eyebrow eyebrow-line mb-4" style={{ color: accentRgb, borderColor: accentRgb }}>
                {lang === 'he' ? 'גלריה' : 'Gallery'}
              </div>
              <h2 className="section-heading text-3xl lg:text-4xl">
                {lang === 'he' ? `גלריית ${brand.name}` : `${brand.name} Gallery`}
              </h2>
            </div>
            <div className={`grid gap-3 ${brand.gallery_images.length === 1 ? 'grid-cols-1' : brand.gallery_images.length === 2 ? 'grid-cols-2' : brand.gallery_images.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
              {brand.gallery_images.map((url, i) => (
                <button key={i}
                  className={`group relative overflow-hidden bg-neutral-100 cursor-zoom-in ${brand.gallery_images.length >= 4 && i === 0 ? 'row-span-2 col-span-1 lg:col-span-2' : ''}`}
                  style={{ aspectRatio: (brand.gallery_images.length >= 4 && i === 0) ? '1 / 1' : '4 / 3' }}
                  onClick={() => setLightboxIdx(i)}
                >
                  <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                    <ZoomIn size={28} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA Section ────────────────────────────────────────── */}
      <section className="py-24 lg:py-32" style={{ backgroundColor: brand.accent_color }}>
        <div className="relative max-w-7xl mx-auto px-8 lg:px-14">
          {/* texture */}
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: `repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)`, backgroundSize: '20px 20px' }} />
          <div className="relative z-10 text-center max-w-2xl mx-auto">
            <div className="bg-white/15 backdrop-blur-sm inline-block p-5 mb-8">
              <BrandLogoDisplay brand={brand} size={56} />
            </div>
            <h2 className="font-serif-display font-bold text-white text-4xl lg:text-5xl mb-4 leading-tight">
              {lang === 'he' ? `מעוניינים ב${brand.name}?` : `Interested in ${brand.name}?`}
            </h2>
            <p className="text-white/70 text-lg mb-10">
              {lang === 'he'
                ? 'צרו קשר עם UltraPet לפרטים על הפצה, תמחור והזמנות'
                : 'Contact UltraPet for distribution details, pricing and orders'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={brand.cta_link || '/#business'}
                className="inline-flex items-center justify-center gap-2 bg-white font-heading font-bold text-xs tracking-widest uppercase px-8 py-4 transition-all hover:bg-neutral-100 group"
                style={{ color: accentRgb }}
              >
                {ctaText}
                <ChevronRight size={13} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="/#contact"
                onClick={(e) => { e.preventDefault(); window.location.href = '/#contact'; }}
                className="inline-flex items-center justify-center gap-2 border-2 border-white/40 hover:border-white text-white font-heading font-bold text-xs tracking-widest uppercase px-8 py-4 transition-all group"
              >
                <Mail size={13} />
                {lang === 'he' ? 'צור קשר' : 'Contact Us'}
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {lightboxIdx !== null && (
        <Lightbox images={brand.gallery_images} index={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </div>
  );
}
