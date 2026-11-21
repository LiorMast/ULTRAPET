/**
 * DiscountRibbon.test.tsx — Tests for the discount ribbon (DiscountRibbon.tsx), rendered alone (it needs no
 * providers): its message with an optional decorative icon, the color variants, the discount / sale / stock kinds (a
 * color each and no icon: the words say it; explicit props win), the inline / corner placements, a staff-chosen
 * `customColor` with readable text (readableTextColor, contrastRatio), and DiscountRibbons (a product's ribbons per
 * kind of discount, rendered with the app's providers for its translated names).
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Truck } from 'lucide-react'
import { contrastRatio, DiscountRibbon, DiscountRibbons, readableTextColor } from '@/components/DiscountRibbon'
import { renderComponent } from '@/test/utils'

const ribbon = () => screen.getByText(/./, { selector: '[data-slot="discount-ribbon"]' })

describe('DiscountRibbon', () => {
  it('shows the message, with a decorative icon when given one', () => {
    render(<DiscountRibbon icon={Truck} message="Free delivery" />)
    expect(ribbon()).toHaveTextContent('Free delivery')
    expect(ribbon().querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders without an icon, in brand red by default, in the flow', () => {
    render(<DiscountRibbon message="-10%" />)
    expect(ribbon().querySelector('svg')).toBeNull()
    expect(ribbon()).toHaveClass('bg-brand-red')
    expect(ribbon()).not.toHaveClass('absolute')
  })

  it('takes its color from the color prop', () => {
    render(<DiscountRibbon message="Sale" color="warning" />)
    expect(ribbon()).toHaveClass('bg-warning')
  })

  it.each([
    ['discount', 'bg-brand-red'],
    ['sale', 'bg-brand-charcoal'],
    ['inStock', 'bg-success'],
    ['lowStock', 'bg-warning'],
    ['outOfStock', 'bg-brand-charcoal'],
  ] as const)('a %s ribbon has its own color, a pill shape and no icon', (kind, colorClass) => {
    render(<DiscountRibbon kind={kind} message="-20%" />)
    expect(ribbon()).toHaveAttribute('data-kind', kind)
    expect(ribbon()).toHaveClass(colorClass, 'rounded-md')
    expect(ribbon()).toHaveTextContent('-20%')
    expect(ribbon().querySelector('svg')).toBeNull()
  })

  it('lets an explicit icon and color override the kind', () => {
    render(<DiscountRibbon kind="sale" icon={Truck} color="light" message="Deal" />)
    expect(ribbon()).toHaveClass('bg-white')
    expect(ribbon().querySelector('svg')).toHaveClass('lucide-truck')
  })

  it('floats inside the inline-start corner when placed in the corner', () => {
    render(<DiscountRibbon message="-5%" placement="corner" className="top-0" />)
    expect(ribbon()).toHaveClass('absolute', 'start-3', 'top-0')
  })
})

describe('custom ribbon colors', () => {
  it('paints the ribbon in a custom color with the text that reads best', () => {
    render(<DiscountRibbon kind="discount" customColor="#FFD54F" message="Sale" />)
    expect(ribbon()).toHaveStyle({ backgroundColor: '#FFD54F', color: '#1A1A1A' })
  })

  it.each(['#000000', '#BE1E24', '#777777', '#808080', '#1A1A1A', '#0055AA', '#26744D', '#FFFFFF', '#FFD54F', '#7F7F7F', '#00FF00', '#FF00FF'])(
    'picks white or charcoal text with at least 4.5:1 contrast on %s',
    (background) => {
      expect(contrastRatio(background, readableTextColor(background))).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('picks white on dark colors and charcoal on light ones', () => {
    expect(readableTextColor('#1A1A1A')).toBe('#FFFFFF')
    expect(readableTextColor('#BE1E24')).toBe('#FFFFFF')
    expect(readableTextColor('#FFFFFF')).toBe('#1A1A1A')
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21)
  })
})

describe('DiscountRibbons', () => {
  const colors = { general: '#0055AA', customer: '#FFD54F' }

  it('renders one ribbon per kind, named and colored, in a corner stack that lets clicks through', async () => {
    renderComponent(<DiscountRibbons types={['general', 'customer']} colors={colors} placement="corner" />, 'en')
    const ribbons = await screen.findAllByText(/./, { selector: '[data-slot="discount-ribbon"]' })
    expect(ribbons.map((one) => one.textContent)).toEqual(['Sale', 'Your discount'])
    expect(ribbons[0]).toHaveStyle({ backgroundColor: '#0055AA' })
    expect(ribbons[1]).toHaveStyle({ backgroundColor: '#FFD54F' })
    expect(ribbons[0].parentElement).toHaveClass('absolute', 'start-3', 'pointer-events-none')
  })

  it('renders nothing without kinds', async () => {
    const { container } = renderComponent(<DiscountRibbons types={[]} colors={colors} />, 'en')
    await Promise.resolve()
    expect(container.querySelector('[data-slot="discount-ribbons"]')).toBeNull()
  })
})
