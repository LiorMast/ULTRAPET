import { useEffect, useRef, useState } from 'react';
import { Globe, Award, Truck, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function About() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const pillars = [
    { icon: Globe, title: t.about.pillar1Title, desc: t.about.pillar1Desc },
    { icon: Award, title: t.about.pillar2Title, desc: t.about.pillar2Desc },
    { icon: Truck, title: t.about.pillar3Title, desc: t.about.pillar3Desc },
    { icon: ShieldCheck, title: t.about.pillar4Title, desc: t.about.pillar4Desc },
  ];

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="about" ref={ref as React.RefObject<HTMLElement>} className="py-28 lg:py-36 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-8 lg:px-14">
        <div className="grid lg:grid-cols-2 gap-16 xl:gap-24 items-center">
          {/* Image */}
          <div className="relative transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)' }}>
            <div className="relative">
              <img src="https://images.pexels.com/photos/1170986/pexels-photo-1170986.jpeg?auto=compress&cs=tinysrgb&w=900&q=85" alt="Premium pet products" className="w-full h-[520px] object-cover" />
              <div className="absolute -bottom-5 -end-5 w-32 h-32 bg-brand-red -z-10" />
              <div className="absolute bottom-8 start-0 bg-white p-6 shadow-premium border-t-2 border-brand-red">
                <div className="font-serif-display font-bold text-brand-charcoal text-5xl leading-none mb-1">{t.about.statValue}</div>
                <div className="font-heading font-semibold text-brand-red text-2xs tracking-widest uppercase">{t.about.statLabel}</div>
                <div className="text-neutral-400 text-xs mt-1">{t.about.statSub}</div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transitionDelay: '150ms' }}>
            <div className="eyebrow eyebrow-line mb-4">{t.about.eyebrow}</div>
            <h2 className="section-heading text-4xl lg:text-5xl mb-6">{t.about.title1}<br />{t.about.title2}</h2>
            <p className="text-neutral-600 text-base leading-relaxed mb-5">{t.about.p1}</p>
            <p className="text-neutral-400 text-sm leading-relaxed mb-12">{t.about.p2}</p>
            <div className="grid grid-cols-2 gap-6">
              {pillars.map((p, i) => (
                <div key={i} className="transition-all duration-700"
                  style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)', transitionDelay: `${250 + i * 80}ms` }}>
                  <div className="w-10 h-10 bg-brand-red/8 border border-brand-red/20 flex items-center justify-center mb-3"><p.icon size={16} className="text-brand-red" /></div>
                  <h4 className="font-heading font-bold text-brand-charcoal text-sm mb-1.5">{p.title}</h4>
                  <p className="text-neutral-400 text-xs leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
