/**
 * routes/admin.brands.tsx — Staff panel: the brands table (/admin/brands). Lists every brand, active or not,
 * and lets staff add, edit and delete them through the staff API (backend/app/staff/routes.py, resource
 * "brands"); a change shows on the public site's Brands section and brand pages at once.
 *
 * The page is a DataTable with the brands' column config; after every change it reloads the rows from the
 * server. Loads nothing when signed out (the layout shows the sign-in form instead).
 */
import { useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createStaffRow, deleteStaffRow, fetchStaffRows, updateStaffRow, type StaffBrand } from '@/api'
import { DataTable, type DataColumn, type RowValues } from '@/components/DataTable'
import { dictionaryFor, useI18n } from '@/i18n'

export const Route = createFileRoute('/admin/brands')({
  loader: ({ context, abortController }) => (context.staff ? fetchStaffRows<StaffBrand>('brands', abortController.signal) : []),
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.admin.brandsTitle} | ${t.admin.metaTitle}` }] }
  },
  component: AdminBrands,
})

/** What the form starts from for a new brand: active, first in the list. */
const NEW_BRAND: RowValues = { isActive: true, sortOrder: 0 }

/**
 * The brands page: its title and the brands table.
 * @returns The page.
 */
function AdminBrands() {
  const rows = Route.useLoaderData()
  const { t } = useI18n()
  const router = useRouter()
  const f = t.admin.brandFields

  const columns = useMemo<DataColumn<StaffBrand>[]>(
    () => [
      { key: 'name', label: f.name, required: true },
      { key: 'slug', label: f.slug, required: true, ltr: true, pattern: '[a-z0-9]+(-[a-z0-9]+)*', hint: f.slugHint },
      { key: 'tagline', label: f.tagline, type: 'localized' },
      { key: 'description', label: f.description, type: 'localized', multiline: true, inTable: false },
      { key: 'accentColor', label: f.accentColor, type: 'color', pattern: '#[0-9A-Fa-f]{6}' },
      { key: 'logoUrl', label: f.logoUrl, type: 'url', inTable: false },
      { key: 'sortOrder', label: f.sortOrder, type: 'integer', required: true },
      { key: 'isActive', label: f.isActive, type: 'boolean' },
    ],
    [f],
  )

  return (
    <section>
      <h1 className="font-display text-3xl font-bold text-brand-charcoal">{t.admin.brandsTitle}</h1>
      <p className="mb-8 mt-2 max-w-2xl text-sm text-brand-charcoal-muted">{t.admin.brandsDescription}</p>
      <DataTable
        rows={rows}
        columns={columns}
        caption={t.admin.brandsTitle}
        rowKey={(brand) => brand.id}
        rowLabel={(brand) => brand.name}
        newRow={NEW_BRAND}
        onCreate={async (values) => {
          await createStaffRow('brands', values)
          await router.invalidate()
        }}
        onUpdate={async (id, changes) => {
          await updateStaffRow('brands', id, changes)
          await router.invalidate()
        }}
        onDelete={async (id) => {
          await deleteStaffRow('brands', id)
          await router.invalidate()
        }}
      />
    </section>
  )
}
