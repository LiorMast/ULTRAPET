/**
 * routes/admin.suppliers.tsx — Staff panel: the suppliers table (/admin/suppliers). Lists every supplier (the
 * manufacturers and exporters Ultra Pet buys from), active or not, and lets staff add, edit and delete them through
 * the staff API (backend/app/staff/routes.py, resource "suppliers"). Suppliers are never shown on the public site;
 * one Ultra Pet no longer buys from is switched off (isActive) and kept for its history.
 *
 * Each row's "Products" button (SupplierProductsDialog) edits the products the supplier supplies, with the supplier's
 * item code and the cost price (GET/PUT /api/staff/suppliers/<id>/products); the loader also reads the products, the
 * dialog's choices. The country is a type-to-search choice of the ISO 3166 countries, named in the page language.
 *
 * The page is a DataTable with the suppliers' column config; after every change it reloads the rows from the
 * server. Loads nothing when signed out (the layout shows the sign-in form instead).
 */
import { useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  createStaffRow,
  deleteStaffRow,
  fetchStaffRows,
  fetchSupplierProducts,
  saveSupplierProducts,
  updateStaffRow,
  type StaffProduct,
  type StaffSupplier,
} from '@/api'
import { localized } from '@/config'
import { DataTable, type DataColumn, type RowValues } from '@/components/DataTable'
import { supplierProductsAction } from '@/components/SupplierProductsDialog'
import { dictionaryFor, useI18n, type Locale } from '@/i18n'

export const Route = createFileRoute('/admin/suppliers')({
  loader: async ({ context, abortController }) => {
    if (!context.staff) return { suppliers: [], products: [] }
    const [suppliers, products] = await Promise.all([
      fetchStaffRows<StaffSupplier>('suppliers', abortController.signal),
      fetchStaffRows<StaffProduct>('products', abortController.signal),
    ])
    return { suppliers, products }
  },
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.admin.suppliersTitle} | ${t.admin.metaTitle}` }] }
  },
  component: AdminSuppliers,
})

/** What the form starts from for a new supplier: active. */
const NEW_SUPPLIER: RowValues = { isActive: true }

/** The ISO 3166-1 alpha-2 country codes (the values suppliers.country allows), named by Intl.DisplayNames. */
const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC ' +
  'CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD ' +
  'GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH ' +
  'KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW ' +
  'MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC ' +
  'SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY ' +
  'UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ')

/**
 * The country choices of the form, named in the page language and sorted by name.
 * @param locale - The page language.
 * @returns The options (value = the ISO code, label = the country's name).
 */
function countryOptions(locale: Locale): { value: string; label: string }[] {
  const names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' })
  return COUNTRY_CODES.map((code) => ({ value: code, label: names.of(code) ?? code })).sort((a, b) => a.label.localeCompare(b.label, locale))
}

/**
 * The suppliers page: its title and the suppliers table.
 * @returns The page.
 */
function AdminSuppliers() {
  const { suppliers, products } = Route.useLoaderData()
  const { t, locale } = useI18n()
  const router = useRouter()
  const f = t.admin.supplierFields

  const columns = useMemo<DataColumn<StaffSupplier>[]>(
    () => [
      { key: 'name', label: f.name, required: true },
      { key: 'country', label: f.country, type: 'select', searchable: true, options: countryOptions(locale) },
      { key: 'contactName', label: f.contactName },
      { key: 'email', label: f.email, ltr: true },
      { key: 'phone', label: f.phone, ltr: true },
      { key: 'website', label: f.website, type: 'url', ltr: true, inTable: false },
      { key: 'notes', label: f.notes, multiline: true, hint: f.notesHint, inTable: false },
      { key: 'isActive', label: f.isActive, type: 'boolean' },
    ],
    [f, locale],
  )

  const choices = useMemo(
    () => products.map((product) => ({ value: product.id, label: localized(product.name, locale), detail: product.sku ?? undefined })),
    [products, locale],
  )

  const productsAction = supplierProductsAction<StaffSupplier>(t, {
    target: (row) => row.name,
    products: choices,
    load: (row, signal) => fetchSupplierProducts(row.id, signal),
    onSave: (row, lines) => saveSupplierProducts(row.id, lines),
  })

  return (
    <section>
      <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">{t.admin.suppliersTitle}</h1>
      <p className="mb-6 mt-2 max-w-2xl sm:mb-8 text-sm text-brand-charcoal-muted">{t.admin.suppliersDescription}</p>
      <DataTable
        rows={suppliers}
        columns={columns}
        caption={t.admin.suppliersTitle}
        rowKey={(supplier) => supplier.id}
        rowLabel={(supplier) => supplier.name}
        newRow={NEW_SUPPLIER}
        rowActions={[productsAction]}
        onCreate={async (values) => {
          await createStaffRow('suppliers', values)
          await router.invalidate()
        }}
        onUpdate={async (id, changes) => {
          await updateStaffRow('suppliers', id, changes)
          await router.invalidate()
        }}
        onDelete={async (id) => {
          await deleteStaffRow('suppliers', id)
          await router.invalidate()
        }}
      />
    </section>
  )
}
