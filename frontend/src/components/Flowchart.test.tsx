/**
 * Flowchart.test.tsx — Tests for FlowchartList and FlowchartCard: the steps as an ordered list in flow order, one
 * decorative connector between each pair of neighbours (chevrons flipped in RTL, a line, or none), the ordinals (the
 * list's numbering, a card's own, or none), string and node titles, the heading level, a meaningful or decorative
 * picture, and the actions slot.
 */
import { screen, within } from '@testing-library/react'
import { Lightbulb } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { FlowchartCard, FlowchartList } from '@/components/Flowchart'
import { renderComponent } from '@/test/utils'

const STEPS = ['Idea', 'Design', 'Production']

/**
 * Renders a flow of the three STEPS.
 * @param props - Props for the list (and `ownOrdinal` for the second card).
 * @returns The render result.
 */
function renderFlow(props: Partial<Parameters<typeof FlowchartList>[0]> & { ownOrdinal?: string } = {}) {
  const { ownOrdinal, ...list } = props
  return renderComponent(
    <FlowchartList label="Process" {...list}>
      {STEPS.map((step, i) => (
        <FlowchartCard key={step} media={<Lightbulb />} title={step} description={`About ${step}`} ordinal={i === 1 ? ownOrdinal : undefined} />
      ))}
    </FlowchartList>,
    'en',
  )
}

/** The list's connectors. */
const connectors = () => document.querySelectorAll('[data-flowchart-connector]')

/** The shown ordinals, in order. */
const ordinals = () => [...document.querySelectorAll('[data-flowchart-ordinal]')].map((node) => node.textContent)

describe('FlowchartList', () => {
  it('renders the steps as an ordered list, in order, with a connector between neighbours', async () => {
    renderFlow()
    const list = await screen.findByRole('list', { name: 'Process' })
    expect(list.tagName).toBe('OL')
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual(STEPS)
    expect(within(items[0]).getByText('About Idea')).toBeInTheDocument()
    expect(connectors()).toHaveLength(STEPS.length - 1)
    for (const connector of connectors()) expect(connector).toHaveAttribute('aria-hidden', 'true')
    // The row's chevrons point along the reading direction: mirrored in RTL.
    expect(connectors()[0].querySelector('.rtl\\:-scale-x-100')).not.toBeNull()
  })

  it('numbers the steps, lets a card keep its own ordinal, and hides the ordinals from screen readers', async () => {
    renderFlow({ ownOrdinal: 'B' })
    await screen.findByRole('list')
    expect(ordinals()).toEqual(['01', 'B', '03'])
    for (const node of document.querySelectorAll('[data-flowchart-ordinal]')) expect(node).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows no ordinals when not numbered, except a card’s own', async () => {
    renderFlow({ numbered: false, ownOrdinal: 'B' })
    await screen.findByRole('list')
    expect(ordinals()).toEqual(['B'])
  })

  it('draws a line or no connector, and stacks the steps when vertical', async () => {
    const { unmount } = renderFlow({ connector: 'line', orientation: 'vertical' })
    const list = await screen.findByRole('list')
    expect(list).toHaveAttribute('data-orientation', 'vertical')
    expect(connectors()).toHaveLength(2)
    expect(connectors()[0].querySelector('svg')).toBeNull()
    unmount()
    renderFlow({ connector: 'none' })
    await screen.findByRole('list')
    expect(connectors()).toHaveLength(0)
  })
})

describe('FlowchartCard', () => {
  it('takes a node title, a heading level, a meaningful picture and actions', async () => {
    renderComponent(
      <FlowchartList>
        <FlowchartCard media={<img src="/a.webp" alt="" />} mediaLabel="A factory" title="Shipping" headingLevel="h2" actions={<button type="button">Act</button>} />
        <FlowchartCard media={<Lightbulb />} title={<p data-testid="custom">Custom title</p>} />
      </FlowchartList>,
      'en',
    )
    expect(await screen.findByRole('heading', { level: 2, name: 'Shipping' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'A factory' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Act' })).toBeInTheDocument()
    expect(screen.getByTestId('custom')).toHaveTextContent('Custom title')
    expect(screen.getAllByRole('heading')).toHaveLength(1)
  })
})
