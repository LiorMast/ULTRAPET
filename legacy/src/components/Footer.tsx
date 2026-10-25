import { ArrowRight, Phone, Mail, MessageCircle, MapPin } from 'lucide-react';
import UltraPetLogo from './UltraPetLogo';
import { useLanguage } from '../contexts/LanguageContext';
import { useCms } from '../contexts/CmsContext';

const catKeys = ['dogFood', 'catFood', 'wetFood', 'litter', 'small', 'birds'] as const;
const go = (href: string) => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });

export default function Footer() {
  const { t, lang } = useLanguage();
  const { contact, brands } = useCms();

  const phone = contact.phone || '+972 3 000 0000';
  const email = contact.email || 'info@ultrapetisrael.co.il';
  const whatsapp = contact.whatsapp || '97250000000';
  const location = contact.location || t.contact.locationValue;

  const activeBrands = brands.filter((b) => b.active);
  const brandNames = activeBrands.length > 0
    ? activeBrands.map((b) => b.name)
    : ['Ultra Pet', 'Internutri', 'Greenheart Premiums', 'Paw', 'JR Farm', 'Ultra Clean'];

  const footerLinks = [
    { label: t.footer.linkAbout, href: '#about' },
    { label: t.footer.linkBrands, href: '#brands' },
    { label: t.footer.linkPrivateLabel, href: '#private-label' },
    { label: t.footer.linkBusiness, href: '#business' },
    { label: t.footer.linkContact, href: '#contact' },
  ];

  return (
    <footer className="bg-brand-charcoal text-white">
      <div className="border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-8 lg:px-14 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-serif-display font-bold text-xl text-white mb-1">{t.footer.ctaTitle}</p>
            <p className="text-white/50 text-sm">{t.footer.ctaSubtitle}</p>
          </div>
          <button onClick={() => go('#business')} className="btn-primary text-2xs whitespace-nowrap flex-shrink-0">
            {t.footer.openAccount} <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 lg:px-14 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          <div className="lg:col-span-1">
            <button onClick={() => go('#home')} className="inline-block mb-6">
              <div className="bg-white/95 px-4 py-2.5 inline-block">
                <UltraPetLogo variant="full" className="h-8 w-auto block" />
              </div>
            </button>
            <p className="text-white/40 text-sm leading-relaxed mb-7">{t.footer.description}</p>
            <div className="space-y-3">
              {[
                { icon: Phone, value: phone, href: `tel:${phone.replace(/\s/g, '')}` },
                { icon: Mail, value: email, href: `mailto:${email}` },
                { icon: MessageCircle, value: 'WhatsApp', href: `https://wa.me/${whatsapp}` },
                { icon: MapPin, value: location, href: '#' },
              ].map(({ icon: Icon, value, href }, i) => (
                <a key={i} href={href} className="flex items-center gap-3 text-white/50 hover:text-white text-sm transition-colors">
                  <Icon size={13} className="text-brand-red flex-shrink-0" />{value}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-heading font-bold text-white text-2xs tracking-widest uppercase mb-6">{t.footer.brandsTitle}</h4>
            <ul className="space-y-3">
              {brandNames.map((b) => (
                <li key={b}>
                  <button onClick={() => go('#brands')} className="text-white/45 hover:text-white text-sm transition-colors flex items-center gap-2.5 group">
                    <span className="w-1 h-1 rounded-full bg-brand-red flex-shrink-0 group-hover:scale-150 transition-transform" />{b}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-white text-2xs tracking-widest uppercase mb-6">{t.footer.categoriesTitle}</h4>
            <ul className="space-y-3">
              {catKeys.map((k) => (
                <li key={k}>
                  <button onClick={() => go('#categories')} className="text-white/45 hover:text-white text-sm transition-colors flex items-center gap-2.5 group">
                    <span className="w-1 h-1 rounded-full bg-brand-red flex-shrink-0 group-hover:scale-150 transition-transform" />
                    {t.categories[k]}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-white text-2xs tracking-widest uppercase mb-6">{t.footer.companyTitle}</h4>
            <ul className="space-y-3">
              {footerLinks.map(({ label, href }) => (
                <li key={label}>
                  <button onClick={() => go(href)} className="text-white/45 hover:text-white text-sm transition-colors flex items-center gap-2.5 group">
                    <span className="w-1 h-1 rounded-full bg-brand-red flex-shrink-0 group-hover:scale-150 transition-transform" />{label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-8 lg:px-14 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs">&copy; {new Date().getFullYear()} UltraPet Israel Ltd. {t.footer.rights}</p>
          <div className="flex gap-6">
            {[t.footer.privacy, t.footer.terms, t.footer.cookies].map((text) => (
              <span key={text} className="text-white/30 hover:text-white/60 text-xs cursor-pointer transition-colors">{text}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
