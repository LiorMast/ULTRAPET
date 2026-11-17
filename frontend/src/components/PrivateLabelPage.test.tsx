/**
 * PrivateLabelPage.test.tsx — Tests for the Private Label page (routes/private-label.tsx): the h1, breadcrumbs and calls to action
 * in both languages, the capabilities, the process (the saved steps, read-only), the product categories, the FAQ
 * accordion with its FAQPage JSON-LD, the header's menu link to the page, and the page head.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

describe('Private Label page', () => {
  it('shows the heading, breadcrumbs, calls to action and every part of the page (Hebrew)', async () => {
    await renderPage('/private-label')
    expect(screen.getByRole('heading', { level: 1, name: 'בנו מותג משלכם למוצרי חיות מחמד' })).toBeInTheDocument()
    const crumbs = screen.getByRole('navigation', { name: 'נתיב ניווט' })
    expect(within(crumbs).getByRole('link', { name: 'דף הבית' })).toHaveAttribute('href', '/')
    expect(within(crumbs).getByText('תווית פרטית')).toHaveAttribute('aria-current', 'page')
    const main = within(screen.getByRole('main'))
    expect(main.getAllByRole('link', { name: 'התחילו פרויקט תווית פרטית' })[0]).toHaveAttribute('href', '/#contact')
    expect(main.getByRole('link', { name: 'למותגים שלנו' })).toHaveAttribute('href', '/#brands')

    expect(main.getByText('מפעלים בינלאומיים')).toBeInTheDocument()
    const process = main.getByRole('list', { name: 'שלבי פרויקט תווית פרטית' })
    expect(within(process).getAllByRole('listitem')).toHaveLength(5)
    expect(main.getByRole('heading', { level: 3, name: 'חול לחתולים' })).toBeInTheDocument()
    expect(main.getByRole('heading', { level: 3, name: 'שותף אחד מקצה לקצה' })).toBeInTheDocument()
    // The process is the home section's, read-only: no edit button and no link back to this page.
    expect(main.queryByRole('link', { name: 'עוד על תווית פרטית' })).not.toBeInTheDocument()
  })

  it('opens a FAQ answer and puts the questions in the head (English)', async () => {
    const { user } = await renderPage('/en/private-label')
    expect(screen.getByRole('heading', { level: 1, name: 'Build your own pet product brand' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Can we get a sample before ordering?' }))
    expect(screen.getByRole('region', { name: 'Can we get a sample before ordering?' })).toHaveTextContent(/you approve the product/)

    await waitFor(() => expect(document.title).toBe('Private label pet food and pet products | Ultra Pet Israel'))
    const data = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent ?? ''))
    expect(data.find((d) => d['@type'] === 'FAQPage').mainEntity).toHaveLength(4)
    expect(data.find((d) => d['@type'] === 'BreadcrumbList')).toBeDefined()
  })

  it('shows staff the process read-only (they edit it on the home page)', async () => {
    await renderPage('/en/private-label', { staff: TEST_STAFF })
    expect(screen.queryByRole('button', { name: 'Edit on page: Private label' })).not.toBeInTheDocument()
  })

  it('is the header menu’s Private Label link', async () => {
    await renderPage('/en')
    const nav = screen.getByRole('navigation', { name: 'Main menu' })
    expect(within(nav).getByRole('link', { name: 'Private Label' })).toHaveAttribute('href', '/en/private-label')
  })
})
