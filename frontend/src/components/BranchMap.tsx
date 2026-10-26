/**
 * BranchMap.tsx — The interactive map of reseller stores (Leaflet + OpenStreetMap tiles, no API key).
 * Used by WhereToBuy, which loads it lazily so Leaflet stays out of every other page's bundle. It shows a
 * brand-red pin per store with a popup, a dot for the visitor's location, and a full-screen button.
 * The map is a visual aid: the same stores are listed as text beside it.
 */
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { Maximize2, Minimize2, Phone } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { useReducedMotion } from '@/components/useReducedMotion'
import { useI18n } from '@/i18n'

/** One reseller store, in the shape of the planned API response (see stubs/branches.json). */
export type Branch = {
  id: string
  name: string
  address: string
  city: string
  phone: string
  website?: string | null
  lat: number
  lng: number
  /** True when the address could not be located and the pin sits at the city centre. */
  approximate?: boolean
}

/** A point on the map, e.g. the visitor's location. */
export type LatLng = { lat: number; lng: number }

/** Centre of Israel, used before the pins are fitted. */
const ISRAEL_CENTER: L.LatLngTuple = [31.5, 34.9]

/**
 * Builds the pin icon: an inline SVG in the brand red, so no image files are needed.
 * @param selected - Whether the pin is the selected store (drawn larger and darker).
 * @returns The Leaflet icon.
 */
function pinIcon(selected: boolean) {
  const size = selected ? 44 : 32
  const fill = selected ? '#96181D' : '#BE1E24'
  return L.divIcon({
    className: 'branch-pin',
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="${fill}" stroke="#fff" stroke-width="1.2" d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
  })
}

const PIN_ICON = pinIcon(false)
const PIN_ICON_SELECTED = pinIcon(true)

/**
 * Moves the map when the data changes (renders nothing): fits all pins when the list changes, and flies to
 * the selected store and opens its popup when the selection changes.
 * @param props.branches - The stores currently shown.
 * @param props.selectedId - The selected store id, or null.
 * @param props.markers - Ref to the Leaflet marker of each store, by id (to open popups).
 * @returns null.
 */
function MapController({ branches, selectedId, markers }: { branches: Branch[]; selectedId: string | null; markers: React.RefObject<Map<string, L.Marker>> }) {
  const map = useMap()
  const reduced = useReducedMotion()

  useEffect(() => {
    if (branches.length === 0) return
    map.fitBounds(L.latLngBounds(branches.map((b): L.LatLngTuple => [b.lat, b.lng])), { padding: [40, 40], maxZoom: 15, animate: !reduced })
  }, [branches, map, reduced])

  const selected = branches.find((b) => b.id === selectedId)
  // Depends on the selected store itself, so filtering the list around it does not re-fly the map.
  useEffect(() => {
    if (!selected) return
    map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 15), { animate: !reduced, duration: 0.8 })
    markers.current.get(selected.id)?.openPopup()
  }, [selected, map, reduced, markers])

  return null
}

/**
 * The full-screen toggle button, placed over the top corner of the map.
 * @param props.target - Ref to the element that goes full screen.
 * @returns The button.
 */
function FullscreenButton({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const { t } = useI18n()
  const [active, setActive] = useState(false)

  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement === target.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [target])

  /** Enters or leaves full screen for the map wrapper. */
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void target.current?.requestFullscreen?.()
  }

  const Icon = active ? Minimize2 : Maximize2
  const label = active ? t.whereToBuy.exitFullscreen : t.whereToBuy.fullscreen
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="absolute bottom-8 start-3 z-[1000] flex size-10 items-center justify-center bg-white text-brand-charcoal shadow-premium-sm transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-brand-red/60"
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  )
}

/**
 * Renders the map with one pin per store.
 * @param props.branches - The stores to pin (already filtered by the page).
 * @param props.selectedId - The selected store id, or null; its pin is highlighted and its popup opened.
 * @param props.onSelect - Called with a store id when its pin is clicked.
 * @param props.userLocation - The visitor's location, drawn as a dot; optional.
 * @param props.className - Extra classes for the wrapper (sets the height).
 * @returns The map wrapper element.
 */
export function BranchMap({
  branches,
  selectedId,
  onSelect,
  userLocation,
  className,
}: {
  branches: Branch[]
  selectedId: string | null
  onSelect: (id: string) => void
  userLocation?: LatLng | null
  className?: string
}) {
  const { t, dir } = useI18n()
  const wrapper = useRef<HTMLDivElement>(null)
  const markers = useRef(new Map<string, L.Marker>())

  return (
    <div ref={wrapper} className={`relative bg-neutral-100 ${className ?? ''}`}>
      <div role="region" aria-label={t.whereToBuy.mapLabel} dir="ltr" className="size-full">
      <MapContainer center={ISRAEL_CENTER} zoom={8} scrollWheelZoom={false} className="size-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapController branches={branches} selectedId={selectedId} markers={markers} />
        {branches.map((branch) => (
          <Marker
            key={branch.id}
            position={[branch.lat, branch.lng]}
            icon={branch.id === selectedId ? PIN_ICON_SELECTED : PIN_ICON}
            title={branch.name}
            ref={(marker) => {
              if (marker) markers.current.set(branch.id, marker)
              else markers.current.delete(branch.id)
            }}
            eventHandlers={{ click: () => onSelect(branch.id) }}
          >
            <Popup>
              <div dir={dir} className="min-w-40 text-start">
                <p className="font-heading text-sm font-bold text-brand-charcoal">{branch.name}</p>
                <p className="mt-1 text-xs text-brand-charcoal-muted">{[branch.address, branch.city].filter(Boolean).join(', ')}</p>
                {branch.approximate && <p className="mt-1 text-xs text-brand-charcoal-muted">{t.whereToBuy.approximate}</p>}
                {branch.phone && (
                  <a href={`tel:${branch.phone.replace(/[^\d+]/g, '')}`} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-red-dark hover:underline" dir="ltr">
                    <Phone aria-hidden="true" className="size-3.5" />
                    {branch.phone}
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        {userLocation && <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1A73E8', fillOpacity: 1 }} />}
      </MapContainer>
      </div>
      <FullscreenButton target={wrapper} />
    </div>
  )
}
