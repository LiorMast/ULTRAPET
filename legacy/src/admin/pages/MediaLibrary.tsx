import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CmsMedia } from '../../contexts/CmsContext';
import { Upload, Trash2, Copy, Check, Loader, Image } from 'lucide-react';

export default function MediaLibrary() {
  const [media, setMedia] = useState<CmsMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    supabase.from('cms_media').select('*').order('uploaded_at', { ascending: false }).then(({ data }) => {
      if (data) setMedia(data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `general/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('cms-media').upload(path, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('cms-media').getPublicUrl(path);
        await supabase.from('cms_media').insert({ filename: file.name, storage_path: path, public_url: publicUrl, mime_type: file.type, size_bytes: file.size, section: 'general' });
      }
    }
    load();
    setUploading(false);
  };

  const remove = async (item: CmsMedia) => {
    await supabase.storage.from('cms-media').remove([item.storage_path]);
    await supabase.from('cms_media').delete().eq('id', item.id);
    setMedia((prev) => prev.filter((m) => m.id !== item.id));
  };

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    upload(e.dataTransfer.files);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-bold text-2xl mb-1">Media Library</h1>
          <p className="text-slate-400 text-sm">Upload and manage images for your website.</p>
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 flex items-center gap-2 transition-colors">
          {uploading ? <Loader size={13} className="animate-spin" /> : <Upload size={13} />}
          Upload
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-slate-700 hover:border-slate-500 transition-colors p-8 text-center mb-6 cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <Image size={24} className="text-slate-600 mx-auto mb-2" />
        <p className="text-slate-500 text-sm">Drop images here or click to upload</p>
        {uploading && <div className="mt-3 flex items-center justify-center gap-2 text-slate-400 text-xs"><Loader size={12} className="animate-spin" /> Uploading...</div>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400"><Loader size={16} className="animate-spin" /> Loading...</div>
      ) : media.length === 0 ? (
        <p className="text-slate-500 text-sm">No media uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {media.map((m) => (
            <div key={m.id} className="group bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="relative h-32">
                <img src={m.public_url} alt={m.filename} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => copy(m.public_url)} className="bg-white/20 hover:bg-white/30 text-white p-1.5 transition-colors" title="Copy URL">
                    {copied === m.public_url ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  <button onClick={() => remove(m)} className="bg-red-600/80 hover:bg-red-600 text-white p-1.5 transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="px-2 py-1.5">
                <p className="text-slate-400 text-xs truncate">{m.filename}</p>
                <p className="text-slate-600 text-xs">{(m.size_bytes / 1024).toFixed(0)} KB</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
