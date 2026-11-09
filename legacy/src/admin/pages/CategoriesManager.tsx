import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CmsCategory } from '../../contexts/CmsContext';
import BilingualField from '../components/BilingualField';
import ImageUpload from '../components/ImageUpload';
import {
  Plus, Trash2, Save, ChevronDown as Expand,
  Loader, Eye, EyeOff, GripVertical, Tag, Globe, Link2,
} from 'lucide-react';

type Draft = CmsCategory & { _dirty: boolean; _open: boolean; _tab: 'info' | 'brands' | 'seo' };

const KNOWN_BRANDS = [
  { slug: 'ultra-pet', name: 'Ultra Pet' },
  { slug: 'internutri', name: 'Internutri' },
  { slug: 'greenheart', name: 'Greenheart Premiums' },
  { slug: 'paw', name: 'Paw' },
  { slug: 'jr-farm', name: 'JR Farm' },
  { slug: 'ultra-clean', name: 'Ultra Clean' },
];

function newCat(order: number): Draft {
  return {
    id: '', slug: '', name_he: '', name_en: '', description_he: '', description_en: '',
    image_url: '', sku_count: 0, sort_order: order, active: true,
    icon: '', color: '',
    seo_title_he: '', seo_title_en: '', seo_description_he: '', seo_description_en: '',
    brand_slugs: [],
    _dirty: true, _open: true, _tab: 'info',
  };
}

const INPUT = 'w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-600 transition-colors';
const LABEL = 'block text-slate-400 text-xs font-semibold tracking-wide uppercase mb-2';

export default function CategoriesManager() {
  const [cats, setCats] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [allBrandSlugs, setAllBrandSlugs] = useState<{ slug: string; name: string }[]>(KNOWN_BRANDS);

  // Drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('cms_categories').select('*').order('sort_order'),
      supabase.from('cms_brands').select('slug,name').eq('active', true).order('sort_order'),
    ]).then(([catsRes, brandsRes]) => {
      if (catsRes.data) {
        setCats(catsRes.data.map((c) => ({
          ...c,
          icon: c.icon ?? '',
          color: c.color ?? '',
          seo_title_he: c.seo_title_he ?? '',
          seo_title_en: c.seo_title_en ?? '',
          seo_description_he: c.seo_description_he ?? '',
          seo_description_en: c.seo_description_en ?? '',
          brand_slugs: Array.isArray(c.brand_slugs) ? c.brand_slugs : [],
          _dirty: false, _open: false, _tab: 'info',
        })));
      }
      if (brandsRes.data && brandsRes.data.length > 0) {
        setAllBrandSlugs(brandsRes.data as { slug: string; name: string }[]);
      }
      setLoading(false);
    });
  }, []);

  const update = (idx: number, patch: Partial<Draft>) =>
    setCats((prev) => prev.map((c, i) => i === idx ? { ...c, ...patch, _dirty: true } : c));

  const toggle = (idx: number) =>
    setCats((prev) => prev.map((c, i) => i === idx ? { ...c, _open: !c._open } : c));

  const setTab = (idx: number, tab: Draft['_tab']) =>
    setCats((prev) => prev.map((c, i) => i === idx ? { ...c, _tab: tab } : c));

  const remove = async (idx: number) => {
    const c = cats[idx];
    if (c.id) await supabase.from('cms_categories').delete().eq('id', c.id);
    setCats((prev) => prev.filter((_, i) => i !== idx));
    flash('Deleted');
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const toggleBrand = (idx: number, bSlug: string) => {
    const current = cats[idx].brand_slugs;
    const next = current.includes(bSlug) ? current.filter((s) => s !== bSlug) : [...current, bSlug];
    update(idx, { brand_slugs: next });
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const onDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === i) { setDragOver(null); dragIdx.current = null; return; }
    setCats((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      return next.map((c, idx) => ({ ...c, sort_order: idx, _dirty: true }));
    });
    dragIdx.current = null;
    setDragOver(null);
  };
  const onDragEnd = () => { dragIdx.current = null; setDragOver(null); };

  // ── Save ───────────────────────────────────────────────────────────────────
  const save = async (idx: number) => {
    const c = cats[idx];
    setSaving(c.id || `new-${idx}`);
    const payload = {
      slug: c.slug, name_he: c.name_he, name_en: c.name_en,
      description_he: c.description_he, description_en: c.description_en,
      image_url: c.image_url, sku_count: c.sku_count, sort_order: c.sort_order, active: c.active,
      icon: c.icon, color: c.color,
      seo_title_he: c.seo_title_he, seo_title_en: c.seo_title_en,
      seo_description_he: c.seo_description_he, seo_description_en: c.seo_description_en,
      brand_slugs: c.brand_slugs,
    };
    const { data, error } = c.id
      ? await supabase.from('cms_categories').update(payload).eq('id', c.id).select().single()
      : await supabase.from('cms_categories').insert(payload).select().single();
    if (!error && data) {
      setCats((prev) => prev.map((x, i) => i === idx ? { ...x, id: data.id, _dirty: false } : x));
      flash('Saved!');
    } else { flash(error?.message || 'Error'); }
    setSaving(null);
  };

  const saveAll = async () => {
    for (let i = 0; i < cats.length; i++) {
      if (cats[i]._dirty) await save(i);
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center gap-2 text-slate-400"><Loader size={16} className="animate-spin" /> Loading...</div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-bold text-2xl mb-1">Categories</h1>
          <p className="text-slate-400 text-sm">Manage product categories, brand assignments, and SEO. Drag rows to reorder.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={saveAll} className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-4 py-2.5 flex items-center gap-2 transition-colors">
            <Save size={13} /> Save All
          </button>
          <button onClick={() => setCats((prev) => [...prev, newCat(prev.length)])}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 flex items-center gap-2 transition-colors">
            <Plus size={13} /> Add Category
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 bg-green-900/30 border border-green-700/40 text-green-300 text-sm px-4 py-2">{msg}</div>}

      <div className="space-y-2">
        {cats.map((c, i) => (
          <div
            key={c.id || `new-${i}`}
            className={`bg-slate-900 border transition-all duration-150 ${c._dirty ? 'border-yellow-600/40' : 'border-slate-800'} ${dragOver === i ? 'border-red-500/60 bg-slate-800' : ''}`}
            onDragOver={(e) => onDragOver(e, i)}
            onDrop={(e) => onDrop(e, i)}
          >
            {/* Row header */}
            <div className="flex items-center gap-2 px-4 py-2.5">
              {/* Drag handle */}
              <div
                draggable
                onDragStart={() => onDragStart(i)}
                onDragEnd={onDragEnd}
                className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing p-1 flex-shrink-0"
              >
                <GripVertical size={14} />
              </div>

              {/* Color swatch */}
              <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white/10"
                style={{ backgroundColor: c.color || '#64748b' }} />

              <button onClick={() => toggle(i)} className="flex items-center gap-2 flex-1 text-start min-w-0">
                <span className="text-white text-sm font-medium truncate">{c.name_en || c.name_he || '(new category)'}</span>
                {c.brand_slugs.length > 0 && (
                  <span className="text-slate-500 text-xs hidden sm:block flex-shrink-0">
                    {c.brand_slugs.slice(0, 2).join(', ')}{c.brand_slugs.length > 2 ? ` +${c.brand_slugs.length - 2}` : ''}
                  </span>
                )}
                {c._dirty && <span className="bg-yellow-600/20 text-yellow-400 text-xs px-2 py-0.5 flex-shrink-0">Unsaved</span>}
              </button>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => update(i, { active: !c.active })}
                  className={`${c.active ? 'text-green-400' : 'text-slate-600'} hover:opacity-80 transition-colors p-1`}>
                  {c.active ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => remove(i)} className="text-slate-600 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                <button onClick={() => save(i)} disabled={saving !== null}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 flex items-center gap-1 transition-colors">
                  {saving === (c.id || `new-${i}`) ? <Loader size={11} className="animate-spin" /> : <Save size={11} />}
                  Save
                </button>
                <button onClick={() => toggle(i)} className="text-slate-500 hover:text-white p-1 transition-colors">
                  <Expand size={14} className={`transition-transform duration-200 ${c._open ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Expanded form */}
            {c._open && (
              <div className="border-t border-slate-800">
                {/* Tabs */}
                <div className="flex border-b border-slate-800 px-4">
                  {([
                    { id: 'info',   label: 'Category Info',  icon: Tag },
                    { id: 'brands', label: 'Brand Assignment', icon: Link2 },
                    { id: 'seo',    label: 'SEO',             icon: Globe },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(i, id)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase border-b-2 transition-colors ${c._tab === id ? 'border-red-600 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                      <Icon size={11} /> {label}
                    </button>
                  ))}
                </div>

                <div className="px-5 pb-6 pt-5 space-y-5">

                  {/* ── Info tab ─────────────────────────────── */}
                  {c._tab === 'info' && <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className={LABEL}>Slug</label>
                        <input value={c.slug} onChange={(e) => update(i, { slug: e.target.value })} placeholder="dog-food" className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>SKU Count</label>
                        <input type="number" value={c.sku_count} onChange={(e) => update(i, { sku_count: parseInt(e.target.value) || 0 })} className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>Color</label>
                        <div className="flex gap-2">
                          <input type="color" value={c.color || '#64748b'} onChange={(e) => update(i, { color: e.target.value })} className="h-9 w-12 bg-slate-800 border border-slate-700 cursor-pointer" />
                          <input value={c.color} onChange={(e) => update(i, { color: e.target.value })} placeholder="#BE1E24" className={`flex-1 ${INPUT} font-mono`} />
                        </div>
                      </div>
                      <div>
                        <label className={LABEL}>Icon (emoji or text)</label>
                        <input value={c.icon} onChange={(e) => update(i, { icon: e.target.value })} placeholder="🐕 or icon name" className={INPUT} />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={c.active} onChange={(e) => update(i, { active: e.target.checked })} className="accent-red-600" />
                      <span className="text-slate-300 text-sm">Active (show on site)</span>
                    </label>

                    <BilingualField label="Category Name"
                      heValue={c.name_he} enValue={c.name_en}
                      onChangeHe={(v) => update(i, { name_he: v })} onChangeEn={(v) => update(i, { name_en: v })} />
                    <BilingualField label="Description"
                      heValue={c.description_he} enValue={c.description_en}
                      onChangeHe={(v) => update(i, { description_he: v })} onChangeEn={(v) => update(i, { description_en: v })} multiline />
                    <ImageUpload value={c.image_url} onChange={(url) => update(i, { image_url: url })} label="Category Image" section="categories" />
                  </>}

                  {/* ── Brands tab ────────────────────────────── */}
                  {c._tab === 'brands' && (
                    <div>
                      <p className="text-slate-400 text-sm mb-4">
                        Assign this category to one or more brands. It will appear on each selected brand's landing page.
                      </p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {allBrandSlugs.map((b) => {
                          const checked = c.brand_slugs.includes(b.slug);
                          return (
                            <label key={b.slug}
                              className={`flex items-center gap-3 px-4 py-3 border cursor-pointer transition-all ${checked ? 'border-red-600/50 bg-red-900/10' : 'border-slate-700 hover:border-slate-600'}`}>
                              <input type="checkbox" checked={checked}
                                onChange={() => toggleBrand(i, b.slug)} className="accent-red-600 flex-shrink-0" />
                              <span className="text-slate-300 text-sm">{b.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      {c.brand_slugs.length > 0 && (
                        <p className="text-slate-500 text-xs mt-3">
                          Assigned to: {c.brand_slugs.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── SEO tab ───────────────────────────────── */}
                  {c._tab === 'seo' && <>
                    <BilingualField label="SEO Title"
                      heValue={c.seo_title_he} enValue={c.seo_title_en}
                      onChangeHe={(v) => update(i, { seo_title_he: v })} onChangeEn={(v) => update(i, { seo_title_en: v })} />
                    <BilingualField label="SEO Description"
                      heValue={c.seo_description_he} enValue={c.seo_description_en}
                      onChangeHe={(v) => update(i, { seo_description_he: v })} onChangeEn={(v) => update(i, { seo_description_en: v })} multiline />
                  </>}

                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {cats.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Tag size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No categories yet. Click "Add Category" to create one.</p>
        </div>
      )}
    </div>
  );
}
