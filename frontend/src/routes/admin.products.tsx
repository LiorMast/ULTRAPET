/**
 * routes/admin.products.tsx — Staff panel: the catalog's products (/admin/products). Lists every product, active
 * or not, and lets staff add, edit and delete them (names, codes, category, brand, list price, ...) and set
 * discounts on a product for every business customer, through the staff API (backend/app/staff/routes.py,
 * resources "products" and "price-rules"); a change shows on the catalog at once and the discounts in the
 * customers' prices. A product's photos are kept as they are (editing them comes with the product upload page).
 *
 * The page is a DataTable with the products' column config (the category and brand are picked from the current
 * lists, by typing to search: SearchableField) and a "Discounts" row action (DiscountsDialog); after every change it reloads the rows and the rules
 * from the server. Loads nothing when signed out (the layout shows the sign-in form instead).
 */
import { useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  createStaffRow,
  deleteStaffRow,
  fetchStaffRows,
  updateStaffRow,
  type StaffBrand,
  type StaffCategory,
  type StaffPriceRule,
  type StaffProduct,
} from '@/api'
import { localized } from '@/config'
import { DataTable, type DataColumn } from '@/components/DataTable'
import { DiscountsCell, discountFields, discountsAction, withDiscounts, type DiscountRow } from '@/components/DiscountsDialog'
import { dictionaryFor, useI18n } from '@/i18n'

export const Route = createFileRoute('/admin/products')({
  loader: async ({ context, abortController }) => {
    if (!context.staff) return { products: [], categories: [], brands: [], rules: [] }
    const { signal } = abortController
    const [products, categories, brands, rules] = await Promise.all([
      fetchStaffRows<StaffProduct>('products', signal),
      fetchStaffRows<StaffCategory>('categories', signal),
      fetchStaffRows<StaffBrand>('brands', signal),
      fetchStaffRows<StaffPriceRule>('price-rules', signal),
    ])
    return { products, categories, brands, rules }
  },
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.admin.productsTitle} | ${t.admin.metaTitle}` }] }
  },
  component: AdminProducts,
})

/** A product row of the table: the product with its discounts. */
type ProductRow = DiscountRow<StaffProduct>

/**
 * The products page: its title and the products table.
 * @returns The page.
 */
function AdminProducts() {
  const { products, categories, brands, rules } = Route.useLoaderData()
  const { t, locale } = useI18n()
  const router = useRouter()
  const f = t.admin.productFields
  const rows = useMemo(() => withDiscounts(products, rules, 'productId', t, locale), [products, rules, t, locale])

  // The category and brand choices are read when the table mounts (DataTable's rule); a page load refreshes them.
  const columns = useMemo<DataColumn<ProductRow>[]>(
    () => [
      { key: 'name', label: f.name, type: 'localized', required: true },
      { key: 'sku', label: f.sku, ltr: true },
      {
        key: 'categoryId',
        label: f.category,
        type: 'select',
        searchable: true,
        required: true,
        options: categories.map((category) => ({ value: category.id, label: localized(category.name, locale) })),
      },
      { key: 'brandId', label: f.brand, type: 'select', searchable: true, options: brands.map((brand) => ({ value: brand.id, label: brand.name })) },
      { key: 'listPrice', label: f.listPrice, type: 'money', hint: f.listPriceHint },
      { key: 'discountText', label: f.discounts, inForm: false, render: (row) => <DiscountsCell rules={row.discounts} /> },
      { key: 'isActive', label: f.isActive, type: 'boolean' },
      { key: 'slug', label: f.slug, required: true, inTable: false },
      { key: 'barcode', label: f.barcode, ltr: true, inTable: false },
      { key: 'description', label: f.description, type: 'localized', multiline: true, inTable: false },
      { key: 'legacyPath', label: f.legacyPath, ltr: true, inTable: false },
      { key: 'sortOrder', label: f.sortOrder, type: 'integer', required: true, inTable: false },
    ],
    [f, categories, brands, locale],
  )

  const discounts = discountsAction<ProductRow>(t, {
    target: (row) => localized(row.name, locale),
    onSave: async (row, discount, rule) => {
      if (rule) await updateStaffRow('price-rules', rule.id, discountFields(discount))
      else await createStaffRow('price-rules', { productId: row.id, ...discountFields(discount) })
      await router.invalidate()
    },
    onDelete: async (rule) => {
      await deleteStaffRow('price-rules', rule.id)
      await router.invalidate()
    },
  })

  return (
    <section>
      <h1 className="font-display text-3xl font-bold text-brand-charcoal">{t.admin.productsTitle}</h1>
      <p className="mb-8 mt-2 max-w-2xl text-sm text-brand-charcoal-muted">{t.admin.productsDescription}</p>
      <DataTable
        rows={rows}
        columns={columns}
        caption={t.admin.productsTitle}
        rowKey={(product) => product.id}
        rowLabel={(product) => localized(product.name, locale)}
        newRow={{ isActive: true, sortOrder: 0, categoryId: categories[0]?.id }}
        onCreate={async (values) => {
          await createStaffRow('products', values)
          await router.invalidate()
        }}
        onUpdate={async (id, changes) => {
          await updateStaffRow('products', id, changes)
          await router.invalidate()
        }}
        onDelete={async (id) => {
          await deleteStaffRow('products', id)
          await router.invalidate()
        }}
        rowActions={[discounts]}
      />
    </section>
  )
}
