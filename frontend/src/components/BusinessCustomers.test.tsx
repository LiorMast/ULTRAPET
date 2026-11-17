/**
 * BusinessCustomers.test.tsx — Tests for the home page Business Customers section (#business): the texts in both
 * languages, the request form's checks, sending a request (stored for staff by the fake API), the server's field
 * errors, the busy button, the hidden honeypot, and staff editing the section's texts in place.
 */
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BusinessCustomers } from '@/components/BusinessCustomers'
import type { AboutItem } from '@/config'
import { fakeLeads, holdRequests, TEST_STAFF } from '@/test/api'
import { renderComponent, renderPage } from '@/test/utils'

/**
 * The section's queries.
 * @returns Testing Library queries bound to #business.
 */
const section = () => within(document.getElementById('business')!)

/**
 * Fills the request form with valid values (English labels).
 * @param user - The user-event instance.
 * @param changes - Values to type instead of the defaults, by label.
 */
async function fillForm(user: Awaited<ReturnType<typeof renderPage>>['user'], changes: Record<string, string> = {}) {
  const values: Record<string, string> = {
    'Business name *': 'Happy Paws',
    'Contact person *': 'Dana Cohen',
    'Phone *': '052-1234567',
    'Email *': 'Dana@HappyPaws.co.il',
    'City *': 'Haifa',
    ...changes,
  }
  for (const [label, value] of Object.entries(values)) if (value) await user.type(section().getByLabelText(label), value)
}

describe('Business Customers section', () => {
  it('explains who we supply and how an account is opened (Hebrew)', async () => {
    await renderPage('/')
    const s = section()
    expect(s.getByRole('heading', { level: 2, name: 'פתיחת חשבון עסקי' })).toBeInTheDocument()
    expect(s.getByRole('heading', { level: 4, name: 'חנויות חיות מחמד' })).toBeInTheDocument()
    expect(within(s.getByRole('list', { name: 'שלבי פתיחת חשבון עסקי' })).getAllByRole('listitem')).toHaveLength(3)
    expect(s.getByRole('button', { name: 'שליחת בקשה' })).toBeInTheDocument()
    expect(s.getByText('החשבונות נפתחים על ידי הצוות שלנו בלבד, אחרי בדיקת הבקשה.')).toBeInTheDocument()
  })

  it('uses English texts in English', async () => {
    await renderPage('/en')
    const s = section()
    expect(s.getByRole('heading', { level: 2, name: 'Open a business account' })).toBeInTheDocument()
    expect(s.getByRole('heading', { level: 3, name: 'Request an account' })).toBeInTheDocument()
    expect(s.getByRole('form', { name: 'Request an account' })).toBeInTheDocument()
  })

  it('checks the fields before sending and focuses the first wrong one', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en')
    await fillForm(user, { 'Business name *': '', 'Email *': 'not-an-email', 'Phone *': '12' })
    await user.click(section().getByRole('button', { name: 'Send request' }))
    const company = section().getByLabelText('Business name *')
    expect(company).toHaveAttribute('aria-invalid', 'true')
    expect(company).toHaveFocus()
    expect(section().getAllByRole('alert').map((alert) => alert.textContent)).toEqual(['Required field', 'Invalid phone number', 'Invalid email address'])
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/api/leads'))).toBe(false)
  })

  it('sends a request and shows the confirmation', async () => {
    const { user } = await renderPage('/en')
    await fillForm(user)
    await user.type(section().getByLabelText('Message'), 'We run two stores.')
    await user.click(section().getByRole('button', { name: 'Send request' }))

    expect(await section().findByRole('status')).toHaveTextContent('Request received')
    expect(await screen.findByText('Request sent.')).toBeInTheDocument()
    const [lead] = await fakeLeads()
    expect(lead).toMatchObject({ companyName: 'Happy Paws', contactPerson: 'Dana Cohen', email: 'dana@happypaws.co.il', city: 'Haifa', message: 'We run two stores.', locale: 'en', status: 'new' })

    await user.click(section().getByRole('button', { name: 'Send another request' }))
    expect(section().getByLabelText('Business name *')).toHaveValue('')
  })

  it('shows a field the server refused under that field', async () => {
    const { user } = await renderPage('/en')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid', field: 'email' }), { status: 400 }))
    await fillForm(user)
    await user.click(section().getByRole('button', { name: 'Send request' }))
    expect(await section().findByRole('alert')).toHaveTextContent('Invalid email address')
    expect(section().getByLabelText('Email *')).toHaveFocus()
  })

  it('waits on the server once, with a busy button', async () => {
    const held = holdRequests((path, method) => path === '/api/leads' && method === 'POST')
    const { user } = await renderPage('/en')
    await fillForm(user)
    const button = section().getByRole('button', { name: 'Send request' })
    await user.click(button)
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    held.release()
    expect(await section().findByRole('status')).toHaveTextContent('Request received')
    expect(held.calls).toEqual(['POST /api/leads'])
  })

  it('hides the honeypot from people and assistive technology', async () => {
    await renderPage('/en')
    const trap = document.getElementById('business-website')!
    expect(trap).toHaveAttribute('tabindex', '-1')
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(section().queryByRole('textbox', { name: 'Leave this field empty' })).not.toBeInTheDocument()
  })

  it('lets staff edit the texts in place, but not the form', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    await user.click(section().getByRole('button', { name: 'Edit on page: Business customers' }))
    await user.type(section().getByRole('textbox', { name: 'Title' }), 'Become a partner')
    await user.click(section().getByRole('button', { name: 'Save' }))
    expect(await section().findByRole('heading', { level: 2, name: 'Become a partner' })).toBeInTheDocument()
    expect(section().getByRole('button', { name: 'Send request' })).toBeInTheDocument()
  })

  it('renders custom lists given by props', async () => {
    const one: AboutItem[] = [{ id: 'x', title: () => 'Vets', text: () => 'Clinics' }]
    renderComponent(<BusinessCustomers audiences={one} trust={[]} steps={[]} />, 'en')
    expect(await screen.findByRole('heading', { level: 4, name: 'Vets' })).toBeInTheDocument()
  })
})
