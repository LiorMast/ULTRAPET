import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { HeroBanner } from '../../contexts/CmsContext';
import BilingualField from '../components/BilingualField';
import ImageUpload from '../components/ImageUpload';
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Eye, EyeOff, Loader } from 'lucide-react';

type Draft = HeroBanner & { _dirty: boolean };

function empty(): Draft {
  return { id: '', title_he: '', title_en: '', subtitle_he: '', subtitle_en: '', image_url: '', sort_order: 0, active: true, _dirty: true };
}

export default function HeroEditor() {
  const [banners, setBanners] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.from('cms_hero_banners').select('*').order('sort_order').then(({ data }) => {
      if (data) setBanners(data.map((b) => ({ ...b, _dirty: false })));
      setLoading(false);
    });
  }, []);

  const update = (idx: number, patch: Partial<Draft>) => {
    setBanners((prev) => prev.map((b, i) => i === idx ? { ...b, ...patch, _dirty: true } : b));
  };

  const add = () => {
    setBanners((prev) => [...prev, { ...empty(), sort_order: prev.length }]);
  };

  const remove = async (idx: number) => {
    const b = banners[idx];
    if (b.id) await supabase.from('cms_hero_banners').delete().eq('id', b.id);
    setBanners((prev) => prev.filter((_, i) => i !== idx));
    flash('Deleted');
  };

  const move = (idx: number, dir: -1 | 1) => {
    setBanners((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((b, i) => ({ ...b, sort_order: i, _dirty: true }));
    });
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const save = async (idx: number) => {
    const b = banners[idx];
    setSaving(b.id || `new-${idx}`);
    const payload = { title_he: b.title_he, title_en: b.title_en, subtitle_he: b.subtitle_he, subtitle_en: b.subtitle_en, image_url: b.image_url, sort_order: b.sort_order, active: b.active };
    const { data, error } = b.id
      ? await supabase.from('cms_hero_banners').update(payload).eq('id', b.id).select().single()
      : await supabase.from('cms_hero_banners').insert(payload).select().single();
    if (!error && data) {
      setBanners((prev) => prev.map((x, i) => i === idx ? { ...x, id: data.id, _dirty: false } : x));
      flash('Saved!');
    } else { flash(error?.message || 'Error'); }
    setSaving(null);
  };

  if (loading) return <div className="p-8 flex items-center gap-2 text-slate-400"><Loader size={16} className="animate-spin" /> Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-bold text-2xl mb-1">Hero Banners</h1>
          <p className="text-slate-400 text-sm">Manage the homepage slideshow images and text.</p>
        </div>
        <button onClick={add} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 flex items-center gap-2 transition-colors">
          <Plus size={13} /> Add Banner
        </button>
      </div>

      {msg && <div className="mb-4 bg-green-900/30 border border-green-700/40 text-green-300 text-sm px-4 py-2">{msg}</div>}

      <div className="space-y-4">
        {banners.map((b, i) => (
          <div key={b.id || `new-${i}`} className={`bg-slate-900 border ${b._dirty ? 'border-yellow-600/40' : 'border-slate-800'} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs font-mono">#{i + 1}</span>
                {b._dirty && <span className="bg-yellow-600/20 text-yellow-400 text-xs px-2 py-0.5">Unsaved</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => update(i, { active: !b.active })} className={`${b.active ? 'text-green-400 hover:text-green-300' : 'text-slate-600 hover:text-slate-400'} transition-colors`} title={b.active ? 'Active' : 'Hidden'}>
                  {b.active ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors"><ChevronUp size={15} /></button>
                <button onClick={() => move(i, 1)} disabled={i === banners.length - 1} className="text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors"><ChevronDown size={15} /></button>
                <button onClick={() => remove(i)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
                <button onClick={() => save(i)} disabled={saving !== null}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 transition-colors">
                  {saving === (b.id || `new-${i}`) ? <Loader size={11} className="animate-spin" /> : <Save size={11} />}
                  Save
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <BilingualField label="Title" heValue={b.title_he} enValue={b.title_en} onChangeHe={(v) => update(i, { title_he: v })} onChangeEn={(v) => update(i, { title_en: v })} />
                <BilingualField label="Subtitle" heValue={b.subtitle_he} enValue={b.subtitle_en} onChangeHe={(v) => update(i, { subtitle_he: v })} onChangeEn={(v) => update(i, { subtitle_en: v })} multiline />
              </div>
              <ImageUpload value={b.image_url} onChange={(url) => update(i, { image_url: url })} label="Banner Image" section="hero" />
            </div>
          </div>
        ))}

        {banners.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 p-12 text-center text-slate-500">
            No banners yet. <button onClick={add} className="text-red-400 hover:text-red-300 underline">Add one</button>
          </div>
        )}
      </div>
    </div>
  );
}
