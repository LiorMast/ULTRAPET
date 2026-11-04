/**
 * DiscountDialog.tsx — The admin panel's dialog for creating or editing one discount, whatever it applies to: a
 * category or a product (for all customers or one customer), or a payment method.
 *
 * It asks for the type (a percentage or an amount in shekels before VAT, as a switch), the value, a start date
 * and an end date or "no end date". The value is always positive: the percent or the shekels taken off. A live summary reads the result back in words ("10% off, from 3 Nov 2026, with no end date"). The
 * dialog knows nothing about storage: it hands the caller a DiscountValue, and the caller saves it for its
 * target (e.g. a price rule); when the save is refused, the dialog shows why and stays open. describeDiscount
 * words a discount the same way for lists (DiscountsDialog).
 */
import { useId, useState, type FormEvent } from 'react'
import { cn } from 'cn'
import { ApiError } from '@/api'
import { errorMessage, INPUT_CLASS, LABEL_CLASS } from '@/components/RecordDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n, type Locale } from '@/i18n'
import type { Dictionary } from '@/i18n/he'

/**
 * One discount. `value` > 0 is what is taken off: percent for "percent", shekels before VAT for
 * "amount". `startsOn` / `endsOn` are Israel dates ("2026-11-03", inclusive); `endsOn` null = no end date.
 */
export type DiscountValue = { type: 'percent' | 'amount'; value: number; startsOn: string; endsOn: string | null }

/** The field a message belongs to. */
type FieldName = 'value' | 'startsOn' | 'endsOn'

/**
 * Today's date in Israel, the day discount periods are counted in (as backend/app/pricing.py does).
 * @returns E.g. "2026-11-03".
 */
export function israelToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

/**
 * Formats a discount value for people, with its unit.
 * @param type - Percent or amount.
 * @param value - The value.
 * @param locale - The page language.
 * @returns E.g. "10%" or "₪20.00", isolated from the text around it so Hebrew sentences keep "7.5%" in order.
 */
function formatValue(type: DiscountValue['type'], value: number, locale: Locale): string {
  const text =
    type === 'percent'
      ? `${value.toLocaleString(locale, { maximumFractionDigits: 2 })}%`
      : value.toLocaleString(locale, { style: 'currency', currency: 'ILS' })
  // U+2066 / U+2069: a left-to-right isolate around the number and its unit.
  return `\u2066${text}\u2069`
}

/**
 * Formats an Israel date ("2026-11-03") for people.
 * @param date - The date.
 * @param locale - The page language.
 * @returns E.g. "3 Nov 2026".
 */
function formatDate(date: string, locale: Locale): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale, { dateStyle: 'medium' })
}

/**
 * Words a discount for people: its value and its period.
 * @param discount - The discount; an empty `startsOn` leaves the period out.
 * @param t - The dictionary.
 * @param locale - The page language.
 * @returns E.g. "10% off, from 3 Nov 2026, with no end date" or "₪20.00 off, from 1 Nov 2026 to 30 Nov 2026".
 */
export function describeDiscount({ type, value, startsOn, endsOn }: DiscountValue, t: Dictionary, locale: Locale): string {
  const d = t.admin.discount
  return [
    d.summaryDiscount.replace('{value}', formatValue(type, value, locale)),
    startsOn &&
      (endsOn ? d.summaryPeriod : d.summaryOpen)
        .replace('{start}', formatDate(startsOn, locale))
        .replace('{end}', endsOn ? formatDate(endsOn, locale) : ''),
  ]
    .filter(Boolean)
    .join(', ')
}

/**
 * The create/edit discount dialog.
 * @param props.open - Whether the dialog is open.
 * @param props.onOpenChange - Called to open or close it (Cancel, Escape, the X, a click outside, after saving).
 * @param props.onSave - Saves the discount; rejects with ApiError to show the server's reason and keep the
 *   dialog open.
 * @param props.initial - The discount being edited (an empty start date starts from today); omit to create one (a
 *   percentage, from today, no end date).
 * @param props.title - The title; defaults to "New discount", or "Edit discount" when `initial` is given.
 * @param props.target - What the discount applies to, shown under the title (e.g. "Dry dog food — Demo Pet Shop").
 * @param props.onCloseAutoFocus - Where the focus goes after closing (the button that opened it); without it, the
 *   focus is left on the page.
 * @returns The dialog.
 */
export function DiscountDialog({
  open,
  onOpenChange,
  onSave,
  initial,
  title,
  target,
  onCloseAutoFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (discount: DiscountValue) => Promise<unknown>
  initial?: DiscountValue
  title?: string
  target?: string
  onCloseAutoFocus?: (event: Event) => void
}) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t.admin.close} onCloseAutoFocus={onCloseAutoFocus}>
        {/* Mounted only while open, so every opening starts from `initial`. */}
        <DiscountForm
          initial={initial}
          title={title ?? (initial ? t.admin.discount.editTitle : t.admin.discount.createTitle)}
          target={target}
          onSave={async (discount) => {
            await onSave(discount)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

/**
 * The dialog's form: the type switch, value, dates, summary and buttons.
 * @param props.initial - The discount being edited, if any.
 * @param props.title - The dialog title.
 * @param props.target - What the discount applies to, if given.
 * @param props.onSave - Saves (rejects with ApiError on refusal).
 * @param props.onCancel - Closes without saving.
 * @returns The title block and the form.
 */
function DiscountForm({
  initial,
  title,
  target,
  onSave,
  onCancel,
}: {
  initial?: DiscountValue
  title: string
  target?: string
  onSave: (discount: DiscountValue) => Promise<void>
  onCancel: () => void
}) {
  const { t, locale } = useI18n()
  const d = t.admin.discount
  const id = useId()
  const [type, setType] = useState<DiscountValue['type']>(initial?.type ?? 'percent')
  const [value, setValue] = useState(initial ? String(initial.value) : '')
  const [startsOn, setStartsOn] = useState(initial?.startsOn || israelToday())
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? '')
  const [noEnd, setNoEnd] = useState(initial ? initial.endsOn === null : true)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  const number = Number(value.trim())
  const valid = /^-?\d+(\.\d{1,2})?$/.test(value.trim()) && number > 0
  const summary = valid ? describeDiscount({ type, value: number, startsOn, endsOn: noEnd || !endsOn ? null : endsOn }, t, locale) : ''

  /**
   * Checks the fields, then saves; puts each problem (or the server's reason) next to its field.
   * @param event - The form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found: Partial<Record<FieldName, string>> = {}
    if (!value.trim()) found.value = t.admin.errors.required
    else if (!/^-?\d+(\.\d{1,2})?$/.test(value.trim())) found.value = d.errorNumber
    else if (number <= 0) found.value = d.errorPositive
    else if (type === 'percent' && number > 100) found.value = d.errorPercent
    if (!startsOn) found.startsOn = t.admin.errors.required
    if (!noEnd && !endsOn) found.endsOn = t.admin.errors.required
    else if (!noEnd && startsOn && endsOn < startsOn) found.endsOn = d.errorEnd
    setErrors(found)
    setFormError('')
    const first = (['value', 'startsOn', 'endsOn'] as const).find((name) => found[name])
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus()
      return
    }
    setPending(true)
    try {
      await onSave({ type, value: number, startsOn, endsOn: noEnd ? null : endsOn })
    } catch (error) {
      setFormError(errorMessage(error instanceof ApiError ? error.code : undefined, t))
      setPending(false)
    }
  }

  /**
   * The accessibility attributes of a field with a hint and/or an error.
   * @param name - The field.
   * @param hint - The id of its hint, if it has one.
   * @returns aria-invalid and aria-describedby.
   */
  const described = (name: FieldName, hint?: string) => ({
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': [hint, errors[name] && `${id}-${name}-error`].filter(Boolean).join(' ') || undefined,
  })
  /**
   * The error message of a field, if any.
   * @param name - The field.
   * @returns The message element, or null.
   */
  const fieldError = (name: FieldName) =>
    errors[name] ? <p id={`${id}-${name}-error`} className="mt-1 text-xs font-medium text-brand-red-dark">{errors[name]}</p> : null

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {target && <span className="block font-semibold text-brand-charcoal">{target}</span>}
          {d.description}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
          <fieldset>
            <legend className={LABEL_CLASS}>{d.type}</legend>
            <div className="mt-2 grid grid-cols-2 border border-neutral-300">
              {(['percent', 'amount'] as const).map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center justify-center py-2.5 text-sm font-medium text-brand-charcoal transition-colors has-checked:bg-brand-charcoal has-checked:text-white has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-brand-red"
                >
                  <input type="radio" name={`${id}-type`} value={option} checked={type === option} onChange={() => setType(option)} className="sr-only" />
                  {option === 'percent' ? `${d.percent} (%)` : `${d.amount} (₪)`}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`${id}-value`} className={LABEL_CLASS}>{`${d.value} *`}</label>
            {/* Numbers read left to right in every language, so the unit sits on the right in Hebrew too. */}
            <span className="relative mt-2 block" dir="ltr">
              <input
                id={`${id}-value`}
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-required
                className={cn(INPUT_CLASS, 'mt-0 pe-10')}
                {...described('value', `${id}-value-hint`)}
              />
              <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm text-brand-charcoal-muted" aria-hidden>
                {type === 'percent' ? '%' : '₪'}
              </span>
            </span>
            <p id={`${id}-value-hint`} className="mt-1 text-xs text-brand-charcoal-muted">
              {type === 'percent' ? d.percentHint : d.amountHint}
            </p>
            {fieldError('value')}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-startsOn`} className={LABEL_CLASS}>{`${d.startsOn} *`}</label>
              <input id={`${id}-startsOn`} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} aria-required className={INPUT_CLASS} {...described('startsOn')} />
              {fieldError('startsOn')}
            </div>
            <div>
              <label htmlFor={`${id}-endsOn`} className={LABEL_CLASS}>{d.endsOn}</label>
              <input
                id={`${id}-endsOn`}
                type="date"
                value={noEnd ? '' : endsOn}
                min={startsOn || undefined}
                disabled={noEnd}
                onChange={(e) => setEndsOn(e.target.value)}
                className={INPUT_CLASS}
                {...described('endsOn')}
              />
              {fieldError('endsOn')}
              <label htmlFor={`${id}-noEnd`} className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-brand-charcoal">
                <input
                  id={`${id}-noEnd`}
                  type="checkbox"
                  checked={noEnd}
                  onChange={(e) => setNoEnd(e.target.checked)}
                  className="size-4 accent-brand-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
                />
                {d.noEnd}
              </label>
            </div>
          </div>

          <p role="status" className="min-h-5 text-sm font-semibold text-brand-charcoal">
            {summary}
          </p>
        </div>
        {formError && (
          <p role="alert" className="px-6 pb-4 text-sm font-medium text-brand-red-dark">
            {formError}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t.admin.cancel}
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {t.admin.save}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
