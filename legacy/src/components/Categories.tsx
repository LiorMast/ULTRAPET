import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCms } from '../contexts/CmsContext';

const FALLBACK_IMAGES = [
  'https://images.pexels.com/photos/1254140/pexels-photo-1254140.jpeg?auto=compress&cs=tinysrgb&w=800&q=85',
  'https://images.pexels.com/photos/1276553/pexels-photo-1276553.jpeg?auto=compress&cs=tinysrgb&w=800&q=85',
  'https://images.pexels.com/photos/406014/pexels-photo-406014.jpeg?auto=compress&cs=tinysrgb&w=800&q=85',
  'https://images.pexels.com/photos/1183434/pexels-photo-1183434.jpeg?auto=compress&cs=tinysrgb&w=800&q=85',
  'https://images.pexels.com/photos/326012/pexels-photo-326012.jpeg?auto=compress&cs=tinysrgb&w=800&q=85',
  'https://images.pexels.com/photos/56733/pexels-photo-56733.jpeg?auto=compress&cs=tinysrgb&w=800&q=85',
];

const FALLBACK_CATS = [
  { name_he: 'אוכל לכלבים', name_en: 'Dog Food', description_he: 'תזונה מקיפה לכלבים', description_en: 'Complete dry and wet nutrition for dogs of all breeds and life stages.', image_url: FALLBACK_IMAGES[0], sku_count: 300 },
  { name_he: 'אוכל לחתולים', name_en: 'Cat Food', description_he: 'תזונה פרימיום לחתולים', description_en: 'Premium feline nutrition crafted for indoor and outdoor cats.', image_url: FALLBACK_IMAGES[1], sku_count: 250 },
  { name_he: 'אוכל רטוב ופינוקים', name_en: 'Wet Food & Treats', description_he: 'מזון רטוב ופינוקים', description_en: 'Gourmet wet food and functional treats for daily supplementation.', image_url: FALLBACK_IMAGES[2], sku_count: 180 },
  { name_he: 'חול לחתולים', name_en: 'Cat Litter', description_he: 'חול היגייני לחתולים', description_en: 'Advanced clumping and non-clumping litter for superior hygiene.', image_url: FALLBACK_IMAGES[3], sku_count: 40 },
  { name_he: 'בעלי חיים קטנים', name_en: 'Small Animals', description_he: 'תזונה לבעלי חיים קטנים', description_en: 'Specialist nutrition for rabbits, guinea pigs, hamsters and more.', image_url: FALLBACK_IMAGES[4], sku_count: 120 },
  { name_he: 'ציפורים', name_en: 'Birds', description_he: 'מזון לציפורים', description_en: 'Complete seed mixes and supplements for parrots, canaries and finches.', image_url: FALLBACK_IMAGES[5], sku_count: 80 },
];

export default function Categories() {
  const { t, lang } = useLanguage();
  const { categories } = useCms();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const activeCats = categories.filter((c) => c.active);
  const cats = activeCats.length > 0 ? activeCats : FALLBACK_CATS;

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="categories" ref={ref as React.RefObject<HTMLElement>} className="py-28 lg:py-36 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-8 lg:px-14">
        <div className="mb-16 lg:mb-20">
          <div className="eyebrow eyebrow-line mb-4 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(12px)' }}>{t.categories.eyebrow}</div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <h2 className="section-heading text-4xl lg:text-5xl transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)', transitionDelay: '80ms' }}>
              {t.categories.title1}<br />{t.categories.title2}
            </h2>
            <p className="text-neutral-500 text-sm leading-relaxed max-w-xs transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '160ms' }}>{t.categories.subtitle}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cats.map((cat, i) => {
            const name = lang === 'he' ? cat.name_he : cat.name_en;
            const desc = lang === 'he' ? cat.description_he : cat.description_en;
            const skuLabel = `${cat.sku_count}+ SKUs`;
            const catSlug = 'slug' in cat ? (cat as { slug: string }).slug : '';
            return (
              <a key={i} href={catSlug ? `/categories/${catSlug}` : '#categories'}
                className="group bg-white overflow-hidden cursor-pointer transition-all duration-700 block"
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(28px)', transitionDelay: `${160 + i * 70}ms` }}>
                <div className="relative h-52 overflow-hidden">
                  <img src={cat.image_url} alt={name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute top-4 end-0 bg-brand-red text-white font-heading font-bold text-2xs tracking-widest uppercase px-4 py-1.5">{skuLabel}</div>
                </div>
                <div className="p-7 border-x border-b border-neutral-200 group-hover:border-brand-red/20 transition-colors duration-300">
                  <h3 className="font-serif-display font-bold text-brand-charcoal text-lg mb-2">{name}</h3>
                  <p className="text-neutral-500 text-sm leading-relaxed mb-5">{desc}</p>
                  <div className="flex items-center gap-2 text-brand-red font-heading font-semibold text-xs tracking-wider uppercase transition-all duration-200 group-hover:gap-3">
                    {t.categories.explore} <ArrowRight size={12} />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
