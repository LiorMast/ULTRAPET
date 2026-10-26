/**
 * WhereToBuy.test.tsx — Tests for the Where to Buy page: the store list with real tel/Waze links in both
 * languages, search filtering, the empty state, and "find the nearest store" (sorted by distance, plus the
 * denied-location message). The Leaflet map is replaced by a stub because jsdom cannot draw maps; the map
 * itself is covered by the Playwright spec.
 */
import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Branch } from '@/components/BranchMap'
import { renderPage } from '@/test/utils'
import branches from '@/stubs/branches.json'

vi.mock('@/components/BranchMap', () => ({
  BranchMap: ({ branches: shown, selectedId }: { branches: Branch[]; selectedId: string | null }) => (
    <div data-testid="map" data-count={shown.length} data-selected={selectedId ?? ''} />
  ),
}))

/** Number of list items currently shown. */
const listCount = () => within(screen.getByRole('list', { name: /רשימת חנויות|Store list/ })).getAllByRole('listitem').length

describe('Where to Buy page', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists every store with a phone link and a Waze link (Hebrew)', async () => {
    await renderPage('/where-to-buy')
    expect(screen.getByRole('heading', { level: 1, name: 'איתור חנויות' })).toBeInTheDocument()
    expect(listCount()).toBe(branches.length)
    expect(await screen.findByTestId('map')).toHaveAttribute('data-count', String(branches.length))
    const first = screen.getAllByRole('listitem')[0]
    expect(within(first).getByRole('link', { name: 'ניווט בוויז' })).toHaveAttribute('href', expect.stringContaining('waze.com/ul?ll='))
  })

  it('uses English texts in English', async () => {
    await renderPage('/en/where-to-buy')
    expect(screen.getByRole('heading', { level: 1, name: 'Find a store' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Find the nearest store' })).toBeInTheDocument()
  })

  it('filters by city and shows the result count', async () => {
    const { user } = await renderPage('/where-to-buy')
    await user.type(screen.getByRole('searchbox', { name: 'חיפוש חנות' }), 'חיפה')
    const expected = branches.filter((b) => `${b.name} ${b.address} ${b.city}`.includes('חיפה')).length
    expect(listCount()).toBe(expected)
    expect(screen.getByRole('status')).toHaveTextContent(`${expected} חנויות`)
  })

  it('shows a message when nothing matches', async () => {
    const { user } = await renderPage('/where-to-buy')
    await user.type(screen.getByRole('searchbox', { name: 'חיפוש חנות' }), 'zzzzzz')
    expect(screen.getByText('לא נמצאו חנויות. נסו חיפוש אחר.')).toBeInTheDocument()
  })

  it('sorts by distance and selects the nearest store after "find nearest"', async () => {
    const target = branches[0]
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: target.lat, longitude: target.lng } } as GeolocationPosition) },
    })
    const { user } = await renderPage('/where-to-buy')
    await user.click(screen.getByRole('button', { name: 'חפש חנות קרובה' }))
    const first = screen.getAllByRole('listitem')[0]
    expect(within(first).getByText('0.0 ק"מ ממך')).toBeInTheDocument()
    expect(await screen.findByTestId('map')).toHaveAttribute('data-selected', expect.any(String))
    expect(screen.getByTestId('map').getAttribute('data-selected')).not.toBe('')
  })

  it('explains when location is denied', async () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) => fail({} as GeolocationPositionError) } })
    const { user } = await renderPage('/where-to-buy')
    await user.click(screen.getByRole('button', { name: 'חפש חנות קרובה' }))
    expect(screen.getByRole('status')).toHaveTextContent('לא הצלחנו לאתר את המיקום שלך')
  })
})
