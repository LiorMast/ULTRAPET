/**
 * routes/admin.customers.index.tsx — Staff panel: the business customers (/admin/customers). Customers cannot register
 * on the site: they send a request (the home page form), and staff open every account, here or from the request in
 * /admin/requests (company, contact person, the sign-in email and a password they type or generate, and the business
 * details; the shared form of customerColumns.tsx), edit it, reset its password, and block it by marking it inactive. Customers
 * are never deleted (the page has no Delete, and the server refuses it), so their orders and history stay. Each
 * customer's own discounts (on every product, a category or a product, on top of the general ones) are set in the row's
 * "Discounts" dialog (DiscountsDialog with the category and product choices).
 *
 * Everything goes through the staff API (backend/app/staff/routes.py, resources "customers" and "price-rules"): the
 * password is write-only (the form's password field starts empty; left empty on an edit, the password is kept), and
 * the last sign-in and activity are read-only. A company name links to the customer's profile (/admin/customers/$id:
 * details, orders, discounts); "Last online" shows whether they are online now (PresenceBadge). The page is a DataTable with the customers' column config; after every change it
 * reloads the rows and the rules from the server. Loads nothing when signed out (the layout shows the sign-in form
 * instead).
 */
import { useMemo } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
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
import { customerColumns } from '@/components/customerColumns'
import { PresenceBadge } from '@/components/CustomerProfile'
import { DataTable, type DataColumn, type RowValues } from '@/components/DataTable'
import { discountTargets, scopeFields } from '@/components/DiscountDialog'
import { DiscountsCell, discountFields, discountsAction, withDiscounts, type DescribeTarget, type DiscountRow } from '@/components/DiscountsDialog'
import { dictionaryFor, useI18n } from '@/i18n'

export const Route = createFileRoute('/admin/customers/')({
  loader: async ({ context, abortController }) => {
    if (!context.staff) return { customers: [], rules: [], categories: [], products: [] }
    const { signal } = abortController
    const [customers, rules, categories, products] = await Promise.all([
      fetchStaffRows<StaffCustomer>('customers', signal),
      fetchStaffRows<StaffPriceRule>('price-rules', signal),
      fetchStaffRows<StaffCategory>('categories', signal),
      fetchStaffRows<StaffProduct>('products', signal),
    ])
    return { customers, rules, categories, products }
  },
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.admin.customersTitle} | ${t.admin.metaTitle}` }] }
  },
  component: AdminCustomers,
})

/** A customer row of the table: the customer with their own discounts; `password` exists only in the form. */
type CustomerRow = DiscountRow<StaffCustomer> & { password?: never }

/** What the form starts from for a new customer: an active account. */
const NEW_CUSTOMER: RowValues = { isActive: true }

/**
 * The customers page: its title and the customers table.
 * @returns The page.
 */
function AdminCustomers() {
  const { customers, rules, categories, products } = Route.useLoaderData()
  const { t, locale } = useI18n()
  const router = useRouter()
  const f = t.admin.customerFields

  // The categories and products a customer's discount can apply to, and each one's name by id for the rule lines
  // (a rule with neither covers every product).
  const targets = useMemo(() => discountTargets(categories, products, t, locale), [categories, products, t, locale])
  const describeTarget = useMemo<DescribeTarget>(() => {
    const names = new Map(targets.map((option) => [option.value.slice(option.value.indexOf(':') + 1), option.label]))
    return (rule) =>
      rule.categoryId === null && rule.productId === null ? t.admin.discountFields.allProducts : (names.get(rule.categoryId ?? rule.productId ?? '') ?? '—')
  }, [targets, t])
  const rows = useMemo(() => withDiscounts(customers, rules, 'businessUserId', t, locale, describeTarget), [customers, rules, t, locale, describeTarget])

  const columns = useMemo<DataColumn<CustomerRow>[]>(
    () =>
      customerColumns<CustomerRow>(t, [
        { key: 'discountText', label: f.discounts, inForm: false, render: (row) => <DiscountsCell rules={row.discounts} describeTarget={describeTarget} /> },
        { key: 'lastSeenAt', label: f.lastSeenAt, type: 'datetime', inForm: false, render: (row) => <PresenceBadge lastSeenAt={row.lastSeenAt} /> },
      ]).map((column) =>
        column.key === 'companyName'
          ? {
              ...column,
              render: (row: CustomerRow) => (
                <Link
                  to="/admin/customers/$id"
                  params={{ id: row.id }}
                  className="font-semibold text-brand-charcoal underline decoration-brand-red/40 underline-offset-4 transition-colors duration-300 hover:text-brand-red-dark hover:decoration-brand-red-dark"
                >
                  {row.companyName}
                </Link>
              ),
            }
          : column,
      ),
    [t, f, describeTarget],
  )

  const discounts = discountsAction<CustomerRow>(t, {
    target: (row) => row.companyName,
    targets,
    describeTarget,
    description: f.discountsDescription,
    onSave: async (row, discount, rule, scope) => {
      const fields = { ...(scope && scopeFields(scope)), businessUserId: row.id, ...discountFields(discount) }
      if (rule) await updateStaffRow('price-rules', rule.id, fields)
      else await createStaffRow('price-rules', fields)
      await router.invalidate()
    },
    onDelete: async (rule) => {
      await deleteStaffRow('price-rules', rule.id)
      await router.invalidate()
    },
  })

  return (
    <section>
      <h1 className="font-display text-3xl font-bold text-brand-charcoal">{t.admin.customersTitle}</h1>
      <p className="mb-8 mt-2 max-w-2xl text-sm text-brand-charcoal-muted">{t.admin.customersDescription}</p>
      <DataTable
        rows={rows}
        columns={columns}
        caption={t.admin.customersTitle}
        rowKey={(customer) => customer.id}
        rowLabel={(customer) => customer.companyName}
        newRow={NEW_CUSTOMER}
        onCreate={async (values) => {
          await createStaffRow('customers', values)
          await router.invalidate()
        }}
        onUpdate={async (id, changes) => {
          await updateStaffRow('customers', id, changes)
          await router.invalidate()
        }}
        rowActions={[discounts]}
      />
    </section>
  )
}
