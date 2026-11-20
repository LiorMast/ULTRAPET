/**
 * productColumns.tsx — The product as staff edit it, shared by the two product managers: the products table
 * (/admin/products, a DataTable) and the manage mode of the customer views (ProductManager.tsx: the catalog cards and
 * the product page). Both must offer the same form and do the same thing on save, so both take from here:
 *  - productColumns: the DataColumn config (photos, name, SKU, category, brand, list price, stock, low-stock
 *    threshold, discounts, active, barcode, description) that drives the table's cells and the RecordDialog form;
 *  - useProductHandlers: every change a manager makes (add, save, delete, reorder, toggle active, record a stock
 *    movement, add / edit / delete a discount) through the staff API, each followed by a reload of the page's data
 *    (and of the manage mode's cached staff rows, clearProductAdmin).
 */
import { useMemo } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  createStaffRow,
  deleteStaffRow,
  fetchProductStock,
  recordStockMovement,
  reorderStaffRows,
  updateStaffRow,
  type StaffBrand,
  type StaffCategory,
  type StaffPriceRule,
  type StaffProduct,
  type StockMovementInput,
} from '@/api'
import { localized } from '@/config'
import type { DataColumn, RowValues } from '@/components/DataTable'
import { discountFields, DiscountsCell, type DiscountRow } from '@/components/DiscountsDialog'
import type { DiscountValue } from '@/components/DiscountDialog'
import { StockCell } from '@/components/StockDialog'
import type { Locale } from '@/i18n'
import type { Dictionary } from '@/i18n/he'
import { clearProductAdmin } from '@/manage'

/** A product as both managers show it: the staff row with its general discounts (withDiscounts). */
export type ProductRow = DiscountRow<StaffProduct>

/** What a new product's form starts from: active, in the first category. */
export const newProductRow = (categories: StaffCategory[]): RowValues => ({ isActive: true, categoryId: categories[0]?.id })

/**
 * The product's columns, in form order.
 * @param t - The dictionary.
 * @param locale - The page language (the category names).
 * @param categories - Every category (the category choice).
 * @param brands - Every brand (the brand choice).
 * @returns The columns.
 */
export function productColumns(t: Dictionary, locale: Locale, categories: StaffCategory[], brands: StaffBrand[]): DataColumn<ProductRow>[] {
  const f = t.admin.productFields
  return [
    { key: 'images', label: f.images, type: 'images', folder: 'products', hint: f.imagesHint },
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
    // The units on hand change only through the "Stock" action (a recorded movement), never in the form.
    { key: 'stockQuantity', label: f.stock, type: 'integer', inForm: false, render: (row) => <StockCell quantity={row.stockQuantity} threshold={row.lowStockThreshold} /> },
    { key: 'lowStockThreshold', label: f.lowStockThreshold, type: 'integer', hint: f.lowStockThresholdHint, inTable: false },
    { key: 'discountText', label: f.discounts, inForm: false, render: (row) => <DiscountsCell rules={row.discounts} /> },
    { key: 'isActive', label: f.isActive, type: 'boolean' },
    { key: 'barcode', label: f.barcode, ltr: true, inTable: false },
    { key: 'description', label: f.description, type: 'localized', multiline: true, inTable: false },
  ]
}

/**
 * Every change a product manager makes; each resolves once saved and the page's data reloaded. `remove` with
 * `reload: false` only drops the cached staff rows (the product page leaves for the catalog instead of reloading a
 * page whose product is gone).
 */
export type ProductHandlers = {
  create: (values: RowValues) => Promise<void>
  update: (id: string, changes: RowValues) => Promise<void>
  remove: (id: string, options?: { reload?: boolean }) => Promise<void>
  reorder: (ids: string[]) => Promise<void>
  loadStock: (id: string, signal: AbortSignal) => ReturnType<typeof fetchProductStock>
  recordStock: (id: string, movement: StockMovementInput) => ReturnType<typeof recordStockMovement>
  saveDiscount: (productId: string, discount: DiscountValue, rule?: StaffPriceRule) => Promise<void>
  deleteDiscount: (rule: StaffPriceRule) => Promise<void>
}

/**
 * The product managers' changes through the staff API (resources "products" and "price-rules", the stock routes),
 * each followed by a reload: the manage mode's cached staff rows are dropped and the router's loaders run again.
 * @returns The handlers (see ProductHandlers).
 */
export function useProductHandlers(): ProductHandlers {
  const router = useRouter()
  return useMemo(() => {
    /** Reloads the page's data after a change (the manage mode's staff rows too). */
    const reload = async () => {
      clearProductAdmin()
      await router.invalidate()
    }
    return {
      create: async (values) => {
        await createStaffRow('products', values)
        await reload()
      },
      update: async (id, changes) => {
        await updateStaffRow('products', id, changes)
        await reload()
      },
      remove: async (id, { reload: reloadPage = true } = {}) => {
        await deleteStaffRow('products', id)
        if (reloadPage) await reload()
        else clearProductAdmin()
      },
      reorder: async (ids) => {
        await reorderStaffRows('products', ids)
        await reload()
      },
      loadStock: (id, signal) => fetchProductStock(id, signal),
      recordStock: async (id, movement) => {
        const saved = await recordStockMovement(id, movement)
        await reload()
        return saved
      },
      saveDiscount: async (productId, discount, rule) => {
        if (rule) await updateStaffRow('price-rules', rule.id, discountFields(discount))
        else await createStaffRow('price-rules', { productId, ...discountFields(discount) })
        await reload()
      },
      deleteDiscount: async (rule) => {
        await deleteStaffRow('price-rules', rule.id)
        await reload()
      },
    }
  }, [router])
}
