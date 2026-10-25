import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, Link, X, Image } from 'lucide-react';

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  section?: string;
  compact?: boolean;
}

export default function ImageUpload({ value, onChange, label = 'Image', section = 'general', compact = false }: Props) {
  const [mode, setMode] = useState<'preview' | 'url'>('preview');
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError('');
    const ext = file.name.split('.').pop();
    const path = `${section}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('cms-media').upload(path, file, { upsert: true });
    if (upErr) { setError(upErr.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('cms-media').getPublicUrl(path);

    await supabase.from('cms_media').insert({
      filename: file.name,
      storage_path: path,
      public_url: publicUrl,
      mime_type: file.type,
      size_bytes: file.size,
      section,
    });

    onChange(publicUrl);
    setUploading(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
  };

  const applyUrl = () => {
    if (urlInput.trim()) { onChange(urlInput.trim()); setMode('preview'); }
  };

  return (
    <div>
      {!compact && <label className="block text-slate-300 text-xs font-semibold tracking-wide uppercase mb-2">{label}</label>}
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      {mode === 'url' ? (
        <div className="flex gap-2">
          <input
            type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://..."
            className="flex-1 bg-slate-900 border border-slate-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-600"
          />
          <button onClick={applyUrl} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-semibold transition-colors">Apply</button>
          <button onClick={() => setMode('preview')} className="text-slate-400 hover:text-white px-2 transition-colors"><X size={14} /></button>
        </div>
      ) : (
        <div className="relative group">
          {value ? (
            <div className="relative">
              <img src={value} alt="" className="w-full h-40 object-cover border border-slate-700" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button onClick={() => inputRef.current?.click()} className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 flex items-center gap-1 transition-colors">
                  <Upload size={12} /> Upload
                </button>
                <button onClick={() => { setUrlInput(''); setMode('url'); }} className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 flex items-center gap-1 transition-colors">
                  <Link size={12} /> URL
                </button>
                <button onClick={() => onChange('')} className="bg-red-600/80 hover:bg-red-600 text-white text-xs px-3 py-1.5 flex items-center gap-1 transition-colors">
                  <X size={12} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed border-slate-700 hover:border-slate-500 ${compact ? 'h-full min-h-[80px]' : 'h-40'} flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group/drop`}
            >
              {uploading ? (
                <div className="w-6 h-6 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Image size={24} className="text-slate-600 group-hover/drop:text-slate-400 transition-colors" />
                  <span className="text-slate-500 text-xs">Click to upload</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setUrlInput(''); setMode('url'); }}
                    className="text-slate-600 hover:text-slate-400 text-xs flex items-center gap-1 transition-colors mt-1"
                  >
                    <Link size={11} /> Or use URL
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
