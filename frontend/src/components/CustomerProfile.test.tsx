/**
 * CustomerProfile.test.tsx — Tests for the customer profile: the customer's own page (/account: signed out, staff,
 * a customer's details, orders and discounts, in both languages), the staff page of a customer
 * (/admin/customers/<id>: internal fields, paused discounts, 404) and the online badge (PresenceBadge).
 */
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createStaffRow } from '@/api'
import { PresenceBadge } from '@/components/CustomerProfile'
import { FAKE_ORDERS, signInFakeUser, STAFF_CUSTOMERS, TEST_STAFF, TEST_USER } from '@/test/api'
import { renderComponent, renderPage } from '@/test/utils'

/** The test customer's row (the profile /account shows), and the first category's id in the fake. */
const CUSTOMER = STAFF_CUSTOMERS[0]
const DRY_CAT_FOOD = '00000000-0000-4000-8001-000000000001'

/**
 * Gives the test customer three discounts of their own: 5% on everything (in effect), ₪3 on a category (ended) and a
 * paused 7%; and a general discount that is not theirs.
 */
async function addDiscounts() {
  signInFakeUser(TEST_STAFF)
  const own = { businessUserId: CUSTOMER.id }
  await createStaffRow('price-rules', { ...own, kind: 'percent', value: 5, startsAt: '2026-01-01T00:00:00' })
  await createStaffRow('price-rules', { ...own, categoryId: DRY_CAT_FOOD, kind: 'amount', value: 3, startsAt: '2026-01-01T00:00:00', endsAt: '2026-02-01T00:00:00' })
  await createStaffRow('price-rules', { ...own, kind: 'percent', value: 7, isActive: false })
  await createStaffRow('price-rules', { categoryId: DRY_CAT_FOOD, kind: 'percent', value: 10 })
}

/**
 * A titled block of the profile.
 * @param name - Its heading.
 * @returns Testing Library queries bound to it.
 */
const block = (name: string) => within(screen.getByRole('region', { name }))

describe('/account', () => {
  beforeEach(addDiscounts)

  it('shows the sign-in form when signed out', async () => {
    signInFakeUser(null as never)
    await renderPage('/en/account')
    expect(screen.getByRole('heading', { name: 'Sign in to Ultra Pet' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('sends staff to the admin panel', async () => {
    await renderPage('/en/account', { staff: TEST_STAFF })
    expect(screen.getByText(/A staff account has no customer profile/)).toBeInTheDocument()
    expect(screen.getByRole('main').querySelector('a[href="/en/admin"]')).toHaveTextContent('Admin panel')
  })

  it("shows a customer's details, discounts and orders", async () => {
    const { user } = await renderPage('/en/account', { user: TEST_USER })
    expect(screen.getByRole('heading', { level: 1, name: 'My account' })).toBeInTheDocument()

    const details = block('Account details')
    expect(details.getByText(CUSTOMER.companyName)).toBeInTheDocument()
    expect(details.getByText(CUSTOMER.email)).toBeInTheDocument()
    expect(details.getByText(/^Last seen /)).toBeInTheDocument()
    expect(details.queryByText('Internal notes')).not.toBeInTheDocument()

    const discounts = block('My discounts')
    const [current, past] = discounts.getAllByRole('list')
    expect(within(current).getByText('All products')).toBeInTheDocument()
    expect(within(current).getByText(/5%.* off/)).toBeInTheDocument()
    expect(within(past).getByText('Category: Dry Cat Food')).toBeInTheDocument()
    expect(within(past).getByText('Ended')).toBeInTheDocument()
    expect(discounts.queryByText(/7%.* off/)).not.toBeInTheDocument() // paused: staff only
    expect(discounts.queryByText(/10%.* off/)).not.toBeInTheDocument() // a general discount, not theirs

    const orders = block('Purchase history')
    const triggers = orders.getAllByRole('button')
    expect(triggers).toHaveLength(FAKE_ORDERS.length)
    expect(triggers[0]).toHaveTextContent(`Order ${FAKE_ORDERS[0].id.slice(0, 8).toUpperCase()}`)
    expect(triggers[0]).toHaveTextContent('Shipped')
    await user.click(triggers[0])
    const lines = orders.getByRole('table', { name: `Order ${FAKE_ORDERS[0].id.slice(0, 8).toUpperCase()}` })
    expect(within(lines).getByRole('link', { name: 'Chew bone' })).toHaveAttribute('href', '/en/products/chew-bone')
    expect(within(lines).getByText('A product no longer in the catalog')).toBeInTheDocument()
    expect(orders.getByText(/Credit card · Paid/)).toBeInTheDocument()
  })

  it('reads in Hebrew', async () => {
    await renderPage('/account', { user: TEST_USER })
    expect(screen.getByRole('heading', { level: 1, name: 'החשבון שלי' })).toBeInTheDocument()
    expect(block('ההנחות שלי').getByText('כל המוצרים')).toBeInTheDocument()
    expect(block('היסטוריית רכישות').getAllByRole('button')[0]).toHaveTextContent('נשלחה')
  })

  it('is linked from the header for a signed-in customer', async () => {
    await renderPage('/en', { user: TEST_USER })
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'My account' })).toHaveAttribute('href', '/en/account')
  })
})

describe('/admin/customers/<id>', () => {
  beforeEach(addDiscounts)

  it('shows staff the internal fields and the paused discounts', async () => {
    await renderPage(`/en/admin/customers/${CUSTOMER.id}`, { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: CUSTOMER.companyName })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toHaveTextContent('Business customers')
    expect(block('Account details').getByText('Internal notes')).toBeInTheDocument()
    const past = block("The customer's discounts").getAllByRole('list')[1]
    expect(within(past).getByText('Paused')).toBeInTheDocument()
    expect(block('Purchase history').getAllByRole('button')).toHaveLength(FAKE_ORDERS.length)
  })

  it('says when a customer has no orders', async () => {
    await renderPage(`/en/admin/customers/${STAFF_CUSTOMERS[1].id}`, { staff: TEST_STAFF })
    expect(block('Purchase history').getByText('The customer has not ordered yet.')).toBeInTheDocument()
    expect(block('Account details').getByText('Never signed in')).toBeInTheDocument()
  })

  it('is the not-found page for an unknown customer', async () => {
    await renderPage('/en/admin/customers/00000000-0000-4000-8000-00000000ffff', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: /not found/i })).toBeInTheDocument()
  })
})

describe('PresenceBadge', () => {
  const now = Date.parse('2026-11-17T12:00:00Z')

  it('says online within five minutes, else how long ago', async () => {
    renderComponent(
      <>
        <PresenceBadge lastSeenAt="2026-11-17T11:57:00Z" now={now} />
        <PresenceBadge lastSeenAt="2026-11-17T09:00:00Z" now={now} />
        <PresenceBadge lastSeenAt={null} now={now} />
      </>,
      'en',
    )
    expect(await screen.findByText('Online now')).toHaveAttribute('dateTime', '2026-11-17T11:57:00Z')
    expect(screen.getByText('Last seen 3 hours ago')).toBeInTheDocument()
    expect(screen.getByText('Never signed in')).toBeInTheDocument()
  })
})
