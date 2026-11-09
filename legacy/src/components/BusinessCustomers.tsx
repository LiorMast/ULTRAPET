import { useState, useEffect, useRef } from 'react';
import { Building2, User, Phone, Mail, MapPin, ArrowRight, CheckCircle, Loader, Store, ShoppingCart, Network, Boxes } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

type Status = 'idle' | 'submitting' | 'success' | 'error';
type Fields = { company_name: string; contact_person: string; phone: string; email: string; city: string; };

function FormField({ label, icon: Icon, name, value, onChange, placeholder, type = 'text', required = false }:
  { label: string; icon: React.ElementType; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string; type?: string; required?: boolean; }) {
  return (
    <div>
      <label className="block text-2xs font-heading font-semibold tracking-widest uppercase text-neutral-400 mb-2">{label}{required && ' *'}</label>
      <div className="relative">
        <Icon size={14} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-neutral-300 pointer-events-none" />
        <input type={type} name={name} value={value} onChange={onChange} required={required} placeholder={placeholder}
          className="w-full ps-10 pe-4 py-3.5 border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-brand-red focus:outline-none text-sm text-brand-charcoal placeholder:text-neutral-300 transition-colors duration-200" />
      </div>
    </div>
  );
}

export default function BusinessCustomers() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState<Fields>({ company_name: '', contact_person: '', phone: '', email: '', city: '' });
  const ref = useRef<HTMLElement>(null);

  const audiences = [
    { icon: Store, title: t.business.audienceStores, desc: t.business.audienceStoresDesc },
    { icon: ShoppingCart, title: t.business.audienceChains, desc: t.business.audienceChainsDesc },
    { icon: Network, title: t.business.audienceDistributors, desc: t.business.audienceDistributorsDesc },
    { icon: Boxes, title: t.business.audienceWholesalers, desc: t.business.audienceWholesalersDesc },
  ];
  const trust = [
    { value: '300+', label: t.business.trustRetail },
    { value: '15+', label: t.business.trustManufacturing },
    { value: '12+', label: t.business.trustYears },
    { value: '6+', label: t.business.trustCountries },
  ];

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.05 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');
    const { error } = await supabase.from('business_leads').insert([form]);
    if (error) { setStatus('error'); setErrorMsg(t.business.error); }
    else setStatus('success');
  };

  return (
    <section id="business" ref={ref as React.RefObject<HTMLElement>} className="bg-white">
      {/* Who we supply */}
      <div className="bg-neutral-50 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-8 lg:px-14 py-14 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10">
            <div>
              <div className="eyebrow eyebrow-line mb-4 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(12px)' }}>{t.business.eyebrow}</div>
              <h2 className="section-heading text-4xl lg:text-5xl transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)', transitionDelay: '80ms' }}>{t.business.supplyTitle}</h2>
            </div>
            <p className="text-neutral-500 text-base leading-relaxed max-w-sm transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '160ms' }}>{t.business.supplyDesc}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {audiences.map((a, i) => (
              <div key={i} className="group bg-white border border-neutral-200 p-7 hover:border-brand-red/30 hover:shadow-premium-sm transition-all duration-400 cursor-default"
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transitionDelay: `${160 + i * 80}ms`, transitionDuration: '700ms' }}>
                <div className="w-12 h-12 bg-neutral-100 group-hover:bg-brand-red/10 flex items-center justify-center mb-5 transition-colors duration-300">
                  <a.icon size={20} className="text-neutral-500 group-hover:text-brand-red transition-colors duration-300" />
                </div>
                <h4 className="font-heading font-bold text-brand-charcoal text-base mb-2">{a.title}</h4>
                <p className="text-neutral-500 text-sm leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main form area */}
      <div className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-8 lg:px-14">
          <div className="grid lg:grid-cols-[1fr_520px] xl:grid-cols-[1fr_560px] gap-14 xl:gap-20 items-start">
            {/* Left */}
            <div className="transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transitionDelay: '100ms' }}>
              <div className="eyebrow eyebrow-line mb-4">{t.business.eyebrow}</div>
              <h3 className="section-heading text-4xl lg:text-5xl mb-6">{t.business.joinTitle}<br />{t.business.joinTitle2}</h3>
              <p className="text-neutral-500 text-base leading-relaxed mb-10">{t.business.joinDesc}</p>
              <div className="grid grid-cols-2 gap-3 mb-10">
                {trust.map((tr, i) => (
                  <div key={i} className="bg-neutral-50 border border-neutral-200 p-5 transition-all duration-700" style={{ transitionDelay: `${200 + i * 60}ms`, opacity: visible ? 1 : 0 }}>
                    <div className="font-serif-display font-bold text-brand-charcoal text-3xl leading-none mb-1">{tr.value}</div>
                    <div className="text-neutral-500 text-xs leading-relaxed">{tr.label}</div>
                  </div>
                ))}
              </div>
              <div className="mb-8">
                <div className="text-2xs font-heading font-bold tracking-widest uppercase text-neutral-400 mb-4">{t.business.benefitsTitle}</div>
                <div className="space-y-3">
                  {t.business.benefits.map((b, i) => (
                    <div key={i} className="flex items-start gap-3 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(-12px)', transitionDelay: `${320 + i * 60}ms` }}>
                      <div className="w-4 h-4 bg-brand-red flex items-center justify-center flex-shrink-0 mt-0.5"><CheckCircle size={10} className="text-white" strokeWidth={3} /></div>
                      <span className="text-neutral-600 text-sm leading-snug">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-brand-charcoal p-6 flex items-start gap-4">
                <div className="w-10 h-10 bg-brand-red flex items-center justify-center flex-shrink-0"><Network size={16} className="text-white" /></div>
                <div>
                  <div className="font-heading font-bold text-white text-sm mb-1">{t.business.logisticsTitle}</div>
                  <div className="text-white/50 text-xs leading-relaxed">{t.business.logisticsDesc}</div>
                </div>
              </div>
            </div>

            {/* Right: form */}
            <div className="border border-neutral-200 bg-white shadow-premium-sm overflow-hidden transition-all duration-700"
              style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transitionDelay: '200ms' }}>
              <div className="bg-brand-charcoal px-8 py-7">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-brand-red flex items-center justify-center flex-shrink-0 mt-0.5"><Building2 size={16} className="text-white" /></div>
                  <div>
                    <h4 className="font-heading font-bold text-white text-lg leading-tight">{t.business.formTitle}</h4>
                    <p className="text-white/50 text-xs mt-1">{t.business.formSubtitle}</p>
                  </div>
                </div>
              </div>
              {status === 'success' ? (
                <div className="px-8 py-16 flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center"><CheckCircle size={32} className="text-green-600" /></div>
                  <h4 className="font-serif-display font-bold text-brand-charcoal text-2xl">{t.business.successTitle}</h4>
                  <p className="text-neutral-500 text-sm max-w-xs leading-relaxed">{t.business.successDesc}</p>
                  <div className="mt-2 px-4 py-2 bg-neutral-50 border border-neutral-200 text-neutral-400 text-xs">{Date.now().toString(36).toUpperCase()}</div>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="px-8 py-8 space-y-5">
                  <FormField label={t.business.fieldCompany} icon={Building2} name="company_name" value={form.company_name} onChange={onChange} placeholder={t.business.fieldCompanyPH} required />
                  <FormField label={t.business.fieldContact} icon={User} name="contact_person" value={form.contact_person} onChange={onChange} placeholder={t.business.fieldContactPH} required />
                  <div className="grid sm:grid-cols-2 gap-5">
                    <FormField label={t.business.fieldPhone} icon={Phone} name="phone" value={form.phone} onChange={onChange} placeholder={t.business.fieldPhonePH} type="tel" required />
                    <FormField label={t.business.fieldEmail} icon={Mail} name="email" value={form.email} onChange={onChange} placeholder={t.business.fieldEmailPH} type="email" required />
                  </div>
                  <FormField label={t.business.fieldCity} icon={MapPin} name="city" value={form.city} onChange={onChange} placeholder={t.business.fieldCityPH} required />
                  {status === 'error' && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs">{errorMsg}</div>}
                  <button type="submit" disabled={status === 'submitting'} className="w-full btn-primary py-4 text-xs disabled:opacity-60 mt-2">
                    {status === 'submitting' ? <><Loader size={14} className="animate-spin" /> {t.business.submitting}</> : <>{t.business.submit} <ArrowRight size={14} /></>}
                  </button>
                  <p className="text-center text-neutral-400 text-2xs">{t.business.disclaimer}</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
