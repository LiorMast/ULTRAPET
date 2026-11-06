/**
 * WhatsAppButton.test.tsx — Tests that the floating WhatsApp circle appears on every page with a
 * translated accessible name and a link to the customer-service chat, except on the staff panel (/admin/...).
 */
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderPage } from '@/test/utils'

describe('WhatsAppButton', () => {
  it.each([
    ['/', 'שירות לקוחות – WhatsApp'],
    ['/en', 'Customer service – WhatsApp'],
    ['/en/catalog', 'Customer service – WhatsApp'],
    ['/en/no-such-page', 'Customer service – WhatsApp'],
  ])('is shown on %s', async (url, name) => {
    await renderPage(url)
    const link = screen.getByRole('link', { name })
    expect(link).toHaveAttribute('href', 'https://wa.me/972522142410')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveTextContent(name.split(' – ')[0])
  })

  it.each(['/admin', '/en/admin/brands'])('is hidden on the staff panel page %s', async (url) => {
    await renderPage(url)
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
  })
})
