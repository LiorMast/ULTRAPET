/**
 * Contact.tsx — The home page "Contact" section (anchor #contact): contact cards (phone, WhatsApp, email,
 * opening hours) and a message form. Used by routes/index.tsx; the navbar's "Contact" link scrolls here.
 * There is no backend yet, so a valid form opens the visitor's email app with the message prefilled
 * (mailto:); Phase 2 replaces that with a call to the lead API.
 */
import { useState, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CONTACT, CONTACT_METHODS, type ContactMethod } from '@/config'
import { useI18n } from '@/i18n'

/** Field names of the form. */
type Field = 'name' | 'phone' | 'email' | 'message'

const INPUT_CLASS =
  'mt-2 block w-full border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-brand-charcoal transition-colors focus:border-brand-red focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 aria-[invalid=true]:border-brand-red'

/**
 * One contact card: a link (tel/mailto/WhatsApp) or plain text, with icon, label, value and sub-line.
 * @param props.method - The card data (see CONTACT_METHODS in config.ts).
 * @returns The list item.
 */
function ContactCard({ method }: { method: ContactMethod }) {
  const { t } = useI18n()
  const Icon = method.icon
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center bg-neutral-100 text-brand-charcoal-muted transition-colors group-hover:bg-brand-red group-hover:text-white">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="block">
        <span className="block font-heading text-2xs font-semibold uppercase tracking-widest text-brand-charcoal-muted">{method.label(t)}</span>
        <span className="mt-0.5 block text-sm font-medium text-brand-charcoal" dir="auto">{method.value(t)}</span>
        <span className="mt-0.5 block text-xs text-brand-charcoal-muted">{method.sub(t)}</span>
      </span>
    </>
  )
  const className = 'group flex items-center gap-5 border border-neutral-200 bg-white p-6 transition-all duration-300'
  return (
    <li>
      {method.href ? (
        <a
          href={method.href}
          {...(method.href.startsWith('http') && { target: '_blank', rel: 'noopener noreferrer' })}
          className={`${className} hover:border-brand-red/30 hover:shadow-premium-sm focus-visible:ring-2 focus-visible:ring-brand-red/40`}
        >
          {body}
        </a>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  )
}

/**
 * The message form: validates required fields and the email format, then opens a mailto: link with the
 * message prefilled and shows a confirmation note.
 * @param props.email - The address the message is sent to; defaults to CONTACT.email.
 * @returns The form, or the confirmation note after a valid submit.
 */
function ContactForm({ email = CONTACT.email }: { email?: string }) {
  const { t } = useI18n()
  const [values, setValues] = useState<Record<Field, string>>({ name: '', phone: '', email: '', message: '' })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [sent, setSent] = useState(false)

  /**
   * Validates the values.
   * @returns The error text per invalid field (empty when everything is valid).
   */
  const validate = () => {
    const found: Partial<Record<Field, string>> = {}
    for (const field of ['name', 'phone', 'message'] as const) {
      if (!values[field].trim()) found[field] = t.contact.errorRequired
    }
    if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) found.email = t.contact.errorEmail
    return found
  }

  /**
   * Submit handler: shows errors, or opens the mailto: link and the confirmation note.
   * @param event - The form submit event.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const body = `${t.contact.fieldName}: ${values.name}\n${t.contact.fieldPhone}: ${values.phone}\n${t.contact.fieldEmail}: ${values.email}\n\n${values.message}`
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(t.contact.mailSubject)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 p-10 text-center lg:p-14">
        <CheckCircle2 aria-hidden="true" className="size-12 text-green-700" />
        <h3 className="font-display text-xl font-bold text-brand-charcoal">{t.contact.successTitle}</h3>
        <p className="text-sm text-brand-charcoal-muted">{t.contact.successDesc}</p>
      </div>
    )
  }

  const fields: { name: Field; label: string; placeholder: string; type: string; autoComplete: string; required: boolean }[] = [
    { name: 'name', label: t.contact.fieldName, placeholder: t.contact.fieldNamePH, type: 'text', autoComplete: 'name', required: true },
    { name: 'phone', label: t.contact.fieldPhone, placeholder: t.contact.fieldPhonePH, type: 'tel', autoComplete: 'tel', required: true },
    { name: 'email', label: t.contact.fieldEmail, placeholder: 'name@company.com', type: 'email', autoComplete: 'email', required: false },
  ]

  return (
    <div className="p-8 lg:p-10">
      <div className="border-s-2 border-brand-red ps-4">
        <h3 className="font-heading text-lg font-bold text-brand-charcoal">{t.contact.formTitle}</h3>
        <p className="mt-0.5 text-xs text-brand-charcoal-muted">{t.contact.formSubtitle}</p>
      </div>
      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        {fields.map((f) => (
          <div key={f.name}>
            <label htmlFor={`contact-${f.name}`} className="block font-heading text-2xs font-semibold uppercase tracking-widest text-brand-charcoal-muted">
              {f.label}{f.required && ' *'}
            </label>
            <input
              id={`contact-${f.name}`}
              name={f.name}
              type={f.type}
              autoComplete={f.autoComplete}
              placeholder={f.placeholder}
              value={values[f.name]}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              aria-required={f.required}
              aria-invalid={!!errors[f.name]}
              aria-describedby={errors[f.name] ? `contact-${f.name}-error` : undefined}
              dir={f.type === 'text' ? undefined : 'auto'}
              className={INPUT_CLASS}
            />
            {errors[f.name] && <p id={`contact-${f.name}-error`} className="mt-1 text-xs font-medium text-brand-red-dark">{errors[f.name]}</p>}
          </div>
        ))}
        <div>
          <label htmlFor="contact-message" className="block font-heading text-2xs font-semibold uppercase tracking-widest text-brand-charcoal-muted">
            {t.contact.fieldMessage} *
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={5}
            placeholder={t.contact.fieldMessagePH}
            value={values.message}
            onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
            aria-required
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? 'contact-message-error' : undefined}
            className={INPUT_CLASS}
          />
          {errors.message && <p id="contact-message-error" className="mt-1 text-xs font-medium text-brand-red-dark">{errors.message}</p>}
        </div>
        <Button type="submit" className="w-full sm:w-auto">{t.contact.send}</Button>
      </form>
    </div>
  )
}

/**
 * The contact section.
 * @param props.methods - The contact cards; defaults to CONTACT_METHODS in config.ts.
 * @param props.email - The address the form sends to; defaults to CONTACT.email.
 * @returns The <section> with the heading, the cards and the form.
 */
export function Contact({ methods = CONTACT_METHODS, email }: { methods?: ContactMethod[]; email?: string }) {
  const { t } = useI18n()
  return (
    <section id="contact" aria-labelledby="contact-title" className="bg-neutral-50 px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-red">{t.contact.eyebrow}</p>
          <h2 id="contact-title" className="mt-4 font-display text-4xl font-bold text-brand-charcoal lg:text-5xl">{t.contact.title}</h2>
          <p className="mt-5 text-lg text-brand-charcoal-muted">{t.contact.description}</p>
        </div>
        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <ul className="space-y-3">
            {methods.map((method) => (
              <ContactCard key={method.id} method={method} />
            ))}
          </ul>
          <div className="border border-neutral-200 bg-white">
            <ContactForm email={email} />
          </div>
        </div>
      </div>
    </section>
  )
}
