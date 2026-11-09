import { useEffect, useRef, useState } from 'react';
import { Package2, Droplets, Star, Sparkles, ClipboardList, Layers, Palette, Factory, ShieldCheck, Ship, Truck, ArrowRight, Globe, Award, CheckCircle, FlaskConical } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const catIcons = [Package2, Droplets, Star, Sparkles];
const catGradients = ['from-amber-50 to-orange-50', 'from-blue-50 to-cyan-50', 'from-rose-50 to-pink-50', 'from-violet-50 to-purple-50'];
const catBorders = ['border-amber-200', 'border-blue-200', 'border-rose-200', 'border-violet-200'];
const catAccents = ['#D97706', '#0284C7', '#BE1E24', '#4A4A6A'];
const stepIcons = [ClipboardList, FlaskConical, Palette, Factory, ShieldCheck, Ship, Truck];

export default function PrivateLabel() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const catNames = [t.privateLabel.dryName, t.privateLabel.wetName, t.privateLabel.treatsName, t.privateLabel.litterName];
  const catTaglines = [t.privateLabel.dryTagline, t.privateLabel.wetTagline, t.privateLabel.treatsTagline, t.privateLabel.litterTagline];
  const catDescs = [t.privateLabel.dryDesc, t.privateLabel.wetDesc, t.privateLabel.treatsDesc, t.privateLabel.litterDesc];
  const catFormats = [t.privateLabel.dryFormats, t.privateLabel.wetFormats, t.privateLabel.treatsFormats, t.privateLabel.litterFormats];
  const catSizes = [t.privateLabel.drySizes, t.privateLabel.wetSizes, t.privateLabel.treatsSizes, t.privateLabel.litterSizes];

  const steps = [
    { icon: stepIcons[0], title: t.privateLabel.step1, desc: t.privateLabel.step1Desc },
    { icon: stepIcons[1], title: t.privateLabel.step2, desc: t.privateLabel.step2Desc },
    { icon: stepIcons[2], title: t.privateLabel.step3, desc: t.privateLabel.step3Desc },
    { icon: stepIcons[3], title: t.privateLabel.step4, desc: t.privateLabel.step4Desc },
    { icon: stepIcons[4], title: t.privateLabel.step5, desc: t.privateLabel.step5Desc },
    { icon: stepIcons[5], title: t.privateLabel.step6, desc: t.privateLabel.step6Desc },
    { icon: stepIcons[6], title: t.privateLabel.step7, desc: t.privateLabel.step7Desc },
  ];

  const credentials = [
    { icon: Globe, value: t.privateLabel.credFactories, label: t.privateLabel.credFactoriesLabel },
    { icon: Award, value: t.privateLabel.credISO, label: t.privateLabel.credISOLabel },
    { icon: CheckCircle, value: t.privateLabel.credFormats, label: t.privateLabel.credFormatsLabel },
    { icon: Layers, value: t.privateLabel.credCountries, label: t.privateLabel.credCountriesLabel },
  ];

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.05 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="private-label" ref={ref as React.RefObject<HTMLElement>} className="bg-white">
      {/* Part 1: Intro */}
      <div className="pt-28 lg:pt-36 pb-20 lg:pb-24">
        <div className="max-w-7xl mx-auto px-8 lg:px-14">
          <div className="grid lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px] gap-16 xl:gap-24 items-start">
            <div>
              <div className="eyebrow eyebrow-line mb-4 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(12px)' }}>{t.privateLabel.eyebrow}</div>
              <h2 className="section-heading text-4xl lg:text-5xl xl:text-6xl mb-6 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transitionDelay: '80ms' }}>
                {t.privateLabel.title1}<br />{t.privateLabel.title2}
              </h2>
              <p className="text-neutral-600 text-lg leading-relaxed mb-5 max-w-xl transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '160ms' }}>
                {t.privateLabel.description1}{' '}
                <strong className="text-brand-charcoal font-semibold">{t.privateLabel.factories}</strong>{' '}
                {t.privateLabel.description2}
              </p>
              <p className="text-neutral-500 text-base leading-relaxed max-w-xl mb-10 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '240ms' }}>{t.privateLabel.description3}</p>
              <div className="flex flex-wrap gap-4 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '320ms' }}>
                <button onClick={() => document.querySelector('#business')?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary">{t.privateLabel.ctaStart} <ArrowRight size={14} /></button>
                <button onClick={() => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })} className="btn-outline-red">{t.privateLabel.ctaSample}</button>
              </div>
            </div>
            <div className="transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateX(24px)', transitionDelay: '200ms' }}>
              <div className="bg-brand-charcoal p-8 mb-3">
                <div className="font-heading font-semibold text-brand-red text-2xs tracking-ultra-wide uppercase mb-3">{t.privateLabel.capTitle}</div>
                <p className="text-white/70 text-sm leading-relaxed">{t.privateLabel.capDesc}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {credentials.map((c, i) => (
                  <div key={i} className="bg-neutral-50 border border-neutral-200 p-6 flex flex-col gap-3 hover:border-brand-red/30 transition-colors duration-300 group">
                    <div className="w-9 h-9 bg-brand-red/10 flex items-center justify-center group-hover:bg-brand-red/20 transition-colors duration-300">
                      <c.icon size={16} className="text-brand-red" />
                    </div>
                    <div>
                      <div className="font-serif-display font-bold text-brand-charcoal text-2xl leading-none mb-1">{c.value}</div>
                      <div className="font-heading font-medium text-neutral-500 text-xs">{c.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-4 bg-brand-red/5 border border-brand-red/20 flex items-start gap-3">
                <ShieldCheck size={16} className="text-brand-red flex-shrink-0 mt-0.5" />
                <p className="text-brand-charcoal text-xs leading-relaxed font-medium">{t.privateLabel.certNote}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Part 2: Categories */}
      <div className="bg-neutral-50 py-20">
        <div className="max-w-7xl mx-auto px-8 lg:px-14">
          <div className="flex items-center gap-3 mb-3"><div className="w-5 h-px bg-brand-red" /><span className="text-brand-red font-heading font-semibold text-2xs tracking-ultra-wide uppercase">{t.privateLabel.categoriesEyebrow}</span></div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-10">
            <h3 className="section-heading text-3xl lg:text-4xl">{t.privateLabel.categoriesTitle}</h3>
            <p className="text-neutral-500 text-sm max-w-xs">{t.privateLabel.categoriesSubtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {catNames.map((name, i) => {
              const Icon = catIcons[i];
              return (
                <div key={i} className={`group relative bg-gradient-to-br ${catGradients[i]} border ${catBorders[i]} p-7 hover:shadow-premium-sm transition-all duration-500 overflow-hidden`}
                  style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)', transitionDelay: `${200 + i * 80}ms`, transitionDuration: '700ms' }}>
                  <Icon size={100} className="absolute -end-4 -bottom-4 opacity-5 transition-opacity duration-300 group-hover:opacity-10" style={{ color: catAccents[i] }} />
                  <div className="w-11 h-11 flex items-center justify-center mb-5" style={{ backgroundColor: `${catAccents[i]}18` }}>
                    <Icon size={20} style={{ color: catAccents[i] }} />
                  </div>
                  <div className="font-heading font-bold text-brand-charcoal text-xl mb-1">{name}</div>
                  <div className="font-heading font-semibold text-2xs tracking-widest uppercase mb-4" style={{ color: catAccents[i] }}>{catTaglines[i]}</div>
                  <p className="text-neutral-600 text-sm leading-relaxed mb-5">{catDescs[i]}</p>
                  <div className="space-y-1.5 mb-5">
                    {catFormats[i].map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: catAccents[i] }} />
                        <span className="text-neutral-600 text-xs">{f}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-black/[0.07]">
                    <div className="text-2xs font-heading font-semibold text-neutral-400 uppercase tracking-widest mb-1">{t.privateLabel.packSizes}</div>
                    <div className="text-xs font-medium text-neutral-600">{catSizes[i]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Part 3: Timeline */}
      <div className="bg-brand-charcoal py-20 lg:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 lg:px-14">
          <div className="grid lg:grid-cols-2 gap-8 items-end mb-14 lg:mb-16">
            <div>
              <div className="flex items-center gap-3 mb-3"><div className="w-5 h-px bg-brand-red" /><span className="text-brand-red font-heading font-semibold text-2xs tracking-ultra-wide uppercase">{t.privateLabel.processEyebrow}</span></div>
              <h3 className="font-serif-display font-bold text-white text-3xl lg:text-4xl leading-tight">
                {t.privateLabel.processTitle1}<br /><span className="text-brand-red italic">{t.privateLabel.processTitle2}</span>
              </h3>
            </div>
            <p className="text-white/50 text-sm leading-relaxed max-w-sm">{t.privateLabel.processDesc}</p>
          </div>

          <div className="relative">
            <div className="hidden lg:block absolute top-[2.25rem] start-0 end-0 h-px bg-white/10 z-0" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-6 lg:gap-3 xl:gap-4 relative z-10">
              {steps.map((step, i) => (
                <div key={i} className="group relative transition-all duration-700"
                  style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transitionDelay: `${400 + i * 80}ms` }}>
                  <div className="flex lg:flex-col gap-4 lg:gap-0">
                    <div className="flex-shrink-0 relative">
                      <div className="w-[4.5rem] h-[4.5rem] lg:w-12 lg:h-12 border-2 border-white/10 group-hover:border-brand-red bg-brand-charcoal-2 group-hover:bg-brand-red flex flex-col items-center justify-center transition-all duration-300 relative z-10">
                        <step.icon size={18} className="text-white/50 group-hover:text-white transition-colors duration-300" />
                      </div>
                      <div className="absolute -top-2 -end-2 w-5 h-5 bg-brand-red flex items-center justify-center lg:hidden">
                        <span className="text-white font-heading font-black text-[9px]">{String(i + 1).padStart(2, '0')}</span>
                      </div>
                    </div>
                    <div className="flex-1 lg:mt-5">
                      <div className="text-white/25 font-heading font-black text-2xs tracking-widest hidden lg:block mb-1.5">{String(i + 1).padStart(2, '0')}</div>
                      <div className="font-heading font-bold text-white text-sm leading-tight mb-2 whitespace-pre-line">{step.title}</div>
                      <div className="text-white/40 text-xs leading-relaxed group-hover:text-white/60 transition-colors duration-300">{step.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-xs font-heading tracking-wide">
              {t.privateLabel.timeNote} <span className="text-white/70 font-semibold">{t.privateLabel.timeValue}</span>
            </p>
            <button onClick={() => document.querySelector('#business')?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary text-2xs py-3">
              {t.privateLabel.startProject} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
