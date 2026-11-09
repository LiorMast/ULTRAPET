import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CmsBrand, CmsCategory, FeaturedProduct } from '../../contexts/CmsContext';
import BilingualField from '../components/BilingualField';
import ImageUpload from '../components/ImageUpload';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save,
  ChevronDown as Expand, Loader, Star, Eye, EyeOff,
  Package, Tag, Globe, ExternalLink, LayoutGrid,
} from 'lucide-react';

type Draft = CmsBrand & { _dirty: boolean; _open: boolean; _tab: 'basic' | 'page' | 'categories' | 'seo' };

function emptyProduct(): FeaturedProduct {
  return { name_en: '', name_he: '', desc_en: '', desc_he: '', image_url: '' };
}

function newBrand(order: number): Draft {
  return {
    id: '', name: '', slug: '', tagline_he: '', tagline_en: '',
    description_he: '', description_en: '', logo_url: null, accent_color: '#BE1E24',
    featured: false, active: true, sort_order: order, features_he: [], features_en: [],
    country_origin: '', hero_image_url: '', gallery_images: [],
    seo_title_he: '', seo_title_en: '', seo_description_he: '', seo_description_en: '',
    featured_products: [], related_category_slugs: [], cta_text_he: '', cta_text_en: '',
    cta_link: '#business',
    _dirty: true, _open: true, _tab: 'categories',
  };
}

const INPUT = 'w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-600 transition-colors';
const LABEL = 'block text-slate-400 text-xs font-semibold tracking-wide uppercase mb-2';

export default function BrandsManager() {
  const [brands, setBrands] = useState<Draft[]>([]);
  const [allCategories, setAllCategories] = useState<CmsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('cms_brands').select('*').order('sort_order'),
      supabase.from('cms_categories').select('*').eq('active', true).order('sort_order'),
    ]).then(([brandsRes, catsRes]) => {
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
          _dirty: false, _open: false, _tab: 'categories',
        })));
      }
      if (catsRes.data) {
        setAllCategories(catsRes.data.map((c) => ({
          ...c,
          icon: c.icon ?? '',
          color: c.color ?? '',
          seo_title_he: c.seo_title_he ?? '',
          seo_title_en: c.seo_title_en ?? '',
          seo_description_he: c.seo_description_he ?? '',
          seo_description_en: c.seo_description_en ?? '',
          brand_slugs: Array.isArray(c.brand_slugs) ? c.brand_slugs : [],
        })));
      }
      setLoading(false);
    });
  }, []);

  const update = (idx: number, patch: Partial<Draft>) =>
    setBrands((prev) => prev.map((b, i) => i === idx ? { ...b, ...patch, _dirty: true } : b));

  const toggle = (idx: number) =>
    setBrands((prev) => prev.map((b, i) => i === idx ? { ...b, _open: !b._open } : b));

  const setTab = (idx: number, tab: Draft['_tab']) =>
    setBrands((prev) => prev.map((b, i) => i === idx ? { ...b, _tab: tab } : b));

  const toggleCategory = (brandIdx: number, catSlug: string) => {
    const current = brands[brandIdx].related_category_slugs;
    const next = current.includes(catSlug)
      ? current.filter((s) => s !== catSlug)
      : [...current, catSlug];
    update(brandIdx, { related_category_slugs: next });
  };

  const move = (idx: number, dir: -1 | 1) => {
    setBrands((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((b, i) => ({ ...b, sort_order: i, _dirty: true }));
    });
  };

  const remove = async (idx: number) => {
    const b = brands[idx];
    if (b.id) await supabase.from('cms_brands').delete().eq('id', b.id);
    setBrands((prev) => prev.filter((_, i) => i !== idx));
    flash('Deleted');
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const addGalleryImage = (idx: number, url: string) => {
    if (!url) return;
    const imgs = [...brands[idx].gallery_images, url];
    update(idx, { gallery_images: imgs });
  };

  const removeGalleryImage = (idx: number, imgIdx: number) => {
    const imgs = brands[idx].gallery_images.filter((_, i) => i !== imgIdx);
    update(idx, { gallery_images: imgs });
  };

  const addProduct = (idx: number) =>
    update(idx, { featured_products: [...brands[idx].featured_products, emptyProduct()] });

  const updateProduct = (brandIdx: number, productIdx: number, patch: Partial<FeaturedProduct>) => {
    const products = brands[brandIdx].featured_products.map((p, i) => i === productIdx ? { ...p, ...patch } : p);
    update(brandIdx, { featured_products: products });
  };

  const removeProduct = (brandIdx: number, productIdx: number) => {
    const products = brands[brandIdx].featured_products.filter((_, i) => i !== productIdx);
    update(brandIdx, { featured_products: products });
  };

  const save = async (idx: number) => {
    const b = brands[idx];
    setSaving(b.id || `new-${idx}`);
    const payload = {
      name: b.name, slug: b.slug, tagline_he: b.tagline_he, tagline_en: b.tagline_en,
      description_he: b.description_he, description_en: b.description_en,
      logo_url: b.logo_url, accent_color: b.accent_color, featured: b.featured,
      active: b.active, sort_order: b.sort_order,
      features_he: b.features_he, features_en: b.features_en,
      country_origin: b.country_origin, hero_image_url: b.hero_image_url,
      gallery_images: b.gallery_images,
      seo_title_he: b.seo_title_he, seo_title_en: b.seo_title_en,
      seo_description_he: b.seo_description_he, seo_description_en: b.seo_description_en,
      featured_products: b.featured_products,
      related_category_slugs: b.related_category_slugs,
      cta_text_he: b.cta_text_he, cta_text_en: b.cta_text_en, cta_link: b.cta_link,
    };
    const { data, error } = b.id
      ? await supabase.from('cms_brands').update(payload).eq('id', b.id).select().single()
      : await supabase.from('cms_brands').insert(payload).select().single();
    if (!error && data) {
      setBrands((prev) => prev.map((x, i) => i === idx ? { ...x, id: data.id, _dirty: false } : x));
      flash('Saved!');
    } else { flash(error?.message || 'Error'); }
    setSaving(null);
  };

  if (loading) return (
    <div className="p-8 flex items-center gap-2 text-slate-400"><Loader size={16} className="animate-spin" /> Loading...</div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-bold text-2xl mb-1">Brands</h1>
          <p className="text-slate-400 text-sm">Manage brand profiles, landing pages, products and gallery.</p>
        </div>
        <button onClick={() => setBrands((prev) => [...prev, newBrand(prev.length)])}
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 flex items-center gap-2 transition-colors">
          <Plus size={13} /> Add Brand
        </button>
      </div>

      {msg && <div className="mb-4 bg-green-900/30 border border-green-700/40 text-green-300 text-sm px-4 py-2">{msg}</div>}

      <div className="space-y-3">
        {brands.map((b, i) => (
          <div key={b.id || `new-${i}`} className={`bg-slate-900 border ${b._dirty ? 'border-yellow-600/40' : 'border-slate-800'}`}>

            {/* Row header */}
            <div className="flex items-center gap-3 px-5 py-3">
              <button onClick={() => toggle(i)} className="flex items-center gap-3 flex-1 text-start min-w-0">
                <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: b.accent_color }} />
                <span className="text-white text-sm font-medium truncate">{b.name || '(new brand)'}</span>
                {b.featured && <Star size={12} className="text-yellow-400 flex-shrink-0" />}
                {b._dirty && <span className="bg-yellow-600/20 text-yellow-400 text-xs px-2 py-0.5 flex-shrink-0">Unsaved</span>}
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a href={`/brands/${b.slug}`} target="_blank" rel="noopener noreferrer"
                  className="text-slate-600 hover:text-slate-300 transition-colors" title="Preview brand page">
                  <ExternalLink size={14} />
                </a>
                <button onClick={() => update(i, { active: !b.active })} className={`${b.active ? 'text-green-400' : 'text-slate-600'} hover:opacity-80 transition-colors`}>
                  {b.active ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-600 hover:text-slate-400 disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === brands.length - 1} className="text-slate-600 hover:text-slate-400 disabled:opacity-30"><ChevronDown size={14} /></button>
                <button onClick={() => remove(i)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
                <button onClick={() => save(i)} disabled={saving !== null}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 flex items-center gap-1 transition-colors">
                  {saving === (b.id || `new-${i}`) ? <Loader size={11} className="animate-spin" /> : <Save size={11} />}
                  Save
                </button>
                <button onClick={() => toggle(i)} className="text-slate-500 hover:text-white transition-colors">
                  <Expand size={14} className={`transition-transform duration-200 ${b._open ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Expanded body */}
            {b._open && (
              <div className="border-t border-slate-800">
                {/* Tab bar */}
                <div className="flex border-b border-slate-800 px-5">
                  {([
                    { id: 'basic',      label: 'Brand Info',        icon: Tag },
                    { id: 'categories', label: 'Assigned Categories', icon: LayoutGrid },
                    { id: 'page',       label: 'Page Content',       icon: Package },
                    { id: 'seo',        label: 'SEO & CTA',          icon: Globe },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(i, id)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold tracking-wide uppercase border-b-2 transition-colors ${b._tab === id ? 'border-red-600 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>

                <div className="px-5 pb-6 pt-5 space-y-5">

                  {/* ── Tab: Assigned Categories ──────────────── */}
                  {b._tab === 'categories' && (
                    <div>
                      <p className="text-slate-400 text-sm mb-5">
                        Select the product categories that belong to this brand.
                        They will appear on the brand landing page immediately below the hero.
                      </p>
                      {allCategories.length === 0 ? (
                        <p className="text-slate-600 text-sm">
                          No categories found. Create categories in the{' '}
                          <span className="text-red-400">Categories</span> section first.
                        </p>
                      ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {allCategories.map((cat) => {
                            const checked = b.related_category_slugs.includes(cat.slug);
                            return (
                              <label key={cat.slug}
                                className={`flex items-center gap-3 px-4 py-3 border cursor-pointer transition-all ${checked ? 'border-red-600/60 bg-red-900/10' : 'border-slate-700 hover:border-slate-600'}`}>
                                <input type="checkbox" checked={checked}
                                  onChange={() => toggleCategory(i, cat.slug)} className="accent-red-600 flex-shrink-0" />
                                {cat.image_url && (
                                  <img src={cat.image_url} alt="" className="w-8 h-8 object-cover flex-shrink-0" />
                                )}
                                {!cat.image_url && cat.icon && (
                                  <span className="text-lg flex-shrink-0">{cat.icon}</span>
                                )}
                                <div className="min-w-0">
                                  <div className="text-slate-200 text-sm font-medium truncate">{cat.name_en || cat.name_he}</div>
                                  {cat.name_he && cat.name_en && (
                                    <div className="text-slate-500 text-xs truncate" dir="rtl">{cat.name_he}</div>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {b.related_category_slugs.length > 0 && (
                        <p className="text-slate-500 text-xs mt-4">
                          Assigned: {b.related_category_slugs.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Tab: Basic ────────────────────────────── */}
                  {b._tab === 'basic' && <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className={LABEL}>Brand Name</label>
                        <input value={b.name} onChange={(e) => update(i, { name: e.target.value })} className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>Slug</label>
                        <input value={b.slug} onChange={(e) => update(i, { slug: e.target.value })} placeholder="ultra-pet" className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>Country of Origin</label>
                        <input value={b.country_origin} onChange={(e) => update(i, { country_origin: e.target.value })} placeholder="Germany" className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>Accent Color</label>
                        <div className="flex gap-2">
                          <input type="color" value={b.accent_color} onChange={(e) => update(i, { accent_color: e.target.value })} className="h-9 w-12 bg-slate-800 border border-slate-700 cursor-pointer" />
                          <input value={b.accent_color} onChange={(e) => update(i, { accent_color: e.target.value })} className={`flex-1 ${INPUT} font-mono`} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={b.featured} onChange={(e) => update(i, { featured: e.target.checked })} className="accent-red-600" />
                        <span className="text-slate-300 text-sm">Featured (flagship)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={b.active} onChange={(e) => update(i, { active: e.target.checked })} className="accent-red-600" />
                        <span className="text-slate-300 text-sm">Active (show on site)</span>
                      </label>
                    </div>

                    <BilingualField label="Tagline" heValue={b.tagline_he} enValue={b.tagline_en}
                      onChangeHe={(v) => update(i, { tagline_he: v })} onChangeEn={(v) => update(i, { tagline_en: v })} />
                    <BilingualField label="Description" heValue={b.description_he} enValue={b.description_en}
                      onChangeHe={(v) => update(i, { description_he: v })} onChangeEn={(v) => update(i, { description_en: v })} multiline />
                    <BilingualField label="Features (one per line)" heValue={b.features_he.join('\n')} enValue={b.features_en.join('\n')}
                      onChangeHe={(v) => update(i, { features_he: v.split('\n').filter(Boolean) })}
                      onChangeEn={(v) => update(i, { features_en: v.split('\n').filter(Boolean) })} isArray />
                    <ImageUpload value={b.logo_url || ''} onChange={(url) => update(i, { logo_url: url || null })} label="Brand Logo" section="brands" />
                  </>}

                  {/* ── Tab: Page Content ─────────────────────── */}
                  {b._tab === 'page' && <>
                    <ImageUpload value={b.hero_image_url} onChange={(url) => update(i, { hero_image_url: url })} label="Hero Banner Image" section="brands" />

                    {/* Featured Products */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className={LABEL}>Featured Products</label>
                        <button onClick={() => addProduct(i)} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 flex items-center gap-1.5 transition-colors">
                          <Plus size={11} /> Add Product
                        </button>
                      </div>
                      {b.featured_products.length === 0 && (
                        <p className="text-slate-600 text-xs">No featured products. Click "Add Product" to add one.</p>
                      )}
                      <div className="space-y-4">
                        {b.featured_products.map((p, pi) => (
                          <div key={pi} className="bg-slate-800 border border-slate-700 p-4 space-y-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-slate-400 text-xs font-mono">Product {pi + 1}</span>
                              <button onClick={() => removeProduct(i, pi)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-slate-500 text-xs mb-1 block">Name (Hebrew)</label>
                                <input dir="rtl" value={p.name_he} onChange={(e) => updateProduct(i, pi, { name_he: e.target.value })} className={INPUT} placeholder="שם המוצר" />
                              </div>
                              <div>
                                <label className="text-slate-500 text-xs mb-1 block">Name (English)</label>
                                <input value={p.name_en} onChange={(e) => updateProduct(i, pi, { name_en: e.target.value })} className={INPUT} placeholder="Product name" />
                              </div>
                              <div>
                                <label className="text-slate-500 text-xs mb-1 block">Description (Hebrew)</label>
                                <textarea dir="rtl" value={p.desc_he} onChange={(e) => updateProduct(i, pi, { desc_he: e.target.value })} rows={2} className={`${INPUT} resize-none`} placeholder="תיאור קצר..." />
                              </div>
                              <div>
                                <label className="text-slate-500 text-xs mb-1 block">Description (English)</label>
                                <textarea value={p.desc_en} onChange={(e) => updateProduct(i, pi, { desc_en: e.target.value })} rows={2} className={`${INPUT} resize-none`} placeholder="Short description..." />
                              </div>
                            </div>
                            <ImageUpload value={p.image_url} onChange={(url) => updateProduct(i, pi, { image_url: url })} label="Product Image" section="brands" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Gallery */}
                    <div>
                      <label className={LABEL}>Brand Gallery</label>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        {b.gallery_images.map((url, gi) => (
                          <div key={gi} className="relative group aspect-video bg-slate-800 overflow-hidden">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => removeGalleryImage(i, gi)}
                              className="absolute top-1 right-1 bg-black/70 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                        <div className="aspect-video">
                          <ImageUpload value="" onChange={(url) => { if (url) addGalleryImage(i, url); }} label="" section="brands" compact />
                        </div>
                      </div>
                      <p className="text-slate-600 text-xs">Add images to the brand gallery. First image shown largest.</p>
                    </div>
                  </>}

                  {/* ── Tab: SEO & CTA ────────────────────────── */}
                  {b._tab === 'seo' && <>
                    <BilingualField label="SEO Title" heValue={b.seo_title_he} enValue={b.seo_title_en}
                      onChangeHe={(v) => update(i, { seo_title_he: v })} onChangeEn={(v) => update(i, { seo_title_en: v })} />
                    <BilingualField label="SEO Description" heValue={b.seo_description_he} enValue={b.seo_description_en}
                      onChangeHe={(v) => update(i, { seo_description_he: v })} onChangeEn={(v) => update(i, { seo_description_en: v })} multiline />

                    <div className="border-t border-slate-800 pt-5">
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-4">CTA Button</p>
                      <BilingualField label="CTA Text" heValue={b.cta_text_he} enValue={b.cta_text_en}
                        onChangeHe={(v) => update(i, { cta_text_he: v })} onChangeEn={(v) => update(i, { cta_text_en: v })} />
                      <div className="mt-4">
                        <label className={LABEL}>CTA Link</label>
                        <input value={b.cta_link} onChange={(e) => update(i, { cta_link: e.target.value })}
                          placeholder="#business" className={INPUT} />
                        <p className="text-slate-600 text-xs mt-1">Use <code className="text-slate-500">#business</code> for the homepage business section, or an absolute URL.</p>
                      </div>
                    </div>

                    <div className="border-t border-slate-800 pt-5">
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Brand Page URL</p>
                      <a href={`/brands/${b.slug}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors font-mono">
                        /brands/{b.slug} <ExternalLink size={12} />
                      </a>
                    </div>
                  </>}

                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
