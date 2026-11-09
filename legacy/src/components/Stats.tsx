import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCms } from '../contexts/CmsContext';

function Counter({ to, suffix, run }: { to: number; suffix: string; run: boolean }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf: number;
    const start = performance.now();
    const duration = 2400;
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setVal(Math.round(ease(t) * to));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return <>{val.toLocaleString()}{suffix}</>;
}

export default function Stats() {
  const { t } = useLanguage();
  const { settings } = useCms();
  const [run, setRun] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const n = (key: string, def: number) => parseInt(settings[key] ?? '') || def;
  const s = (key: string, def: string) => settings[key] ?? def;

  const stats = [
    { value: n('stat_retail_value', 300), suffix: s('stat_retail_suffix', '+'), label: t.stats.retailLabel, desc: t.stats.retailDesc },
    { value: n('stat_partners_value', 15), suffix: s('stat_partners_suffix', '+'), label: t.stats.partnersLabel, desc: t.stats.partnersDesc },
    { value: n('stat_products_value', 1000), suffix: s('stat_products_suffix', '+'), label: t.stats.productsLabel, desc: t.stats.productsDesc },
    { value: n('stat_years_value', 12), suffix: s('stat_years_suffix', '+'), label: t.stats.yearsLabel, desc: t.stats.yearsDesc },
  ];

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setRun(true); obs.disconnect(); } }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="stats" ref={ref as React.RefObject<HTMLElement>} className="bg-brand-charcoal overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_1.4fr]">
          <div className="relative px-8 lg:px-14 py-16 lg:py-24 flex flex-col justify-center border-b lg:border-b-0 lg:border-e border-white/[0.07]">
            <div className="absolute start-0 top-8 bottom-8 w-0.5 bg-brand-red" />
            <div className="transition-all duration-700" style={{ opacity: run ? 1 : 0, transform: run ? 'none' : 'translateY(-20px)' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-5 h-px bg-brand-red" />
                <span className="text-brand-red font-heading font-semibold text-2xs tracking-ultra-wide uppercase">{t.stats.eyebrow}</span>
              </div>
              <h2 className="font-serif-display font-bold text-white text-3xl lg:text-4xl leading-tight mb-6">{t.stats.title}</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-10 max-w-sm">{t.stats.description}</p>
            </div>
            <div className="space-y-3">
              {t.stats.highlights.map((h, i) => (
                <div key={i} className="flex items-center gap-3 transition-all duration-700"
                  style={{ opacity: run ? 1 : 0, transform: run ? 'none' : 'translateY(-16px)', transitionDelay: `${200 + i * 80}ms` }}>
                  <div className="w-1.5 h-1.5 bg-brand-red flex-shrink-0" />
                  <span className="text-white/70 font-heading font-medium text-sm">{h}</span>
                </div>
              ))}
            </div>
            <div className="mt-10 pt-8 border-t border-white/[0.08] transition-all duration-700" style={{ opacity: run ? 1 : 0, transitionDelay: '600ms' }}>
              <p className="text-white/30 text-2xs font-heading font-semibold tracking-widest uppercase">{t.stats.credibility}</p>
            </div>
          </div>

          <div className="grid grid-cols-2">
            {stats.map((s, i) => (
              <div key={i} className={`relative px-8 lg:px-12 py-12 lg:py-16 group overflow-hidden ${i % 2 === 0 ? 'border-e border-white/[0.07]' : ''} ${i < 2 ? 'border-b border-white/[0.07]' : ''}`}>
                <div className="absolute inset-0 bg-brand-red translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                <div className="relative z-10 transition-all duration-700" style={{ opacity: run ? 1 : 0, transform: run ? 'none' : 'translateY(20px)', transitionDelay: `${i * 120}ms` }}>
                  <div className="font-serif-display font-bold text-white leading-none mb-3" style={{ fontSize: 'clamp(3rem, 5.5vw, 5rem)' }}>
                    <Counter to={s.value} suffix={s.suffix} run={run} />
                  </div>
                  <div className="font-heading font-bold text-white text-sm mb-2">{s.label}</div>
                  <div className="text-white/40 group-hover:text-white/70 text-xs leading-relaxed transition-colors duration-300 hidden lg:block">{s.desc}</div>
                  <div className="mt-6 w-0 h-px bg-white/40 group-hover:w-8 transition-all duration-500" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.07] py-4 overflow-hidden">
          <div className="flex items-center gap-0 whitespace-nowrap animate-marquee">
            {[...Array(3)].map((_, outer) => (
              <div key={outer} className="flex items-center gap-0 flex-shrink-0">
                {t.stats.marqueeItems.map((item, i) => (
                  <span key={i} className="flex items-center gap-6 px-8">
                    <span className="w-1 h-1 bg-brand-red rounded-full flex-shrink-0" />
                    <span className="text-white/25 font-heading font-medium text-2xs tracking-widest uppercase">{item}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
