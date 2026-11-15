/**
 * TextLink.test.tsx — Tests for the shared text link (TextLink.tsx): an internal page gets the language prefix and
 * the router's link, another address stays a plain link (in a new tab with `external`), an action's leading icon
 * (decorative), and the muted tone.
 */
import { linkOptions } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextLink } from '@/components/TextLink'
import { renderComponent } from '@/test/utils'

describe('TextLink', () => {
  it('links to a page of the site, with the language prefix and the underline look', async () => {
    renderComponent(<TextLink link={linkOptions({ to: '/where-to-buy' })}>Find a store</TextLink>, 'en')
    const link = await screen.findByRole('link', { name: 'Find a store' })
    expect(link).toHaveAttribute('href', '/en/where-to-buy')
    expect(link).toHaveClass('link-underline', 'text-brand-red-dark')
    expect(link).not.toHaveAttribute('target')
    expect(link.querySelector('svg')).toBeNull()
  })

  it('opens another address in a new tab when external', async () => {
    renderComponent(<TextLink href="/api/catalog.pdf?lang=he" external>Catalog</TextLink>, 'he')
    const link = await screen.findByRole('link', { name: 'Catalog' })
    expect(link).toHaveAttribute('href', '/api/catalog.pdf?lang=he')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('leads with a decorative icon when given one, keeping its name', async () => {
    renderComponent(<TextLink href="/api/catalog.pdf" external icon={Download}>Download the catalog</TextLink>, 'en')
    const link = await screen.findByRole('link', { name: 'Download the catalog' })
    expect(link.querySelector('svg.lucide-download')).toHaveAttribute('aria-hidden', 'true')
  })

  it('has a muted tone', async () => {
    renderComponent(<TextLink href="#x" tone="muted" className="mt-4">Muted</TextLink>, 'en')
    expect(await screen.findByRole('link', { name: 'Muted' })).toHaveClass('text-brand-charcoal-muted', 'mt-4')
  })
})
