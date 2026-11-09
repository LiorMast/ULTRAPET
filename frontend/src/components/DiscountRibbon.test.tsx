/**
 * DiscountRibbon.test.tsx — Tests for the discount ribbon (DiscountRibbon.tsx), rendered alone (it needs no
 * providers): its message with a decorative icon, the color variants, the discount / sale kinds (color, icon;
 * explicit props win) and the inline / corner placements.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Truck } from 'lucide-react'
import { DiscountRibbon } from '@/components/DiscountRibbon'

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
    ['discount', 'bg-brand-red', 'lucide-percent'],
    ['sale', 'bg-brand-charcoal', 'lucide-tag'],
  ] as const)('a %s ribbon has its own color and icon', (kind, colorClass, iconClass) => {
    render(<DiscountRibbon kind={kind} message="-20%" />)
    expect(ribbon()).toHaveAttribute('data-kind', kind)
    expect(ribbon()).toHaveClass(colorClass)
    expect(ribbon().querySelector('svg')).toHaveClass(iconClass)
  })

  it('lets an explicit icon and color override the kind', () => {
    render(<DiscountRibbon kind="sale" icon={Truck} color="light" message="Deal" />)
    expect(ribbon()).toHaveClass('bg-white')
    expect(ribbon().querySelector('svg')).toHaveClass('lucide-truck')
  })

  it('pins itself to the inline-start corner when placed in the corner', () => {
    render(<DiscountRibbon message="-5%" placement="corner" className="top-0" />)
    expect(ribbon()).toHaveClass('absolute', 'start-0', 'top-0')
  })
})
