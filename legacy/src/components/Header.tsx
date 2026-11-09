import { useState, useEffect, useRef } from 'react';
import { Menu, X, Globe, ChevronDown } from 'lucide-react';
import UltraPetLogo from './UltraPetLogo';
import { useLanguage } from '../contexts/LanguageContext';
import { LANGUAGES, type Language } from '../lib/i18n';

const LANG_LABELS: Record<Language, string> = { he: 'עברית', en: 'English' };
const COMING_SOON = ['ru', 'ar'] as const;
const COMING_SOON_LABELS: Record<string, string> = { ru: 'Русский', ar: 'العربية' };

interface LogoProps {
  scrolled: boolean;
  logoUrl: string;
  logoWidth: string;
  logoHeight: string;
  className?: string;
}

function SiteLogo({ scrolled, logoUrl, logoWidth, logoHeight, className = '' }: LogoProps) {
  const style: React.CSSProperties = {};
  if (logoWidth) style.width = `${logoWidth}px`;
  if (logoHeight) style.height = `${logoHeight}px`;

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Logo"
        className={`block w-auto object-contain transition-all duration-300 ${!logoHeight ? (scrolled ? 'h-10' : 'h-9') : ''} ${className}`}
        style={style}
        draggable={false}
      />
    );
  }

  return (
    <UltraPetLogo
      variant="full"
      className={`block w-auto transition-all duration-300 ${scrolled ? 'h-10' : 'h-9'} ${className}`}
    />
  );
}

export default function Header() {
  const { t, lang, setLang, isRtl } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const { headerLogoUrl, headerLogoWidth, headerLogoHeight, mobileLogoUrl, faviconUrl } = t.siteIdentity;
  // Mobile logo falls back to the main header logo
  const effectiveMobileLogoUrl = mobileLogoUrl || headerLogoUrl;

  // Dynamically update the favicon when a CMS URL is provided
  useEffect(() => {
    if (!faviconUrl) return;
    const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (existing) {
      existing.href = faviconUrl;
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = faviconUrl;
      document.head.appendChild(link);
    }
  }, [faviconUrl]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (href: string) => {
    setMobileOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    { label: t.nav.brands, href: '#brands' },
    { label: t.nav.products, href: '#categories' },
    { label: t.nav.privateLabel, href: '#private-label' },
    { label: t.nav.about, href: '#about' },
    { label: t.nav.contact, href: '#contact' },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-sm border-b border-neutral-150 py-3 shadow-premium-sm'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between gap-6">

          {/* Logo */}
          <button
            onClick={() => go('#home')}
            className="flex-shrink-0 group"
            aria-label="UltraPet Home"
          >
            <div className={`transition-all duration-500 ${
              scrolled || headerLogoUrl
                ? 'bg-transparent px-0 py-0'
                : 'bg-white/92 backdrop-blur-sm px-3 py-2'
            }`}>
              <SiteLogo
                scrolled={scrolled}
                logoUrl={headerLogoUrl}
                logoWidth={headerLogoWidth}
                logoHeight={headerLogoHeight}
              />
            </div>
          </button>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7 flex-1 justify-center">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => go(link.href)}
                className={`relative font-heading font-medium text-xs tracking-widest uppercase transition-colors duration-200 group ${
                  scrolled ? 'text-neutral-600 hover:text-brand-red' : 'text-white/80 hover:text-white'
                }`}
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-brand-red transition-all duration-300 group-hover:w-full" />
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 font-heading font-semibold text-xs tracking-widest uppercase transition-colors duration-200 ${
                  scrolled ? 'text-neutral-500 hover:text-brand-red' : 'text-white/70 hover:text-white'
                }`}
                aria-label={t.lang.switchLabel}
              >
                <Globe size={13} />
                <span>{LANG_LABELS[lang]}</span>
                <ChevronDown
                  size={10}
                  className={`transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {langOpen && (
                <div className="absolute top-full mt-2 bg-white border border-neutral-200 shadow-premium-sm min-w-[160px] py-1 z-50"
                  style={{ [isRtl ? 'left' : 'right']: 0 }}
                >
                  {LANGUAGES.map((l) => (
                    <button
                      key={l}
                      onClick={() => { setLang(l); setLangOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-heading font-medium transition-colors duration-150 ${
                        l === lang
                          ? 'text-brand-red bg-brand-red/5'
                          : 'text-neutral-700 hover:bg-neutral-50 hover:text-brand-red'
                      }`}
                      dir={l === 'he' || l === 'ar' ? 'rtl' : 'ltr'}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${l === lang ? 'bg-brand-red' : 'bg-neutral-300'}`} />
                      {LANG_LABELS[l]}
                    </button>
                  ))}
                  <div className="border-t border-neutral-100 mt-1 pt-1">
                    {COMING_SOON.map((l) => (
                      <div
                        key={l}
                        className="flex items-center justify-between px-4 py-2.5"
                        dir={l === 'ar' ? 'rtl' : 'ltr'}
                      >
                        <span className="text-sm font-heading text-neutral-300">{COMING_SOON_LABELS[l]}</span>
                        <span className="text-2xs font-heading font-bold text-neutral-300 tracking-wider uppercase">{t.lang.comingSoon}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => go('#business')}
              className="btn-primary py-3 px-6 text-2xs"
            >
              {t.nav.businessCta}
            </button>
          </div>

          {/* Mobile: lang + menu toggle */}
          <div className="lg:hidden flex items-center gap-1">
            <button
              onClick={() => { setLang(lang === 'he' ? 'en' : 'he'); }}
              className={`flex items-center gap-1.5 p-2 font-heading font-semibold text-xs transition-colors ${
                scrolled ? 'text-neutral-500' : 'text-white/80 bg-white/10 rounded-sm'
              }`}
              aria-label="Switch language"
            >
              <Globe size={14} />
              <span className="text-xs">{lang === 'he' ? 'EN' : 'עב'}</span>
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
              className={`p-2 transition-colors ${scrolled ? 'text-brand-charcoal' : 'text-white'}`}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-all duration-300 ${
          mobileOpen ? 'visible' : 'invisible'
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`absolute ${isRtl ? 'left-0' : 'right-0'} top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
            mobileOpen ? 'translate-x-0' : isRtl ? '-translate-x-full' : 'translate-x-full'
          }`}
        >
          {/* Drawer header — uses mobile logo (or falls back to desktop logo) */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-150">
            <SiteLogo
              scrolled={true}
              logoUrl={effectiveMobileLogoUrl}
              logoWidth=""
              logoHeight=""
              className="h-9"
            />
            <button onClick={() => setMobileOpen(false)} className="text-neutral-400 hover:text-brand-charcoal ms-4">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 px-6 py-8 space-y-1">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => go(link.href)}
                className="w-full text-left py-3.5 font-heading font-semibold text-xs tracking-widest uppercase text-neutral-700 hover:text-brand-red border-b border-neutral-100 last:border-0 transition-colors"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="px-6 pb-4 border-t border-neutral-100 pt-4">
            <div className="text-2xs font-heading font-bold tracking-widest uppercase text-neutral-400 mb-3">
              {t.lang.switchLabel}
            </div>
            <div className="flex gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => { setLang(l); setMobileOpen(false); }}
                  className={`flex-1 py-2.5 text-xs font-heading font-semibold border transition-all duration-200 ${
                    l === lang
                      ? 'bg-brand-red text-white border-brand-red'
                      : 'text-neutral-600 border-neutral-200 hover:border-brand-red hover:text-brand-red'
                  }`}
                  dir={l === 'he' ? 'rtl' : 'ltr'}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 pb-8">
            <button onClick={() => go('#business')} className="w-full btn-primary py-4 text-2xs">
              {t.nav.businessCta}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
