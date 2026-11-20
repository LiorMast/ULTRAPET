/**
 * manage.ts — The staff data of the manage mode (the staff's management layer on the customer views: the expanded
 * product cards and the product page's staff panel, ProductManager.tsx), and the lazy entry points of that layer.
 *
 * The on/off flag itself belongs to the session (useManage / readManageMode / setManageMode in auth.tsx), since signing
 * out turns it off.
 *
 * The data: loadProductAdmin reads every product (active or not), the price rules, the categories and the brands from
 * the staff API, the same rows the /admin/products table shows, and joins each product to its general discounts.
 * The catalog, product and brand pages' loaders call it while manage mode is on. The answer is cached for CACHE_MS,
 * so paging and filtering the catalog do not fetch the 400 products again; every change made through
 * useProductHandlers (productColumns.tsx) clears it first, and so do switching manage mode and entering the staff
 * panel (routes/admin.tsx).
 *
 * Code splitting: the management layer (dialogs, forms, uploads) is loaded only when it is shown, so customers never
 * download it: ManageBar and ManageStrip are React.lazy wrappers of ProductManager.tsx's components (render them
 * inside a <Suspense>), and the discounts join is imported on first use. This module stays tiny, since auth.tsx (the
 * main bundle) imports it.
 */
import { createElement, lazy, type ReactNode } from 'react'
import { ApiError, fetchStaffRows, type StaffBrand, type StaffCategory, type StaffPriceRule, type StaffProduct } from '@/api'
import type { ProductRow } from '@/components/productColumns'
import { dictionaryFor, type Locale } from '@/i18n'

/** How long loadProductAdmin reuses its last answer, in ms (changes made here clear it at once). */
export const CACHE_MS = 30_000

/**
 * The staff data of the manage mode: every product with its general discounts, and the categories and brands (the
 * edit form's choices).
 * - `products`: in the staff order (the catalog's order), active or not.
 * - `bySlug`: the same rows by slug, to find a catalog card's row (slugs are unique and never change).
 */
export type ProductAdmin = {
  products: ProductRow[]
  bySlug: Map<string, ProductRow>
  categories: StaffCategory[]
  brands: StaffBrand[]
}

let cached: { locale: Locale; at: number; data: Promise<ProductAdmin | null> } | null = null

/**
 * Drops the cached staff data (after a change, or when manage mode is switched), so the next load reads it fresh.
 */
export function clearProductAdmin() {
  cached = null
}

/**
 * Loads the manage mode's staff data from the staff API, or reuses the answer of the last CACHE_MS. It takes no abort
 * signal: the answer is shared by the loaders that ask while it loads (a catalog page replaced by the next one still
 * leaves it to the next), so one loader's abort must not fail the others.
 * @param locale - The page language (the discounts' descriptions).
 * @returns The data, or null when nobody from the staff is signed in (401/403); other failures throw (LoadError).
 */
export function loadProductAdmin(locale: Locale): Promise<ProductAdmin | null> {
  if (cached && cached.locale === locale && Date.now() - cached.at < CACHE_MS) return cached.data
  const data = (async () => {
    try {
      const [products, rules, categories, brands, { withDiscounts }] = await Promise.all([
        fetchStaffRows<StaffProduct>('products'),
        fetchStaffRows<StaffPriceRule>('price-rules'),
        fetchStaffRows<StaffCategory>('categories'),
        fetchStaffRows<StaffBrand>('brands'),
        import('@/components/DiscountsDialog'),
      ])
      const rows = withDiscounts(products, rules, 'productId', dictionaryFor(locale), locale)
      return { products: rows, bySlug: new Map(rows.map((row) => [row.slug, row])), categories, brands }
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null
      throw error
    }
  })()
  const entry = { locale, at: Date.now(), data }
  cached = entry
  // A failed load is not reused.
  data.catch(() => {
    if (cached === entry) cached = null
  })
  return data
}

/** ProductManageBar (ProductManager.tsx), loaded on first render: the "Manage products" switch and the catalog's staff actions. */
export const ManageBar = lazy(() => import('@/components/ProductManager').then((module) => ({ default: module.ProductManageBar })))

/** ProductManageStrip (ProductManager.tsx), loaded on first render: a product's staff information and actions. */
export const ManageStrip = lazy(() => import('@/components/ProductManager').then((module) => ({ default: module.ProductManageStrip })))

/**
 * The manage mode props of a CatalogCard: the product's staff strip and whether it is hidden from customers. Shared by
 * every list of cards (the catalog, a brand page, a product page's "You may also like").
 * @param admin - The staff data while manage mode is on (useManage().on), else null / undefined (the customer view).
 * @param slug - The card's product.
 * @returns `{ manage, inactive }` for the card, or {} when not managing (or the product has no staff row yet).
 */
export function cardManagement(admin: ProductAdmin | null | undefined, slug: string): { manage?: ReactNode; inactive?: boolean } {
  const row = admin?.bySlug.get(slug)
  return admin && row ? { manage: createElement(ManageStrip, { row, admin }), inactive: !row.isActive } : {}
}
