/**
 * routes/admin.resellers.tsx — Staff panel: the resellers (משווקים, /admin/resellers), the stores of the public Where
 * to Buy page and its map. Lists every reseller, active or not, and lets staff add, edit and delete them through the
 * staff API (backend/app/staff/routes.py, resource "resellers"); a change shows on /where-to-buy at once.
 *
 * Above the table, the map of every reseller (BranchMap, lazy: an inactive one has a grey pin); a click on a pin (or
 * Enter on a focused pin) opens that reseller's Edit form (DataTable `editRequest`), and the focus goes back to the
 * map when it closes. The form is the column-driven RecordDialog with the map position added (LocationField: place
 * the pin on a map, or find it from the address), which writes the latitude, longitude and approximate fields.
 *
 * After every change the page reloads the rows from the server. Loads nothing when signed out (the layout shows the
 * sign-in form instead).
 */
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createStaffRow, deleteStaffRow, fetchStaffRows, updateStaffRow, type Branch, type StaffReseller } from '@/api'
import { DataTable, type DataColumn, type EditRequest, type RowValues } from '@/components/DataTable'
import { LocationField } from '@/components/LocationField'
import { Skeleton } from '@/components/ui/skeleton'
import { dictionaryFor, useI18n } from '@/i18n'

const BranchMap = lazy(() => import('@/components/BranchMap').then((m) => ({ default: m.BranchMap })))

export const Route = createFileRoute('/admin/resellers')({
  loader: async ({ context, abortController }) => {
    if (!context.staff) return { resellers: [] }
    return { resellers: await fetchStaffRows<StaffReseller>('resellers', abortController.signal) }
  },
  head: ({ match }) => {
    const t = dictionaryFor(match.context.locale)
    return { meta: [{ title: `${t.admin.resellersTitle} | ${t.admin.metaTitle}` }] }
  },
  component: AdminResellers,
})

/** What the form starts from for a new reseller: active, at an exact location. */
const NEW_RESELLER: RowValues = { isActive: true, approximateLocation: false }

/** The map's height. */
const MAP_HEIGHT = 'h-72 sm:h-[26rem]'

/**
 * A reseller as the map draws it (the public page's shape).
 * @param row - The staff row.
 * @returns The map's store.
 */
const toBranch = (row: StaffReseller): Branch => ({
  id: row.id,
  name: row.name,
  address: row.address,
  city: row.city,
  phone: row.phone,
  website: row.website,
  lat: row.latitude,
  lng: row.longitude,
  approximate: row.approximateLocation,
})

/**
 * The resellers page: its title, the map of every reseller and the resellers table.
 * @returns The page.
 */
function AdminResellers() {
  const { resellers } = Route.useLoaderData()
  const { t } = useI18n()
  const router = useRouter()
  const f = t.admin.resellerFields
  const map = useRef<HTMLDivElement>(null)
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null)

  const columns = useMemo<DataColumn<StaffReseller>[]>(
    () => [
      { key: 'name', label: f.name, required: true },
      { key: 'city', label: f.city, required: true },
      { key: 'address', label: f.address, required: true },
      { key: 'phone', label: f.phone, ltr: true },
      { key: 'website', label: f.website, type: 'url', ltr: true, inTable: false },
      { key: 'isActive', label: f.isActive, type: 'boolean' },
      { key: 'latitude', label: f.latitude, type: 'number', required: true, ltr: true, inTable: false },
      { key: 'longitude', label: f.longitude, type: 'number', required: true, ltr: true, inTable: false },
      { key: 'approximateLocation', label: f.approximateLocation, type: 'boolean', hint: f.approximateHint, inTable: false },
    ],
    [f],
  )

  const branches = useMemo(() => resellers.map(toBranch), [resellers])
  const inactive = useMemo(() => new Set(resellers.filter((row) => !row.isActive).map((row) => row.id)), [resellers])

  /**
   * A pin was clicked: opens its reseller's Edit form; closing it puts the focus back on the pin (else the map).
   * @param id - The reseller's id.
   */
  const handlePin = (id: string) => {
    const pin = document.activeElement instanceof HTMLElement && map.current?.contains(document.activeElement) ? document.activeElement : null
    setEditRequest({ key: id, restoreFocus: () => (pin?.isConnected ? pin : map.current?.querySelector<HTMLElement>('[role="region"]'))?.focus() })
  }

  return (
    <section>
      <h1 className="font-display text-2xl font-bold text-brand-charcoal sm:text-3xl">{t.admin.resellersTitle}</h1>
      <p className="mb-6 mt-2 max-w-2xl sm:mb-8 text-sm text-brand-charcoal-muted">{t.admin.resellersDescription}</p>
      <div ref={map} className="mb-10">
        <Suspense fallback={<Skeleton className={`${MAP_HEIGHT} w-full rounded-2xl`} />}>
          <BranchMap
            branches={branches}
            selectedId={null}
            onSelect={handlePin}
            mutedIds={inactive}
            popups={false}
            label={t.admin.resellersMapLabel}
            className={MAP_HEIGHT}
          />
        </Suspense>
      </div>
      <DataTable
        rows={resellers}
        columns={columns}
        caption={t.admin.resellersTitle}
        rowKey={(reseller) => reseller.id}
        rowLabel={(reseller) => reseller.name}
        newRow={NEW_RESELLER}
        formExtra={(form) => <LocationField form={form} />}
        editRequest={editRequest}
        onCreate={async (values) => {
          await createStaffRow('resellers', values)
          await router.invalidate()
        }}
        onUpdate={async (id, changes) => {
          await updateStaffRow('resellers', id, changes)
          await router.invalidate()
        }}
        onDelete={async (id) => {
          await deleteStaffRow('resellers', id)
          await router.invalidate()
        }}
      />
    </section>
  )
}
