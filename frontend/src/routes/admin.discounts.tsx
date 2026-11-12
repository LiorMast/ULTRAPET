/**
 * routes/admin.discounts.tsx — Staff panel: every discount in one table (/admin/discounts). Lists every price rule
 * (table price_rules), general or for one business customer, on a category or a product (or a customer's on every
 * product), with where it stands now
 * (active, upcoming, ended, paused), and lets staff add, edit and delete them through the staff API
 * (backend/app/staff/routes.py: resource "price-rules", plus "customers" for the customer choices). A change shows
 * in the customers' prices at once (backend/app/pricing.py).
 *
 * The page is a DataTable whose Add and Edit open DiscountDialog with its "applies to" fields (`scope`: all
 * products or a category or product, all customers or one) instead of the column-driven form; a customer's fixed price (kind
 * "fixed_price", which that dialog does not edit) is listed and can be deleted, but not edited here. The same general
 * discounts also show on the products and categories pages (their "Discounts" row action). After every change the
 * page reloads the rules from the server. Loads nothing when signed out (the layout shows the sign-in form instead).
 */
import { useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  createStaffRow,
  deleteStaffRow,
  fetchStaffRows,
  updateStaffRow,
  type StaffCategory,
  type StaffCustomer,
  type StaffPriceRule,
  type StaffProduct,
} from '@/api'
import { DataTable, type DataColumn } from '@/components/DataTable'
import { DiscountDialog, describeDiscount, discountTargets, END_TIME, formatMoment, formatValue, israelNow, israelTime, scopeFields, START_TIME } from '@/components/DiscountDialog'
import { discountFields, ruleDiscount, ruleScope, ruleState, type RuleState } from '@/components/DiscountsDialog'
import type { SearchOption } from '@/components/SearchableField'
import { dictionaryFor, useI18n, type Locale } from '@/i18n'
import type { Dictionary } from '@/i18n/he'

export const Route = createFileRoute('/admin/discounts')({
  loader: async ({ context, abortController }) => {
    if (!context.staff) return { rules: [], categories: [], products: [], customers: [] }
    const { signal } = abortController
    const [rules, categories, products, customers] = await Promise.all([
      fetchStaffRows<StaffPriceRule>('price-rules', signal),
      fetchStaffRows<StaffCategory>('categories', signal),
      fetchStaffRows<StaffProduct>('products', signal),
      fetchStaffRows<StaffCustomer>('customers', signal),
    ])
    return { rules, categories, products, customers }
  },
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.admin.discountsTitle} | ${t.admin.metaTitle}` }] }
  },
  component: AdminDiscounts,
})

/** A row of the table: the rule with its words (what the cells show and search and sorting see) and its state. */
type DiscountRuleRow = StaffPriceRule & { targetText: string; customerText: string; discountText: string; state: RuleState; statusText: string }

/** The table's order of the states: what applies now first, what no longer applies last. */
const STATE_ORDER: RuleState[] = ['active', 'upcoming', 'paused', 'ended']

/**
 * Builds the table rows: each rule in words, sorted by state (STATE_ORDER), then newest first.
 * @param rules - Every price rule.
 * @param names - The name of each category and product by id ("Category: …" / "Product: …") and of each customer.
 * @param names.targets - Category and product names by id.
 * @param names.customers - Company names by customer id.
 * @param t - The dictionary.
 * @param locale - The page language.
 * @returns The rows.
 */
function discountRows(
  rules: StaffPriceRule[],
  names: { targets: Map<string, string>; customers: Map<string, string> },
  t: Dictionary,
  locale: Locale,
): DiscountRuleRow[] {
  const f = t.admin.discountFields
  const now = israelNow()
  return rules
    .map((rule) => {
      const state = ruleState(rule, now)
      const discount = ruleDiscount(rule)
      return {
        ...rule,
        targetText: rule.categoryId === null && rule.productId === null ? f.allProducts : (names.targets.get(rule.categoryId ?? rule.productId ?? '') ?? '—'),
        customerText: rule.businessUserId === null ? f.allCustomers : (names.customers.get(rule.businessUserId) ?? '—'),
        // The period has its own columns, so the words leave it out.
        discountText:
          rule.kind === 'fixed_price'
            ? f.fixedPrice.replace('{value}', formatValue('amount', rule.value, locale))
            : describeDiscount({ ...discount, startsAt: '' }, t, locale),
        state,
        statusText: f.states[state],
      }
    })
    .sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || b.createdAt.localeCompare(a.createdAt))
}

/**
 * The discounts page: its title and the table of every discount.
 * @returns The page.
 */
function AdminDiscounts() {
  const { rules, categories, products, customers } = Route.useLoaderData()
  const { t, locale } = useI18n()
  const router = useRouter()
  const f = t.admin.discountFields

  // The "applies to" choices and the names the rows show, from the same lists.
  const choices = useMemo(() => {
    const targets = discountTargets(categories, products, t, locale)
    const customerOptions: SearchOption[] = customers.map((customer: StaffCustomer) => ({
      value: customer.id,
      label: customer.companyName,
      detail: [customer.city, customer.email].filter(Boolean).join(' · '),
    }))
    return { targets, customers: customerOptions }
  }, [categories, products, customers, t, locale])

  const rows = useMemo(() => {
    const targets = new Map(choices.targets.map((option) => [option.value.slice(option.value.indexOf(':') + 1), option.label]))
    const names = new Map(customers.map((customer) => [customer.id, customer.companyName]))
    return discountRows(rules, { targets, customers: names }, t, locale)
  }, [rules, choices, customers, t, locale])

  const columns = useMemo<DataColumn<DiscountRuleRow>[]>(
    () => [
      { key: 'targetText', label: f.appliesTo },
      { key: 'customerText', label: f.customers },
      { key: 'discountText', label: f.discount },
      { key: 'startsAt', label: f.startsOn, render: (row) => (row.startsAt ? formatMoment(israelTime(row.startsAt), locale, START_TIME) : '—') },
      { key: 'endsAt', label: f.endsOn, render: (row) => (row.endsAt ? formatMoment(israelTime(row.endsAt), locale, END_TIME) : f.noEnd) },
      {
        key: 'statusText',
        label: f.status,
        render: (row) => <span className={row.state === 'active' ? 'font-semibold' : row.state === 'upcoming' ? '' : 'text-brand-charcoal-muted'}>{row.statusText}</span>,
      },
    ],
    [f, locale],
  )

  return (
    <section>
      <h1 className="font-display text-3xl font-bold text-brand-charcoal">{t.admin.discountsTitle}</h1>
      <p className="mb-8 mt-2 max-w-2xl text-sm text-brand-charcoal-muted">{t.admin.discountsDescription}</p>
      <DataTable
        rows={rows}
        columns={columns}
        caption={t.admin.discountsTitle}
        rowKey={(rule) => rule.id}
        rowLabel={(rule) => `${rule.targetText}, ${rule.customerText}: ${rule.discountText}`}
        onCreate={async (values) => {
          await createStaffRow('price-rules', values)
          await router.invalidate()
        }}
        onUpdate={async (id, changes) => {
          await updateStaffRow('price-rules', id, changes)
          await router.invalidate()
        }}
        onDelete={async (id) => {
          await deleteStaffRow('price-rules', id)
          await router.invalidate()
        }}
        canEdit={(rule) => rule.kind !== 'fixed_price'}
        formDialog={(rule, { onSave, onClose, onCloseAutoFocus }) => (
          <DiscountDialog
            open
            onOpenChange={(isOpen) => !isOpen && onClose()}
            initial={rule && ruleDiscount(rule)}
            scope={{ ...choices, initial: rule && ruleScope(rule) }}
            onSave={(discount, scope) => onSave({ ...(scope && scopeFields(scope)), ...discountFields(discount) })}
            onCloseAutoFocus={onCloseAutoFocus}
          />
        )}
      />
    </section>
  )
}
