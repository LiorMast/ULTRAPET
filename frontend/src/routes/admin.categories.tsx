/**
 * routes/admin.categories.tsx — Staff panel: the catalog's categories (/admin/categories). Lists every category,
 * active or not, and lets staff add, edit and delete them, and set discounts on a whole category for every
 * business customer, through the staff API (backend/app/staff/routes.py, resources "categories" and
 * "price-rules"); a change shows on the catalog at once and the discounts in the customers' prices.
 *
 * The page is a DataTable with the categories' column config and a "Discounts" row action (DiscountsDialog);
 * after every change it reloads the rows and the rules from the server. Loads nothing when signed out (the
 * layout shows the sign-in form instead).
 */
import { useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createStaffRow, deleteStaffRow, fetchStaffRows, updateStaffRow, type StaffCategory, type StaffPriceRule } from '@/api'
import { localized } from '@/config'
import { DataTable, type DataColumn, type RowValues } from '@/components/DataTable'
import { DiscountsCell, discountFields, discountsAction, withDiscounts, type DiscountRow } from '@/components/DiscountsDialog'
import { dictionaryFor, useI18n } from '@/i18n'

export const Route = createFileRoute('/admin/categories')({
  loader: async ({ context, abortController }) => {
    if (!context.staff) return { categories: [], rules: [] }
    const [categories, rules] = await Promise.all([
      fetchStaffRows<StaffCategory>('categories', abortController.signal),
      fetchStaffRows<StaffPriceRule>('price-rules', abortController.signal),
    ])
    return { categories, rules }
  },
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.admin.categoriesTitle} | ${t.admin.metaTitle}` }] }
  },
  component: AdminCategories,
})

/** A category row of the table: the category with its discounts. */
type CategoryRow = DiscountRow<StaffCategory>

/** What the form starts from for a new category: active, first in the list. */
const NEW_CATEGORY: RowValues = { isActive: true, sortOrder: 0 }

/**
 * The categories page: its title and the categories table.
 * @returns The page.
 */
function AdminCategories() {
  const { categories, rules } = Route.useLoaderData()
  const { t, locale } = useI18n()
  const router = useRouter()
  const f = t.admin.categoryFields
  const rows = useMemo(() => withDiscounts(categories, rules, 'categoryId', t, locale), [categories, rules, t, locale])

  const columns = useMemo<DataColumn<CategoryRow>[]>(
    () => [
      { key: 'name', label: f.name, type: 'localized', required: true },
      { key: 'slug', label: f.slug, required: true, ltr: true, pattern: '[a-z0-9]+(-[a-z0-9]+)*', hint: f.slugHint },
      { key: 'discountText', label: f.discounts, inForm: false, render: (row) => <DiscountsCell rules={row.discounts} /> },
      { key: 'imageUrl', label: f.imageUrl, type: 'url', inTable: false },
      { key: 'legacyPath', label: f.legacyPath, ltr: true, hint: f.legacyPathHint, inTable: false },
      { key: 'sortOrder', label: f.sortOrder, type: 'integer', required: true },
      { key: 'isActive', label: f.isActive, type: 'boolean' },
    ],
    [f],
  )

  const discounts = discountsAction<CategoryRow>(t, {
    target: (row) => localized(row.name, locale),
    onSave: async (row, discount, rule) => {
      if (rule) await updateStaffRow('price-rules', rule.id, discountFields(discount))
      else await createStaffRow('price-rules', { categoryId: row.id, ...discountFields(discount) })
      await router.invalidate()
    },
    onDelete: async (rule) => {
      await deleteStaffRow('price-rules', rule.id)
      await router.invalidate()
    },
  })

  return (
    <section>
      <h1 className="font-display text-3xl font-bold text-brand-charcoal">{t.admin.categoriesTitle}</h1>
      <p className="mb-8 mt-2 max-w-2xl text-sm text-brand-charcoal-muted">{t.admin.categoriesDescription}</p>
      <DataTable
        rows={rows}
        columns={columns}
        caption={t.admin.categoriesTitle}
        rowKey={(category) => category.id}
        rowLabel={(category) => localized(category.name, locale)}
        newRow={NEW_CATEGORY}
        onCreate={async (values) => {
          await createStaffRow('categories', values)
          await router.invalidate()
        }}
        onUpdate={async (id, changes) => {
          await updateStaffRow('categories', id, changes)
          await router.invalidate()
        }}
        onDelete={async (id) => {
          await deleteStaffRow('categories', id)
          await router.invalidate()
        }}
        rowActions={[discounts]}
      />
    </section>
  )
}
