import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import BilingualField from '../components/BilingualField';
import { Save, Loader } from 'lucide-react';

interface StatRow {
  key: string;
  label: string;
  value: string;
  suffix: string;
  labelHe: string;
  labelEn: string;
  descHe: string;
  descEn: string;
}

const STAT_KEYS = [
  { key: 'retail', label: 'Retail Locations', defaultValue: '300', defaultSuffix: '+' },
  { key: 'partners', label: 'Manufacturing Partners', defaultValue: '15', defaultSuffix: '+' },
  { key: 'products', label: 'Products', defaultValue: '1000', defaultSuffix: '+' },
  { key: 'years', label: 'Years in Industry', defaultValue: '12', defaultSuffix: '+' },
];

export default function StatsEditor() {
  const [rows, setRows] = useState<StatRow[]>(
    STAT_KEYS.map((k) => ({ key: k.key, label: k.label, value: k.defaultValue, suffix: k.defaultSuffix, labelHe: '', labelEn: '', descHe: '', descEn: '' }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('cms_settings').select('*'),
      supabase.from('cms_text_blocks').select('*').eq('section', 'stats'),
    ]).then(([settingsRes, textRes]) => {
      setRows((prev) => prev.map((r) => {
        const settings = settingsRes.data || [];
        const texts = textRes.data || [];
        const val = settings.find((s: {key:string}) => s.key === `stat_${r.key}_value`)?.value;
        const suf = settings.find((s: {key:string}) => s.key === `stat_${r.key}_suffix`)?.value;

        const getLang = (lang: string, field: string) =>
          texts.find((t: {lang:string; field_key:string}) => t.lang === lang && t.field_key === field)?.value || '';

        return {
          ...r,
          value: val ?? r.value,
          suffix: suf ?? r.suffix,
          labelHe: getLang('he', `${r.key}Label`),
          labelEn: getLang('en', `${r.key}Label`),
          descHe: getLang('he', `${r.key}Desc`),
          descEn: getLang('en', `${r.key}Desc`),
        };
      }));
      setLoading(false);
    });
  }, []);

  const update = (idx: number, patch: Partial<StatRow>) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const saveAll = async () => {
    setSaving(true);
    const settingsUpserts = rows.flatMap((r) => [
      { key: `stat_${r.key}_value`, value: r.value },
      { key: `stat_${r.key}_suffix`, value: r.suffix },
    ]);
    const textUpserts = rows.flatMap((r) => [
      { lang: 'he', section: 'stats', field_key: `${r.key}Label`, value: r.labelHe },
      { lang: 'en', section: 'stats', field_key: `${r.key}Label`, value: r.labelEn },
      { lang: 'he', section: 'stats', field_key: `${r.key}Desc`, value: r.descHe },
      { lang: 'en', section: 'stats', field_key: `${r.key}Desc`, value: r.descEn },
    ]).filter((t) => t.value.trim());

    await Promise.all([
      supabase.from('cms_settings').upsert(settingsUpserts, { onConflict: 'key' }),
      textUpserts.length ? supabase.from('cms_text_blocks').upsert(textUpserts, { onConflict: 'lang,section,field_key' }) : Promise.resolve(),
    ]);
    setSaving(false);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 2500);
  };

  if (loading) return <div className="p-8 flex items-center gap-2 text-slate-400"><Loader size={16} className="animate-spin" /> Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-bold text-2xl mb-1">Statistics</h1>
          <p className="text-slate-400 text-sm">Edit the company numbers shown in the stats section.</p>
        </div>
        <button onClick={saveAll} disabled={saving} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 flex items-center gap-2 transition-colors">
          {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
          Save All
        </button>
      </div>

      {msg && <div className="mb-4 bg-green-900/30 border border-green-700/40 text-green-300 text-sm px-4 py-2">{msg}</div>}

      <div className="space-y-6">
        {rows.map((r, i) => (
          <div key={r.key} className="bg-slate-900 border border-slate-800 p-6">
            <h3 className="text-white font-semibold text-sm mb-5 flex items-center gap-2">
              <span className="bg-red-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center">{i + 1}</span>
              {r.label}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-slate-400 text-xs font-semibold tracking-wide uppercase mb-2">Number</label>
                <input type="text" value={r.value} onChange={(e) => update(i, { value: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-600" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-semibold tracking-wide uppercase mb-2">Suffix</label>
                <input type="text" value={r.suffix} onChange={(e) => update(i, { suffix: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-600" />
              </div>
            </div>

            <div className="space-y-4">
              <BilingualField label="Label" heValue={r.labelHe} enValue={r.labelEn} onChangeHe={(v) => update(i, { labelHe: v })} onChangeEn={(v) => update(i, { labelEn: v })} hint="Leave blank to use default" />
              <BilingualField label="Description" heValue={r.descHe} enValue={r.descEn} onChangeHe={(v) => update(i, { descHe: v })} onChangeEn={(v) => update(i, { descEn: v })} multiline hint="Leave blank to use default" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
