import { useState, useEffect, useRef } from 'react';
import { Phone, Mail, MessageCircle, MapPin, Send, Loader, CheckCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCms } from '../contexts/CmsContext';

type Status = 'idle' | 'submitting' | 'success';

export default function Contact() {
  const { t } = useLanguage();
  const { contact } = useCms();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const ref = useRef<HTMLElement>(null);

  const phone = contact.phone || '+972 3 000 0000';
  const email = contact.email || 'info@ultrapetisrael.co.il';
  const whatsapp = contact.whatsapp || '97250000000';
  const location = contact.location || t.contact.locationValue;

  const contactMethods = [
    { icon: Phone, label: t.contact.phoneLabel, value: phone, sub: t.contact.phoneSub, href: `tel:${phone.replace(/\s/g, '')}` },
    { icon: Mail, label: t.contact.emailLabel, value: email, sub: t.contact.emailSub, href: `mailto:${email}` },
    { icon: MessageCircle, label: t.contact.whatsappLabel, value: `+${whatsapp}`, sub: t.contact.whatsappSub, href: `https://wa.me/${whatsapp}` },
    { icon: MapPin, label: t.contact.locationLabel, value: location, sub: t.contact.locationSub, href: '#' },
  ];

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    await new Promise((r) => setTimeout(r, 1400));
    setStatus('success');
  };

  return (
    <section id="contact" ref={ref as React.RefObject<HTMLElement>} className="py-28 lg:py-36 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-8 lg:px-14">
        <div className="grid lg:grid-cols-2 gap-6 items-end mb-16">
          <div>
            <div className="eyebrow eyebrow-line mb-4 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(12px)' }}>{t.contact.eyebrow}</div>
            <h2 className="section-heading text-4xl lg:text-5xl transition-all duration-700" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)', transitionDelay: '80ms' }}>{t.contact.title}</h2>
          </div>
          <p className="text-neutral-500 text-base leading-relaxed max-w-sm transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '160ms' }}>{t.contact.description}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          <div className="space-y-3 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '200ms' }}>
            {contactMethods.map((m, i) => (
              <a key={i} href={m.href} className="flex items-center gap-5 p-6 bg-white border border-neutral-200 hover:border-brand-red/30 hover:shadow-premium-sm transition-all duration-300 group">
                <div className="w-11 h-11 bg-neutral-100 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-red transition-colors duration-300">
                  <m.icon size={18} className="text-neutral-500 group-hover:text-white transition-colors duration-300" />
                </div>
                <div>
                  <div className="font-heading font-semibold text-2xs tracking-widest uppercase text-neutral-400 mb-0.5">{m.label}</div>
                  <div className="font-medium text-brand-charcoal text-sm">{m.value}</div>
                  <div className="text-neutral-400 text-xs mt-0.5">{m.sub}</div>
                </div>
              </a>
            ))}
          </div>

          <div className="bg-white border border-neutral-200 transition-all duration-700" style={{ opacity: visible ? 1 : 0, transitionDelay: '300ms' }}>
            {status === 'success' ? (
              <div className="flex flex-col items-center justify-center text-center p-14 gap-4">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center"><CheckCircle size={26} className="text-green-600" /></div>
                <h3 className="font-serif-display font-bold text-brand-charcoal text-xl">{t.contact.successTitle}</h3>
                <p className="text-neutral-400 text-sm">{t.contact.successDesc}</p>
              </div>
            ) : (
              <div className="p-8 lg:p-10">
                <div className="border-s-2 border-brand-red ps-4 mb-8">
                  <h3 className="font-heading font-bold text-brand-charcoal text-lg">{t.contact.formTitle}</h3>
                  <p className="text-neutral-400 text-xs mt-0.5">{t.contact.formSubtitle}</p>
                </div>
                <form onSubmit={onSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-2xs font-heading font-semibold tracking-widest uppercase text-neutral-400 mb-2">{t.contact.fieldName} *</label>
                      <input type="text" name="name" value={form.name} onChange={onChange} required placeholder={t.contact.fieldNamePH}
                        className="w-full px-4 py-3 border border-neutral-200 focus:border-brand-red focus:outline-none text-sm transition-colors bg-neutral-50 focus:bg-white" />
                    </div>
                    <div>
                      <label className="block text-2xs font-heading font-semibold tracking-widest uppercase text-neutral-400 mb-2">{t.contact.fieldPhone}</label>
                      <input type="tel" name="phone" value={form.phone} onChange={onChange} placeholder={t.contact.fieldPhonePH}
                        className="w-full px-4 py-3 border border-neutral-200 focus:border-brand-red focus:outline-none text-sm transition-colors bg-neutral-50 focus:bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-2xs font-heading font-semibold tracking-widest uppercase text-neutral-400 mb-2">{t.contact.fieldEmail} *</label>
                    <input type="email" name="email" value={form.email} onChange={onChange} required placeholder="email@company.com"
                      className="w-full px-4 py-3 border border-neutral-200 focus:border-brand-red focus:outline-none text-sm transition-colors bg-neutral-50 focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-2xs font-heading font-semibold tracking-widest uppercase text-neutral-400 mb-2">{t.contact.fieldMessage} *</label>
                    <textarea name="message" value={form.message} onChange={onChange} required rows={5} placeholder={t.contact.fieldMessagePH}
                      className="w-full px-4 py-3 border border-neutral-200 focus:border-brand-red focus:outline-none text-sm transition-colors resize-none bg-neutral-50 focus:bg-white" />
                  </div>
                  <button type="submit" disabled={status === 'submitting'} className="w-full btn-primary py-4 disabled:opacity-60">
                    {status === 'submitting' ? <><Loader size={14} className="animate-spin" /> {t.contact.sending}</> : <><Send size={14} /> {t.contact.send}</>}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
