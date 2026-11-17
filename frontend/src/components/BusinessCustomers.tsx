/**
 * BusinessCustomers.tsx — The home page "Business Customers" section (anchor #business, the header's and the hero's
 * "Become a business customer" target): who Ultra Pet supplies, why, and the request form.
 *
 * Customers cannot register themselves: the form sends a request for an account (postLead → POST /api/leads), staff
 * are emailed, review it in /admin/requests and open the account. Used by routes/index.tsx, which passes the
 * section's saved texts (page_sections "business").
 *
 * With `onSave`, staff edit the section's texts in place (EditableSection, the page's language): the heading's words,
 * font and size, and the words of the audience cards and the trust list. The form's own texts (title,
 * labels, button) stay in the dictionaries. The edit form wraps the explanation column only (display: contents), so
 * it never contains the request form.
 */
import { useRef, useState, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { ApiError, postLead, type LeadInput, type SectionContent } from '@/api'
import { fieldLabel, SectionEditBar, useEditableSection, type EditableField } from '@/components/EditableSection'
import { FormField } from '@/components/FormField'
import { EditableText } from '@/components/InlineEditor'
import { HEADING_KEYS, headingLabels, SectionHeading } from '@/components/SectionHeading'
import { Button } from '@/components/ui/button'
import { BUSINESS_AUDIENCES, BUSINESS_TRUST, type AboutItem } from '@/config'
import type { Dictionary } from '@/i18n/he'
import { useI18n } from '@/i18n'
import { useToast } from '@/toast'

/** The section's own titles besides the heading and the lists. */
const BLOCK_KEYS = ['audienceTitle', 'trustTitle'] as const

/** The request form's text fields (the message is optional; the honeypot `website` is not a field people see). */
type Field = 'companyName' | 'contactPerson' | 'phone' | 'email' | 'city' | 'message'

/** The fields every request must have. */
const REQUIRED: Field[] = ['companyName', 'contactPerson', 'phone', 'email', 'city']

/** The longest text the server takes in a field, and in the message. */
const MAX_LENGTH = 200
const MAX_MESSAGE = 2000

/** A phone number as people write it: digits, spaces, dashes, brackets and a leading +, with at least 6 digits. */
const PHONE = /^\+?[\d\s()-]+$/

/** The empty form. */
const EMPTY: Record<Field, string> = { companyName: '', contactPerson: '', phone: '', email: '', city: '', message: '' }

/**
 * Checks the request before it is sent (the server checks it again).
 * @param values - The form's values.
 * @param t - The dictionary.
 * @returns The error text per invalid field (empty when everything is valid).
 */
function validate(values: Record<Field, string>, t: Dictionary): Partial<Record<Field, string>> {
  const b = t.business
  const found: Partial<Record<Field, string>> = {}
  for (const field of REQUIRED) {
    const value = values[field].trim()
    if (!value) found[field] = b.errorRequired
    else if (value.length > MAX_LENGTH) found[field] = b.errorTooLong
  }
  const email = values.email.trim()
  if (!found.email && !/^\S+@\S+\.\S+$/.test(email)) found.email = b.errorEmail
  const phone = values.phone.trim()
  if (!found.phone && (!PHONE.test(phone) || phone.replace(/\D/g, '').length < 6)) found.phone = b.errorPhone
  if (values.message.length > MAX_MESSAGE) found.message = b.errorTooLong
  return found
}

/**
 * The message for a field the server refused.
 * @param field - The refused field.
 * @param code - The server's error code ("required" or "invalid").
 * @param t - The dictionary.
 * @returns The text to show under the field.
 */
function serverError(field: Field, code: string | undefined, t: Dictionary): string {
  const b = t.business
  if (code === 'required') return b.errorRequired
  if (field === 'email') return b.errorEmail
  if (field === 'phone') return b.errorPhone
  return b.errorTooLong
}

/**
 * The request form for a business account: validates, sends the request (the button waits on the server), maps the
 * server's field errors onto the fields, then shows a confirmation in place of the form (and a toast).
 * @returns The form, or the confirmation after it was sent.
 */
function RequestForm() {
  const { t, locale } = useI18n()
  const b = t.business
  const toast = useToast()
  const [values, setValues] = useState(EMPTY)
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * Submit handler: shows the errors and focuses the first invalid field, or sends the request.
   * @param event - The form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const found = validate(values, t)
    setErrors(found)
    const first = (Object.keys(EMPTY) as Field[]).find((field) => found[field])
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#business-${first}`)?.focus()
      return
    }
    setPending(true)
    try {
      const lead: LeadInput = { ...values, website, locale }
      for (const field of Object.keys(EMPTY) as Field[]) lead[field] = values[field].trim()
      await postLead(lead)
      toast.success(b.sent)
      setSent(true)
    } catch (error) {
      const field = error instanceof ApiError && error.status === 400 ? (error.field as Field | undefined) : undefined
      if (field && field in EMPTY) {
        setErrors({ [field]: serverError(field, error instanceof ApiError ? error.code : undefined, t) })
        formRef.current?.querySelector<HTMLElement>(`#business-${field}`)?.focus()
      } else {
        toast.error(b.errorFailed)
      }
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 p-8 text-center lg:p-12">
        <CheckCircle2 aria-hidden="true" className="size-12 text-success" />
        <h3 className="font-display text-2xl font-bold text-brand-charcoal">{b.successTitle}</h3>
        <p className="text-brand-charcoal-muted">{b.successText}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            setValues(EMPTY)
            setSent(false)
          }}
        >
          {b.sendAnother}
        </Button>
      </div>
    )
  }

  const fields: { name: Exclude<Field, 'message'>; label: string; placeholder?: string; type: string; autoComplete: string }[] = [
    { name: 'companyName', label: b.fieldCompany, placeholder: b.fieldCompanyPH, type: 'text', autoComplete: 'organization' },
    { name: 'contactPerson', label: b.fieldContact, placeholder: b.fieldContactPH, type: 'text', autoComplete: 'name' },
    { name: 'phone', label: b.fieldPhone, placeholder: '050-0000000', type: 'tel', autoComplete: 'tel' },
    { name: 'email', label: b.fieldEmail, placeholder: 'name@company.com', type: 'email', autoComplete: 'email' },
    { name: 'city', label: b.fieldCity, placeholder: b.fieldCityPH, type: 'text', autoComplete: 'address-level2' },
  ]

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <h3 id="business-form-title" className="font-display text-2xl font-bold text-brand-charcoal">
        {b.formTitle}
      </h3>
      <p className="mt-1 text-sm text-brand-charcoal-muted">{b.formSubtitle}</p>
      <form ref={formRef} onSubmit={handleSubmit} noValidate aria-labelledby="business-form-title" className="relative mt-8 grid gap-5 sm:grid-cols-2">
        {fields.map((f) => (
          <FormField
            key={f.name}
            id={`business-${f.name}`}
            label={f.label}
            required
            error={errors[f.name]}
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            placeholder={f.placeholder}
            value={values[f.name]}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            dir={f.type === 'text' ? undefined : 'auto'}
            className={f.name === 'contactPerson' || f.name === 'phone' ? undefined : 'sm:col-span-2'}
          />
        ))}
        <FormField
          multiline
          id="business-message"
          label={b.fieldMessage}
          error={errors.message}
          name="message"
          rows={3}
          placeholder={b.fieldMessagePH}
          value={values.message}
          onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
          className="sm:col-span-2"
        />
        {/* A trap for bots: hidden from people and assistive technology; a filled one is dropped by the server. */}
        <div aria-hidden="true" className="pointer-events-none absolute -start-[9999px] top-0 size-px overflow-hidden">
          <label htmlFor="business-website">{b.honeypot}</label>
          <input id="business-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" loading={pending} className="w-full sm:w-auto">
            {b.submit}
          </Button>
          <p className="mt-4 text-xs text-brand-charcoal-muted">{b.formNote}</p>
        </div>
      </form>
    </div>
  )
}

/**
 * One audience card (who Ultra Pet supplies): a title over its description. Not a link, so it never lifts.
 * @param props.title - Its title's EditableText props.
 * @param props.text - Its description's EditableText props.
 * @returns The list item.
 */
function AudienceCard({ title, text }: { title: EditableField; text: EditableField }) {
  return (
    <li className="rounded-2xl border border-neutral-200 bg-white p-6">
      <EditableText as="h4" wrap {...title} className="font-heading text-lg font-semibold text-brand-charcoal" />
      <EditableText multiline {...text} className="mt-2 text-sm text-brand-charcoal-muted" />
    </li>
  )
}

/**
 * The built-in words and box names of every editable text of the section, in the page language.
 * @param t - The dictionary.
 * @param lists - The audiences and trust indicators shown.
 * @returns `defaults` and `labels` by text key: the heading's, BLOCK_KEYS, "audience.<id>.title|text", and "trust.<id>".
 */
function businessTexts(t: Dictionary, lists: { audiences: AboutItem[]; trust: typeof BUSINESS_TRUST }) {
  const b = t.business
  const defaults: Record<string, string> = { eyebrow: b.eyebrow, title: b.title, intro: b.intro }
  const labels: Record<string, string> = headingLabels(t)
  for (const key of BLOCK_KEYS) {
    defaults[key] = b[key]
    labels[key] = fieldLabel(t, 'title', b[key])
  }
  for (const item of lists.audiences) {
    defaults[`audience.${item.id}.title`] = item.title(t)
    defaults[`audience.${item.id}.text`] = item.text(t)
    labels[`audience.${item.id}.title`] = fieldLabel(t, 'title', item.title(t))
    labels[`audience.${item.id}.text`] = fieldLabel(t, 'text', item.title(t))
  }
  for (const item of lists.trust) {
    defaults[`trust.${item.id}`] = item.label(t)
    labels[`trust.${item.id}`] = fieldLabel(t, 'text', item.label(t))
  }
  return { defaults, labels }
}

/**
 * The Business Customers section.
 * @param props.audiences - Who Ultra Pet supplies; defaults to BUSINESS_AUDIENCES in config.ts.
 * @param props.trust - The trust indicators; defaults to BUSINESS_TRUST.
 * @param props.content - The texts staff saved (see businessTexts for the keys); null or omitted = the dictionary's.
 * @param props.onSave - Stores new content (rejects with an ApiError on refusal); given = staff can edit in place.
 * @returns The <section> with the explanation and the request form.
 */
export function BusinessCustomers({
  audiences = BUSINESS_AUDIENCES,
  trust = BUSINESS_TRUST,
  content,
  onSave,
}: {
  audiences?: AboutItem[]
  trust?: typeof BUSINESS_TRUST
  content?: SectionContent | null
  onSave?: (content: SectionContent) => Promise<unknown>
}) {
  const { t } = useI18n()
  const section = useEditableSection<string>({ content, ...businessTexts(t, { audiences, trust }), styled: HEADING_KEYS, onSave: onSave && ((next) => onSave(next)) })
  const { field } = section
  return (
    <section id="business" aria-labelledby="business-title" className="bg-white px-6 py-20 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-7xl">
        {section.edit && <SectionEditBar edit={section.edit} label={t.business.eyebrow} className="bg-white" />}
        <div className="grid gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <form {...section.formProps} className="contents">
            <div className="lg:col-start-1">
              <SectionHeading id="business-title" edit={field} />
              <EditableText as="h3" wrap {...field('audienceTitle')} className="mt-12 font-display text-2xl font-bold text-brand-charcoal" />
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {audiences.map((item) => (
                  <AudienceCard key={item.id} title={field(`audience.${item.id}.title`)} text={field(`audience.${item.id}.text`)} />
                ))}
              </ul>
              <div className="mt-8 rounded-2xl bg-neutral-50 p-6 lg:p-8">
                <EditableText as="h3" wrap {...field('trustTitle')} className="font-display text-xl font-bold text-brand-charcoal" />
                <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {trust.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 text-brand-charcoal">
                      <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-red" />
                      <EditableText as="span" wrap {...field(`trust.${item.id}`)} className="min-w-0 flex-1" />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </form>
          <div className="self-start rounded-3xl border border-neutral-150 bg-white shadow-soft lg:col-start-2 lg:row-start-1">
            <RequestForm />
          </div>
        </div>
      </div>
    </section>
  )
}
