import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import UltraPetLogo from './UltraPetLogo';
import { useLanguage } from '../contexts/LanguageContext';
import { useCms, CmsBrand } from '../contexts/CmsContext';

/* ─── Brand mark SVGs ──────────────────────── */
function InternutriMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" stroke={color} strokeWidth="2" />
      <circle cx="40" cy="40" r="28" stroke={color} strokeWidth="1" strokeDasharray="4 4" />
      <circle cx="40" cy="40" r="8" fill={color} />
      <line x1="40" y1="4" x2="40" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="58" x2="40" y2="76" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="40" x2="22" y2="40" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="58" y1="40" x2="76" y2="40" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="13" r="3" fill={color} /><circle cx="40" cy="67" r="3" fill={color} />
      <circle cx="13" cy="40" r="3" fill={color} /><circle cx="67" cy="40" r="3" fill={color} />
    </svg>
  );
}
function GreenheartMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 68 C40 68 12 50 12 30 C12 20 20 12 30 14 C34 15 38 18 40 22 C42 18 46 15 50 14 C60 12 68 20 68 30 C68 50 40 68 40 68Z" fill={color} opacity="0.15" stroke={color} strokeWidth="2" />
      <path d="M40 56 C40 56 22 44 22 32 C22 25 27 20 33 21 C36 21.5 38.5 23 40 26 C41.5 23 44 21.5 47 21 C53 20 58 25 58 32 C58 44 40 56 40 56Z" fill={color} />
      <path d="M40 56 L40 72" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M40 65 C40 65 34 60 30 55" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M40 62 C40 62 46 57 50 52" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function PawMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="52" rx="18" ry="16" fill={color} />
      <ellipse cx="22" cy="34" rx="7" ry="9" fill={color} /><ellipse cx="33" cy="28" rx="7" ry="9" fill={color} />
      <ellipse cx="47" cy="28" rx="7" ry="9" fill={color} /><ellipse cx="58" cy="34" rx="7" ry="9" fill={color} />
      <ellipse cx="38" cy="50" rx="5" ry="4" fill="white" opacity="0.2" />
    </svg>
  );
}
function JRFarmMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="40" y1="72" x2="40" y2="18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="30" cy="26" rx="9" ry="6" fill={color} transform="rotate(-30 30 26)" />
      <ellipse cx="28" cy="38" rx="9" ry="6" fill={color} transform="rotate(-25 28 38)" />
      <ellipse cx="29" cy="50" rx="9" ry="6" fill={color} transform="rotate(-20 29 50)" />
      <ellipse cx="50" cy="26" rx="9" ry="6" fill={color} transform="rotate(30 50 26)" />
      <ellipse cx="52" cy="38" rx="9" ry="6" fill={color} transform="rotate(25 52 38)" />
      <ellipse cx="51" cy="50" rx="9" ry="6" fill={color} transform="rotate(20 51 50)" />
      <ellipse cx="40" cy="18" rx="7" ry="5" fill={color} />
      <line x1="22" y1="72" x2="58" y2="72" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function UltraCleanMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="40,10 58,40 40,70 22,40" fill={color} opacity="0.15" stroke={color} strokeWidth="2" />
      <polygon points="40,20 52,40 40,60 28,40" fill={color} />
      <line x1="10" y1="10" x2="10" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="14" x2="14" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="68" y1="58" x2="68" y2="66" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="64" y1="62" x2="72" y2="62" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M18 55 C18 55 14 50 14 47 C14 44.5 16 43 18 43 C20 43 22 44.5 22 47 C22 50 18 55 18 55Z" fill={color} opacity="0.7" />
      <path d="M66 28 C66 28 62 23 62 20 C62 17.5 64 16 66 16 C68 16 70 17.5 70 20 C70 23 66 28 66 28Z" fill={color} opacity="0.7" />
    </svg>
  );
}

function BrandMark({ slug, logoUrl, color, size = 64 }: { slug: string; logoUrl: string | null; color: string; size?: number }) {
  const style = { width: size, height: size, flexShrink: 0 };
  if (logoUrl) return <div style={style}><img src={logoUrl} alt={slug} className="w-full h-full object-contain" /></div>;
  if (slug === 'ultra-pet') return <div style={style}><UltraPetLogo variant="mark" className="w-full h-full" /></div>;
  if (slug === 'internutri') return <div style={style}><InternutriMark color={color} /></div>;
  if (slug === 'greenheart') return <div style={style}><GreenheartMark color={color} /></div>;
  if (slug === 'paw') return <div style={style}><PawMark color={color} /></div>;
  if (slug === 'jr-farm') return <div style={style}><JRFarmMark color={color} /></div>;
  return <div style={style}><UltraCleanMark color={color} /></div>;
}

const FALLBACK_BRANDS: CmsBrand[] = [
  { id: '1', name: 'Ultra Pet', slug: 'ultra-pet', tagline_he: 'תזונה מקיפה פרימיום', tagline_en: 'Premium Complete Nutrition', description_he: '', description_en: 'Our flagship brand delivering complete and balanced nutrition for dogs and cats at every life stage.', logo_url: null, accent_color: '#BE1E24', featured: true, active: true, sort_order: 0, features_he: [], features_en: ['Complete dry & wet formulas', 'All life stages', 'Nationwide distribution', 'Vet-endorsed quality'] },
  { id: '2', name: 'Internutri', slug: 'internutri', tagline_he: 'פורמולות מבוססות מדע', tagline_en: 'Science-Based Formulas', description_he: '', description_en: 'Veterinary-grade nutritional formulas developed in collaboration with leading European nutrition scientists.', logo_url: null, accent_color: '#1C4E80', featured: false, active: true, sort_order: 1, features_he: [], features_en: [] },
  { id: '3', name: 'Greenheart Premiums', slug: 'greenheart', tagline_he: 'טבעי ואורגני', tagline_en: 'Natural & Organic', description_he: '', description_en: 'Premium natural recipes crafted with sustainably sourced ingredients from certified organic European farms.', logo_url: null, accent_color: '#2D6A4F', featured: false, active: true, sort_order: 2, features_he: [], features_en: [] },
  { id: '4', name: 'Paw', slug: 'paw', tagline_he: 'מצוינות יומיומית', tagline_en: 'Everyday Excellence', description_he: '', description_en: 'Accessible quality nutrition meeting the daily needs of every pet household, without compromise.', logo_url: null, accent_color: '#C97D30', featured: false, active: true, sort_order: 3, features_he: [], features_en: [] },
  { id: '5', name: 'JR Farm', slug: 'jr-farm', tagline_he: 'מומחי בעלי חיים קטנים', tagline_en: 'Small Animal Specialists', description_he: '', description_en: "Europe's leading brand for rabbits, guinea pigs, hamsters, birds and small pets.", logo_url: null, accent_color: '#4A7C42', featured: false, active: true, sort_order: 4, features_he: [], features_en: [] },
  { id: '6', name: 'Ultra Clean', slug: 'ultra-clean', tagline_he: 'היגיינה פרימיום לחתולים', tagline_en: 'Premium Cat Hygiene', description_he: '', description_en: 'Advanced clumping and non-clumping litter solutions with superior odor-control technology.', logo_url: null, accent_color: '#4A4A6A', featured: false, active: true, sort_order: 5, features_he: [], features_en: [] },
];

function FeaturedCard({ brand, visible }: { brand: CmsBrand; visible: boolean }) {
  const { t, lang } = useLanguage();
  const tagline = lang === 'he' ? brand.tagline_he : brand.tagline_en;
  const desc = lang === 'he' ? brand.description_he : brand.description_en;
  const features = lang === 'he' ? brand.features_he : brand.features_en;
  const displayFeatures = features.length > 0 ? features : t.brands.featuredFeatures;
  const displayDesc = desc || t.brands.featuredDescription;

  return (
    <div className="relative bg-brand-charcoal overflow-hidden mb-3 transition-all duration-700"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)', transitionDelay: '200ms' }}>
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: `repeating-linear-gradient(45deg, ${brand.accent_color} 0, ${brand.accent_color} 1px, transparent 0, transparent 50%)`, backgroundSize: '20px 20px' }} />
      <div className="absolute start-0 top-0 bottom-0 w-1" style={{ backgroundColor: brand.accent_color }} />
      <div className="relative z-10 grid lg:grid-cols-[1fr_auto] gap-8 lg:gap-0 p-10 lg:p-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6" style={{ backgroundColor: `${brand.accent_color}33`, border: `1px solid ${brand.accent_color}66` }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: brand.accent_color }} />
            <span className="font-heading font-bold text-2xs tracking-widest uppercase" style={{ color: brand.accent_color }}>{t.brands.flagshipBadge}</span>
          </div>
          <h3 className="font-serif-display font-bold text-white text-4xl lg:text-5xl mb-2 leading-tight">{brand.name}</h3>
          <div className="font-heading font-semibold text-white/50 text-xs tracking-widest uppercase mb-6">{tagline}</div>
          <p className="text-white/65 text-base leading-relaxed max-w-xl mb-8">{displayDesc}</p>
          <div className="flex flex-wrap gap-2 mb-8">
            {displayFeatures.map((f) => (
              <span key={f} className="px-3 py-1.5 border border-white/15 text-white/60 font-heading font-medium text-2xs tracking-wide uppercase">{f}</span>
            ))}
          </div>
          <a href={`/brands/${brand.slug}`} className="inline-flex items-center gap-2 text-white font-heading font-bold text-xs tracking-widest uppercase group hover:text-brand-red transition-colors duration-200">
            {t.brands.exploreBrand} <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform duration-200" />
          </a>
        </div>
        <div className="hidden lg:flex items-center justify-center w-52 h-52 opacity-90">
          <BrandMark slug={brand.slug} logoUrl={brand.logo_url} color={brand.accent_color} size={180} />
        </div>
      </div>
    </div>
  );
}

function BrandCard({ brand, index, visible }: { brand: CmsBrand; index: number; visible: boolean }) {
  const { t, lang } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const tagline = lang === 'he' ? brand.tagline_he : brand.tagline_en;
  const desc = lang === 'he' ? brand.description_he : brand.description_en;

  return (
    <div className="relative group overflow-hidden cursor-pointer border border-neutral-200 hover:border-transparent transition-all duration-500 hover:shadow-premium"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(28px)', transitionDelay: `${300 + index * 90}ms`, transitionDuration: '700ms' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <a href={`/brands/${brand.slug}`} className="absolute inset-0 z-20" aria-label={`View ${brand.name}`} />
      <div className="absolute inset-0 transition-transform duration-500 ease-out" style={{ backgroundColor: brand.accent_color, transform: hovered ? 'translateY(0)' : 'translateY(100%)' }} />
      <div className="absolute top-0 start-0 end-0 h-0.5 transition-opacity duration-300" style={{ backgroundColor: brand.accent_color, opacity: hovered ? 0 : 1 }} />
      <div className="relative z-10 p-8 lg:p-9 flex flex-col h-full min-h-[340px]">
        <div className="flex items-center justify-between mb-6">
          <span className={`font-heading font-semibold text-2xs tracking-widest uppercase transition-colors duration-300 ${hovered ? 'text-white/60' : 'text-neutral-400'}`}>
            {brand.tagline_en.split(' ').slice(-1)[0] || ''}
          </span>
          <span className={`px-2.5 py-1 font-heading font-semibold text-2xs tracking-widest uppercase transition-all duration-300 ${hovered ? 'bg-white/15 text-white/80' : 'bg-neutral-100 text-neutral-500'}`}>
            {tagline}
          </span>
        </div>
        <div className="mb-6 flex justify-center">
          <div className="transition-all duration-500" style={{ filter: hovered ? 'brightness(0) invert(1)' : 'none', transform: hovered ? 'scale(1.1)' : 'scale(1)' }}>
            <BrandMark slug={brand.slug} logoUrl={brand.logo_url} color={brand.accent_color} size={72} />
          </div>
        </div>
        <h3 className={`font-serif-display font-bold text-xl mb-1 text-center transition-colors duration-300 ${hovered ? 'text-white' : 'text-brand-charcoal'}`}>{brand.name}</h3>
        <div className="font-heading font-semibold text-2xs tracking-widest uppercase mb-4 text-center transition-colors duration-300"
          style={{ color: hovered ? 'rgba(255,255,255,0.7)' : brand.accent_color }}>{tagline}</div>
        <p className={`text-sm leading-relaxed flex-1 text-center transition-colors duration-300 ${hovered ? 'text-white/75' : 'text-neutral-500'}`}>{desc}</p>
        <div className="mt-6 flex items-center justify-center gap-2 pt-5 border-t border-white/15">
          <span className={`font-heading font-bold text-xs tracking-widest uppercase flex items-center gap-2 transition-all duration-300 group-hover:gap-3 ${hovered ? 'text-white' : ''}`}
            style={{ color: hovered ? undefined : brand.accent_color }}>
            {t.brands.viewBrand} <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Brands() {
  const { t } = useLanguage();
  const { brands } = useCms();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const activeBrands = brands.filter((b) => b.active);
  const displayBrands = activeBrands.length > 0 ? activeBrands : FALLBACK_BRANDS;
  const featured = displayBrands.find((b) => b.featured) || displayBrands[0];
  const others = displayBrands.filter((b) => b.id !== featured?.id);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.05 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="brands" ref={ref as React.RefObject<HTMLElement>} className="py-28 lg:py-36 bg-white">
      <div className="max-w-7xl mx-auto px-8 lg:px-14">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-end mb-14 lg:mb-16">
          <div>
            <div className="eyebrow eyebrow-line mb-4 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(12px)' }}>{t.brands.eyebrow}</div>
            <h2 className="section-heading text-4xl lg:text-5xl transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)', transitionDelay: '80ms' }}>
              {t.brands.title1}<br />{t.brands.title2}
            </h2>
          </div>
          <div className="transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '160ms' }}>
            <p className="text-neutral-500 text-base leading-relaxed mb-4">{t.brands.description}</p>
            <a href="#contact" onClick={(e) => { e.preventDefault(); document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="inline-flex items-center gap-2 text-brand-red font-heading font-bold text-xs tracking-widest uppercase hover:gap-3 transition-all duration-200">
              {t.brands.inquire} <ArrowRight size={12} />
            </a>
          </div>
        </div>

        {featured && <FeaturedCard brand={featured} visible={visible} />}

        <div className={`grid sm:grid-cols-2 gap-3 ${others.length >= 5 ? 'lg:grid-cols-5' : others.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {others.map((b, i) => (
            <BrandCard key={b.id} brand={b} index={i} visible={visible} />
          ))}
        </div>

        <div className="mt-10 pt-10 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '800ms' }}>
          <div className="flex items-center gap-3">
            <ExternalLink size={14} className="text-neutral-400" />
            <span className="text-neutral-400 text-sm">{t.brands.catalogNote}</span>
          </div>
          <a href="#business" onClick={(e) => { e.preventDefault(); document.querySelector('#business')?.scrollIntoView({ behavior: 'smooth' }); }}
            className="btn-outline-red text-2xs py-3 px-6 whitespace-nowrap flex-shrink-0">
            {t.brands.requestCatalog}
          </a>
        </div>
      </div>
    </section>
  );
}
