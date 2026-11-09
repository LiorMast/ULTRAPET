import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CmsSection } from '../../contexts/CmsContext';
import { Save, Loader, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';

export default function SectionsEditor() {
  const [sections, setSections] = useState<CmsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.from('cms_sections').select('*').order('sort_order').then(({ data }) => {
      if (data) setSections(data);
      setLoading(false);
    });
  }, []);

  const move = (idx: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((s, i) => ({ ...s, sort_order: i }));
    });
  };

  const toggle = (idx: number) => {
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, visible: !s.visible } : s));
  };

  const saveAll = async () => {
    setSaving(true);
    await Promise.all(sections.map((s) =>
      supabase.from('cms_sections').update({ sort_order: s.sort_order, visible: s.visible }).eq('id', s.id)
    ));
    setSaving(false);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 2500);
  };

  if (loading) return <div className="p-8 flex items-center gap-2 text-slate-400"><Loader size={16} className="animate-spin" /> Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-bold text-2xl mb-1">Section Order</h1>
          <p className="text-slate-400 text-sm">Reorder homepage sections and show/hide them.</p>
        </div>
        <button onClick={saveAll} disabled={saving} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 flex items-center gap-2 transition-colors">
          {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
          Save Order
        </button>
      </div>

      {msg && <div className="mb-4 bg-green-900/30 border border-green-700/40 text-green-300 text-sm px-4 py-2">{msg}</div>}

      <div className="max-w-md space-y-2">
        {sections.map((s, i) => (
          <div key={s.id} className={`bg-slate-900 border ${s.visible ? 'border-slate-800' : 'border-slate-800/40'} flex items-center gap-3 px-4 py-3`}>
            <span className="text-slate-600 text-xs font-mono w-5 text-center">{i + 1}</span>
            <span className={`flex-1 text-sm font-medium ${s.visible ? 'text-white' : 'text-slate-600'}`}>{s.label_en}</span>
            <span className="font-mono text-xs text-slate-600">{s.slug}</span>
            <button onClick={() => toggle(i)} className={`transition-colors ${s.visible ? 'text-green-400 hover:text-green-300' : 'text-slate-600 hover:text-slate-400'}`} title={s.visible ? 'Visible' : 'Hidden'}>
              {s.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors"><ChevronUp size={14} /></button>
            <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors"><ChevronDown size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
