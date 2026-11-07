/**
 * DiscountDialog.tsx — The admin panel's dialog for creating or editing one discount, whatever it applies to: a
 * category or a product (for all customers or one customer), or a payment method.
 *
 * It asks for the type (a percentage or an amount in shekels before VAT, as a switch), the value, whether it is a
 * bulk discount (with its minimum quantity: it applies from that many units of one product, on top of the regular
 * discounts), a start date and an end date or "no end date". The value is always positive: the percent or the
 * shekels taken off. A live summary reads the result back in words ("10% off for 12 units or more, from 3 Nov 2026,
 * with no end date"). The
 * dialog knows nothing about storage: it hands the caller a DiscountValue, and the caller saves it for its
 * target (e.g. a price rule); when the save is refused, the dialog shows why and stays open. describeDiscount
 * words a discount the same way for lists (DiscountsDialog, the Discounts page).
 *
 * Given `scope` (the Discounts page, routes/admin.discounts.tsx), the form also asks what the discount applies to:
 * a category or a product (one searchable list of both) and all customers or one customer (a searchable list), and
 * hands that back as a RuleScope; scopeFields turns it into a price rule's target fields.
 */
import { useId, useState, type FormEvent } from 'react'
import { cn } from 'cn'
import { ApiError } from '@/api'
import { errorMessage, INPUT_CLASS, LABEL_CLASS } from '@/components/RecordDialog'
import { SearchableField, type SearchOption } from '@/components/SearchableField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n, type Locale } from '@/i18n'
import type { Dictionary } from '@/i18n/he'

/**
 * One discount. `value` > 0 is what is taken off: percent for "percent", shekels before VAT for
 * "amount". `startsOn` / `endsOn` are Israel dates ("2026-11-03", inclusive); `endsOn` null = no end date.
 * `minQuantity` (a whole number >= 2) makes it a bulk discount: it applies when one product is ordered in at least
 * that many units; null = a regular discount (any quantity).
 */
export type DiscountValue = { type: 'percent' | 'amount'; value: number; minQuantity: number | null; startsOn: string; endsOn: string | null }

/**
 * What a discount applies to (the Discounts page): `target` = "category:<id>" or "product:<id>" ('' = not chosen
 * yet); `customerId` = one business customer, or null for every customer.
 */
export type RuleScope = { target: string; customerId: string | null }

/**
 * The choices of the "applies to" fields: `targets` = the categories and products (values "category:<id>" /
 * "product:<id>", see scopeTarget), `customers` = the business customers (value = id); `initial` = the edited rule's.
 */
export type ScopeChoices = { targets: SearchOption[]; customers: SearchOption[]; initial?: RuleScope }

/**
 * The value of a category or product among the scope's targets.
 * @param kind - "category" or "product".
 * @param id - Its id.
 * @returns E.g. "category:3f2a…".
 */
export const scopeTarget = (kind: 'category' | 'product', id: string) => `${kind}:${id}`

/**
 * A price rule's target fields for the staff API (createStaffRow / updateStaffRow 'price-rules'); the target not
 * chosen is set to null, so an edit that moves a rule from a category to a product keeps exactly one target.
 * @param scope - The scope from DiscountDialog.
 * @returns { categoryId, productId, businessUserId }.
 */
export function scopeFields({ target, customerId }: RuleScope) {
  const [kind, id] = target.split(':')
  return { categoryId: kind === 'category' ? id : null, productId: kind === 'product' ? id : null, businessUserId: customerId }
}

/** The row of a checkbox and its label ("Bulk discount", "No end date"). */
const CHECKBOX_LABEL_CLASS = 'flex cursor-pointer items-center gap-3 text-sm text-brand-charcoal'

/** A checkbox in the brand red, with the site's focus ring. */
const CHECKBOX_CLASS = 'size-4 accent-brand-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red'

/** The field a message belongs to. */
type FieldName = 'target' | 'customer' | 'value' | 'minQuantity' | 'startsOn' | 'endsOn'

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
export function formatValue(type: DiscountValue['type'], value: number, locale: Locale): string {
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
export function formatDate(date: string, locale: Locale): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale, { dateStyle: 'medium' })
}

/**
 * Words a discount for people: its value, its minimum quantity (a bulk discount) and its period.
 * @param discount - The discount; an empty `startsOn` leaves the period out.
 * @param t - The dictionary.
 * @param locale - The page language.
 * @returns E.g. "10% off, from 3 Nov 2026, with no end date" or "₪20.00 off for 12 units or more, from 1 Nov 2026 to
 *   30 Nov 2026".
 */
export function describeDiscount({ type, value, minQuantity, startsOn, endsOn }: DiscountValue, t: Dictionary, locale: Locale): string {
  const d = t.admin.discount
  const off = d.summaryDiscount.replace('{value}', formatValue(type, value, locale))
  return [
    minQuantity === null ? off : `${off} ${d.summaryBulk.replace('{quantity}', `\u2066${minQuantity.toLocaleString(locale)}\u2069`)}`,
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
 * @param props.scope - Adds the "applies to" fields (a category or product, all customers or one); `onSave` then
 *   also gets the chosen RuleScope. Omit when the caller already knows the target.
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
  scope,
  onCloseAutoFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (discount: DiscountValue, scope?: RuleScope) => Promise<unknown>
  initial?: DiscountValue
  title?: string
  target?: string
  scope?: ScopeChoices
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
          scope={scope}
          onSave={async (discount, chosen) => {
            await (chosen ? onSave(discount, chosen) : onSave(discount))
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

/**
 * The dialog's form: the "applies to" fields (with `scope`), the type switch, value, bulk minimum quantity, dates,
 * summary and buttons.
 * @param props.initial - The discount being edited, if any.
 * @param props.title - The dialog title.
 * @param props.target - What the discount applies to, if given.
 * @param props.scope - The "applies to" choices, if the form asks for them.
 * @param props.onSave - Saves (rejects with ApiError on refusal).
 * @param props.onCancel - Closes without saving.
 * @returns The title block and the form.
 */
function DiscountForm({
  initial,
  title,
  target,
  scope,
  onSave,
  onCancel,
}: {
  initial?: DiscountValue
  title: string
  target?: string
  scope?: ScopeChoices
  onSave: (discount: DiscountValue, scope?: RuleScope) => Promise<void>
  onCancel: () => void
}) {
  const { t, locale } = useI18n()
  const d = t.admin.discount
  const id = useId()
  const [type, setType] = useState<DiscountValue['type']>(initial?.type ?? 'percent')
  const [value, setValue] = useState(initial ? String(initial.value) : '')
  const [bulk, setBulk] = useState(initial ? initial.minQuantity !== null : false)
  const [minQuantity, setMinQuantity] = useState(initial?.minQuantity != null ? String(initial.minQuantity) : '')
  const [startsOn, setStartsOn] = useState(initial?.startsOn || israelToday())
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? '')
  const [noEnd, setNoEnd] = useState(initial ? initial.endsOn === null : true)
  const [ruleTarget, setRuleTarget] = useState(scope?.initial?.target ?? '')
  const [oneCustomer, setOneCustomer] = useState(Boolean(scope?.initial?.customerId))
  const [customerId, setCustomerId] = useState(scope?.initial?.customerId ?? '')
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  const number = Number(value.trim())
  const valid = /^-?\d+(\.\d{1,2})?$/.test(value.trim()) && number > 0
  const quantity = /^\d+$/.test(minQuantity.trim()) ? Number(minQuantity.trim()) : NaN
  const quantityValid = !bulk || quantity >= 2
  const summary =
    valid && quantityValid
      ? describeDiscount({ type, value: number, minQuantity: bulk ? quantity : null, startsOn, endsOn: noEnd || !endsOn ? null : endsOn }, t, locale)
      : ''

  /**
   * Checks the fields, then saves; puts each problem (or the server's reason) next to its field.
   * @param event - The form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found: Partial<Record<FieldName, string>> = {}
    if (scope && !ruleTarget) found.target = t.admin.errors.required
    if (scope && oneCustomer && !customerId) found.customer = t.admin.errors.required
    if (!value.trim()) found.value = t.admin.errors.required
    else if (!/^-?\d+(\.\d{1,2})?$/.test(value.trim())) found.value = d.errorNumber
    else if (number <= 0) found.value = d.errorPositive
    else if (type === 'percent' && number > 100) found.value = d.errorPercent
    if (bulk && !minQuantity.trim()) found.minQuantity = t.admin.errors.required
    else if (!quantityValid) found.minQuantity = d.errorQuantity
    if (!startsOn) found.startsOn = t.admin.errors.required
    if (!noEnd && !endsOn) found.endsOn = t.admin.errors.required
    else if (!noEnd && startsOn && endsOn < startsOn) found.endsOn = d.errorEnd
    setErrors(found)
    setFormError('')
    const first = (['target', 'customer', 'value', 'minQuantity', 'startsOn', 'endsOn'] as const).find((name) => found[name])
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus()
      return
    }
    setPending(true)
    try {
      const chosen = scope ? { target: ruleTarget, customerId: oneCustomer ? customerId : null } : undefined
      await onSave({ type, value: number, minQuantity: bulk ? quantity : null, startsOn, endsOn: noEnd ? null : endsOn }, chosen)
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
          {scope && (
            <>
              <div>
                <label htmlFor={`${id}-target`} className={LABEL_CLASS}>{`${d.appliesTo} *`}</label>
                <SearchableField
                  id={`${id}-target`}
                  label={d.appliesTo}
                  value={ruleTarget}
                  onChange={(next) => setRuleTarget(next)}
                  options={scope.targets}
                  strict
                  className="mt-2"
                  inputClassName={INPUT_CLASS}
                  aria-required
                  {...described('target', `${id}-target-hint`)}
                />
                <p id={`${id}-target-hint`} className="mt-1 text-xs text-brand-charcoal-muted">
                  {d.appliesToHint}
                </p>
                {fieldError('target')}
              </div>

              <div>
                <Segmented
                  name={`${id}-customers`}
                  legend={d.customers}
                  options={[
                    { value: 'all', label: d.allCustomers },
                    { value: 'one', label: d.oneCustomer },
                  ]}
                  value={oneCustomer ? 'one' : 'all'}
                  onChange={(next) => setOneCustomer(next === 'one')}
                />
                {oneCustomer && (
                  <div className="mt-3">
                    <label htmlFor={`${id}-customer`} className={LABEL_CLASS}>{`${d.customer} *`}</label>
                    <SearchableField
                      id={`${id}-customer`}
                      label={d.customer}
                      value={customerId}
                      onChange={(next) => setCustomerId(next)}
                      options={scope.customers}
                      strict
                      className="mt-2"
                      inputClassName={INPUT_CLASS}
                      aria-required
                      {...described('customer')}
                    />
                    {fieldError('customer')}
                  </div>
                )}
              </div>
            </>
          )}

          <Segmented
            name={`${id}-type`}
            legend={d.type}
            options={[
              { value: 'percent', label: `${d.percent} (%)` },
              { value: 'amount', label: `${d.amount} (₪)` },
            ]}
            value={type}
            onChange={(next) => setType(next)}
          />

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

          <div>
            <label htmlFor={`${id}-bulk`} className={CHECKBOX_LABEL_CLASS}>
              <input id={`${id}-bulk`} type="checkbox" checked={bulk} onChange={(e) => setBulk(e.target.checked)} className={CHECKBOX_CLASS} />
              {d.bulk}
            </label>
            {bulk && (
              <div className="mt-3">
                <label htmlFor={`${id}-minQuantity`} className={LABEL_CLASS}>{`${d.minQuantity} *`}</label>
                <span className="relative mt-2 block" dir="ltr">
                  <input
                    id={`${id}-minQuantity`}
                    type="text"
                    inputMode="numeric"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    aria-required
                    className={cn(INPUT_CLASS, 'mt-0 pe-16')}
                    {...described('minQuantity', `${id}-minQuantity-hint`)}
                  />
                  <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-sm text-brand-charcoal-muted" aria-hidden>
                    {d.units}
                  </span>
                </span>
                <p id={`${id}-minQuantity-hint`} className="mt-1 text-xs text-brand-charcoal-muted">
                  {d.minQuantityHint}
                </p>
                {fieldError('minQuantity')}
              </div>
            )}
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
              <label htmlFor={`${id}-noEnd`} className={cn(CHECKBOX_LABEL_CLASS, 'mt-3')}>
                <input id={`${id}-noEnd`} type="checkbox" checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} className={CHECKBOX_CLASS} />
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

/**
 * A two-way (or more) switch of radio buttons drawn as one segmented bar: the chosen part is dark.
 * @param props.name - The radio group's name (unique on the page).
 * @param props.legend - The group's visible name.
 * @param props.options - The choices, in order: value and visible label.
 * @param props.value - The chosen value.
 * @param props.onChange - Called with the newly chosen value.
 * @returns The fieldset.
 */
function Segmented<Value extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string
  legend: string
  options: { value: Value; label: string }[]
  value: Value
  onChange: (value: Value) => void
}) {
  return (
    <fieldset>
      <legend className={LABEL_CLASS}>{legend}</legend>
      <div className="mt-2 grid auto-cols-fr grid-flow-col border border-neutral-300">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center justify-center py-2.5 text-sm font-medium text-brand-charcoal transition-colors has-checked:bg-brand-charcoal has-checked:text-white has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-brand-red"
          >
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="sr-only" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
