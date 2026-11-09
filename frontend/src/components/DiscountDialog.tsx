/**
 * DiscountDialog.tsx — The admin panel's dialog for creating or editing one discount, whatever it applies to: a
 * category or a product (for all customers or one customer), or a payment method.
 *
 * It asks for the type (a percentage or an amount in shekels before VAT, as a switch), the value, whether it is a
 * bulk discount (with its minimum quantity: it applies from that many units of one product, on top of the regular
 * discounts), a start date and time and an end date and time or "no end date" (Israel time; the times default to
 * 00:00 and 23:59, so a period covers whole days unless staff pick otherwise). The value is always positive: the
 * percent or the shekels taken off. A live summary reads the result back in words ("10% off for 12 units or more,
 * from 3 Nov 2026, with no end date"; a time shows only when it is not the default). The
 * dialog knows nothing about storage: it hands the caller a DiscountValue, and the caller saves it for its
 * target (e.g. a price rule); when the save is refused, the dialog shows why and stays open. describeDiscount
 * words a discount the same way for lists (DiscountsDialog, the Discounts page).
 *
 * Given `scope` (the Discounts page, routes/admin.discounts.tsx), the form also asks what the discount applies to:
 * all products, or a category or a product (one searchable list of both), and all customers or one customer (a
 * searchable list), and hands that back as a RuleScope; scopeFields turns it into a price rule's target fields. A
 * discount on all products is always for one customer (a store-wide discount for every customer would just lower the
 * list prices), so choosing it asks for the customer directly. Without `scope.customers` (a customer's own discounts,
 * routes/admin.customers.tsx) it asks only what it applies to, and the caller sets the customer. discountTargets
 * builds the category and product choices for both pages.
 *
 * Editing a discount that has not ended offers "End discount now": it saves the discount at once, unchanged except
 * that it ends at this moment (the end is exclusive, as backend/app/pricing.py applies it: it stops applying at
 * once), and closes.
 */
import { useId, useState, type FormEvent } from 'react'
import { CalendarX2 } from 'lucide-react'
import { cn } from 'cn'
import { ApiError, type StaffCategory, type StaffProduct } from '@/api'
import { localized } from '@/config'
import { errorMessage, INPUT_CLASS, LABEL_CLASS } from '@/components/RecordDialog'
import { SearchableField, type SearchOption } from '@/components/SearchableField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n, type Locale } from '@/i18n'
import type { Dictionary } from '@/i18n/he'

/**
 * One discount. `value` > 0 is what is taken off: percent for "percent", shekels before VAT for
 * "amount". `startsAt` / `endsAt` are Israel times ("2026-11-03T08:30:00", see israelTime; the start inclusive, the
 * end exclusive); `startsAt` '' = in effect since the rule was made, `endsAt` null = no end.
 * `minQuantity` (a whole number >= 2) makes it a bulk discount: it applies when one product is ordered in at least
 * that many units; null = a regular discount (any quantity).
 */
export type DiscountValue = { type: 'percent' | 'amount'; value: number; minQuantity: number | null; startsAt: string; endsAt: string | null }

/**
 * What a discount applies to: `target` = "category:<id>", "product:<id>" or ALL_PRODUCTS ('' = not chosen yet);
 * `customerId` = one business customer, or null for every customer (never with ALL_PRODUCTS).
 */
export type RuleScope = { target: string; customerId: string | null }

/**
 * The choices of the "applies to" fields: `targets` = the categories and products (values "category:<id>" /
 * "product:<id>", see scopeTarget), `customers` = the business customers (value = id; omit when the caller fixes the
 * customer: the form then asks only for the target and hands back `initial.customerId`, else null); `initial` = the
 * edited rule's.
 */
export type ScopeChoices = { targets: SearchOption[]; customers?: SearchOption[]; initial?: RuleScope }

/** The RuleScope target of a customer's discount on every product (a price rule with no category and no product). */
export const ALL_PRODUCTS = 'all'

/**
 * The value of a category or product among the scope's targets.
 * @param kind - "category" or "product".
 * @param id - Its id.
 * @returns E.g. "category:3f2a…".
 */
export const scopeTarget = (kind: 'category' | 'product', id: string) => `${kind}:${id}`

/**
 * The "applies to" choices: every category ("Category: …") and every product ("Product: …", with its SKU).
 * @param categories - The categories.
 * @param products - The products.
 * @param t - The dictionary.
 * @param locale - The page language (the names shown).
 * @returns The options, categories first (values from scopeTarget).
 */
export function discountTargets(categories: StaffCategory[], products: StaffProduct[], t: Dictionary, locale: Locale): SearchOption[] {
  const f = t.admin.discountFields
  return [
    ...categories.map((category) => ({ value: scopeTarget('category', category.id), label: f.category.replace('{name}', localized(category.name, locale)) })),
    ...products.map((product) => ({ value: scopeTarget('product', product.id), label: f.product.replace('{name}', localized(product.name, locale)), detail: product.sku ?? undefined })),
  ]
}

/**
 * A price rule's target fields for the staff API (createStaffRow / updateStaffRow 'price-rules'); the target not
 * chosen is set to null, so an edit that moves a rule from a category to a product keeps exactly one target, and
 * ALL_PRODUCTS sets both to null.
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

/** The time a new period starts and ends at, so that by default it covers whole days. */
export const START_TIME = '00:00'
export const END_TIME = '23:59'

/** Reads a moment on the Israel clock, with the parts named. */
const ISRAEL_CLOCK = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/**
 * A moment as Israel time, the form discount periods are edited and compared in.
 * @param moment - The moment.
 * @returns E.g. "2026-11-03T08:30:00".
 */
function israelClock(moment: Date): string {
  const part = Object.fromEntries(ISRAEL_CLOCK.formatToParts(moment).map(({ type, value }) => [type, value]))
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}:${part.second}`
}

/**
 * The current Israel time (the server reads a time without a UTC offset as Israel time).
 * @returns E.g. "2026-11-03T14:32:07".
 */
export function israelNow(): string {
  return israelClock(new Date())
}

/**
 * Today's date in Israel.
 * @returns E.g. "2026-11-03".
 */
export function israelToday(): string {
  return israelNow().slice(0, 10)
}

/**
 * A stored time as Israel time: the staff API answers with a UTC offset ("2026-11-03T06:30:00+00:00"); a time without
 * one is already Israel time (what the form sends).
 * @param value - The stored time.
 * @returns E.g. "2026-11-03T08:30:00", comparable as text with israelNow.
 */
export function israelTime(value: string): string {
  if (/(Z|[+-]\d\d:?\d\d)$/i.test(value)) return israelClock(new Date(value.replace(/(\.\d{3})\d+/, '$1')))
  return value.length === 16 ? `${value}:00` : value
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
 * Formats an Israel time for people: its date, and its time unless it is the default one.
 * @param value - The time ("2026-11-03T08:30:00", see israelTime).
 * @param locale - The page language.
 * @param defaultTime - The time not worth showing ("00:00" for a start, "23:59" for an end); omit to always show it.
 * @returns E.g. "3 Nov 2026" or "3 Nov 2026, 08:30" (the time isolated left to right).
 */
export function formatMoment(value: string, locale: Locale, defaultTime?: string): string {
  const date = formatDate(value.slice(0, 10), locale)
  const time = value.slice(11, 16)
  return time && time !== defaultTime ? `${date}, \u2066${time}\u2069` : date
}

/**
 * Words a discount for people: its value, its minimum quantity (a bulk discount) and its period.
 * @param discount - The discount; an empty `startsAt` leaves the period out.
 * @param t - The dictionary.
 * @param locale - The page language.
 * @returns E.g. "10% off, from 3 Nov 2026, with no end date" or "₪20.00 off for 12 units or more, from 1 Nov 2026 to
 *   30 Nov 2026".
 */
export function describeDiscount({ type, value, minQuantity, startsAt, endsAt }: DiscountValue, t: Dictionary, locale: Locale): string {
  const d = t.admin.discount
  const off = d.summaryDiscount.replace('{value}', formatValue(type, value, locale))
  return [
    minQuantity === null ? off : `${off} ${d.summaryBulk.replace('{quantity}', `\u2066${minQuantity.toLocaleString(locale)}\u2069`)}`,
    startsAt &&
      (endsAt ? d.summaryPeriod : d.summaryOpen)
        .replace('{start}', formatMoment(startsAt, locale, START_TIME))
        .replace('{end}', endsAt ? formatMoment(endsAt, locale, END_TIME) : ''),
  ]
    .filter(Boolean)
    .join(', ')
}

/**
 * The create/edit discount dialog.
 * @param props.open - Whether the dialog is open.
 * @param props.onOpenChange - Called to open or close it (Cancel, Escape, the X, a click outside, after saving).
 * @param props.onSave - Saves the discount (also "End discount now", with the edited rule's `scope.initial`); rejects
 *   with ApiError to show the server's reason and keep the dialog open.
 * @param props.initial - The discount being edited (an empty start starts from today at 00:00; one that has not
 *   ended gets "End discount now"); omit to create one (a percentage, from today at 00:00, no end date).
 * @param props.title - The title; defaults to "New discount", or "Edit discount" when `initial` is given.
 * @param props.target - What the discount applies to, shown under the title (e.g. "Dry dog food — Demo Pet Shop").
 * @param props.scope - Adds the "applies to" fields (all products, or a category or product; all customers or one); `onSave` then
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
 * summary and buttons (with "End discount now" when editing a discount that has not ended).
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
  const [startsOn, setStartsOn] = useState(initial?.startsAt ? initial.startsAt.slice(0, 10) : israelToday())
  const [startTime, setStartTime] = useState(initial?.startsAt ? initial.startsAt.slice(11, 16) : START_TIME)
  const [endsOn, setEndsOn] = useState(initial?.endsAt?.slice(0, 10) ?? '')
  const [endTime, setEndTime] = useState(initial?.endsAt ? initial.endsAt.slice(11, 16) : END_TIME)
  const [noEnd, setNoEnd] = useState(initial ? initial.endsAt === null : true)
  const [everyProduct, setEveryProduct] = useState(scope?.initial?.target === ALL_PRODUCTS)
  const [ruleTarget, setRuleTarget] = useState(scope?.initial?.target === ALL_PRODUCTS ? '' : (scope?.initial?.target ?? ''))
  const [oneCustomer, setOneCustomer] = useState(Boolean(scope?.initial?.customerId))
  const [customerId, setCustomerId] = useState(scope?.initial?.customerId ?? '')
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  const number = Number(value.trim())
  const valid = /^-?\d+(\.\d{1,2})?$/.test(value.trim()) && number > 0
  const quantity = /^\d+$/.test(minQuantity.trim()) ? Number(minQuantity.trim()) : NaN
  const quantityValid = !bulk || quantity >= 2
  // A discount on every product is always for one customer.
  const askCustomer = Boolean(scope?.customers) && (oneCustomer || everyProduct)
  // The period as Israel times; an emptied time box falls back to the default time.
  const startsAt = `${startsOn}T${startTime || START_TIME}:00`
  const endsAt = noEnd || !endsOn ? null : `${endsOn}T${endTime || END_TIME}:00`
  const canEnd = initial !== undefined && (initial.endsAt === null || initial.endsAt > israelNow())
  const summary =
    valid && quantityValid
      ? describeDiscount({ type, value: number, minQuantity: bulk ? quantity : null, startsAt: startsOn && startsAt, endsAt }, t, locale)
      : ''

  /**
   * Checks the fields, then saves; puts each problem (or the server's reason) next to its field.
   * @param event - The form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found: Partial<Record<FieldName, string>> = {}
    if (scope && !everyProduct && !ruleTarget) found.target = t.admin.errors.required
    if (askCustomer && !customerId) found.customer = t.admin.errors.required
    if (!value.trim()) found.value = t.admin.errors.required
    else if (!/^-?\d+(\.\d{1,2})?$/.test(value.trim())) found.value = d.errorNumber
    else if (number <= 0) found.value = d.errorPositive
    else if (type === 'percent' && number > 100) found.value = d.errorPercent
    if (bulk && !minQuantity.trim()) found.minQuantity = t.admin.errors.required
    else if (!quantityValid) found.minQuantity = d.errorQuantity
    if (!startsOn) found.startsOn = t.admin.errors.required
    if (!noEnd && !endsOn) found.endsOn = t.admin.errors.required
    else if (startsOn && endsAt !== null && endsAt < startsAt) found.endsOn = d.errorEnd
    setErrors(found)
    setFormError('')
    const first = (['target', 'customer', 'value', 'minQuantity', 'startsOn', 'endsOn'] as const).find((name) => found[name])
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus()
      return
    }
    setPending(true)
    try {
      const chosen = scope
        ? { target: everyProduct ? ALL_PRODUCTS : ruleTarget, customerId: scope.customers ? (askCustomer ? customerId : null) : (scope.initial?.customerId ?? null) }
        : undefined
      await onSave({ type, value: number, minQuantity: bulk ? quantity : null, startsAt, endsAt }, chosen)
    } catch (error) {
      setFormError(errorMessage(error instanceof ApiError ? error.code : undefined, t))
      setPending(false)
    }
  }

  /**
   * "End discount now": saves the edited discount as it was stored (unsaved changes in the form are dropped), ending
   * at this moment (to the second; the end is exclusive, so it stops applying at once); a discount that has not
   * started yet also starts now (an empty period), so its period stays valid. Shows the server's refusal like Save does.
   */
  const handleEndNow = async () => {
    if (!initial) return
    const now = israelNow()
    setPending(true)
    setFormError('')
    try {
      await onSave({ ...initial, startsAt: initial.startsAt && initial.startsAt > now ? now : initial.startsAt, endsAt: now }, scope?.initial)
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
                <Segmented
                  name={`${id}-products`}
                  legend={d.products}
                  options={[
                    { value: 'some', label: d.someProducts },
                    { value: 'all', label: d.allProducts },
                  ]}
                  value={everyProduct ? 'all' : 'some'}
                  onChange={(next) => setEveryProduct(next === 'all')}
                />
                {everyProduct && <p className="mt-1 text-xs text-brand-charcoal-muted">{d.allProductsHint}</p>}
              </div>

              {!everyProduct && (
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
              )}

              {scope.customers && (
                <div>
                  {!everyProduct && (
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
                  )}
                  {askCustomer && (
                    <div className={everyProduct ? undefined : 'mt-3'}>
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
              )}
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
              <label htmlFor={`${id}-startTime`} className={cn(LABEL_CLASS, 'mt-3')}>{d.startTime}</label>
              <input id={`${id}-startTime`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={INPUT_CLASS} />
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
              <label htmlFor={`${id}-endTime`} className={cn(LABEL_CLASS, 'mt-3')}>{d.endTime}</label>
              <input
                id={`${id}-endTime`}
                type="time"
                value={noEnd ? '' : endTime}
                disabled={noEnd}
                onChange={(e) => setEndTime(e.target.value)}
                className={INPUT_CLASS}
              />
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
          {canEnd && (
            <Button type="button" variant="outline" size="sm" className="sm:me-auto" disabled={pending} onClick={handleEndNow}>
              <CalendarX2 aria-hidden />
              {d.endNow}
            </Button>
          )}
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
