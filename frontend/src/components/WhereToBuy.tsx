/**
 * WhereToBuy.tsx — The "Where to Buy" page content (משווקים): a store locator with a search box, a
 * "find the nearest store" button, a list of the reseller stores (name, address, phone, distance) and a map.
 * Used by routes/where-to-buy.tsx, which loads the stores from the API (fetchResellers).
 * The map (Leaflet) is loaded lazily, so the rest of the site does not download it; a skeleton of its size waits in
 * its place meanwhile.
 *
 * Mobile-first: below lg the list and the map take turns, chosen by a List | Map switch (SegmentedSwitch); the list
 * flows in the page (no box scrolling inside the page), the map fills the screen under it, and picking a store in the
 * list shows it on the map. From lg they stand side by side, the same height. A store's actions (call, Waze, website)
 * are 44px chips on touch screens.
 */
import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react'
import { Globe, List, LocateFixed, Map as MapIcon, Navigation, Phone, Search } from 'lucide-react'
import { cn } from 'cn'
import { SectionHeading } from '@/components/SectionHeading'
import { SegmentedSwitch } from '@/components/SegmentedSwitch'
import { useMediaQuery } from '@/components/useMediaQuery'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { inputVariants } from '@/components/ui/input'
import type { Branch } from '@/api'
import type { LatLng } from '@/components/BranchMap'
import { useI18n } from '@/i18n'

const BranchMap = lazy(() => import('@/components/BranchMap').then((m) => ({ default: m.BranchMap })))

/** Where the visitor's position stands: not asked, waiting for the browser, or an error to show. */
type LocationState = { status: 'idle' | 'locating' } | { status: 'found'; position: LatLng } | { status: 'denied' | 'unsupported' }

/** The list's and the map's height side by side (lg); below lg the map fills the screen and the list flows. */
const PANE_HEIGHT = 'lg:h-[40rem]'

/** The map's height below lg: the screen under the header, above the tab bar (at least 20rem). */
const MAP_HEIGHT = 'h-[max(20rem,calc(100svh-var(--header-h)-var(--tabbar-h)-2rem))] lg:h-[40rem]'

/** Below lg (Tailwind's 64rem): the list and the map take turns. */
const NARROW_QUERY = '(width < 64rem)'

/** A store's action (call, Waze, website): a small outlined chip that leads with its icon; 44px tall on touch screens. */
const ACTION_CLASS =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 font-heading text-xs font-semibold text-brand-red-dark transition-[color,border-color,scale] duration-300 outline-none hover:border-brand-red focus-visible:ring-2 focus-visible:ring-brand-red/60 active:scale-[0.97] active:duration-100 pointer-coarse:h-11 pointer-coarse:text-sm [&_svg]:size-4'

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
 * One store in the list: the name, address, distance (when known), and call / navigate / website chips (each leads with
 * its icon, like the action buttons). The whole card is selectable; the chips work on their own.
 * @param props.branch - The store to show.
 * @param props.distance - Distance from the visitor in km, or undefined when the location is unknown.
 * @param props.selected - Whether the store is the selected one (highlighted).
 * @param props.onSelect - Called when the card's main button is pressed.
 * @returns The list item.
 */
function BranchCard({ branch, distance, selected, onSelect }: { branch: Branch; distance?: number; selected: boolean; onSelect: () => void }) {
  const { t } = useI18n()
  return (
    <li className={cn('border-b border-neutral-150 transition-colors duration-300 last:border-b-0', selected ? 'bg-brand-red-muted' : 'bg-white hover:bg-neutral-50')}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="block w-full px-5 pt-5 text-start focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-red/60"
      >
        <span className="block min-w-0">
          <span className="block font-heading text-base font-semibold text-brand-charcoal">{branch.name}</span>
          <span className="mt-1 block text-sm text-brand-charcoal-muted">{[branch.address, branch.city].filter(Boolean).join(', ')}</span>
          {distance !== undefined && <span className="mt-0.5 block text-xs text-brand-charcoal-muted">{t.whereToBuy.distance.replace('{km}', distance.toFixed(1))}</span>}
        </span>
      </button>
      <div className="flex flex-wrap gap-2 px-5 pb-5 pt-3">
        {branch.phone && (
          <a href={`tel:${branch.phone.replace(/[^\d+]/g, '')}`} className={ACTION_CLASS}>
            <Phone aria-hidden="true" />
            <span dir="ltr">{branch.phone}</span>
          </a>
        )}
        <a href={`https://waze.com/ul?ll=${branch.lat},${branch.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer" className={ACTION_CLASS}>
          <Navigation aria-hidden="true" />
          {t.whereToBuy.navigate}
        </a>
        {branch.website && (
          <a href={branch.website} target="_blank" rel="nofollow noopener noreferrer" className={ACTION_CLASS}>
            <Globe aria-hidden="true" />
            {t.whereToBuy.website}
          </a>
        )}
      </div>
    </li>
  )
}

/**
 * The Where to Buy page content.
 * @param props.branches - The stores.
 * @returns The page <section> with the heading, filters, list and map.
 */
export function WhereToBuy({ branches }: { branches: Branch[] }) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState<LocationState>({ status: 'idle' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const narrow = useMediaQuery(NARROW_QUERY)
  const [view, setView] = useState<'list' | 'map'>('list')
  const showList = !narrow || view === 'list'
  const showMap = !narrow || view === 'map'

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
    <section aria-labelledby="where-to-buy-title" className="page-y px-gutter mx-auto max-w-7xl lg:py-20">
      <SectionHeading as="h1" id="where-to-buy-title" eyebrow={t.whereToBuy.eyebrow} title={t.whereToBuy.title} intro={t.whereToBuy.description} />

      <form onSubmit={handleSubmit} role="search" aria-label={t.whereToBuy.searchLabel} className="mt-6 flex flex-col gap-3 sm:mt-10 sm:flex-row">
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
            className={inputVariants({ size: 'search' })}
          />
        </div>
        <Button type="button" onClick={handleNearest} loading={location.status === 'locating'}>
          <LocateFixed aria-hidden="true" />
          {t.whereToBuy.nearest}
        </Button>
      </form>

      <p role="status" className="mt-3 min-h-6 text-sm text-brand-charcoal-muted">
        {message || t.whereToBuy.results.replace('{n}', String(shown.length))}
      </p>

      {narrow && (
        <SegmentedSwitch
          legend={t.whereToBuy.view}
          hideLegend
          options={[
            { value: 'list', label: t.whereToBuy.list, icon: List },
            { value: 'map', label: t.whereToBuy.map, icon: MapIcon },
          ]}
          value={view}
          onChange={setView}
          className="mt-3"
        />
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {showList && (
          <div className={cn(PANE_HEIGHT, 'rounded-2xl border border-neutral-200 lg:overflow-y-auto lg:overscroll-contain')}>
            {shown.length === 0 ? (
              <p className="p-8 text-center text-brand-charcoal-muted">{t.whereToBuy.noResults}</p>
            ) : (
              <ul aria-label={t.whereToBuy.listLabel}>
                {shown.map(({ branch, distance }) => (
                  <BranchCard
                    key={branch.id}
                    branch={branch}
                    distance={distance}
                    selected={branch.id === activeId}
                    onSelect={() => {
                      setSelectedId(branch.id)
                      // Below lg the picked store shows on the map.
                      if (narrow) setView('map')
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
        {showMap && (
          // While the map's code loads: a skeleton of the map's size, saying what is coming.
          <Suspense
            fallback={
              <div className={cn(MAP_HEIGHT, 'relative flex items-center justify-center overflow-hidden rounded-2xl')}>
                <Skeleton className="absolute inset-0 size-full rounded-none" />
                <p className="relative text-sm text-brand-charcoal-muted">{t.whereToBuy.mapLoading}</p>
              </div>
            }
          >
            <BranchMap branches={shownBranches} selectedId={activeId} onSelect={setSelectedId} userLocation={position} className={MAP_HEIGHT} />
          </Suspense>
        )}
      </div>
    </section>
  )
}
