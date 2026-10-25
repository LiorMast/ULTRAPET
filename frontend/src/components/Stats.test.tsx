/**
 * Stats.test.tsx — Tests for the home page Stats band: four figures in order with their final values
 * and labels in both languages, the section anchor, and a custom list via props.
 */
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Stats } from '@/components/Stats'
import type { Stat } from '@/config'
import { renderComponent, renderPage } from '@/test/utils'

describe('Stats section', () => {
  it('shows the four figures with their labels in order (Hebrew)', async () => {
    await renderPage('/')
    const section = document.getElementById('stats')!
    expect(within(section).getByRole('heading', { level: 2, name: 'אולטרה פט במספרים' })).toBeInTheDocument()
    const items = within(section).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['350+350+נקודות מכירה', '15+15+שותפי ייצור', '1,000+1,000+מוצרים', '12+12+שנות ניסיון'])
  })

  it('uses English labels in English', async () => {
    await renderPage('/en')
    const section = document.getElementById('stats')!
    for (const label of ['Retail locations', 'Manufacturing partners', 'Products', 'Years of experience']) {
      expect(within(section).getByText(label)).toBeInTheDocument()
    }
  })

  it('renders a custom list given by props', async () => {
    const stats: Stat[] = [{ id: 'x', value: 7, suffix: '%', label: () => 'Seven' }]
    renderComponent(<Stats stats={stats} />)
    expect(await screen.findAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Seven')).toBeInTheDocument()
    expect(screen.getByText('7%', { selector: '.sr-only' })).toBeInTheDocument()
  })
})
