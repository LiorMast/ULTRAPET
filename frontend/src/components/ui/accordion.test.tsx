/**
 * accordion.test.tsx — Tests for the Accordion primitive (ui/accordion.tsx): the ARIA accordion pattern (buttons
 * inside headings, aria-expanded, the panel's region), single and multiple modes, collapsing, keyboard moves between
 * the triggers and the variants.
 */
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { renderComponent } from '@/test/utils'

/**
 * Three panels "One" / "Two" / "Three" whose answers read "Answer one" ...
 * @param props - The Accordion root props (type, variant, defaultValue ...).
 * @returns The accordion.
 */
function Sample(props: React.ComponentProps<typeof Accordion>) {
  return (
    <Accordion {...props}>
      {['one', 'two', 'three'].map((id) => (
        <AccordionItem key={id} value={id}>
          <AccordionTrigger>{id[0].toUpperCase() + id.slice(1)}</AccordionTrigger>
          <AccordionContent>Answer {id}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

const trigger = (name: string) => screen.getByRole('button', { name })

describe('Accordion', () => {
  it('renders each trigger as a button inside a heading, with the open panel as a labelled region', async () => {
    renderComponent(<Sample type="single" collapsible defaultValue="one" />, 'en')
    expect(await screen.findByRole('heading', { level: 3, name: 'One' })).toContainElement(trigger('One'))
    expect(trigger('One')).toHaveAttribute('aria-expanded', 'true')
    expect(trigger('Two')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('region', { name: 'One' })).toHaveTextContent('Answer one')
    expect(screen.queryByText('Answer two')).not.toBeInTheDocument()
  })

  it('keeps one panel open in single mode and closes it again when collapsible', async () => {
    renderComponent(<Sample type="single" collapsible defaultValue="one" />, 'en')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Two' }))
    expect(trigger('Two')).toHaveAttribute('aria-expanded', 'true')
    expect(trigger('One')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Answer two')).toBeVisible()
    await user.click(trigger('Two'))
    expect(trigger('Two')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Answer two')).not.toBeInTheDocument()
  })

  it('lets several panels stay open in multiple mode', async () => {
    renderComponent(<Sample type="multiple" />, 'en')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(trigger('Three'))
    expect(trigger('One')).toHaveAttribute('aria-expanded', 'true')
    expect(trigger('Three')).toHaveAttribute('aria-expanded', 'true')
  })

  it('moves between the triggers with the arrow keys and opens with Enter', async () => {
    renderComponent(<Sample type="single" collapsible />, 'en')
    const user = userEvent.setup()
    ;(await screen.findByRole('button', { name: 'One' })).focus()
    await user.keyboard('{ArrowDown}')
    expect(trigger('Two')).toHaveFocus()
    await user.keyboard('{End}')
    expect(trigger('Three')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(trigger('Three')).toHaveAttribute('aria-expanded', 'true')
  })

  it('applies the variant to the root and its items', async () => {
    renderComponent(<Sample type="single" variant="card" />, 'en')
    const root = (await screen.findByRole('button', { name: 'One' })).closest('[data-slot="accordion"]')!
    expect(root).toHaveAttribute('data-variant', 'card')
    expect(root.querySelector('[data-slot="accordion-item"]')).toHaveClass('border', 'bg-white')
  })
})
