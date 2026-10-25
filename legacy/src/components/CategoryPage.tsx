import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CmsProduct, normalizeProduct } from '../contexts/CmsContext';
import { useCms } from '../contexts/CmsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Package, ChevronRight, Filter } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';

function ProductCard({ product, lang, accentColor }: { product: CmsProduct; lang: string; accentColor: string }) {
  const name = lang === 'he' ? product.name_he : product.name_en;
  const desc = lang === 'he' ? product.short_description_he : product.short_description_en;
  const url = `/brands/${product.brand_slug}/${product.category_slug}/${product.slug}`;
  return (
    <a href={url} className="group block bg-white border border-neutral-100 hover:border-transparent hover:shadow-premium transition-all duration-400 overflow-hidden">
      <div className="relative aspect-square bg-neutral-50 overflow-hidden">
        {product.main_image_url
          ? <img src={product.main_image_url} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center"><Package size={40} className="text-neutral-200" /></div>}
        {product.featured && (
          <div className="absolute top-3 left-3 text-white text-2xs font-heading font-bold px-2.5 py-1 tracking-widest uppercase"
            style={{ backgroundColor: accentColor }}>
            {lang === 'he' ? 'נבחר' : 'Featured'}
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="w-5 h-0.5 mb-3" style={{ backgroundColor: accentColor }} />
        <h3 className="font-heading font-bold text-brand-charcoal text-sm leading-tight mb-1 line-clamp-2">{name}</h3>
        {product.weight && <p className="text-neutral-400 text-xs mb-2">{product.weight}</p>}
        {desc && <p className="text-neutral-500 text-xs leading-relaxed line-clamp-3 mb-4">{desc}</p>}
        <span className="inline-flex items-center gap-1.5 text-xs font-heading font-bold tracking-widest uppercase transition-all duration-200 group-hover:gap-2.5"
          style={{ color: accentColor }}>
          {lang === 'he' ? 'פרטים' : 'View Details'} <ChevronRight size={11} />
        </span>
      </div>
    </a>
  );
}

export default function CategoryPage({ slug }: { slug: string }) {
  const { categories, brands } = useCms();
  const { lang, isRtl } = useLanguage();
  const [products, setProducts] = useState<CmsProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState('');
  const [filterWeight, setFilterWeight] = useState('');
  const [filterLifeStage, setFilterLifeStage] = useState('');

  const category = categories.find((c) => c.slug === slug) ?? null;
  const catName  = lang === 'he' ? (category?.name_he ?? slug) : (category?.name_en ?? slug);
  const catDesc  = lang === 'he' ? category?.description_he : category?.description_en;

  useEffect(() => {
    if (!category) { document.title = `${slug} | UltraPet`; }
    else {
      const t = lang === 'he' ? (category.seo_title_he || `${category.name_he} | UltraPet`) : (category.seo_title_en || `${category.name_en} | UltraPet`);
      document.title = t;
    }
    return () => { document.title = 'UltraPet'; };
  }, [category, lang, slug]);

  useEffect(() => {
    supabase.from('cms_products')
      .select('*')
      .eq('category_slug', slug)
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setProducts(data.map((p) => normalizeProduct(p as Record<string, unknown>)));
        setLoading(false);
      });
  }, [slug]);

  // Derive filter options from actual products
  const brandSlugsInCategory = [...new Set(products.map((p) => p.brand_slug).filter(Boolean))];
  const weightsInCategory    = [...new Set(products.map((p) => p.weight).filter(Boolean))];
  const lifeStagesInCategory = [...new Set(products.map((p) => p.life_stage).filter(Boolean))];

  const brandMeta = (bSlug: string) => brands.find((b) => b.slug === bSlug);

  const filtered = products.filter((p) => {
    const matchBrand     = !filterBrand     || p.brand_slug  === filterBrand;
    const matchWeight    = !filterWeight    || p.weight      === filterWeight;
    const matchLifeStage = !filterLifeStage || p.life_stage  === filterLifeStage;
    return matchBrand && matchWeight && matchLifeStage;
  });

  const accentColor = category?.color || '#BE1E24';
  const hasFilters  = brandSlugsInCategory.length > 1 || weightsInCategory.length > 1 || lifeStagesInCategory.length > 1;

  return (
    <div className="min-h-screen bg-white" dir={isRtl ? 'rtl' : 'ltr'}>
      <Header />

      {/* Category hero */}
      <section className="relative py-20 lg:py-28 overflow-hidden" style={{ backgroundColor: accentColor }}>
        {category?.image_url && (
          <img src={category.image_url} alt={catName} className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accentColor}e0 0%, ${accentColor}80 100%)` }} />
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`, backgroundSize: '28px 28px' }} />
        <div className="relative z-10 max-w-7xl mx-auto px-8 lg:px-14">
          <div className="font-heading font-semibold text-white/60 text-xs tracking-widest uppercase mb-3">
            <a href="/" className="hover:text-white/80 transition-colors">{lang === 'he' ? 'בית' : 'Home'}</a>
            <span className="mx-2">/</span>
            <span>{catName}</span>
          </div>
          <h1 className="font-serif-display font-bold text-white text-5xl lg:text-6xl mb-4">{catName}</h1>
          {catDesc && <p className="text-white/70 text-lg max-w-2xl">{catDesc}</p>}
          <div className="mt-6 text-white/60 font-heading text-sm">{filtered.length} {lang === 'he' ? 'מוצרים' : 'products'}</div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 lg:px-14 py-14 lg:py-20">
        <div className={`flex ${hasFilters ? 'gap-8 lg:gap-12 flex-col lg:flex-row' : ''}`}>

          {/* Filters sidebar */}
          {hasFilters && (
            <aside className="w-full lg:w-56 flex-shrink-0">
              <div className="flex items-center gap-2 mb-5">
                <Filter size={14} className="text-neutral-400" />
                <span className="font-heading font-bold text-xs tracking-widest uppercase text-neutral-400">
                  {lang === 'he' ? 'סינון' : 'Filter'}
                </span>
              </div>
              <div className="space-y-6">
                {brandSlugsInCategory.length > 1 && (
                  <div>
                    <label className="font-heading font-bold text-xs tracking-widest uppercase text-neutral-400 mb-3 block">
                      {lang === 'he' ? 'מותג' : 'Brand'}
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input type="radio" name="brand" value="" checked={filterBrand === ''} onChange={() => setFilterBrand('')} className="accent-red-600" />
                        <span className="text-sm text-neutral-600 group-hover:text-neutral-800 transition-colors">{lang === 'he' ? 'הכל' : 'All'}</span>
                      </label>
                      {brandSlugsInCategory.map((bSlug) => (
                        <label key={bSlug} className="flex items-center gap-2 cursor-pointer group">
                          <input type="radio" name="brand" value={bSlug} checked={filterBrand === bSlug} onChange={() => setFilterBrand(bSlug)} className="accent-red-600" />
                          <span className="text-sm text-neutral-600 group-hover:text-neutral-800 transition-colors">{brandMeta(bSlug)?.name ?? bSlug}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {weightsInCategory.length > 1 && (
                  <div>
                    <label className="font-heading font-bold text-xs tracking-widest uppercase text-neutral-400 mb-3 block">
                      {lang === 'he' ? 'משקל' : 'Weight'}
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="weight" value="" checked={filterWeight === ''} onChange={() => setFilterWeight('')} className="accent-red-600" />
                        <span className="text-sm text-neutral-600">{lang === 'he' ? 'הכל' : 'All'}</span>
                      </label>
                      {weightsInCategory.map((w) => (
                        <label key={w} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="weight" value={w} checked={filterWeight === w} onChange={() => setFilterWeight(w)} className="accent-red-600" />
                          <span className="text-sm text-neutral-600">{w}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {lifeStagesInCategory.length > 1 && (
                  <div>
                    <label className="font-heading font-bold text-xs tracking-widest uppercase text-neutral-400 mb-3 block">
                      {lang === 'he' ? 'שלב חיים' : 'Life Stage'}
                    </label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="life_stage" value="" checked={filterLifeStage === ''} onChange={() => setFilterLifeStage('')} className="accent-red-600" />
                        <span className="text-sm text-neutral-600">{lang === 'he' ? 'הכל' : 'All'}</span>
                      </label>
                      {lifeStagesInCategory.map((ls) => (
                        <label key={ls} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="life_stage" value={ls} checked={filterLifeStage === ls} onChange={() => setFilterLifeStage(ls)} className="accent-red-600" />
                          <span className="text-sm text-neutral-600">{ls}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {(filterBrand || filterWeight || filterLifeStage) && (
                  <button onClick={() => { setFilterBrand(''); setFilterWeight(''); setFilterLifeStage(''); }}
                    className="text-xs font-heading font-bold text-brand-red hover:underline tracking-wider uppercase">
                    {lang === 'he' ? 'נקה סינון' : 'Clear Filters'}
                  </button>
                )}
              </div>
            </aside>
          )}

          {/* Product grid */}
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-neutral-200 border-t-brand-red rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-neutral-400">
                <Package size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{lang === 'he' ? 'לא נמצאו מוצרים' : 'No products found'}</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((p) => {
                  const bColor = brandMeta(p.brand_slug)?.accent_color || accentColor;
                  return <ProductCard key={p.id} product={p} lang={lang} accentColor={bColor} />;
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
