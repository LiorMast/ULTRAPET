/**
 * spinner.test.tsx — Tests for the Spinner primitive (ui/spinner.tsx): a status region with a translated label,
 * a custom label, a decorative ring, and its sizes.
 */
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Spinner } from '@/components/ui/spinner'
import { renderComponent } from '@/test/utils'

describe('Spinner', () => {
  it('is a status region named "Loading…" in English', async () => {
    renderComponent(<Spinner />, 'en')
    expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
  })

  it('speaks Hebrew on a Hebrew page', async () => {
    renderComponent(<Spinner />, 'he')
    expect(await screen.findByRole('status')).toHaveTextContent('טוען…')
  })

  it('says what is loading when given a label', async () => {
    renderComponent(<Spinner label="Loading the stock…" />, 'en')
    expect(await screen.findByRole('status')).toHaveTextContent('Loading the stock…')
  })

  it('is only a hidden ring when decorative, in the chosen size', async () => {
    const { container } = renderComponent(<Spinner label={false} size="lg" className="text-brand-red" />, 'en')
    const ring = await waitFor(() => container.querySelector('[data-slot="spinner"]') ?? Promise.reject(new Error('no ring yet')))
    expect(screen.queryByRole('status')).toBeNull()
    expect(ring).toHaveAttribute('aria-hidden', 'true')
    expect(ring).toHaveClass('size-10', 'text-brand-red', 'animate-spinner')
  })
})

