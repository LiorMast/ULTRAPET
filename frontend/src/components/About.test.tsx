/**
 * About.test.tsx — Tests for the home page About section: heading and texts in both languages, the three
 * pillars and five offers, the contact link, and a custom list via props.
 */
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { About } from '@/components/About'
import type { AboutItem } from '@/config'
import { renderComponent, renderPage } from '@/test/utils'

describe('About section', () => {
  it('shows the story, pillars and offers (Hebrew)', async () => {
    await renderPage('/')
    const section = document.getElementById('about')!
    expect(within(section).getByRole('heading', { level: 2, name: /היבואן והמפיץ המוביל/ })).toBeInTheDocument()
    expect(within(section).getByRole('heading', { level: 4, name: 'שירות אישי ואמין' })).toBeInTheDocument()
    expect(within(section).getAllByRole('heading', { level: 4 })).toHaveLength(8)
    expect(within(section).getByRole('link', { name: /לקבלת הצעת מחיר/ })).toHaveAttribute('href', '/#contact')
  })

  it('uses English texts and the /en prefix in English', async () => {
    await renderPage('/en')
    const section = document.getElementById('about')!
    expect(within(section).getByRole('heading', { level: 2, name: /leading importer/ })).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: /Get a quote/ })).toHaveAttribute('href', '/en#contact')
  })

  it('renders custom lists given by props', async () => {
    const one: AboutItem[] = [{ id: 'x', icon: (() => null) as unknown as AboutItem['icon'], title: () => 'Only', text: () => 'One' }]
    renderComponent(<About pillars={one} offers={[]} advantages={[]} />, 'en')
    expect(await screen.findByRole('heading', { level: 4, name: 'Only' })).toBeInTheDocument()
  })
})
