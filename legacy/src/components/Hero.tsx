import { useEffect, useState, useRef } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import UltraPetLogo from './UltraPetLogo';
import { useLanguage } from '../contexts/LanguageContext';
import { useCms } from '../contexts/CmsContext';

const FALLBACK_SLIDES = [
  { image: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=1920&q=90', label_he: 'כלבים - תזונה פרימיום', label_en: 'Premium Dog Nutrition' },
  { image: 'https://images.pexels.com/photos/1404819/pexels-photo-1404819.jpeg?auto=compress&cs=tinysrgb&w=1920&q=90', label_he: 'חתולים - תזונה פרימיום', label_en: 'Premium Cat Nutrition' },
  { image: 'https://images.pexels.com/photos/2607544/pexels-photo-2607544.jpeg?auto=compress&cs=tinysrgb&w=1920&q=90', label_he: 'טיפול מקיף בחיות מחמד', label_en: 'Complete Pet Care' },
];

export default function Hero() {
  const { t, isRtl, lang } = useLanguage();
  const { heroBanners } = useCms();
  const [slide, setSlide] = useState(0);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const SLIDE_DURATION = 7000;

  const activeBanners = heroBanners.filter((b) => b.active);
  const slides = activeBanners.length > 0
    ? activeBanners.map((b) => ({ image: b.image_url, label_he: b.title_he || '', label_en: b.title_en || '' }))
    : FALLBACK_SLIDES;

  const currentLabel = lang === 'he' ? slides[slide]?.label_he : slides[slide]?.label_en;

  useEffect(() => { setVisible(true); }, []);

  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    const tick = setInterval(() => {
      setProgress(Math.min(((Date.now() - start) / SLIDE_DURATION) * 100, 100));
    }, 50);
    intervalRef.current = setInterval(() => {
      setSlide((p) => (p + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => { clearInterval(tick); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [slide, slides.length]);

  const goTo = (i: number) => { if (intervalRef.current) clearInterval(intervalRef.current); setSlide(i); };
  const scrollDown = () => document.querySelector('#stats')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section id="home" className="relative h-screen min-h-[680px] max-h-[1080px] overflow-hidden bg-brand-charcoal">
      {slides.map((s, i) => (
        <div key={i} className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: i === slide ? 1 : 0, transitionDuration: '1200ms' }}>
          <img src={s.image} alt={s.label_en} className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/15 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
      <div className={`absolute top-0 bottom-0 w-1 bg-brand-red z-10 ${isRtl ? 'right-0' : 'left-0'}`} />

      <div className="relative z-10 h-full max-w-7xl mx-auto px-8 lg:px-14 flex flex-col justify-center">
        <div className={`max-w-3xl ${isRtl ? 'ms-auto lg:ms-0' : ''}`}>
          <div className="mb-8 transition-all duration-700 flex items-center gap-4" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transitionDelay: '200ms' }}>
            {t.hero.logoImageUrl ? (
              <img
                src={t.hero.logoImageUrl}
                alt="UltraPet"
                className="object-contain drop-shadow-2xl"
                style={{ width: `${t.hero.logoWidth || '96'}px`, height: `${t.hero.logoHeight || '96'}px` }}
              />
            ) : (
              <UltraPetLogo variant="mark" className="w-20 h-20 lg:w-24 lg:h-24 drop-shadow-2xl" />
            )}
            {t.hero.showSecondaryIcon === 'true' && t.hero.secondaryIconUrl && (
              <img
                src={t.hero.secondaryIconUrl}
                alt=""
                className="object-contain drop-shadow-xl opacity-80"
                style={{ width: '48px', height: '48px' }}
              />
            )}
          </div>
          <div className="flex items-center gap-3 mb-5 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)', transitionDelay: '350ms' }}>
            <div className="w-8 h-px bg-brand-red" />
            <span className="text-brand-red font-heading font-semibold text-2xs tracking-ultra-wide uppercase">{t.hero.eyebrow}</span>
          </div>
          <h1 className="font-serif-display font-bold text-white leading-[1.05] mb-5 transition-all duration-700"
            style={{ fontSize: 'clamp(3.2rem, 7.5vw, 6.5rem)', opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transitionDelay: '500ms' }}>
            {t.hero.headline1}<span className="text-brand-red italic">{t.hero.headline2}</span>
          </h1>
          <p className="text-white/80 font-heading font-medium text-lg lg:text-xl mb-4 leading-snug transition-all duration-700"
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)', transitionDelay: '650ms' }}>
            {t.hero.tagline}
          </p>
          <p className="text-white/55 text-base max-w-xl mb-10 leading-relaxed transition-all duration-700"
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(12px)', transitionDelay: '750ms' }}>
            {t.hero.description}
          </p>
          <div className="flex flex-wrap gap-4 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(12px)', transitionDelay: '900ms' }}>
            <button onClick={() => document.querySelector('#brands')?.scrollIntoView({ behavior: 'smooth' })} className="btn-primary">
              {t.hero.cta1} {isRtl ? null : <ArrowRight size={14} />}
            </button>
            <button onClick={() => document.querySelector('#business')?.scrollIntoView({ behavior: 'smooth' })} className="btn-ghost-white">
              {t.hero.cta2}
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-14 left-0 right-0 z-10 max-w-7xl mx-auto px-8 lg:px-14 flex items-end justify-between">
        <div className="transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '1100ms' }}>
          <span className="text-white/40 font-heading text-2xs tracking-widest uppercase">{currentLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`}>
              {i === slide ? (
                <div className="w-14 h-0.5 bg-white/20 overflow-hidden">
                  <div className="h-full bg-brand-red transition-none" style={{ width: `${progress}%` }} />
                </div>
              ) : (
                <div className="w-5 h-0.5 bg-white/30 hover:bg-white/60 transition-colors" />
              )}
            </button>
          ))}
        </div>
      </div>

      <button onClick={scrollDown} className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 text-white/40 hover:text-white/80 transition-colors animate-bounce" aria-label="Scroll down">
        <ChevronDown size={24} />
      </button>
    </section>
  );
}
