import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, X, Download, Play, MapPin, CheckCircle2, Package, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CmsProduct, CmsCategory, CmsBrand, normalizeProduct } from '../contexts/CmsContext';
import { useCms } from '../contexts/CmsContext';
import { useLanguage } from '../contexts/LanguageContext';
import Header from './Header';
import Footer from './Footer';

/* ─── Helpers ──────────────────────────────────────────────────── */
function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return m ? m[1] : null;
}
function getVimeoId(url: string) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

/* ─── Image Gallery ────────────────────────────────────────────── */
function Gallery({ images, productName }: { images: string[]; productName: string }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const touchStart = useRef(0);

  const all = images.filter(Boolean);
  if (all.length === 0) return null;

  const prev = () => setActive((c) => (c - 1 + all.length) % all.length);
  const next = () => setActive((c) => (c + 1) % all.length);

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false);
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, all.length]);

  return (
    <>
      {/* Main + thumbs */}
      <div>
        {/* Main image */}
        <div
          className="relative bg-neutral-50 overflow-hidden cursor-zoom-in mb-3"
          style={{ aspectRatio: '4/3' }}
          onClick={() => setLightbox(true)}
          onTouchStart={(e) => { touchStart.current = e.changedTouches[0].screenX; }}
          onTouchEnd={(e) => {
            const diff = touchStart.current - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); }
          }}>
          <img src={all[active]} alt={productName} className="w-full h-full object-contain transition-opacity duration-300" />
          {all.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow p-2 transition-all">
                <ChevronLeft size={18} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white shadow p-2 transition-all">
                <ChevronRight size={18} />
              </button>
            </>
          )}
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 font-heading">{active + 1} / {all.length}</div>
        </div>

        {/* Thumbnails */}
        {all.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {all.map((img, i) => (
              <button key={i} onClick={() => setActive(i)}
                className={`flex-shrink-0 w-16 h-16 overflow-hidden border-2 transition-all ${i === active ? 'border-brand-red' : 'border-neutral-200 hover:border-neutral-400'}`}>
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(false)}>
          <button className="absolute top-5 right-5 text-white/70 hover:text-white z-10 p-2" onClick={() => setLightbox(false)}>
            <X size={28} />
          </button>
          {all.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-5xl font-thin z-10">‹</button>
              <button onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-5xl font-thin z-10">›</button>
            </>
          )}
          <img src={all[active]} alt={productName}
            className="max-w-[90vw] max-h-[88vh] object-contain" onClick={(e) => e.stopPropagation()} />
          {all.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
              {all.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setActive(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${i === active ? 'bg-white scale-125' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ─── Video player ─────────────────────────────────────────────── */
function VideoPlayer({ url, type, title }: { url: string; type: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (!playing) {
    return (
      <button onClick={() => setPlaying(true)}
        className="relative w-full aspect-video bg-neutral-900 flex items-center justify-center group overflow-hidden">
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
        <div className="relative z-10 w-16 h-16 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
          <Play size={24} className="text-brand-charcoal ms-1" />
        </div>
        {title && <span className="absolute bottom-3 left-4 text-white/80 text-sm">{title}</span>}
      </button>
    );
  }

  if (type === 'youtube') {
    const id = getYouTubeId(url);
    return <div className="aspect-video"><iframe src={`https://www.youtube.com/embed/${id}?autoplay=1`} allow="autoplay; fullscreen" className="w-full h-full" title={title} /></div>;
  }
  if (type === 'vimeo') {
    const id = getVimeoId(url);
    return <div className="aspect-video"><iframe src={`https://player.vimeo.com/video/${id}?autoplay=1`} allow="autoplay; fullscreen" className="w-full h-full" title={title} /></div>;
  }
  return <video src={url} controls autoPlay className="w-full aspect-video bg-black" />;
}

/* ─── Detail tab content ───────────────────────────────────────── */
function DetailSection({ label, content }: { label: string; content: string }) {
  if (!content) return null;
  return (
    <div>
      <h3 className="font-heading font-bold text-xs tracking-widest uppercase text-neutral-400 mb-3">{label}</h3>
      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}

/* ─── Related product mini-card ────────────────────────────────── */
function RelatedCard({ product, lang }: { product: CmsProduct; lang: string }) {
  const name = lang === 'he' ? product.name_he : product.name_en;
  const url = `/brands/${product.brand_slug}/${product.category_slug}/${product.slug}`;
  return (
    <a href={url} className="group block bg-white border border-neutral-100 hover:border-brand-red/30 hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="aspect-square bg-neutral-50 overflow-hidden">
        {product.main_image_url
          ? <img src={product.main_image_url} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center"><Package size={32} className="text-neutral-300" /></div>}
      </div>
      <div className="p-4">
        <h4 className="font-heading font-semibold text-brand-charcoal text-sm leading-tight mb-1 line-clamp-2">{name}</h4>
        {product.weight && <p className="text-neutral-400 text-xs">{product.weight}</p>}
      </div>
    </a>
  );
}

/* ─── Main ProductPage ─────────────────────────────────────────── */
export default function ProductPage({ brandSlug, categorySlug, productSlug }: { brandSlug: string; categorySlug: string; productSlug: string }) {
  const { brands, categories } = useCms();
  const { lang, isRtl } = useLanguage();
  const [product, setProduct] = useState<CmsProduct | null>(null);
  const [related, setRelated] = useState<CmsProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'description' | 'ingredients' | 'nutritional' | 'feeding'>('description');

  const brand = brands.find((b) => b.slug === brandSlug) ?? null;
  const category = categories.find((c) => c.slug === categorySlug) ?? null;

  useEffect(() => {
    supabase.from('cms_products')
      .select('*')
      .eq('brand_slug', brandSlug)
      .eq('category_slug', categorySlug)
      .eq('slug', productSlug)
      .eq('active', true)
      .single()
      .then(({ data }) => {
        if (data) {
          const p = normalizeProduct(data as Record<string, unknown>);
          setProduct(p);
          // fetch related (same brand+category, excluding this product)
          return supabase.from('cms_products')
            .select('*')
            .eq('brand_slug', brandSlug)
            .eq('category_slug', categorySlug)
            .eq('active', true)
            .neq('id', p.id)
            .limit(4);
        }
        return { data: null, error: null };
      })
      .then((res) => {
        if (res && res.data) setRelated(res.data.map((r) => normalizeProduct(r as Record<string, unknown>)));
        setLoading(false);
      });
  }, [brandSlug, categorySlug, productSlug]);

  useEffect(() => {
    if (!product) return;
    const seoTitle = lang === 'he' ? (product.seo_title_he || `${product.name_he} | UltraPet`) : (product.seo_title_en || `${product.name_en} | UltraPet`);
    document.title = seoTitle;
    return () => { document.title = 'UltraPet'; };
  }, [product, lang]);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-neutral-200 border-t-brand-red rounded-full animate-spin" />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif-display text-4xl text-brand-charcoal font-bold">Product Not Found</h1>
      <p className="text-neutral-500">This product doesn't exist or has been removed.</p>
      <a href={`/brands/${brandSlug}`} className="btn-primary py-3 px-6 text-xs mt-2">Back to Brand</a>
    </div>
  );

  const name          = lang === 'he' ? product.name_he          : product.name_en;
  const shortDesc     = lang === 'he' ? product.short_description_he : product.short_description_en;
  const fullDesc      = lang === 'he' ? product.description_he    : product.description_en;
  const ingredients   = lang === 'he' ? product.ingredients_he    : product.ingredients_en;
  const nutritional   = lang === 'he' ? product.nutritional_he    : product.nutritional_en;
  const feedingGuide  = lang === 'he' ? product.feeding_guide_he  : product.feeding_guide_en;
  const brandName     = brand?.name ?? brandSlug;
  const categoryName  = lang === 'he' ? (category?.name_he ?? categorySlug) : (category?.name_en ?? categorySlug);
  const accentColor   = brand?.accent_color ?? '#BE1E24';
  const allImages     = [product.main_image_url, ...product.gallery_images].filter(Boolean);

  const DETAIL_TABS = [
    { id: 'description' as const, label: lang === 'he' ? 'תיאור' : 'Description',    content: fullDesc },
    { id: 'ingredients' as const, label: lang === 'he' ? 'רכיבים' : 'Ingredients',   content: ingredients },
    { id: 'nutritional' as const, label: lang === 'he' ? 'ניתוח תזונתי' : 'Nutritional', content: nutritional },
    { id: 'feeding'     as const, label: lang === 'he' ? 'מינון' : 'Feeding Guide',   content: feedingGuide },
  ].filter((t) => t.content);

  const FILE_ICONS: Record<string, string> = { pdf: '📄', sheet: '📊', catalog: '📋', cert: '🏆', other: '📎' };

  return (
    <div className="min-h-screen bg-white" dir={isRtl ? 'rtl' : 'ltr'}>
      <Header />

      {/* ── Breadcrumb ───────────────────────────────────────────── */}
      <div className="border-b border-neutral-100 bg-white">
        <div className="max-w-7xl mx-auto px-8 lg:px-14 py-4">
          <nav className="flex items-center gap-2 text-xs font-heading font-semibold text-neutral-400 flex-wrap">
            <a href="/" className="hover:text-brand-charcoal transition-colors">{lang === 'he' ? 'בית' : 'Home'}</a>
            <span>/</span>
            <a href={`/brands/${brandSlug}`} className="hover:text-brand-charcoal transition-colors">{brandName}</a>
            <span>/</span>
            <a href={`/categories/${categorySlug}`} className="hover:text-brand-charcoal transition-colors">{categoryName}</a>
            <span>/</span>
            <span className="text-brand-charcoal">{name}</span>
          </nav>
        </div>
      </div>

      {/* ── Main product section ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-8 lg:px-14 py-12 lg:py-16">
        <div className="grid lg:grid-cols-[3fr_2fr] gap-12 lg:gap-16">

          {/* Left: Gallery + detail tabs */}
          <div>
            <Gallery images={allImages} productName={name} />

            {/* Videos */}
            {product.videos.length > 0 && (
              <div className="mt-8 space-y-4">
                <h3 className="font-heading font-bold text-xs tracking-widest uppercase text-neutral-400">
                  {lang === 'he' ? 'סרטונים' : 'Product Videos'}
                </h3>
                {product.videos.map((v, i) => (
                  <VideoPlayer key={i} url={v.url} type={v.type} title={v.title} />
                ))}
              </div>
            )}

            {/* Detail tabs */}
            {DETAIL_TABS.length > 0 && (
              <div className="mt-12">
                <div className="flex border-b border-neutral-200 gap-6 overflow-x-auto">
                  {DETAIL_TABS.map((t) => (
                    <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
                      className={`pb-3 text-sm font-heading font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === t.id ? 'border-brand-red text-brand-red' : 'border-transparent text-neutral-400 hover:text-brand-charcoal'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="pt-6">
                  {DETAIL_TABS.filter((t) => t.id === activeTab).map((t) => (
                    <DetailSection key={t.id} label={t.label} content={t.content} />
                  ))}
                </div>
              </div>
            )}

            {/* Downloads */}
            {product.files.length > 0 && (
              <div className="mt-12 pt-8 border-t border-neutral-100">
                <h3 className="font-heading font-bold text-xs tracking-widest uppercase text-neutral-400 mb-4">
                  {lang === 'he' ? 'הורדות' : 'Downloads'}
                </h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {product.files.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 border border-neutral-200 hover:border-brand-red/30 hover:bg-neutral-50 transition-all group">
                      <span className="text-lg flex-shrink-0">{FILE_ICONS[f.file_type] || '📎'}</span>
                      <span className="text-sm font-heading font-semibold text-brand-charcoal group-hover:text-brand-red transition-colors truncate">{f.label || f.filename}</span>
                      <Download size={13} className="ms-auto text-neutral-400 group-hover:text-brand-red transition-colors flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Product info sidebar */}
          <div className="lg:sticky lg:top-6 self-start">
            {/* Brand + Category pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              <a href={`/brands/${brandSlug}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-heading font-bold tracking-wider uppercase text-white transition-all hover:opacity-80"
                style={{ backgroundColor: accentColor }}>
                {brandName}
              </a>
              <a href={`/categories/${categorySlug}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-heading font-bold tracking-wider uppercase border border-neutral-300 text-neutral-600 hover:border-brand-red/40 transition-all">
                {categoryName}
              </a>
            </div>

            {/* Name */}
            <h1 className="font-serif-display font-bold text-brand-charcoal text-3xl lg:text-4xl leading-tight mb-4">{name}</h1>

            {/* Meta badges */}
            <div className="flex flex-wrap gap-3 mb-5">
              {product.weight && (
                <div className="flex items-center gap-1.5 text-neutral-500 text-sm">
                  <Package size={14} />
                  <span>{product.weight}</span>
                </div>
              )}
              {product.country_origin && (
                <div className="flex items-center gap-1.5 text-neutral-500 text-sm">
                  <MapPin size={14} />
                  <span>{product.country_origin}</span>
                </div>
              )}
              {product.life_stage && (
                <div className="px-2.5 py-1 text-xs font-heading font-bold tracking-wide uppercase border text-neutral-500 border-neutral-200">
                  {product.life_stage}
                </div>
              )}
              {product.suitable_for && (
                <div className="px-2.5 py-1 text-xs font-heading font-bold tracking-wide uppercase border text-neutral-500 border-neutral-200">
                  {product.suitable_for}
                </div>
              )}
            </div>

            {/* Short description */}
            {shortDesc && <p className="text-neutral-600 text-base leading-relaxed mb-6">{shortDesc}</p>}

            {/* Benefits */}
            {product.benefits.length > 0 && (
              <div className="mb-6 space-y-2.5">
                {product.benefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" style={{ color: accentColor }} />
                    <span className="text-neutral-700 text-sm">{b}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Package sizes */}
            {product.package_sizes.length > 0 && (
              <div className="mb-7">
                <div className="text-neutral-400 text-2xs font-heading font-bold tracking-widest uppercase mb-2">
                  {lang === 'he' ? 'מידות אריזה' : 'Package Sizes'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.package_sizes.map((s) => (
                    <span key={s} className="px-3 py-1.5 text-xs font-heading font-semibold border border-neutral-200 text-neutral-600">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-col gap-3 pt-2">
              <a href="/#business"
                className="flex items-center justify-center gap-2 py-4 text-white font-heading font-bold text-xs tracking-widest uppercase transition-all hover:opacity-90"
                style={{ backgroundColor: accentColor }}>
                {lang === 'he' ? 'הפוך ללקוח עסקי' : 'Become a Business Customer'}
                <ChevronRight size={13} />
              </a>
              <a href="/#contact" onClick={(e) => { e.preventDefault(); window.location.href = '/#contact'; }}
                className="flex items-center justify-center gap-2 py-4 border-2 border-neutral-200 hover:border-brand-red/40 text-neutral-700 font-heading font-bold text-xs tracking-widest uppercase transition-all">
                <Mail size={13} />
                {lang === 'he' ? 'צור קשר' : 'Contact Us'}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Related Products ──────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="py-16 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-8 lg:px-14">
            <div className="eyebrow eyebrow-line mb-4" style={{ color: accentColor, borderColor: accentColor }}>
              {lang === 'he' ? 'מוצרים נוספים' : 'Related Products'}
            </div>
            <h2 className="section-heading text-3xl mb-10">
              {lang === 'he' ? `עוד מ${brandName}` : `More from ${brandName}`}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((r) => <RelatedCard key={r.id} product={r} lang={lang} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA Banner ───────────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: accentColor }}>
        <div className="relative max-w-7xl mx-auto px-8 lg:px-14">
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: `repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)`, backgroundSize: '20px 20px' }} />
          <div className="relative z-10 text-center max-w-xl mx-auto">
            <h2 className="font-serif-display font-bold text-white text-3xl lg:text-4xl mb-3">
              {lang === 'he' ? `מעוניינים ב${brandName}?` : `Interested in ${brandName}?`}
            </h2>
            <p className="text-white/70 mb-8">
              {lang === 'he' ? 'צרו קשר עם UltraPet לפרטים על הפצה, תמחור והזמנות' : 'Contact UltraPet for distribution, pricing and order details'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/#business" className="inline-flex items-center justify-center gap-2 bg-white px-8 py-4 font-heading font-bold text-xs tracking-widest uppercase hover:bg-neutral-100 transition-colors" style={{ color: accentColor }}>
                {lang === 'he' ? 'הפוך ללקוח עסקי' : 'Become a Business Customer'}
                <ChevronRight size={13} />
              </a>
              <a href="/#contact" onClick={(e) => { e.preventDefault(); window.location.href = '/#contact'; }}
                className="inline-flex items-center justify-center gap-2 border-2 border-white/40 hover:border-white text-white px-8 py-4 font-heading font-bold text-xs tracking-widest uppercase transition-colors">
                <Mail size={13} /> {lang === 'he' ? 'צור קשר' : 'Contact Us'}
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
