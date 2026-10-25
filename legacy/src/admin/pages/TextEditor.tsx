import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { en } from '../../lib/translations/en';
import { he } from '../../lib/translations/he';
import ImageUpload from '../components/ImageUpload';
import { Save, Loader } from 'lucide-react';

interface Props {
  section: string;
  onSectionChange: (s: string) => void;
}

const SECTIONS = ['hero', 'stats', 'brands', 'categories', 'privateLabel', 'business', 'about', 'contact', 'footer', 'nav', 'siteIdentity'];

type FieldValues = Record<string, { he: string; en: string }>;

// Naming-convention-based field type detection
function fieldType(key: string): 'image' | 'toggle' | 'number' | 'bilingual' {
  if (key.endsWith('Url') || key.endsWith('URL') || key.endsWith('ImageUrl')) return 'image';
  if (key.startsWith('show') || key.startsWith('hide') || key.startsWith('enable')) return 'toggle';
  if (key.endsWith('Width') || key.endsWith('Height') || key.endsWith('Size')) return 'number';
  return 'bilingual';
}

function toEditableValue(v: unknown): string {
  if (Array.isArray(v)) return v.join('\n');
  if (typeof v === 'string') return v;
  return '';
}

export default function TextEditor({ section, onSectionChange }: Props) {
  const [fields, setFields] = useState<FieldValues>({});
  const [defaults, setDefaults] = useState<Record<string, { he: string; en: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    const enSec = (en as Record<string, unknown>)[section];
    const heSec = (he as Record<string, unknown>)[section];
    if (!enSec || typeof enSec !== 'object') { setLoading(false); return; }

    const defs: Record<string, { he: string; en: string }> = {};
    const init: FieldValues = {};
    for (const key of Object.keys(enSec as object)) {
      const eVal = (enSec as Record<string, unknown>)[key];
      const hVal = heSec && typeof heSec === 'object' ? (heSec as Record<string, unknown>)[key] : undefined;
      defs[key] = { en: toEditableValue(eVal), he: toEditableValue(hVal) };
      init[key] = { en: toEditableValue(eVal), he: toEditableValue(hVal) };
    }
    setDefaults(defs);

    supabase.from('cms_text_blocks').select('*').eq('section', section).then(({ data }) => {
      const overrides = { ...init };
      if (data) {
        data.forEach((r: { lang: string; field_key: string; value: string }) => {
          if (r.field_key in overrides) {
            const parsed = r.value.startsWith('[') ? JSON.parse(r.value).join('\n') : r.value;
            overrides[r.field_key] = { ...overrides[r.field_key], [r.lang]: parsed };
          }
        });
      }
      setFields(overrides);
      setLoading(false);
    });
  }, [section]);

  const update = (key: string, lang: 'he' | 'en', value: string) => {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], [lang]: value } }));
  };

  // For language-agnostic fields (image, toggle, number) — sync both langs
  const updateShared = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: { he: value, en: value } }));
  };

  const isArrayField = (key: string) => {
    const enSec = (en as Record<string, unknown>)[section];
    if (!enSec || typeof enSec !== 'object') return false;
    return Array.isArray((enSec as Record<string, unknown>)[key]);
  };

  const saveAll = async () => {
    setSaving(true);
    const upserts = Object.entries(fields).flatMap(([key, vals]) => {
      const arrayField = isArrayField(key);
      const heVal = arrayField ? JSON.stringify(vals.he.split('\n').filter(Boolean)) : vals.he;
      const enVal = arrayField ? JSON.stringify(vals.en.split('\n').filter(Boolean)) : vals.en;
      return [
        { lang: 'he', section, field_key: key, value: heVal },
        { lang: 'en', section, field_key: key, value: enVal },
      ];
    });
    await supabase.from('cms_text_blocks').upsert(upserts, { onConflict: 'lang,section,field_key' });
    setSaving(false);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 2500);
  };

  const reset = async (key: string) => {
    setFields((prev) => ({ ...prev, [key]: defaults[key] }));
    await supabase.from('cms_text_blocks').delete().eq('section', section).eq('field_key', key);
    setMsg('Reset to default');
    setTimeout(() => setMsg(''), 2500);
  };

  const base = 'w-full bg-slate-900 border border-slate-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-600 transition-colors resize-none';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-bold text-2xl mb-1">Text Content</h1>
          <p className="text-slate-400 text-sm">Edit website text in Hebrew and English.</p>
        </div>
        <button onClick={saveAll} disabled={saving} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 flex items-center gap-2 transition-colors">
          {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
          Save All
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-slate-900 border border-slate-800 p-2">
        {SECTIONS.map((s) => (
          <button key={s} onClick={() => onSectionChange(s)}
            className={`px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${s === section ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {msg && <div className="mb-4 bg-green-900/30 border border-green-700/40 text-green-300 text-sm px-4 py-2">{msg}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400"><Loader size={16} className="animate-spin" /> Loading...</div>
      ) : (
        <div className="space-y-4">
          {Object.keys(fields).map((key) => {
            const type = fieldType(key);
            const sharedVal = fields[key].en; // canonical value for shared fields

            return (
              <div key={key} className="bg-slate-900 border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-slate-300 text-xs font-mono">{key}</label>
                  <button onClick={() => reset(key)} className="text-slate-600 hover:text-slate-400 text-xs transition-colors">Reset</button>
                </div>

                {type === 'image' && (
                  <ImageUpload
                    value={sharedVal}
                    onChange={(url) => updateShared(key, url)}
                    label=""
                    section={section}
                  />
                )}

                {type === 'toggle' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sharedVal === 'true'}
                      onChange={(e) => updateShared(key, e.target.checked ? 'true' : 'false')}
                      className="w-4 h-4 accent-red-600"
                    />
                    <span className="text-slate-300 text-sm">Enabled</span>
                  </label>
                )}

                {type === 'number' && (
                  <input
                    type="number"
                    value={sharedVal}
                    onChange={(e) => updateShared(key, e.target.value)}
                    className={`${base} max-w-xs`}
                    min={1}
                  />
                )}

                {type === 'bilingual' && (() => {
                  const arrayField = isArrayField(key);
                  const rows = arrayField ? 5 : fields[key].en.length > 80 ? 3 : 1;
                  const Tag = (rows > 1 ? 'textarea' : 'input') as 'textarea' | 'input';
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-slate-500 text-xs mb-1">Hebrew</div>
                          <Tag dir="rtl" value={fields[key].he} onChange={(e) => update(key, 'he', e.target.value)} rows={rows} className={base} placeholder="עברית..." />
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs mb-1">English</div>
                          <Tag dir="ltr" value={fields[key].en} onChange={(e) => update(key, 'en', e.target.value)} rows={rows} className={base} placeholder="English..." />
                        </div>
                      </div>
                      {arrayField && <p className="text-slate-600 text-xs mt-1">One item per line</p>}
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
