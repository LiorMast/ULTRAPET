/**
 * Contact.tsx — The home page "Contact" section (anchor #contact): contact cards (phone, WhatsApp, email,
 * opening hours) and a message form. Used by routes/index.tsx, which passes the contact details (the settings
 * contact_*, loaded by the root route) and the section's saved texts (page_sections "contact"); the navbar's
 * "Contact" link scrolls here. There is no lead API yet, so a valid form opens the visitor's email app with the
 * message prefilled (mailto:); Phase 2 replaces that with a call to the lead API.
 *
 * With `onSave`, staff edit in place (EditableSection, the page's language): the heading's words, font and size; each
 * card's label and sub-line and the opening hours (words only); and the phone, WhatsApp and email (the settings, the
 * same in every language; checked before anything is saved). While editing, the cards are not links. The edit form
 * wraps the heading and the cards only (display: contents), so it never contains the message form.
 */
import { useState, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from 'cn'
import type { ContactDetails, SectionContent } from '@/api'
import { fieldLabel, SectionEditBar, useEditableSection, type EditableField } from '@/components/EditableSection'
import { EditableText, InlineEditError } from '@/components/InlineEditor'
import { HEADING_KEYS, headingLabels, SectionHeading } from '@/components/SectionHeading'
import type { SettingChanges } from '@/components/Stats'
import { Button } from '@/components/ui/button'
import { CONTACT_METHODS, type ContactMethod } from '@/config'
import { useI18n } from '@/i18n'

/** The setting that holds each contact detail. */
const DETAIL_SETTINGS: Record<keyof ContactDetails, string> = { phone: 'contact_phone', whatsapp: 'contact_whatsapp', email: 'contact_email' }

/** The on-screen keyboard of each contact detail's box. */
const DETAIL_INPUT: Record<keyof ContactDetails, 'tel' | 'email'> = { phone: 'tel', whatsapp: 'tel', email: 'email' }

/** A phone number as staff may write it: digits, spaces, dashes and a leading +, with at least 6 digits. */
const PHONE = /^\+?[\d\s-]+$/

/** An email address (the same loose check as the message form's). */
const EMAIL = /^\S+@\S+\.\S+$/

/**
 * Checks one edited contact detail.
 * @param detail - Which detail.
 * @param value - The edited value, trimmed.
 * @param errors - The translated messages (t.inlineEdit.errors).
 * @returns Why it is refused, or null when it is valid.
 */
function detailError(detail: keyof ContactDetails, value: string, errors: { required: string; phone: string; email: string }): string | null {
  if (!value) return errors.required
  if (detail === 'email') return EMAIL.test(value) ? null : errors.email
  return PHONE.test(value) && value.replace(/\D/g, '').length >= 6 ? null : errors.phone
}

/** Field names of the form. */
type Field = 'name' | 'phone' | 'email' | 'message'

const INPUT_CLASS =
  'mt-2 block w-full border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-brand-charcoal transition-colors focus:border-brand-red focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 aria-[invalid=true]:border-brand-red'

/**
 * One contact card: a link (tel/mailto/WhatsApp) or plain text, with icon, label, value and sub-line.
 * @param props.method - The card's icon (see CONTACT_METHODS in config.ts).
 * @param props.label - Its label's EditableText props.
 * @param props.value - Its value's EditableText props.
 * @param props.sub - Its sub-line's EditableText props.
 * @param props.href - Where the card links to; omitted = plain text (the opening hours, or while editing).
 * @param props.inputMode - The keyboard of the value's box while editing; given for a contact detail, whose value is
 *   then left-to-right (a phone number or an address). Omitted: the value follows the page's direction (the hours).
 * @returns The list item.
 */
function ContactCard({ method, label, value, sub, href, inputMode }: { method: ContactMethod; label: EditableField; value: EditableField; sub: EditableField; href?: string; inputMode?: 'tel' | 'email' }) {
  const Icon = method.icon
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center bg-neutral-100 text-brand-charcoal-muted transition-colors group-hover:bg-brand-red group-hover:text-white">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="block min-w-0 flex-1">
        <EditableText as="span" wrap {...label} className="block font-heading text-2xs font-semibold uppercase tracking-widest text-brand-charcoal-muted" />
        <EditableText as="span" wrap {...value} dir={inputMode && 'ltr'} inputMode={inputMode} className="mt-0.5 block text-sm font-medium text-brand-charcoal" />
        <EditableText as="span" wrap {...sub} className="mt-0.5 block text-xs text-brand-charcoal-muted" />
      </span>
    </>
  )
  const className = 'group flex items-center gap-5 border border-neutral-200 bg-white p-6 transition-all duration-300'
  return (
    <li>
      {href ? (
        <a
          href={href}
          {...(href.startsWith('http') && { target: '_blank', rel: 'noopener noreferrer' })}
          className={cn(className, 'hover:border-brand-red/30 hover:shadow-premium-sm focus-visible:ring-2 focus-visible:ring-brand-red/40')}
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
 * @param props.email - The address the message is sent to.
 * @returns The form, or the confirmation note after a valid submit.
 */
function ContactForm({ email }: { email: string }) {
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
 * @param props.details - The phone, WhatsApp number and email (fetchContact); the cards and the form use them.
 * @param props.methods - The contact cards; defaults to CONTACT_METHODS in config.ts.
 * @param props.content - The texts staff saved (keys "eyebrow", "title", "intro", "method.<id>.label|sub",
 *   "method.hours.value"); null or omitted = the dictionary's.
 * @param props.onSave - Stores the new content and the changed settings (the contact details); rejects with an
 *   ApiError on refusal. Given = staff can edit in place.
 * @returns The <section> with the heading, the cards and the form.
 */
export function Contact({
  details,
  methods = CONTACT_METHODS,
  content,
  onSave,
}: {
  details: ContactDetails
  methods?: ContactMethod[]
  content?: SectionContent | null
  onSave?: (content: SectionContent, settings: SettingChanges) => Promise<unknown>
}) {
  const { t } = useI18n()
  const defaults: Record<string, string> = { eyebrow: t.contact.eyebrow, title: t.contact.title, intro: t.contact.description }
  const labels: Record<string, string> = headingLabels(t)
  const data: Record<string, string> = {}
  for (const method of methods) {
    const name = method.label(t)
    defaults[`method.${method.id}.label`] = name
    defaults[`method.${method.id}.sub`] = method.sub(t)
    labels[`method.${method.id}.label`] = fieldLabel(t, 'label', name)
    labels[`method.${method.id}.sub`] = fieldLabel(t, 'sub', name)
    if (method.detail) {
      data[`detail.${method.detail}`] = details[method.detail]
      defaults[`detail.${method.detail}`] = details[method.detail]
      labels[`detail.${method.detail}`] = t.inlineEdit.fields[method.detail]
    } else {
      defaults[`method.${method.id}.value`] = method.value(t)
      labels[`method.${method.id}.value`] = fieldLabel(t, 'value', name)
    }
  }
  const section = useEditableSection<string>({
    content,
    defaults,
    labels,
    styled: HEADING_KEYS,
    data,
    onSave:
      onSave &&
      (async (next, draft) => {
        const settings: SettingChanges = {}
        for (const detail of Object.keys(DETAIL_SETTINGS) as (keyof ContactDetails)[]) {
          const box = draft[`detail.${detail}`]
          if (!box) continue
          const value = box.text.trim()
          const error = detailError(detail, value, t.inlineEdit.errors)
          if (error) throw new InlineEditError(error, `detail.${detail}`)
          if (value !== details[detail]) settings[DETAIL_SETTINGS[detail]] = value
        }
        await onSave(next, settings)
      }),
  })
  const { field, editing } = section
  return (
    <section id="contact" aria-labelledby="contact-title" className="bg-neutral-50 px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        {section.edit && <SectionEditBar edit={section.edit} label={t.contact.eyebrow} className="bg-neutral-50" />}
        <div className="grid gap-x-10 lg:grid-cols-2">
          <form {...section.formProps} className="contents">
            <SectionHeading id="contact-title" edit={field} className="lg:col-span-2" />
            <ul className="mt-14 space-y-3">
              {methods.map((method) => (
                <ContactCard
                  key={method.id}
                  method={method}
                  label={field(`method.${method.id}.label`)}
                  value={field(method.detail ? `detail.${method.detail}` : `method.${method.id}.value`)}
                  sub={field(`method.${method.id}.sub`)}
                  href={method.detail && !editing ? method.href(details[method.detail]) : undefined}
                  inputMode={method.detail && DETAIL_INPUT[method.detail]}
                />
              ))}
            </ul>
          </form>
          <div className="mt-10 border border-neutral-200 bg-white lg:mt-14">
            <ContactForm email={details.email} />
          </div>
        </div>
      </div>
    </section>
  )
}
