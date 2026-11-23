/**
 * LocationField.tsx — The map position of a record in an admin form: a map to place the pin on (LocationPicker, by
 * click or drag) and a "Find from address" button that asks the server's geocoder (geocodeAddress in src/api.ts:
 * OpenStreetMap's Nominatim) where the form's address and city are. Both write the form's latitude and longitude
 * fields (number inputs the form shows above it, the keyboard path) and its "approximate location" flag: a pin placed
 * by hand or found at the street is exact, one found only at the city centre is approximate.
 *
 * It is RecordDialog's `extra` content (FormExtraProps: the form's values and setValues), used by the resellers page
 * (routes/admin.resellers.tsx); the field keys default to the resellers' columns. The map's code (Leaflet) loads
 * lazily, with a skeleton of its size meanwhile. The lookup's result is announced in a polite status line; a failure
 * (no city typed, nothing found, the service down) in an alert.
 */
import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { ApiError, geocodeAddress } from '@/api'
import type { FormExtraProps } from '@/components/RecordDialog'
import { Button } from '@/components/ui/button'
import { LABEL_CLASS } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n'

const LocationPicker = lazy(() => import('@/components/BranchMap').then((m) => ({ default: m.LocationPicker })))

/** Which form fields hold the position, the flag and the address (default: the resellers' columns). */
export type LocationKeys = { lat: string; lng: string; approximate?: string; address: string; city: string }

const RESELLER_KEYS: LocationKeys = { lat: 'latitude', lng: 'longitude', approximate: 'approximateLocation', address: 'address', city: 'city' }

/** The map's height (the picker and its skeleton). */
const MAP_HEIGHT = 'h-56 sm:h-72'

/**
 * Reads a coordinate typed into a number input.
 * @param value - The field's value (text).
 * @returns The number, or null when empty or not a number.
 */
function coordinate(value: unknown): number | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

/** What the lookup last said: nothing yet, a result to announce, or a failure to show. */
type Message = { kind: 'status' | 'alert'; text: string } | null

/**
 * The map position field: a heading, hint, "Find from address", the lookup's message and the map picker.
 * @param props.form - The form's values and setter (RecordDialog's FormExtraProps).
 * @param props.keys - Which fields hold the position, the approximate flag and the address; default the resellers'.
 * @returns The field.
 */
export function LocationField({ form, keys = RESELLER_KEYS }: { form: FormExtraProps; keys?: LocationKeys }) {
  const { t } = useI18n()
  const f = t.admin.resellerFields
  const id = useId()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const lookup = useRef<AbortController | null>(null)
  useEffect(() => () => lookup.current?.abort(), [])

  const lat = coordinate(form.values[keys.lat])
  const lng = coordinate(form.values[keys.lng])
  const point = lat !== null && lng !== null ? { lat, lng } : null

  /**
   * Writes a position into the form.
   * @param position - The point.
   * @param approximate - Whether it is only the city centre.
   */
  const place = (position: { lat: number; lng: number }, approximate: boolean) =>
    form.setValues({ [keys.lat]: String(position.lat), [keys.lng]: String(position.lng), ...(keys.approximate ? { [keys.approximate]: approximate } : {}) })

  /** "Find from address": asks the geocoder for the form's address and city and places the pin there. */
  const handleFind = async () => {
    if (pending) return
    const city = String(form.values[keys.city] ?? '').trim()
    if (!city) {
      setMessage({ kind: 'alert', text: t.admin.geocode.needCity })
      return
    }
    lookup.current?.abort()
    const controller = new AbortController()
    lookup.current = controller
    setPending(true)
    setMessage(null)
    try {
      const found = await geocodeAddress(String(form.values[keys.address] ?? '').trim(), city, controller.signal)
      place(found, found.approximate)
      setMessage({ kind: 'status', text: (found.approximate ? t.admin.geocode.foundCity : t.admin.geocode.found).replace('{label}', found.label) })
    } catch (error) {
      if (controller.signal.aborted) return
      setMessage({ kind: 'alert', text: error instanceof ApiError && error.status === 404 ? t.admin.geocode.notFound : t.admin.geocode.unavailable })
    } finally {
      if (!controller.signal.aborted) setPending(false)
    }
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`}>
      <p id={`${id}-label`} className={LABEL_CLASS}>
        {f.location}
      </p>
      <p id={`${id}-hint`} className="text-xs text-brand-charcoal-muted">
        {f.locationHint}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" loading={pending} onClick={handleFind}>
          <MapPin aria-hidden />
          {t.admin.geocode.button}
        </Button>
        {/* The live regions stay in the page, so their messages are announced when they change. */}
        <p role="status" className="text-xs text-brand-charcoal-muted">
          {message?.kind === 'status' ? message.text : ''}
        </p>
        <p role="alert" className="text-xs font-medium text-brand-red-dark empty:hidden">
          {message?.kind === 'alert' ? message.text : ''}
        </p>
      </div>
      <Suspense fallback={<Skeleton className={`mt-3 ${MAP_HEIGHT} w-full rounded-2xl`} />}>
        <LocationPicker
          value={point}
          onChange={(position) => {
            place(position, false)
            setMessage(null)
          }}
          label={f.pickerLabel}
          pinLabel={f.pin}
          className={`mt-3 ${MAP_HEIGHT}`}
        />
      </Suspense>
    </div>
  )
}
