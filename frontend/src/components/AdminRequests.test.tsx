/**
 * AdminRequests.test.tsx — Tests for the staff panel's account requests (/admin/requests, routes/admin.requests.tsx)
 * against the fake staff API (src/test/api.ts): the menu link, the table (newest first, status ribbons, the account
 * link of a converted request, the count of new ones, no Add), following a request up (status and notes), opening the
 * account from a request (the customer form prefilled from it, the request then converted and its action gone), a
 * taken email, deleting spam, and the Hebrew texts.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakeLeads, STAFF_LEADS, TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The fake's two requests: a new one, and one that already became Zoo Haifa's account. */
const [NEW, CONVERTED] = STAFF_LEADS

/**
 * The table's rows (without the header), each as the text of its cells.
 * @param caption - The table's name in the page language.
 * @returns The cells' texts per row, in the table's order.
 */
const tableCells = (caption = 'Account requests') =>
  within(screen.getByRole('table', { name: caption }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))

describe('/admin/requests', { timeout: 20_000 }, () => {
  it('lists the requests, newest first, with their status and account', async () => {
    await renderPage('/en/admin/requests', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'Account requests' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Admin' })).getByRole('link', { name: 'Account requests' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('1 new requests')).toBeInTheDocument()
    const rows = tableCells()
    expect(rows.map((cells) => cells.slice(1, 6))).toEqual([
      [NEW.companyName, NEW.contactPerson, NEW.phone, NEW.email, NEW.city],
      [CONVERTED.companyName, CONVERTED.contactPerson, CONVERTED.phone, CONVERTED.email, CONVERTED.city],
    ])
    expect(rows[0]).toContain('New')
    expect(rows[1]).toContain('Converted')
    expect(screen.getByRole('link', { name: CONVERTED.companyName })).toHaveAttribute('href', `/en/admin/customers/${CONVERTED.businessUserId}`)
    expect(screen.getByRole('button', { name: `Open account: ${NEW.companyName}` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Open account: ${CONVERTED.companyName}` })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
  })

  it('follows a request up: status and notes, the rest read-only', async () => {
    const { user } = await renderPage('/en/admin/requests', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Edit ${NEW.companyName}` }))
    const form = await screen.findByRole('dialog')
    expect(within(form).getByLabelText('Business name')).toBeDisabled()
    await user.selectOptions(within(form).getByLabelText('Status *'), 'contacted')
    await user.type(within(form).getByLabelText('Notes'), 'Call back Sunday')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect((await fakeLeads())[0]).toMatchObject({ status: 'contacted', notes: 'Call back Sunday' })
    expect(await screen.findByText('No new requests.')).toBeInTheDocument()
  })

  it('opens the account from a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en/admin/requests', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Open account: ${NEW.companyName}` }))
    const form = await screen.findByRole('dialog', { name: `Open an account for ${NEW.companyName}` })
    expect(within(form).getByLabelText('Company name *')).toHaveValue(NEW.companyName)
    expect(within(form).getByLabelText('Contact person *')).toHaveValue(NEW.contactPerson)
    expect(within(form).getByLabelText('Email (sign-in name) *')).toHaveValue(NEW.email)
    await user.click(within(form).getByRole('button', { name: 'Generate a random password' }))
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Account opened.')).toBeInTheDocument()

    const [, init] = fetchSpy.mock.calls.find(([url, request]) => String(url) === `/api/staff/leads/${NEW.id}/convert` && request?.method === 'POST')!
    expect(JSON.parse(String(init?.body))).toMatchObject({ companyName: NEW.companyName, fullName: NEW.contactPerson, email: NEW.email, phone: NEW.phone, city: NEW.city, isActive: true })
    const [lead] = await fakeLeads()
    expect(lead.status).toBe('converted')
    expect(await screen.findByRole('link', { name: NEW.companyName })).toHaveAttribute('href', `/en/admin/customers/${lead.businessUserId}`)
    expect(screen.queryByRole('button', { name: `Open account: ${NEW.companyName}` })).not.toBeInTheDocument()
  })

  it('keeps the form open when the email already has an account', async () => {
    const { user } = await renderPage('/en/admin/requests', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Open account: ${NEW.companyName}` }))
    const form = await screen.findByRole('dialog')
    const email = within(form).getByLabelText('Email (sign-in name) *')
    await user.clear(email)
    await user.type(email, 'zoo@example.com')
    await user.click(within(form).getByRole('button', { name: 'Generate a random password' }))
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    expect(await within(form).findByText('Another record already has this value.')).toBeInTheDocument()
    expect((await fakeLeads())[0].status).toBe('new')
  })

  it('deletes a spam request', async () => {
    const { user } = await renderPage('/en/admin/requests', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `Delete ${NEW.companyName}` }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect(await fakeLeads()).toHaveLength(1))
  })

  it('reads in Hebrew', async () => {
    await renderPage('/admin/requests', { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: 'בקשות לפתיחת חשבון' })).toBeInTheDocument()
    expect(tableCells('בקשות לפתיחת חשבון')[0]).toContain('חדשה')
    expect(screen.getByRole('button', { name: `פתיחת חשבון: ${NEW.companyName}` })).toBeInTheDocument()
  })
})
