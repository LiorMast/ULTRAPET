/**
 * CustomerProfile.tsx — A business customer's profile: their details, whether they are online, their own discounts
 * (current and past) and their purchase history. One component for both readers: the customer's own page (/account,
 * view "customer") and the staff page of any customer (/admin/customers/$id, view "staff", which adds the internal
 * fields and the paused discounts the server sends only to staff). The data is a CustomerProfile from the API
 * (fetchAccount / fetchCustomerProfile); the route passes it in.
 *
 * Also exports PresenceBadge ("Online now" / "Last seen 3 hours ago" / "Never signed in"), which the customers table
 * shows too, and ONLINE_MS, how recent the last activity must be to count as online.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from 'cn'
import type { CustomerProfile as Profile, ProfileDiscount, ProfileOrder } from '@/api'
import { formatPrice } from '@/components/CatalogCard'
import { DiscountRibbon, type RibbonColor } from '@/components/DiscountRibbon'
import { describeDiscount, formatValue, israelNow } from '@/components/DiscountDialog'
import { ruleDiscount, ruleState, type RuleState } from '@/components/DiscountsDialog'
import { TextLink } from '@/components/TextLink'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { localized } from '@/config'
import type { Dictionary } from '@/i18n/he'
import { useI18n, type Locale } from '@/i18n'

/** A customer counts as online when their last request to the site was at most this long ago (5 minutes). */
export const ONLINE_MS = 5 * 60 * 1000

/** Who reads the profile: the customer themselves, or staff (internal fields, paused discounts). */
export type ProfileView = 'customer' | 'staff'

/** The ribbon color of each discount state. */
const STATE_COLORS: Record<RuleState, RibbonColor> = { active: 'success', upcoming: 'light', ended: 'charcoal', paused: 'warning' }

/** The ribbon color of each order status. */
const ORDER_COLORS: Record<ProfileOrder['status'], RibbonColor> = { submitted: 'light', confirmed: 'light', shipped: 'charcoal', delivered: 'success', cancelled: 'red' }

/** The units Intl.RelativeTimeFormat counts in, largest first, with their length in seconds. */
const TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/**
 * Words how long ago a moment was, e.g. "3 hours ago" / "לפני 3 שעות" / "yesterday".
 * @param iso - The moment (ISO time).
 * @param locale - The page language.
 * @param now - The current time in ms (tests pass a fixed one).
 * @returns The relative time.
 */
export function timeAgo(iso: string, locale: Locale, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, length] of TIME_UNITS) {
    if (Math.abs(seconds) >= length) return format.format(Math.round(seconds / length), unit)
  }
  return format.format(0, 'minute')
}

/**
 * Formats a date for people, e.g. "5 Nov 2026".
 * @param iso - The moment (ISO time).
 * @param locale - The page language.
 * @param time - true adds the time of day.
 * @returns The date (and time).
 */
function formatWhen(iso: string, locale: Locale, time = false): string {
  return new Date(iso).toLocaleString(locale, time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
}

/**
 * Whether a customer is online: a green dot with "Online now" when their last activity is at most ONLINE_MS old, else
 * a grey dot with how long ago they were last seen, or "Never signed in". The exact time is the tooltip. Its clock
 * ticks once a minute, so an open page moves from "Online now" to "Last seen" by itself.
 * @param props.lastSeenAt - Their last activity (ISO time), null = never.
 * @param props.now - The current time in ms (tests pass a fixed one); omitted = the badge's own clock.
 * @param props.className - Extra classes.
 * @returns The badge.
 */
export function PresenceBadge({ lastSeenAt, now: fixedNow, className }: { lastSeenAt: string | null; now?: number; className?: string }) {
  const { t, locale } = useI18n()
  const [clock, setClock] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const now = fixedNow ?? clock
  const p = t.account.presence
  const online = lastSeenAt !== null && now - new Date(lastSeenAt).getTime() <= ONLINE_MS
  const words = lastSeenAt === null ? p.never : online ? p.online : p.lastSeen.replace('{time}', timeAgo(lastSeenAt, locale, now))
  return (
    <span data-online={online} className={cn('inline-flex items-center gap-2 text-sm', online ? 'font-semibold text-brand-charcoal' : 'text-brand-charcoal-muted', className)}>
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', online ? 'bg-success' : 'bg-neutral-400')} />
      {lastSeenAt ? <time dateTime={lastSeenAt} title={formatWhen(lastSeenAt, locale, true)}>{words}</time> : words}
    </span>
  )
}

/**
 * A titled block of the profile (a white card).
 * @param props.id - The heading's id (the block is labelled by it).
 * @param props.title - The heading.
 * @param props.note - A muted line under the heading, if any.
 * @param props.children - The block's content.
 * @param props.className - Extra classes.
 * @returns The <section>.
 */
function ProfileBlock({ id, title, note, children, className }: { id: string; title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('rounded-2xl border border-neutral-200 bg-white p-5 sm:p-8', className)}>
      <h2 id={id} className="font-display text-xl font-bold text-brand-charcoal">
        {title}
      </h2>
      {note && <p className="mt-1 text-sm text-brand-charcoal-muted">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

/**
 * The customer's details as a definition list; staff also see the status, the Rivhit number and the internal notes.
 * @param props.customer - The details.
 * @param props.view - Who reads them.
 * @returns The list.
 */
function DetailsList({ customer, view }: { customer: Profile['customer']; view: ProfileView }) {
  const { t, locale } = useI18n()
  const f = t.account.fields
  const rows: { label: string; value: string | null; ltr?: boolean }[] = [
    { label: f.fullName, value: customer.fullName },
    { label: f.email, value: customer.email, ltr: true },
    { label: f.phone, value: customer.phone, ltr: true },
    { label: f.businessNumber, value: customer.businessNumber, ltr: true },
    { label: f.city, value: customer.city },
    { label: f.address, value: customer.address },
    { label: f.createdAt, value: formatWhen(customer.createdAt, locale) },
    { label: f.lastLoginAt, value: customer.lastLoginAt && formatWhen(customer.lastLoginAt, locale, true) },
  ]
  if (view === 'staff') {
    rows.push(
      { label: f.status, value: customer.isActive ? t.account.active : t.account.inactive },
      { label: f.rivhitCustomerId, value: customer.rivhitCustomerId ?? null, ltr: true },
      { label: f.notes, value: customer.notes ?? null },
    )
  }
  return (
    <dl className="divide-y divide-neutral-150">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-sm text-brand-charcoal-muted">{row.label}</dt>
          <dd className={cn('break-words text-sm font-medium text-brand-charcoal', !row.value && 'font-normal text-brand-charcoal-muted')}>
            {row.value ? row.ltr ? <bdi dir="ltr">{row.value}</bdi> : row.value : t.account.notGiven}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Words what a discount applies to.
 * @param discount - The discount.
 * @param t - The dictionary.
 * @param locale - The page language.
 * @returns E.g. "Category: Dry dog food" or "All products".
 */
function targetWords(discount: ProfileDiscount, t: Dictionary, locale: Locale): string {
  const words = t.account.target
  const name = discount.target.name ? localized(discount.target.name, locale) : ''
  return discount.target.type === 'all' ? words.all : words[discount.target.type].replace('{name}', name)
}

/**
 * One discount line: what it applies to, the discount and its period, and its state as a ribbon.
 * @param props.discount - The discount.
 * @param props.state - Where it stands now.
 * @returns The list item.
 */
function DiscountLine({ discount, state }: { discount: ProfileDiscount; state: RuleState }) {
  const { t, locale } = useI18n()
  const words =
    discount.kind === 'fixed_price'
      ? t.admin.discountFields.fixedPrice.replace('{value}', formatValue('amount', discount.value, locale))
      : describeDiscount(ruleDiscount(discount), t, locale)
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-semibold text-brand-charcoal">{targetWords(discount, t, locale)}</p>
        <p className="mt-0.5 text-sm text-brand-charcoal-muted">{words}</p>
      </div>
      <DiscountRibbon message={t.account.state[state]} color={STATE_COLORS[state]} />
    </li>
  )
}

/**
 * The customer's own discounts in two lists: current (in effect or starting later) and past (ended, and for staff the
 * paused ones).
 * @param props.discounts - The discounts.
 * @param props.view - Who reads them.
 * @returns The two lists.
 */
function DiscountLists({ discounts, view }: { discounts: ProfileDiscount[]; view: ProfileView }) {
  const { t } = useI18n()
  const a = t.account
  const now = israelNow()
  const states = discounts.map((discount) => ({ discount, state: ruleState(discount, now) }))
  const current = states.filter(({ state }) => state === 'active' || state === 'upcoming')
  const past = states.filter(({ state }) => state === 'ended' || (view === 'staff' && state === 'paused'))
  return (
    <div className="grid gap-8">
      {[
        { id: 'current', title: a.currentDiscounts, items: current, empty: a.noCurrent },
        { id: 'past', title: a.pastDiscounts, items: past, empty: a.noPast },
      ].map((group) => (
        <div key={group.id}>
          <h3 className="font-heading text-sm font-semibold text-brand-charcoal-muted">{group.title}</h3>
          {group.items.length > 0 ? (
            <ul className="mt-3 divide-y divide-neutral-150">
              {group.items.map(({ discount, state }) => (
                <DiscountLine key={discount.id} discount={discount} state={state} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-brand-charcoal-muted">{group.empty}</p>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * One past order as an accordion item: the trigger shows its number, date, status and total; the panel its lines,
 * amounts and payment. The lines are a table; on a phone (below sm) each line is one row instead ("3 × ₪120.00" under
 * the product, its total at the end; the column headers stay for screen readers, and explicit roles keep the table's
 * meaning while its CSS display changes).
 * @param props.order - The order.
 * @param props.view - Who reads it (a product line links to its page only for the customer).
 * @returns The accordion item.
 */
function OrderItem({ order, view }: { order: ProfileOrder; view: ProfileView }) {
  const { t, locale } = useI18n()
  const o = t.account.order
  const number = order.id.slice(0, 8).toUpperCase()
  return (
    <AccordionItem value={order.id}>
      <AccordionTrigger>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
          <span className="min-w-0">
            <span className="block">{o.title.replace('{number}', number)}</span>
            <span className="block text-sm font-normal text-brand-charcoal-muted">{o.placed.replace('{date}', formatWhen(order.createdAt, locale))}</span>
          </span>
          <DiscountRibbon message={o.status[order.status]} color={ORDER_COLORS[order.status]} />
          <span className="ms-auto tabular-nums">{formatPrice(locale, order.total)}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="sm:overflow-x-auto">
          <table role="table" className="w-full text-sm max-sm:block sm:min-w-[32rem]">
            <caption className="sr-only">{o.title.replace('{number}', number)}</caption>
            <thead role="rowgroup" className="max-sm:sr-only">
              <tr role="row" className="border-b border-neutral-200 text-start text-brand-charcoal-muted">
                <th role="columnheader" scope="col" className="py-2 pe-4 text-start font-medium">{o.product}</th>
                <th role="columnheader" scope="col" className="py-2 pe-4 text-end font-medium">{o.quantity}</th>
                <th role="columnheader" scope="col" className="py-2 pe-4 text-end font-medium">{o.unitPrice}</th>
                <th role="columnheader" scope="col" className="py-2 text-end font-medium">{o.lineTotal}</th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="divide-y divide-neutral-150 text-brand-charcoal max-sm:block">
              {order.items.map((item, index) => {
                const name = localized(item.productName, locale)
                return (
                  <tr role="row" key={index} className="max-sm:flex max-sm:flex-wrap max-sm:items-baseline max-sm:gap-x-1.5 max-sm:py-3">
                    <td role="cell" className="py-3 pe-4 max-sm:basis-full max-sm:p-0 max-sm:pb-1">
                      {item.productSlug && view === 'customer' ? (
                        <TextLink link={{ to: '/products/$slug', params: { slug: item.productSlug } }}>{name}</TextLink>
                      ) : (
                        name
                      )}
                      {!item.productSlug && <span className="block text-xs text-brand-charcoal-muted">{o.deletedProduct}</span>}
                      {item.sku && <bdi dir="ltr" className="block text-xs text-brand-charcoal-muted">{item.sku}</bdi>}
                    </td>
                    <td role="cell" className="py-3 pe-4 text-end tabular-nums max-sm:p-0 max-sm:text-brand-charcoal-muted">{item.quantity.toLocaleString(locale)}</td>
                    <td role="cell" className="py-3 pe-4 text-end tabular-nums max-sm:p-0 max-sm:text-brand-charcoal-muted max-sm:before:content-['×_']">
                      {formatPrice(locale, item.unitPrice)}
                    </td>
                    <td role="cell" className="py-3 text-end tabular-nums max-sm:ms-auto max-sm:p-0 max-sm:font-semibold">{formatPrice(locale, item.lineTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 grid gap-2 border-t border-neutral-200 pt-4 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:col-start-2">
            <dt>{o.subtotal}</dt>
            <dd className="tabular-nums text-brand-charcoal">{formatPrice(locale, order.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4 font-semibold text-brand-charcoal sm:col-start-2">
            <dt>{o.total}</dt>
            <dd className="tabular-nums">{formatPrice(locale, order.total)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:col-start-2">
            <dt>{o.paymentMethod}</dt>
            <dd className="text-brand-charcoal">
              {localized(order.paymentMethod, locale)} · {o.payment[order.paymentStatus]}
            </dd>
          </div>
        </dl>
      </AccordionContent>
    </AccordionItem>
  )
}

/**
 * The customer's profile (see the file header).
 * @param props.profile - The profile from the API.
 * @param props.view - "customer" (their own page) or "staff" (the staff page of a customer).
 * @returns The profile: the details card beside the discounts and the orders.
 */
export function CustomerProfile({ profile, view }: { profile: Profile; view: ProfileView }) {
  const { t } = useI18n()
  const a = t.account
  const { customer, orders, discounts } = profile
  return (
    <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-8">
      <ProfileBlock id="profile-details" title={a.details} note={view === 'customer' ? a.detailsNote : undefined}>
        <div className="mb-6 rounded-xl bg-neutral-50 p-4">
          <p className="font-display text-lg font-bold text-brand-charcoal">{customer.companyName}</p>
          <PresenceBadge lastSeenAt={customer.lastSeenAt} className="mt-1" />
        </div>
        <DetailsList customer={customer} view={view} />
      </ProfileBlock>
      <div className="grid gap-6 lg:gap-8">
        <ProfileBlock id="profile-discounts" title={view === 'staff' ? a.discountsTitleStaff : a.discountsTitle} note={view === 'customer' ? a.discountsNote : undefined}>
          <DiscountLists discounts={discounts} view={view} />
        </ProfileBlock>
        <ProfileBlock id="profile-orders" title={a.ordersTitle}>
          {orders.length > 0 ? (
            <Accordion type="multiple" variant="card">
              {orders.map((order) => (
                <OrderItem key={order.id} order={order} view={view} />
              ))}
            </Accordion>
          ) : (
            <div className="text-sm text-brand-charcoal-muted">
              <p>{view === 'staff' ? a.ordersEmptyStaff : a.ordersEmpty}</p>
              {view === 'customer' && (
                <TextLink link={{ to: '/catalog' }} className="mt-3">
                  {a.toCatalog}
                </TextLink>
              )}
            </div>
          )}
        </ProfileBlock>
      </div>
    </div>
  )
}

