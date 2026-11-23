/**
 * BranchMap.tsx — The interactive maps of the reseller stores (Leaflet + OpenStreetMap tiles, no API key), loaded
 * lazily by their callers so Leaflet stays out of every other page's bundle:
 * - BranchMap: a brand-red pin per store with a popup, a dot for the visitor's location, and a full-screen button.
 *   Used by WhereToBuy (the public page) and the staff panel's resellers page (routes/admin.resellers.tsx: every
 *   store, inactive ones with a grey pin, no popups: a click opens the store's form).
 * - LocationPicker: one draggable pin that staff place by clicking or dragging (ResellerDialog, a store's position).
 * The maps are a visual aid: the same stores are listed as text beside them, and the picker's point is also typed
 * into number fields.
 *
 * Touch screens (TouchPan): one finger scrolls the page past a map and two fingers move and zoom it, like most sites'
 * maps, so a map never traps the page's scroll; a hint says so when one finger drags on it. In full screen one finger
 * moves the map. The full-screen button shows only where the browser can put an element in full screen (not on
 * iPhones). The maps' layers stay inside their box (isolate), under the header, dialogs and toasts.
 */
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Maximize2, Minimize2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import type { Branch } from '@/api'
import { useReducedMotion } from '@/components/useMediaQuery'
import { useI18n } from '@/i18n'

/** A point on the map, e.g. the visitor's location. */
export type LatLng = { lat: number; lng: number }

/** Centre of Israel, used before the pins are fitted. */
const ISRAEL_CENTER: L.LatLngTuple = [31.5, 34.9]

/**
 * Builds the pin icon: an inline SVG in the brand red, so no image files are needed.
 * @param selected - Whether the pin is the selected store (drawn larger and darker).
 * @param muted - Whether the store is hidden from the public site (a grey pin, the staff map only).
 * @returns The Leaflet icon.
 */
function pinIcon(selected: boolean, muted = false) {
  const size = selected ? 44 : 32
  const fill = muted ? (selected ? '#3A3A3A' : '#6B6B6B') : selected ? '#96181D' : '#BE1E24'
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
const PIN_ICON_MUTED = pinIcon(false, true)
const PIN_ICON_MUTED_SELECTED = pinIcon(true, true)

/** The OpenStreetMap tiles and their required attribution, shared by both maps. */
function Tiles() {
  return <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
}

/**
 * Whether the device's main pointer is a finger (a phone or a tablet).
 * @returns true on a touch screen.
 */
const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches

/**
 * A map's touch behavior (see the file header): on a touch screen, one-finger dragging is off (Leaflet then lets one
 * finger scroll the page, and two fingers still pinch and move the map) unless the map is full screen; a one-finger drag
 * on the map shows a short hint.
 * @param props.fullscreen - Whether the map is full screen (one finger moves it there).
 * @returns The hint while it shows, else nothing.
 */
function TouchPan({ fullscreen = false }: { fullscreen?: boolean }) {
  const map = useMap()
  const { t } = useI18n()
  const [hint, setHint] = useState(false)

  useEffect(() => {
    if (!coarsePointer()) return
    if (fullscreen) {
      map.dragging.enable()
      return
    }
    map.dragging.disable()
    const container = map.getContainer()
    let timer = 0
    /** A one-finger move on the map: shows the hint for a moment. */
    const handleMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      setHint(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setHint(false), 1500)
    }
    container.addEventListener('touchmove', handleMove, { passive: true })
    return () => {
      container.removeEventListener('touchmove', handleMove)
      window.clearTimeout(timer)
    }
  }, [map, fullscreen])

  if (!hint) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-black/45 p-6 text-center font-heading text-base font-semibold text-white animate-fade-in">
      {t.whereToBuy.twoFingers}
    </div>
  )
}

/**
 * Tracks whether an element is the page's full-screen element.
 * @param target - The element (the map's wrapper).
 * @returns true while it is full screen.
 */
function useFullscreen(target: React.RefObject<HTMLDivElement | null>) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement === target.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [target])
  return active
}

/**
 * Moves the map when the data changes (renders nothing): fits all pins when the list changes, and flies to
 * the selected store and opens its popup when the selection changes.
 * @param props.branches - The stores currently shown.
 * @param props.selectedId - The selected store id, or null.
 * @param props.markers - Ref to the Leaflet marker of each store, by id (to open popups).
 * @param props.popups - Whether the selected store's popup opens.
 * @returns null.
 */
function MapController({
  branches,
  selectedId,
  markers,
  popups,
}: {
  branches: Branch[]
  selectedId: string | null
  markers: React.RefObject<Map<string, L.Marker>>
  popups: boolean
}) {
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
    if (!popups) return
    // A tick later: a map that mounts with a store already selected (a phone's list switching to the map) adds its
    // markers after this effect.
    const timer = window.setTimeout(() => markers.current.get(selected.id)?.openPopup())
    return () => window.clearTimeout(timer)
  }, [selected, map, reduced, markers, popups])

  return null
}

/**
 * The full-screen toggle button, placed over the bottom corner of the map; none where the browser cannot put an
 * element in full screen (iPhones).
 * @param props.target - Ref to the element that goes full screen.
 * @param props.active - Whether it is full screen now (useFullscreen).
 * @returns The button, or nothing.
 */
function FullscreenButton({ target, active }: { target: React.RefObject<HTMLDivElement | null>; active: boolean }) {
  const { t } = useI18n()
  // iPhones cannot put an element in full screen: no button there.
  if (!document.fullscreenEnabled) return null

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
      className="absolute bottom-8 start-3 z-[1000] flex size-10 items-center pointer-coarse:size-11 justify-center rounded-lg bg-white text-brand-charcoal shadow-premium-sm transition-[background-color,scale] duration-300 hover:bg-neutral-100 active:scale-[0.94] active:duration-100 focus-visible:ring-2 focus-visible:ring-brand-red/60"
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
 * @param props.mutedIds - Stores drawn with a grey pin (the staff map: hidden from the public site); default none.
 * @param props.popups - Whether a pin opens a popup with the store's details (default true; the staff map: false,
 *   a click only selects).
 * @param props.label - The map region's accessible name (default "Map of stores").
 * @param props.className - Extra classes for the wrapper (sets the height).
 * @returns The map wrapper element.
 */
export function BranchMap({
  branches,
  selectedId,
  onSelect,
  userLocation,
  mutedIds,
  popups = true,
  label,
  className,
}: {
  branches: Branch[]
  selectedId: string | null
  onSelect: (id: string) => void
  userLocation?: LatLng | null
  mutedIds?: ReadonlySet<string>
  popups?: boolean
  label?: string
  className?: string
}) {
  const { t, dir } = useI18n()
  const wrapper = useRef<HTMLDivElement>(null)
  const markers = useRef(new Map<string, L.Marker>())
  const fullscreen = useFullscreen(wrapper)

  return (
    <div ref={wrapper} className={`relative isolate overflow-hidden rounded-2xl bg-neutral-100 ${className ?? ''}`}>
      <div role="region" aria-label={label ?? t.whereToBuy.mapLabel} dir="ltr" className="size-full">
      <MapContainer center={ISRAEL_CENTER} zoom={8} scrollWheelZoom={false} className="size-full">
        <Tiles />
        <MapController branches={branches} selectedId={selectedId} markers={markers} popups={popups} />
        <TouchPan fullscreen={fullscreen} />
        {branches.map((branch) => (
          <Marker
            key={branch.id}
            position={[branch.lat, branch.lng]}
            icon={
              mutedIds?.has(branch.id)
                ? branch.id === selectedId ? PIN_ICON_MUTED_SELECTED : PIN_ICON_MUTED
                : branch.id === selectedId ? PIN_ICON_SELECTED : PIN_ICON
            }
            title={branch.name}
            ref={(marker) => {
              if (marker) markers.current.set(branch.id, marker)
              else markers.current.delete(branch.id)
            }}
            eventHandlers={{ click: () => onSelect(branch.id) }}
          >
            {popups && (
            <Popup>
              <div dir={dir} className="min-w-40 text-start">
                <p className="font-heading text-sm font-bold text-brand-charcoal">{branch.name}</p>
                <p className="mt-1 text-xs text-brand-charcoal-muted">{[branch.address, branch.city].filter(Boolean).join(', ')}</p>
                {branch.approximate && <p className="mt-1 text-xs text-brand-charcoal-muted">{t.whereToBuy.approximate}</p>}
                {branch.phone && (
                  <a href={`tel:${branch.phone.replace(/[^\d+]/g, '')}`} className="mt-2 block text-xs font-semibold text-brand-red-dark hover:underline" dir="ltr">
                    {branch.phone}
                  </a>
                )}
              </div>
            </Popup>
            )}
          </Marker>
        ))}
        {userLocation && <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1A73E8', fillOpacity: 1 }} />}
      </MapContainer>
      </div>
      <FullscreenButton target={wrapper} active={fullscreen} />
    </div>
  )
}

/** How many decimals a picked point keeps (6 ≈ 10 cm, more than a store needs). */
const PICK_DECIMALS = 6

/**
 * Rounds a picked point.
 * @param point - The point Leaflet gives (a click or the end of a drag).
 * @returns The point with PICK_DECIMALS decimals.
 */
function rounded(point: L.LatLng): LatLng {
  const round = (value: number) => Number(value.toFixed(PICK_DECIMALS))
  return { lat: round(point.lat), lng: round(point.lng) }
}

/**
 * The picker's map logic (renders nothing): a click places the point, a new point outside the view (typed in, or
 * found from the address) brings the map to it, and the map re-measures itself when its box resizes (it mounts in
 * an opening dialog).
 * @param props.value - The current point, or null.
 * @param props.onPick - Called with a clicked point.
 * @returns null.
 */
function PickerController({ value, onPick }: { value: LatLng | null; onPick: (point: LatLng) => void }) {
  const map = useMapEvents({ click: (event) => onPick(rounded(event.latlng)) })
  const reduced = useReducedMotion()

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  const lat = value?.lat
  const lng = value?.lng
  useEffect(() => {
    if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return
    if (map.getZoom() >= 13 && map.getBounds().pad(-0.1).contains([lat, lng])) return
    map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { animate: !reduced, duration: 0.6 })
  }, [lat, lng, map, reduced])

  return null
}

/**
 * A map for placing one point: click the map to put the pin there, or drag the pin. Staff use it for a store's
 * position (ResellerDialog); the same point is also typed into number fields, the keyboard path.
 * @param props.value - The point, or null (no pin yet: the map shows Israel).
 * @param props.onChange - Called with the new point (rounded to PICK_DECIMALS) after a click or a drag.
 * @param props.label - The map region's accessible name.
 * @param props.pinLabel - The pin's name (its tooltip and the marker's alt text).
 * @param props.className - Extra classes for the wrapper (sets the height).
 * @returns The map wrapper element.
 */
export function LocationPicker({
  value,
  onChange,
  label,
  pinLabel,
  className,
}: {
  value: LatLng | null
  onChange: (point: LatLng) => void
  label: string
  pinLabel: string
  className?: string
}) {
  const valid = value !== null && Number.isFinite(value.lat) && Number.isFinite(value.lng)
  return (
    <div className={`relative isolate overflow-hidden rounded-2xl bg-neutral-100 ${className ?? ''}`}>
      <div role="region" aria-label={label} dir="ltr" className="size-full cursor-crosshair">
        <MapContainer center={valid ? [value.lat, value.lng] : ISRAEL_CENTER} zoom={valid ? 16 : 8} scrollWheelZoom={false} className="size-full">
          <Tiles />
          <PickerController value={value} onPick={onChange} />
          <TouchPan />
          {valid && (
            <Marker
              position={[value.lat, value.lng]}
              icon={PIN_ICON_SELECTED}
              title={pinLabel}
              alt={pinLabel}
              draggable
              eventHandlers={{ dragend: (event) => onChange(rounded((event.target as L.Marker).getLatLng())) }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  )
}
