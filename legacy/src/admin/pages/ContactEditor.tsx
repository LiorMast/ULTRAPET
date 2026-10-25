import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Loader } from 'lucide-react';

const FIELDS = [
  { key: 'phone', label: 'Phone', placeholder: '+972 3 000 0000', type: 'tel' },
  { key: 'email', label: 'Email', placeholder: 'info@ultrapetisrael.co.il', type: 'email' },
  { key: 'whatsapp', label: 'WhatsApp (digits only)', placeholder: '972501234567', type: 'text' },
  { key: 'location', label: 'Location', placeholder: 'Industrial Zone, Israel', type: 'text' },
  { key: 'hours', label: 'Hours', placeholder: 'Sun–Thu, 8am–5pm', type: 'text' },
];

export default function ContactEditor() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.from('cms_contact').select('*').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: { field_key: string; value: string }) => { map[r.field_key] = r.value; });
        setValues(map);
      }
      setLoading(false);
    });
  }, []);

  const saveAll = async () => {
    setSaving(true);
    const upserts = FIELDS.map((f) => ({ field_key: f.key, value: values[f.key] || '', label: f.label }));
    await supabase.from('cms_contact').upsert(upserts, { onConflict: 'field_key' });
    setSaving(false);
    setMsg('Saved!');
    setTimeout(() => setMsg(''), 2500);
  };

  if (loading) return <div className="p-8 flex items-center gap-2 text-slate-400"><Loader size={16} className="animate-spin" /> Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-bold text-2xl mb-1">Contact Info</h1>
          <p className="text-slate-400 text-sm">Update the contact details shown on the website.</p>
        </div>
        <button onClick={saveAll} disabled={saving} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 flex items-center gap-2 transition-colors">
          {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
          Save
        </button>
      </div>

      {msg && <div className="mb-4 bg-green-900/30 border border-green-700/40 text-green-300 text-sm px-4 py-2">{msg}</div>}

      <div className="bg-slate-900 border border-slate-800 p-6 space-y-5 max-w-xl">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-slate-300 text-xs font-semibold tracking-wide uppercase mb-2">{f.label}</label>
            <input
              type={f.type}
              value={values[f.key] || ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-red-600 transition-colors placeholder-slate-600"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
