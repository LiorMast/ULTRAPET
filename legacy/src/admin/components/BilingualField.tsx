interface Props {
  label: string;
  fieldKey?: string;
  heValue: string;
  enValue: string;
  onChangeHe: (v: string) => void;
  onChangeEn: (v: string) => void;
  multiline?: boolean;
  isArray?: boolean;
  hint?: string;
}

export default function BilingualField({ label, heValue, enValue, onChangeHe, onChangeEn, multiline, isArray, hint }: Props) {
  const rows = isArray ? 5 : multiline ? 3 : 1;
  const Tag = (rows > 1 ? 'textarea' : 'input') as 'textarea' | 'input';
  const base = 'w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-600 text-sm px-3 py-2 focus:outline-none focus:border-red-600 transition-colors resize-none';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-slate-300 text-xs font-semibold tracking-wide uppercase">{label}</label>
        {hint && <span className="text-slate-600 text-xs">{hint}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-slate-500 text-xs mb-1">Hebrew</div>
          <Tag
            dir="rtl"
            value={heValue}
            onChange={(e) => onChangeHe(e.target.value)}
            placeholder="עברית..."
            rows={rows}
            className={base}
            {...(Tag === 'input' ? {} : {})}
          />
        </div>
        <div>
          <div className="text-slate-500 text-xs mb-1">English</div>
          <Tag
            dir="ltr"
            value={enValue}
            onChange={(e) => onChangeEn(e.target.value)}
            placeholder="English..."
            rows={rows}
            className={base}
            {...(Tag === 'input' ? {} : {})}
          />
        </div>
      </div>
      {isArray && <p className="text-slate-600 text-xs mt-1">One item per line</p>}
    </div>
  );
}
