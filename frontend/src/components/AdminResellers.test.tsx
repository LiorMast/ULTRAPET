/**
 * AdminResellers.test.tsx — Tests for the staff panel's resellers page (/admin/resellers, routes/admin.resellers.tsx)
 * and its map position field (LocationField) against the fake staff API (src/test/api.ts): the menu link, the map of
 * every reseller and the table; adding a reseller found from its address (what is sent); a pin opening its reseller's
 * form (and the focus going back to it), the pin placed on the map picker; the lookup's messages (no city, not found,
 * the city centre only, the service down); a latitude the server refuses; deactivating (a grey pin, gone from the
 * public list) and deleting; the busy Save; the sign-in form when signed out; and the Hebrew texts.
 *
 * Leaflet cannot draw in jsdom, so both maps are stubs: BranchMap = a button per pin (data-muted for a grey one),
 * LocationPicker = its value plus a "Pick" button that places the pin at PICKED. The real maps are covered by the
 * Playwright spec.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Branch } from '@/api'
import type { LatLng } from '@/components/BranchMap'
import branches from '@/stubs/branches.json'
import { fakeFetch, FAKE_GEOCODE, holdRequests, TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/** Where the stub map picker places the pin. */
const PICKED = { lat: 31.5, lng: 34.75 }

vi.mock('@/components/BranchMap', () => ({
  BranchMap: ({ branches: pins, onSelect, mutedIds, label }: { branches: Branch[]; onSelect: (id: string) => void; mutedIds?: ReadonlySet<string>; label?: string }) => (
    <div role="region" aria-label={label}>
      {pins.map((pin) => (
        <button key={pin.id} type="button" data-testid={`pin-${pin.id}`} data-muted={String(Boolean(mutedIds?.has(pin.id)))} onClick={() => onSelect(pin.id)}>
          {pin.name}
        </button>
      ))}
    </div>
  ),
  LocationPicker: ({ value, onChange, label }: { value: LatLng | null; onChange: (point: LatLng) => void; label: string }) => (
    <div role="region" aria-label={label} data-value={value ? `${value.lat},${value.lng}` : ''}>
      <button type="button" onClick={() => onChange({ lat: 31.5, lng: 34.75 })}>
        Pick
      </button>
    </div>
  ),
}))

/** How long to wait for the lazy map (its chunk loads slowly while the whole suite runs at once). */
const MAP_WAIT = { timeout: 10_000 }

/** A stub reseller whose pin is approximate (at its city centre). */
const LUCY = branches.find((branch) => branch.id === 'b005')!

/**
 * The request bodies sent to a path with a method.
 * @param spy - The fetch spy.
 * @param method - E.g. "POST".
 * @param path - E.g. "/api/staff/resellers" (a longer path starts with it).
 * @returns The parsed bodies, oldest first.
 */
const bodies = (spy: { mock: { calls: [RequestInfo | URL, RequestInit?][] } }, method: string, path: string) =>
  spy.mock.calls.filter(([url, init]) => init?.method === method && String(url).startsWith(path)).map(([, init]) => JSON.parse(String(init?.body)) as unknown)

/**
 * Opens a reseller's form from its pin on the map.
 * @param user - The test's user-event instance.
 * @param id - The reseller's id.
 * @param name - Its name (the dialog's title).
 * @returns The dialog.
 */
async function openFromPin(user: Awaited<ReturnType<typeof renderPage>>['user'], id = LUCY.id, name = LUCY.name) {
  await user.click(await screen.findByTestId(`pin-${id}`, {}, MAP_WAIT))
  return screen.findByRole('dialog', { name: `Edit ${name}` })
}

/**
 * Opens the Add form and fills the store's name, address and city.
 * @param user - The test's user-event instance.
 * @param address - The street address.
 * @param city - The city.
 * @returns The dialog.
 */
async function openNew(user: Awaited<ReturnType<typeof renderPage>>['user'], address = 'Dizengoff 50', city = 'Tel Aviv') {
  await user.click(screen.getByRole('button', { name: 'Add' }))
  const form = await screen.findByRole('dialog', { name: 'New record' })
  await user.type(within(form).getByLabelText('Store name *'), 'Pet Corner')
  if (address) await user.type(within(form).getByLabelText('Address *'), address)
  if (city) await user.type(within(form).getByLabelText('City *'), city)
  return form
}

describe('/admin/resellers', { timeout: 20_000 }, () => {
  it('shows every reseller on the map and in the table, in the admin menu', async () => {
    await renderPage('/en/admin/resellers', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'Resellers' })).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(menu).getByRole('link', { name: 'Resellers' })).toHaveAttribute('aria-current', 'page')
    const map = await screen.findByRole('region', { name: 'Map of the resellers' }, MAP_WAIT)
    expect(within(map).getAllByRole('button')).toHaveLength(branches.length)
    expect(screen.getByTestId(`pin-${LUCY.id}`)).toHaveAttribute('data-muted', 'false')
    const table = screen.getByRole('table', { name: 'Resellers' })
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Store name', 'City', 'Address', 'Phone', 'Active', 'Actions'])
  })

  it('adds a reseller placed from its address', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/resellers', { staff: TEST_STAFF })
    const form = await openNew(user)
    await user.click(within(form).getByRole('button', { name: 'Find from address' }))
    expect(await within(form).findByRole('status')).toHaveTextContent(`Found: ${FAKE_GEOCODE.label}`)
    expect(within(form).getByLabelText('Latitude *')).toHaveValue(FAKE_GEOCODE.lat)
    expect(within(form).getByLabelText('Longitude *')).toHaveValue(FAKE_GEOCODE.lng)
    expect(await within(form).findByRole('region', { name: "Map for choosing the store's position" }, MAP_WAIT)).toHaveAttribute('data-value', `${FAKE_GEOCODE.lat},${FAKE_GEOCODE.lng}`)
    await user.type(within(form).getByLabelText('Phone'), '03-5550000')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'POST', '/api/staff/resellers')).toEqual([
      {
        name: 'Pet Corner', city: 'Tel Aviv', address: 'Dizengoff 50', phone: '03-5550000', isActive: true,
        latitude: FAKE_GEOCODE.lat, longitude: FAKE_GEOCODE.lng, approximateLocation: false,
      },
    ])
    expect(await screen.findByRole('button', { name: 'Pet Corner' }, MAP_WAIT)).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Resellers' })).getByText('Pet Corner')).toBeInTheDocument()
  })

  it('opens a reseller from its pin, moves it on the map picker, and gives the focus back to the pin', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/resellers', { staff: TEST_STAFF })
    let form = await openFromPin(user)
    expect(within(form).getByLabelText('Store name *')).toHaveValue(LUCY.name)
    expect(within(form).getByLabelText('Approximate location')).toBeChecked()
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.getByTestId(`pin-${LUCY.id}`)).toHaveFocus())

    form = await openFromPin(user)
    await user.click(await within(form).findByRole('button', { name: 'Pick' }, MAP_WAIT))
    expect(within(form).getByLabelText('Latitude *')).toHaveValue(PICKED.lat)
    expect(within(form).getByLabelText('Approximate location')).not.toBeChecked()
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodies(fetchSpy, 'PATCH', `/api/staff/resellers/${LUCY.id}`)).toEqual([{ latitude: PICKED.lat, longitude: PICKED.lng, approximateLocation: false }])
    const stores = (await (await fakeFetch('/api/resellers')).json()) as Branch[]
    expect(stores.find((store) => store.id === LUCY.id)).toMatchObject({ lat: PICKED.lat, lng: PICKED.lng, approximate: false })
  })

  it('explains what the address lookup found or why it failed', async () => {
    const { user } = await renderPage('/en/admin/resellers', { staff: TEST_STAFF })
    let form = await openNew(user, 'nowhere 1', '')
    const find = within(form).getByRole('button', { name: 'Find from address' })
    await user.click(find)
    expect(within(form).getByRole('alert')).toHaveTextContent('Type the city first.')

    await user.type(within(form).getByLabelText('City *'), 'Atlantis')
    await user.click(find)
    expect(await within(form).findByText(/could not find the address or the city/)).toHaveAttribute('role', 'alert')

    await user.clear(within(form).getByLabelText('City *'))
    await user.type(within(form).getByLabelText('City *'), 'Tel Aviv')
    await user.click(find)
    expect(await within(form).findByRole('status')).toHaveTextContent(`the pin is at the city centre: ${FAKE_GEOCODE.label}`)
    expect(within(form).getByLabelText('Approximate location')).toBeChecked()
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      String(input).startsWith('/api/staff/geocode')
        ? Promise.resolve(new Response(JSON.stringify({ error: 'geocoder_unavailable' }), { status: 502, headers: { 'Content-Type': 'application/json' } }))
        : fakeFetch(input, init),
    )
    form = await openNew(user)
    await user.click(within(form).getByRole('button', { name: 'Find from address' }))
    expect(await within(form).findByText(/map service is not available/)).toHaveAttribute('role', 'alert')
  })

  it('refuses a latitude out of range next to its field', async () => {
    const { user } = await renderPage('/en/admin/resellers', { staff: TEST_STAFF })
    const form = await openFromPin(user)
    const latitude = within(form).getByLabelText('Latitude *')
    await user.clear(latitude)
    await user.type(latitude, '95')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(latitude).toHaveAttribute('aria-invalid', 'true'))
    expect(latitude).toHaveFocus()
    expect(screen.getByRole('dialog', { name: `Edit ${LUCY.name}` })).toBeInTheDocument()
  })

  it('greys out a deactivated reseller on the map and hides it from the public list, and deletes one', async () => {
    const { user } = await renderPage('/en/admin/resellers', { staff: TEST_STAFF })
    const form = await openFromPin(user)
    await user.click(within(form).getByLabelText('Active'))
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByTestId(`pin-${LUCY.id}`)).toHaveAttribute('data-muted', 'true'))
    let stores = (await (await fakeFetch('/api/resellers')).json()) as Branch[]
    expect(stores.some((store) => store.id === LUCY.id)).toBe(false)

    await user.click((await screen.findAllByRole('button', { name: /^Delete / }))[0])
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.getAllByTestId(/^pin-/)).toHaveLength(branches.length - 1))
    stores = (await (await fakeFetch('/api/resellers')).json()) as Branch[]
    expect(stores).toHaveLength(branches.length - 2)
  })

  it('shows Save busy while the server saves, and sends one request however often it is clicked', async () => {
    const held = holdRequests((path, method) => method === 'PATCH' && path.startsWith('/api/staff/resellers/'))
    const { user } = await renderPage('/en/admin/resellers', { staff: TEST_STAFF })
    const form = await openFromPin(user)
    await user.type(within(form).getByLabelText('Phone'), '1')
    const save = within(form).getByRole('button', { name: 'Save' })
    await user.click(save)
    await waitFor(() => expect(held.calls).toHaveLength(1))
    expect(save).toHaveAttribute('aria-busy', 'true')
    await user.click(save)
    expect(held.calls).toHaveLength(1)
    held.release()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(held.calls).toHaveLength(1)
  })

  it('shows the sign-in form when signed out', async () => {
    await renderPage('/en/admin/resellers')
    expect(screen.getByRole('heading', { name: 'Staff sign-in' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('is in Hebrew on the Hebrew page', async () => {
    const { user } = await renderPage('/admin/resellers', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'משווקים' })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'מפת המשווקים' }, MAP_WAIT)).toBeInTheDocument()
    await user.click(screen.getByTestId(`pin-${LUCY.id}`))
    const form = await screen.findByRole('dialog', { name: `עריכת ${LUCY.name}` })
    expect(within(form).getByRole('button', { name: 'מציאה לפי הכתובת' })).toBeInTheDocument()
    expect(within(form).getByLabelText('קו רוחב *')).toHaveValue(LUCY.lat)
  })
})
