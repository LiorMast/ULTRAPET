/**
 * Carousel.test.tsx — Tests for the generic Carousel: slides as list items under a labelled region,
 * arrows hidden when everything fits, scroll direction in LTR vs RTL, disabled arrows at the ends and
 * non-smooth scrolling for reduced motion, and paged mode (grouping, dots, one-page arrows). jsdom has no layout, so the scroll metrics are mocked.
 */
import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Carousel } from '@/components/Carousel'
import { renderComponent } from '@/test/utils'

const scrollBy = vi.fn()

/**
 * Mocks the row's measured size so jsdom thinks the content overflows.
 * @param scrollWidth - Total content width.
 * @param clientWidth - Visible width.
 */
function mockMetrics(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth)
}

/** Shows three slides inside a carousel. */
const slides = (
  <Carousel label="Demo">
    <span>one</span>
    <span>two</span>
    <span>three</span>
  </Carousel>
)

beforeEach(() => {
  Element.prototype.scrollBy = scrollBy as unknown as typeof Element.prototype.scrollBy
})

afterEach(() => {
  vi.restoreAllMocks()
  scrollBy.mockClear()
})

describe('Carousel', () => {
  it('wraps every child in a list item inside a labelled carousel region', async () => {
    mockMetrics(900, 300)
    renderComponent(slides, 'en')
    const region = await screen.findByRole('region', { name: 'Demo' })
    expect(region).toHaveAttribute('aria-roledescription', 'carousel')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['one', 'two', 'three'])
  })

  it('hides the arrows when everything fits', async () => {
    mockMetrics(300, 300)
    renderComponent(slides, 'en')
    await screen.findByRole('region')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('scrolls forward on Next and disables Previous at the start (English)', async () => {
    mockMetrics(900, 300)
    const { user } = renderComponent(slides, 'en')
    expect(await screen.findByRole('button', { name: 'Previous' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(scrollBy).toHaveBeenCalledWith({ left: 270, behavior: 'smooth' })
  })

  it('scrolls the other way in Hebrew (RTL), where scrollLeft is negative', async () => {
    mockMetrics(900, 300)
    const { user } = renderComponent(slides, 'he')
    await user.click(await screen.findByRole('button', { name: 'הבא' }))
    expect(scrollBy).toHaveBeenCalledWith({ left: -270, behavior: 'smooth' })
  })

  it('disables Next at the end and enables Previous after scrolling', async () => {
    mockMetrics(900, 300)
    renderComponent(slides, 'en')
    const list = (await screen.findAllByRole('list'))[0]
    list.scrollLeft = 600
    fireEvent.scroll(list)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
  })

  it('does not animate for visitors who prefer reduced motion', async () => {
    mockMetrics(900, 300)
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList)
    const { user } = renderComponent(slides, 'en')
    await user.click(await screen.findByRole('button', { name: 'Next' }))
    expect(scrollBy).toHaveBeenCalledWith({ left: 270, behavior: 'auto' })
  })
})

describe('Carousel in paged mode', () => {
  const paged = (
    <Carousel label="Demo" pageSize={2}>
      <span>one</span>
      <span>two</span>
      <span>three</span>
    </Carousel>
  )

  it('groups the children into pages of pageSize', async () => {
    mockMetrics(600, 300)
    const { container } = renderComponent(paged, 'en')
    await screen.findByRole('region')
    const pages = container.querySelectorAll('ul > li > ul')
    expect([...pages].map((p) => p.textContent)).toEqual(['onetwo', 'three'])
  })

  it('shows one dot per page, marks the current one and jumps to a page on click', async () => {
    mockMetrics(600, 300)
    Element.prototype.scrollTo = scrollBy as unknown as typeof Element.prototype.scrollTo
    const { user } = renderComponent(paged, 'en')
    const dots = await screen.findAllByRole('button', { name: /^Page \d of 2$/ })
    expect(dots).toHaveLength(2)
    expect(dots[0]).toHaveAttribute('aria-current', 'true')
    await user.click(dots[1])
    expect(scrollBy).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' })
  })

  it('follows the scroll position and scrolls a whole page per arrow click (RTL flips the sign)', async () => {
    mockMetrics(600, 300)
    const { user } = renderComponent(paged, 'he')
    const list = (await screen.findAllByRole('list'))[0]
    list.scrollLeft = 300
    fireEvent.scroll(list)
    expect(screen.getByRole('button', { name: 'עמוד 2 מתוך 2' })).toHaveAttribute('aria-current', 'true')
    await user.click(screen.getByRole('button', { name: 'הקודם' }))
    expect(scrollBy).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' })
  })

  it('shows no dots when everything fits on one view', async () => {
    mockMetrics(300, 300)
    renderComponent(paged, 'en')
    await screen.findByRole('region')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
