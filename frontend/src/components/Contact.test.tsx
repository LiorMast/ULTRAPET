/**
 * Contact.test.tsx — Tests for the home page Contact section: the four cards with real links in both
 * languages, form validation, the prefilled mailto: on a valid submit, and a custom list via props.
 */
import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Contact } from '@/components/Contact'
import type { ContactMethod } from '@/config'
import { renderComponent, renderPage } from '@/test/utils'

describe('Contact section', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the contact cards with real links (Hebrew)', async () => {
    await renderPage('/')
    const section = document.getElementById('contact')!
    expect(within(section).getByRole('heading', { level: 2, name: 'דברו איתנו' })).toBeInTheDocument()
    const hrefs = within(section).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['tel:1700559992', 'https://wa.me/972522142410', 'mailto:office@ultrapet.co.il'])
    expect(within(section).getByText('שישי וערבי חג: סגור')).toBeInTheDocument()
  })

  it('uses English texts in English', async () => {
    await renderPage('/en')
    const section = document.getElementById('contact')!
    expect(within(section).getByRole('heading', { level: 2, name: 'Talk to us' })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Send message' })).toBeInTheDocument()
  })

  it('shows required-field and email errors and does not send', async () => {
    await renderPage('/en')
    const section = document.getElementById('contact')!
    fireEvent.change(within(section).getByLabelText('Email'), { target: { value: 'nope' } })
    fireEvent.click(within(section).getByRole('button', { name: 'Send message' }))
    expect(within(section).getAllByText('Required field')).toHaveLength(3)
    expect(within(section).getByText('Invalid email address')).toBeInTheDocument()
    expect(within(section).getByLabelText(/Full name/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('opens a prefilled mailto: on a valid submit and shows the confirmation', async () => {
    const location = { href: '' }
    vi.stubGlobal('location', location)
    await renderPage('/en')
    const section = document.getElementById('contact')!
    fireEvent.change(within(section).getByLabelText(/Full name/), { target: { value: 'Dana' } })
    fireEvent.change(within(section).getByLabelText(/Phone/), { target: { value: '050-1234567' } })
    fireEvent.change(within(section).getByLabelText(/Message/), { target: { value: 'Quote please' } })
    fireEvent.click(within(section).getByRole('button', { name: 'Send message' }))
    expect(location.href).toMatch(/^mailto:office@ultrapet\.co\.il\?subject=.*&body=.*Dana.*Quote%20please/s)
    expect(await within(section).findByRole('status')).toHaveTextContent('Almost there!')
  })

  it('renders custom cards given by props', async () => {
    const methods: ContactMethod[] = [{ id: 'x', icon: (() => null) as unknown as ContactMethod['icon'], label: () => 'Lbl', value: () => 'Val', sub: () => 'Sub' }]
    renderComponent(<Contact methods={methods} />, 'en')
    expect(await screen.findByText('Val')).toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
