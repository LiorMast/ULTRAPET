/**
 * routes/admin.products.tsx — Staff panel: the catalog's products (/admin/products). Lists every product, active
 * or not, and lets staff add, edit and delete them (names, codes, category, brand, list price, low-stock threshold,
 * ...), manage each product's stock and set discounts on a product for every business customer, through the staff
 * API (backend/app/staff/routes.py, resources "products" and "price-rules", and the products' stock routes); a change
 * shows on the catalog at once, the discounts in the customers' prices and the stock in their stock statuses.
 * The stock column shows the units on hand with a Low / Out ribbon, the stock alerts above the table count the
 * products low or out of stock, and the "Stock" row action (StockDialog) records goods received, returns, removals
 * and stock counts and shows the product's history. The photos column shows the main photo; the form's photo list
 * (ImageListField) uploads new photos into the file storage (folder "products", each with a thumbnail for the cards),
 * reorders them (the first is the main photo) and removes them; Save stores the whole list.
 * The "PDF catalog" button (CatalogPdfDialog) sets the layout of the downloadable PDF catalog the server generates from
 * the products and builds it; the server also rebuilds it after every change made here.
 * The technical fields stay out of the table and the form: the URL name (the server names a new product after its
 * English name and never renames it), the old site address and the order number; the order is set in "Change order"
 * (DataTable's onReorder: ReorderDialog) and the table lists the products in it, the catalog's order.
 *
 * The page is a DataTable with the products' column config (productColumns.tsx, shared with the manage mode of the
 * catalog cards; the category and brand are picked from the current lists, by typing to search: SearchableField) and
 * the "Stock" (StockDialog) and "Discounts" (DiscountsDialog) row actions; every change goes through
 * useProductHandlers (the same as the manage mode's), which reloads the rows and the rules from the server. Loads nothing when signed out (the layout shows the sign-in form instead).
 */
import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { fetchCatalogPdf, generateCatalogPdf, fetchStaffRows, type StaffBrand, type StaffCategory, type StaffPriceRule, type StaffProduct } from '@/api'
import { localized } from '@/config'
import { CatalogPdfButton } from '@/components/CatalogPdfDialog'
import { DataTable } from '@/components/DataTable'
import { discountsAction, withDiscounts } from '@/components/DiscountsDialog'
import { newProductRow, productColumns, useProductHandlers, type ProductRow } from '@/components/productColumns'
import { StockSummary, stockAction } from '@/components/StockDialog'
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

/**
 * The products page: its title, the PDF catalog button and the products table.
 * @returns The page.
 */
function AdminProducts() {
  const { products, categories, brands, rules } = Route.useLoaderData()
  const { t, locale } = useI18n()
  const handlers = useProductHandlers()
  const rows = useMemo(() => withDiscounts(products, rules, 'productId', t, locale), [products, rules, t, locale])

  // The category and brand choices are read when the table mounts (DataTable's rule); a page load refreshes them.
  const columns = useMemo(() => productColumns(t, locale, categories, brands), [t, locale, categories, brands])

  const stock = stockAction<ProductRow>(t, {
    target: (row) => localized(row.name, locale),
    load: (row, signal) => handlers.loadStock(row.id, signal),
    onSave: (row, movement) => handlers.recordStock(row.id, movement),
  })

  const discounts = discountsAction<ProductRow>(t, {
    target: (row) => localized(row.name, locale),
    onSave: (row, discount, rule) => handlers.saveDiscount(row.id, discount, rule),
    onDelete: handlers.deleteDiscount,
  })

  return (
    <section>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">{t.admin.productsTitle}</h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-charcoal-muted">{t.admin.productsDescription}</p>
        </div>
        <CatalogPdfButton load={fetchCatalogPdf} onGenerate={generateCatalogPdf} />
      </div>
      <StockSummary products={products} className="mb-6" />
      <DataTable
        rows={rows}
        columns={columns}
        caption={t.admin.productsTitle}
        rowKey={(product) => product.id}
        rowLabel={(product) => localized(product.name, locale)}
        newRow={newProductRow(categories)}
        onCreate={handlers.create}
        onUpdate={handlers.update}
        onDelete={handlers.remove}
        onReorder={handlers.reorder}
        rowActions={[stock, discounts]}
      />
    </section>
  )
}
