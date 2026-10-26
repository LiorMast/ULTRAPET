/**
 * WhereToBuy.tsx — The "Where to Buy" page content (משווקים): a store locator with a search box, a
 * "find the nearest store" button, a list of the reseller stores (name, address, phone, distance) and a map.
 * Used by routes/where-to-buy.tsx. The stores come from stubs/branches.json until the backend serves them.
 * The map (Leaflet) is loaded lazily, so the rest of the site does not download it.
 */
import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react'
import { LocateFixed, MapPin, Navigation, Phone, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Branch, LatLng } from '@/components/BranchMap'
import { useI18n } from '@/i18n'
import branchesData from '@/stubs/branches.json'

const BranchMap = lazy(() => import('@/components/BranchMap').then((m) => ({ default: m.BranchMap })))

/** Where the visitor's position stands: not asked, waiting for the browser, or an error to show. */
type LocationState = { status: 'idle' | 'locating' } | { status: 'found'; position: LatLng } | { status: 'denied' | 'unsupported' }

/** Map and list height on large screens. */
const PANE_HEIGHT = 'h-[34rem] lg:h-[40rem]'

/**
 * Straight-line distance between two points (haversine formula).
 * @param a - First point.
 * @param b - Second point.
 * @returns The distance in kilometres.
 */
function distanceKm(a: LatLng, b: LatLng) {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/**
 * One store in the list: a pin with the distance (when known), the name, address, and call / navigate /
 * website links. The whole card is selectable; the links work on their own.
 * @param props.branch - The store to show.
 * @param props.distance - Distance from the visitor in km, or undefined when the location is unknown.
 * @param props.selected - Whether the store is the selected one (highlighted).
 * @param props.onSelect - Called when the card's main button is pressed.
 * @returns The list item.
 */
function BranchCard({ branch, distance, selected, onSelect }: { branch: Branch; distance?: number; selected: boolean; onSelect: () => void }) {
  const { t } = useI18n()
  const linkClass = 'inline-flex items-center gap-1.5 text-xs font-semibold text-brand-red-dark hover:underline focus-visible:ring-2 focus-visible:ring-brand-red/60'
  return (
    <li className={`border-b border-neutral-150 transition-colors ${selected ? 'bg-brand-red-muted' : 'bg-white'}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full items-start gap-4 px-5 pt-5 text-start focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-red/60"
      >
        <span className="flex w-14 shrink-0 flex-col items-center text-brand-red">
          <MapPin aria-hidden="true" className="size-7" />
          {distance !== undefined && <span className="mt-1 font-heading text-sm font-bold text-brand-charcoal">{distance.toFixed(1)}</span>}
        </span>
        <span className="block min-w-0 flex-1">
          <span className="block font-heading text-base font-bold text-brand-charcoal">{branch.name}</span>
          <span className="mt-1 block text-sm text-brand-charcoal-muted">{[branch.address, branch.city].filter(Boolean).join(', ')}</span>
          {distance !== undefined && <span className="mt-0.5 block text-xs text-brand-charcoal-muted">{t.whereToBuy.distance.replace('{km}', distance.toFixed(1))}</span>}
        </span>
      </button>
      <div className="flex flex-wrap gap-x-5 gap-y-2 pe-5 pb-5 ps-[5.75rem] pt-3">
        {branch.phone && (
          <a href={`tel:${branch.phone.replace(/[^\d+]/g, '')}`} className={linkClass}>
            <Phone aria-hidden="true" className="size-3.5" />
            <span dir="ltr">{branch.phone}</span>
          </a>
        )}
        <a href={`https://waze.com/ul?ll=${branch.lat},${branch.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <Navigation aria-hidden="true" className="size-3.5" />
          {t.whereToBuy.navigate}
        </a>
        {branch.website && (
          <a href={branch.website} target="_blank" rel="nofollow noopener noreferrer" className={linkClass}>
            {t.whereToBuy.website}
          </a>
        )}
      </div>
    </li>
  )
}

/**
 * The Where to Buy page content.
 * @param props.branches - The stores; defaults to the stub in stubs/branches.json.
 * @returns The page <section> with the heading, filters, list and map.
 */
export function WhereToBuy({ branches = branchesData as Branch[] }: { branches?: Branch[] }) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState<LocationState>({ status: 'idle' })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const position = location.status === 'found' ? location.position : null

  /** Stores matching the search text, nearest first when the location is known, else by city and name. */
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = branches
      .filter((b) => !needle || `${b.name} ${b.address} ${b.city}`.toLowerCase().includes(needle))
      .map((branch) => ({ branch, distance: position ? distanceKm(position, branch) : undefined }))
    return rows.sort((a, b) =>
      a.distance !== undefined && b.distance !== undefined
        ? a.distance - b.distance
        : a.branch.city.localeCompare(b.branch.city, locale) || a.branch.name.localeCompare(b.branch.name, locale),
    )
  }, [branches, query, position, locale])

  const shownBranches = useMemo(() => shown.map((row) => row.branch), [shown])
  const activeId = shownBranches.some((b) => b.id === selectedId) ? selectedId : null

  /**
   * Asks the browser for the visitor's position, then sorts by distance and selects the nearest store.
   * Shows a message when location is denied or unsupported.
   */
  const handleNearest = () => {
    if (!('geolocation' in navigator)) {
      setLocation({ status: 'unsupported' })
      return
    }
    setLocation({ status: 'locating' })
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const found = { lat: coords.latitude, lng: coords.longitude }
        setLocation({ status: 'found', position: found })
        const nearest = branches.reduce((best, b) => (distanceKm(found, b) < distanceKm(found, best) ? b : best), branches[0])
        setSelectedId(nearest?.id ?? null)
      },
      () => setLocation({ status: 'denied' }),
      { timeout: 10000 },
    )
  }

  /**
   * Search form submit: nothing to send (the list filters as you type), so just keep the page from reloading.
   * @param event - The form submit event.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => event.preventDefault()

  const message =
    location.status === 'locating' ? t.whereToBuy.locating : location.status === 'denied' ? t.whereToBuy.locationDenied : location.status === 'unsupported' ? t.whereToBuy.locationUnsupported : ''

  return (
    <section aria-labelledby="where-to-buy-title" className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
      <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-red">{t.whereToBuy.eyebrow}</p>
      <h1 id="where-to-buy-title" className="mt-4 font-display text-4xl font-bold text-brand-charcoal lg:text-5xl">
        {t.whereToBuy.title}
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-brand-charcoal-muted">{t.whereToBuy.description}</p>

      <form onSubmit={handleSubmit} role="search" aria-label={t.whereToBuy.searchLabel} className="mt-10 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="branch-search" className="sr-only">
            {t.whereToBuy.searchLabel}
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-brand-charcoal-muted" />
          <input
            id="branch-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.whereToBuy.searchPlaceholder}
            autoComplete="off"
            className="block h-12 w-full border border-neutral-300 bg-neutral-50 ps-12 pe-4 text-sm text-brand-charcoal focus:border-brand-red focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40"
          />
        </div>
        <Button type="button" onClick={handleNearest} disabled={location.status === 'locating'}>
          <LocateFixed aria-hidden="true" />
          {t.whereToBuy.nearest}
        </Button>
      </form>

      <p role="status" className="mt-3 min-h-6 text-sm text-brand-charcoal-muted">
        {message || t.whereToBuy.results.replace('{n}', String(shown.length))}
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className={`${PANE_HEIGHT} overflow-y-auto border border-neutral-200`}>
          {shown.length === 0 ? (
            <p className="p-8 text-center text-brand-charcoal-muted">{t.whereToBuy.noResults}</p>
          ) : (
            <ul aria-label={t.whereToBuy.listLabel}>
              {shown.map(({ branch, distance }) => (
                <BranchCard key={branch.id} branch={branch} distance={distance} selected={branch.id === activeId} onSelect={() => setSelectedId(branch.id)} />
              ))}
            </ul>
          )}
        </div>
        <Suspense fallback={<div className={`${PANE_HEIGHT} flex items-center justify-center bg-neutral-100 text-sm text-brand-charcoal-muted`}>{t.whereToBuy.mapLoading}</div>}>
          <BranchMap branches={shownBranches} selectedId={activeId} onSelect={setSelectedId} userLocation={position} className={PANE_HEIGHT} />
        </Suspense>
      </div>
    </section>
  )
}
