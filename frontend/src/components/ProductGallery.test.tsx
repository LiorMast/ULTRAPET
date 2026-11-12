/**
 * ProductGallery.test.tsx — Tests for ProductGallery on its own: a placeholder without photos, no thumbnail row for
 * a single photo, and the alt texts (the photo's own in the page language, else the product name). Switching photos
 * is tested on the real page in ProductPage.test.tsx.
 */
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductGallery } from '@/components/ProductGallery'
import { renderComponent } from '@/test/utils'

/** A photo as the API answers it. */
const photo = (name: string, alt: Record<string, string> | null = null) => ({
  src: `/api/media/products/${name}.png`,
  thumbnail: `/api/media/products/${name}-300x300.png`,
  srcSet: '',
  alt,
})

describe('ProductGallery', () => {
  it('shows a placeholder when the product has no photo', async () => {
    renderComponent(<ProductGallery images={[]} name="Dog Chew" />, 'en')
    expect(await screen.findByText('No photo of this product')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows one photo without thumbnails, its alt text falling back to the product name', async () => {
    renderComponent(<ProductGallery images={[photo('chew', { he: 'עצם' })]} name="Dog Chew" />, 'en')
    expect(await screen.findByRole('img', { name: 'Dog Chew' })).toHaveAttribute('src', '/api/media/products/chew.png')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it("uses the photo's own alt text in the page language", async () => {
    renderComponent(<ProductGallery images={[photo('chew', { he: 'עצם לעיסה' }), photo('back')]} name="עצם" />)
    expect(await screen.findByRole('img', { name: 'עצם לעיסה' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
