import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CmsProduct, VideoItem, ProductFile, normalizeProduct } from '../../contexts/CmsContext';
import BilingualField from '../components/BilingualField';
import ImageUpload from '../components/ImageUpload';
import {
  Plus, Trash2, Save, Loader, Eye, EyeOff, Star, Copy,
  GripVertical, Tag, Image, Film, FileText, BookOpen, Folder, Search,
  Globe, ChevronDown, ExternalLink, Upload, X,
} from 'lucide-react';

type Tab = 'basic' | 'images' | 'videos' | 'descriptions' | 'details' | 'files' | 'seo';
type Draft = CmsProduct & { _dirty: boolean; _open: boolean; _tab: Tab };

const INPUT = 'w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-600 transition-colors';
const LABEL = 'block text-slate-400 text-xs font-semibold tracking-wide uppercase mb-2';
const TEXTAREA = `${INPUT} resize-none`;

function emptyProduct(order: number): Draft {
  return {
    id: '', slug: '', brand_slug: '', category_slug: '',
    name_he: '', name_en: '', weight: '', country_origin: '',
    featured: false, active: true, sort_order: order,
    main_image_url: '', gallery_images: [], videos: [],
    short_description_he: '', short_description_en: '',
    description_he: '', description_en: '',
    ingredients_he: '', ingredients_en: '',
    nutritional_he: '', nutritional_en: '',
    feeding_guide_he: '', feeding_guide_en: '',
    package_sizes: [], suitable_for: '', life_stage: '', benefits: [],
    files: [],
    seo_title_he: '', seo_title_en: '', seo_description_he: '', seo_description_en: '',
    og_image_url: '', canonical_url: '',
    _dirty: true, _open: true, _tab: 'basic',
  };
}

/* ─── Gallery editor with drag & drop ─────────────────────────── */
function GalleryEditor({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const onDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === i) { setDragOver(null); return; }
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(i, 0, item);
    onChange(next);
    dragIdx.current = null; setDragOver(null);
  };
  const remove = (i: number) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {images.map((url, i) => (
          <div key={i} draggable
            onDragStart={() => onDragStart(i)} onDragOver={(e) => onDragOver(e, i)} onDrop={(e) => onDrop(e, i)} onDragEnd={() => { dragIdx.current = null; setDragOver(null); }}
            className={`relative group aspect-square bg-slate-800 overflow-hidden border ${dragOver === i ? 'border-red-500' : 'border-slate-700'} cursor-grab`}>
            <img src={url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <GripVertical size={14} className="text-white/70" />
              <button onClick={() => remove(i)} className="bg-red-600 text-white p-1 hover:bg-red-700 transition-colors">
                <Trash2 size={11} />
              </button>
            </div>
            {i === 0 && <div className="absolute top-1 left-1 bg-red-600 text-white text-2xs px-1.5 py-0.5 font-bold">Cover</div>}
          </div>
        ))}
        <div className="aspect-square">
          <ImageUpload value="" onChange={(url) => { if (url) onChange([...images, url]); }} label="" section="products" compact />
        </div>
      </div>
      <p className="text-slate-600 text-xs">Drag to reorder. First image is the cover.</p>
    </div>
  );
}

/* ─── Video editor ─────────────────────────────────────────────── */
function VideoEditor({ videos, onChange }: { videos: VideoItem[]; onChange: (v: VideoItem[]) => void }) {
  const add = () => onChange([...videos, { type: 'youtube', url: '', title: '' }]);
  const update = (i: number, patch: Partial<VideoItem>) => onChange(videos.map((v, idx) => idx === i ? { ...v, ...patch } : v));
  const remove = (i: number) => onChange(videos.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {videos.map((v, i) => (
        <div key={i} className="bg-slate-800 border border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-mono">Video {i + 1}</span>
            <button onClick={() => remove(i)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-slate-500 text-xs mb-1 block">Type</label>
              <select value={v.type} onChange={(e) => update(i, { type: e.target.value as VideoItem['type'] })} className={INPUT}>
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="mp4">MP4 URL</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-slate-500 text-xs mb-1 block">URL</label>
              <input value={v.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://..." className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-slate-500 text-xs mb-1 block">Title (optional)</label>
            <input value={v.title} onChange={(e) => update(i, { title: e.target.value })} className={INPUT} />
          </div>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold transition-colors border border-slate-700 hover:border-slate-600 px-4 py-2.5">
        <Plus size={12} /> Add Video
      </button>
    </div>
  );
}

/* ─── File editor ──────────────────────────────────────────────── */
function FileEditor({ files, onChange }: { files: ProductFile[]; onChange: (f: ProductFile[]) => void }) {
  const [uploading, setUploading] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const add = () => onChange([...files, { label: '', url: '', file_type: 'pdf', filename: '' }]);
  const update = (i: number, patch: Partial<ProductFile>) => onChange(files.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const remove = (i: number) => onChange(files.filter((_, idx) => idx !== i));

  const uploadFile = async (i: number, file: File) => {
    setUploading(i);
    const ext = file.name.split('.').pop();
    const path = `products/files/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('cms-media').upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('cms-media').getPublicUrl(path);
      await supabase.from('cms_media').insert({ filename: file.name, storage_path: path, public_url: publicUrl, mime_type: file.type, size_bytes: file.size, section: 'products' });
      update(i, { url: publicUrl, filename: file.name });
    }
    setUploading(null);
  };

  const TYPE_LABELS: Record<ProductFile['file_type'], string> = { pdf: 'PDF Document', sheet: 'Technical Sheet', catalog: 'Catalog', cert: 'Certificate', other: 'Other' };

  return (
    <div className="space-y-3">
      {files.map((f, i) => (
        <div key={i} className="bg-slate-800 border border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-mono">File {i + 1}</span>
            <button onClick={() => remove(i)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-500 text-xs mb-1 block">Label</label>
              <input value={f.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Datasheet" className={INPUT} />
            </div>
            <div>
              <label className="text-slate-500 text-xs mb-1 block">Type</label>
              <select value={f.file_type} onChange={(e) => update(i, { file_type: e.target.value as ProductFile['file_type'] })} className={INPUT}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-slate-500 text-xs mb-1 block">URL</label>
              <input value={f.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://... or upload below" className={INPUT} />
            </div>
            <button onClick={() => inputRefs.current[i]?.click()}
              disabled={uploading === i}
              className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 flex items-center gap-1.5 transition-colors flex-shrink-0 self-end">
              {uploading === i ? <Loader size={11} className="animate-spin" /> : <Upload size={11} />} Upload
            </button>
            <input ref={(el) => { inputRefs.current[i] = el; }} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(i, file); }} />
          </div>
          {f.filename && <p className="text-slate-500 text-xs flex items-center gap-1"><FileText size={11} /> {f.filename}</p>}
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold transition-colors border border-slate-700 hover:border-slate-600 px-4 py-2.5">
        <Plus size={12} /> Add File
      </button>
    </div>
  );
}

/* ─── Main ProductsManager ─────────────────────────────────────── */
export default function ProductsManager() {
  const [products, setProducts] = useState<Draft[]>([]);
  const [allBrands, setAllBrands] = useState<{ slug: string; name: string }[]>([]);
  const [allCategories, setAllCategories] = useState<{ slug: string; name_en: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCat, setFilterCat] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('cms_products').select('*').order('sort_order').order('created_at'),
      supabase.from('cms_brands').select('slug,name').eq('active', true).order('sort_order'),
      supabase.from('cms_categories').select('slug,name_en').eq('active', true).order('sort_order'),
    ]).then(([prodRes, brandRes, catRes]) => {
      if (prodRes.data) setProducts(prodRes.data.map((p) => ({ ...normalizeProduct(p as Record<string, unknown>), _dirty: false, _open: false, _tab: 'basic' as Tab })));
      if (brandRes.data) setAllBrands(brandRes.data as { slug: string; name: string }[]);
      if (catRes.data) setAllCategories(catRes.data as { slug: string; name_en: string }[]);
      setLoading(false);
    });
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const update = (idx: number, patch: Partial<Draft>) =>
    setProducts((prev) => prev.map((p, i) => i === idx ? { ...p, ...patch, _dirty: true } : p));

  const openProduct = (idx: number) =>
    setProducts((prev) => prev.map((p, i) => ({ ...p, _open: i === idx ? !p._open : false })));

  const setTab = (idx: number, tab: Tab) =>
    setProducts((prev) => prev.map((p, i) => i === idx ? { ...p, _tab: tab } : p));

  const remove = async (idx: number) => {
    const p = products[idx];
    if (!window.confirm(`Delete "${p.name_en || p.name_he}"?`)) return;
    if (p.id) await supabase.from('cms_products').delete().eq('id', p.id);
    setProducts((prev) => prev.filter((_, i) => i !== idx));
    flash('Deleted');
  };

  const duplicate = async (idx: number) => {
    const p = products[idx];
    const payload = productToPayload(p);
    payload.slug = `${p.slug || 'product'}-copy`;
    payload.name_en = `${p.name_en} (Copy)`;
    payload.name_he = `${p.name_he} (עותק)`;
    payload.active = false;
    payload.sort_order = products.length;
    const { data, error } = await supabase.from('cms_products').insert(payload).select().single();
    if (!error && data) {
      setProducts((prev) => [...prev, { ...normalizeProduct(data as Record<string, unknown>), _dirty: false, _open: false, _tab: 'basic' }]);
      flash('Duplicated!');
    } else flash(error?.message || 'Error');
  };

  function productToPayload(p: Draft) {
    return {
      slug: p.slug, brand_slug: p.brand_slug, category_slug: p.category_slug,
      name_he: p.name_he, name_en: p.name_en, weight: p.weight, country_origin: p.country_origin,
      featured: p.featured, active: p.active, sort_order: p.sort_order,
      main_image_url: p.main_image_url, gallery_images: p.gallery_images, videos: p.videos,
      short_description_he: p.short_description_he, short_description_en: p.short_description_en,
      description_he: p.description_he, description_en: p.description_en,
      ingredients_he: p.ingredients_he, ingredients_en: p.ingredients_en,
      nutritional_he: p.nutritional_he, nutritional_en: p.nutritional_en,
      feeding_guide_he: p.feeding_guide_he, feeding_guide_en: p.feeding_guide_en,
      package_sizes: p.package_sizes, suitable_for: p.suitable_for, life_stage: p.life_stage,
      benefits: p.benefits, files: p.files,
      seo_title_he: p.seo_title_he, seo_title_en: p.seo_title_en,
      seo_description_he: p.seo_description_he, seo_description_en: p.seo_description_en,
      og_image_url: p.og_image_url, canonical_url: p.canonical_url,
      updated_at: new Date().toISOString(),
    };
  }

  const save = async (idx: number) => {
    const p = products[idx];
    setSaving(p.id || `new-${idx}`);
    const payload = productToPayload(p);
    const { data, error } = p.id
      ? await supabase.from('cms_products').update(payload).eq('id', p.id).select().single()
      : await supabase.from('cms_products').insert(payload).select().single();
    if (!error && data) {
      setProducts((prev) => prev.map((x, i) => i === idx ? { ...x, id: data.id, _dirty: false } : x));
      flash('Saved!');
    } else flash(error?.message || 'Error');
    setSaving(null);
  };

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name_en.toLowerCase().includes(q) || p.name_he.includes(q) || p.slug.includes(q);
    const matchBrand = !filterBrand || p.brand_slug === filterBrand;
    const matchCat = !filterCat || p.category_slug === filterCat;
    return matchSearch && matchBrand && matchCat;
  });

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'basic',        label: 'Basic',        icon: Tag },
    { id: 'images',       label: 'Images',       icon: Image },
    { id: 'videos',       label: 'Videos',       icon: Film },
    { id: 'descriptions', label: 'Descriptions', icon: BookOpen },
    { id: 'details',      label: 'Details',      icon: FileText },
    { id: 'files',        label: 'Files',        icon: Folder },
    { id: 'seo',          label: 'SEO',          icon: Globe },
  ];

  if (loading) return <div className="p-8 flex items-center gap-2 text-slate-400"><Loader size={16} className="animate-spin" /> Loading...</div>;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-bold text-2xl mb-1">Products</h1>
          <p className="text-slate-400 text-sm">{products.length} products total · {filtered.length} shown</p>
        </div>
        <button onClick={() => { const p = emptyProduct(products.length); setProducts((prev) => [...prev, p]); }}
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 flex items-center gap-2 transition-colors">
          <Plus size={13} /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full bg-slate-800 border border-slate-700 text-white text-sm pl-8 pr-3 py-2 focus:outline-none focus:border-red-600" />
        </div>
        <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="bg-slate-800 border border-slate-700 text-sm text-white px-3 py-2 focus:outline-none focus:border-red-600">
          <option value="">All Brands</option>
          {allBrands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
        </select>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="bg-slate-800 border border-slate-700 text-sm text-white px-3 py-2 focus:outline-none focus:border-red-600">
          <option value="">All Categories</option>
          {allCategories.map((c) => <option key={c.slug} value={c.slug}>{c.name_en}</option>)}
        </select>
      </div>

      {msg && <div className="mb-4 bg-green-900/30 border border-green-700/40 text-green-300 text-sm px-4 py-2">{msg}</div>}

      {/* Product list */}
      <div className="space-y-2">
        {filtered.map((p) => {
          const globalIdx = products.findIndex((x) => x === p);
          return (
            <div key={p.id || `new-${globalIdx}`} className={`bg-slate-900 border ${p._dirty ? 'border-yellow-600/40' : 'border-slate-800'}`}>

              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-2.5">
                {/* Thumbnail */}
                <div className="w-10 h-10 flex-shrink-0 bg-slate-800 overflow-hidden">
                  {p.main_image_url
                    ? <img src={p.main_image_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-600"><Image size={14} /></div>}
                </div>

                <button onClick={() => openProduct(globalIdx)} className="flex-1 text-start min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white text-sm font-medium truncate">{p.name_en || p.name_he || '(new product)'}</span>
                    {p.featured && <Star size={11} className="text-yellow-400 flex-shrink-0" />}
                    {p._dirty && <span className="bg-yellow-600/20 text-yellow-400 text-xs px-1.5 py-0.5 flex-shrink-0">Unsaved</span>}
                  </div>
                  <div className="text-slate-500 text-xs mt-0.5 truncate">
                    {[p.brand_slug, p.category_slug, p.weight].filter(Boolean).join(' · ')}
                  </div>
                </button>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {p.brand_slug && p.category_slug && p.slug && (
                    <a href={`/brands/${p.brand_slug}/${p.category_slug}/${p.slug}`} target="_blank" rel="noopener noreferrer"
                      className="text-slate-600 hover:text-slate-300 p-1 transition-colors" title="Preview">
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button onClick={() => update(globalIdx, { active: !p.active })}
                    className={`${p.active ? 'text-green-400' : 'text-slate-600'} hover:opacity-80 p-1 transition-colors`}>
                    {p.active ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button onClick={() => duplicate(globalIdx)} className="text-slate-600 hover:text-slate-300 p-1 transition-colors" title="Duplicate"><Copy size={13} /></button>
                  <button onClick={() => remove(globalIdx)} className="text-slate-600 hover:text-red-400 p-1 transition-colors"><Trash2 size={13} /></button>
                  <button onClick={() => save(globalIdx)} disabled={saving !== null}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 flex items-center gap-1 transition-colors">
                    {saving === (p.id || `new-${globalIdx}`) ? <Loader size={11} className="animate-spin" /> : <Save size={11} />}
                    Save
                  </button>
                  <button onClick={() => openProduct(globalIdx)} className="text-slate-500 hover:text-white p-1 transition-colors">
                    <ChevronDown size={14} className={`transition-transform duration-200 ${p._open ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Editor (inline expand) */}
              {p._open && (
                <div className="border-t border-slate-800">
                  {/* Tab bar */}
                  <div className="flex border-b border-slate-800 px-4 overflow-x-auto">
                    {TABS.map(({ id, label, icon: Icon }) => (
                      <button key={id} onClick={() => setTab(globalIdx, id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase border-b-2 whitespace-nowrap transition-colors ${p._tab === id ? 'border-red-600 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                        <Icon size={11} /> {label}
                      </button>
                    ))}
                  </div>

                  <div className="px-5 pb-6 pt-5 space-y-5">

                    {/* ── Basic ──────────────────────────────── */}
                    {p._tab === 'basic' && <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className={LABEL}>Brand</label>
                          <select value={p.brand_slug} onChange={(e) => update(globalIdx, { brand_slug: e.target.value })} className={INPUT}>
                            <option value="">-- Select Brand --</option>
                            {allBrands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={LABEL}>Category</label>
                          <select value={p.category_slug} onChange={(e) => update(globalIdx, { category_slug: e.target.value })} className={INPUT}>
                            <option value="">-- Select Category --</option>
                            {allCategories.map((c) => <option key={c.slug} value={c.slug}>{c.name_en}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={LABEL}>Slug</label>
                          <input value={p.slug} onChange={(e) => update(globalIdx, { slug: e.target.value })} placeholder="puppy-all-breeds" className={INPUT} />
                        </div>
                        <div>
                          <label className={LABEL}>Weight</label>
                          <input value={p.weight} onChange={(e) => update(globalIdx, { weight: e.target.value })} placeholder="1kg / 3kg / 15kg" className={INPUT} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className={LABEL}>Country of Origin</label>
                          <input value={p.country_origin} onChange={(e) => update(globalIdx, { country_origin: e.target.value })} placeholder="Germany" className={INPUT} />
                        </div>
                        <div>
                          <label className={LABEL}>Life Stage</label>
                          <input value={p.life_stage} onChange={(e) => update(globalIdx, { life_stage: e.target.value })} placeholder="Puppy / Adult / Senior" className={INPUT} />
                        </div>
                        <div>
                          <label className={LABEL}>Suitable For</label>
                          <input value={p.suitable_for} onChange={(e) => update(globalIdx, { suitable_for: e.target.value })} placeholder="All Breeds" className={INPUT} />
                        </div>
                        <div className="flex flex-col gap-2 pt-5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={p.featured} onChange={(e) => update(globalIdx, { featured: e.target.checked })} className="accent-red-600" />
                            <span className="text-slate-300 text-sm">Featured product</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={p.active} onChange={(e) => update(globalIdx, { active: e.target.checked })} className="accent-red-600" />
                            <span className="text-slate-300 text-sm">Active (show on site)</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className={LABEL}>Package Sizes (one per line)</label>
                        <textarea value={p.package_sizes.join('\n')} onChange={(e) => update(globalIdx, { package_sizes: e.target.value.split('\n').filter(Boolean) })} rows={3} className={TEXTAREA} placeholder={'1kg\n3kg\n15kg'} />
                      </div>
                      <div>
                        <label className={LABEL}>Benefits (one per line)</label>
                        <textarea value={p.benefits.join('\n')} onChange={(e) => update(globalIdx, { benefits: e.target.value.split('\n').filter(Boolean) })} rows={4} className={TEXTAREA} placeholder="High protein\nGrain free\n..." />
                      </div>
                    </>}

                    {/* ── Images ─────────────────────────────── */}
                    {p._tab === 'images' && <>
                      <ImageUpload value={p.main_image_url} onChange={(url) => update(globalIdx, { main_image_url: url })} label="Main Product Image" section="products" />
                      <div>
                        <label className={LABEL}>Product Gallery</label>
                        <GalleryEditor images={p.gallery_images} onChange={(imgs) => update(globalIdx, { gallery_images: imgs })} />
                      </div>
                      <ImageUpload value={p.og_image_url} onChange={(url) => update(globalIdx, { og_image_url: url })} label="Open Graph Image (optional, falls back to main image)" section="products" />
                    </>}

                    {/* ── Videos ─────────────────────────────── */}
                    {p._tab === 'videos' && (
                      <VideoEditor videos={p.videos} onChange={(v) => update(globalIdx, { videos: v })} />
                    )}

                    {/* ── Descriptions ───────────────────────── */}
                    {p._tab === 'descriptions' && <>
                      <BilingualField label="Product Name" heValue={p.name_he} enValue={p.name_en}
                        onChangeHe={(v) => update(globalIdx, { name_he: v })} onChangeEn={(v) => update(globalIdx, { name_en: v })} />
                      <BilingualField label="Short Description" heValue={p.short_description_he} enValue={p.short_description_en}
                        onChangeHe={(v) => update(globalIdx, { short_description_he: v })} onChangeEn={(v) => update(globalIdx, { short_description_en: v })} multiline />
                      <BilingualField label="Full Description" heValue={p.description_he} enValue={p.description_en}
                        onChangeHe={(v) => update(globalIdx, { description_he: v })} onChangeEn={(v) => update(globalIdx, { description_en: v })} multiline />
                    </>}

                    {/* ── Details ────────────────────────────── */}
                    {p._tab === 'details' && <>
                      <BilingualField label="Ingredients" heValue={p.ingredients_he} enValue={p.ingredients_en}
                        onChangeHe={(v) => update(globalIdx, { ingredients_he: v })} onChangeEn={(v) => update(globalIdx, { ingredients_en: v })} multiline />
                      <BilingualField label="Nutritional Analysis" heValue={p.nutritional_he} enValue={p.nutritional_en}
                        onChangeHe={(v) => update(globalIdx, { nutritional_he: v })} onChangeEn={(v) => update(globalIdx, { nutritional_en: v })} multiline />
                      <BilingualField label="Feeding Guide" heValue={p.feeding_guide_he} enValue={p.feeding_guide_en}
                        onChangeHe={(v) => update(globalIdx, { feeding_guide_he: v })} onChangeEn={(v) => update(globalIdx, { feeding_guide_en: v })} multiline />
                    </>}

                    {/* ── Files ──────────────────────────────── */}
                    {p._tab === 'files' && (
                      <FileEditor files={p.files} onChange={(f) => update(globalIdx, { files: f })} />
                    )}

                    {/* ── SEO ────────────────────────────────── */}
                    {p._tab === 'seo' && <>
                      <BilingualField label="SEO Title" heValue={p.seo_title_he} enValue={p.seo_title_en}
                        onChangeHe={(v) => update(globalIdx, { seo_title_he: v })} onChangeEn={(v) => update(globalIdx, { seo_title_en: v })} />
                      <BilingualField label="SEO Description" heValue={p.seo_description_he} enValue={p.seo_description_en}
                        onChangeHe={(v) => update(globalIdx, { seo_description_he: v })} onChangeEn={(v) => update(globalIdx, { seo_description_en: v })} multiline />
                      <div>
                        <label className={LABEL}>Canonical URL (optional)</label>
                        <input value={p.canonical_url} onChange={(e) => update(globalIdx, { canonical_url: e.target.value })} placeholder="https://..." className={INPUT} />
                      </div>
                      {p.brand_slug && p.category_slug && p.slug && (
                        <div className="border-t border-slate-800 pt-4">
                          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Product Page URL</p>
                          <a href={`/brands/${p.brand_slug}/${p.category_slug}/${p.slug}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-mono transition-colors">
                            /brands/{p.brand_slug}/{p.category_slug}/{p.slug} <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </>}

                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Tag size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{products.length === 0 ? 'No products yet. Click "Add Product" to create one.' : 'No products match your filters.'}</p>
        </div>
      )}
    </div>
  );
}
