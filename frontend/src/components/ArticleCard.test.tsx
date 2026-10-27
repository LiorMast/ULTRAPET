/**
 * ArticleCard.test.tsx — Tests for the articles pages (the list at /articles and one article at
 * /articles/$slug), which are built from ArticleCard, ArticleMeta and Breadcrumbs: the navbar link,
 * cards and links in both languages, the article text, photo, breadcrumbs and internal links, the
 * not-found page for unknown slugs, and the SEO head tags (title, description, canonical, hreflang, JSON-LD).
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderPage } from '@/test/utils'
import articles from '@/stubs/articles.json'

/** The stub articles, newest first (the order the pages use). */
const newest = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

/**
 * Reads the JSON-LD objects the page has rendered.
 * @returns The parsed objects.
 */
const jsonLd = () => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent ?? ''))

describe('Articles page', () => {
  it('is linked from the main menu and marked as the current page', async () => {
    await renderPage('/articles')
    const nav = screen.getByRole('navigation', { name: 'תפריט ראשי' })
    const link = within(nav).getByRole('link', { name: 'מאמרים' })
    expect(link).toHaveAttribute('href', '/articles')
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('lists every article, newest first, with links to the article pages (Hebrew)', async () => {
    await renderPage('/articles')
    expect(screen.getByRole('heading', { level: 1, name: 'מדריכים וטיפים לבעלי חיות מחמד' })).toBeInTheDocument()
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titles).toEqual(newest.map((a) => a.title.he))
    const first = screen.getByRole('link', { name: new RegExp(newest[0].title.he) })
    expect(first).toHaveAttribute('href', `/articles/${newest[0].slug}`)
    expect(within(first).getByText('17 במרץ 2024')).toHaveAttribute('datetime', newest[0].publishedAt)
  })

  it('uses English texts and /en links in English', async () => {
    await renderPage('/en/articles')
    expect(screen.getByRole('heading', { level: 1, name: 'Pet care guides and tips' })).toBeInTheDocument()
    const card = screen.getByRole('link', { name: new RegExp(newest[1].title.en) })
    expect(card).toHaveAttribute('href', `/en/articles/${newest[1].slug}`)
    expect(within(card).getByText('March 17, 2024')).toBeInTheDocument()
    expect(within(card).getByText(/min read/)).toBeInTheDocument()
  })

  it('sets the title, description, canonical, hreflang and Blog JSON-LD', async () => {
    await renderPage('/en/articles')
    await waitFor(() => expect(document.title).toBe('Dog and cat care articles and tips | Ultra Pet Israel'))
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', expect.stringContaining('Expert tips'))
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.ultrapet.co.il/en/articles')
    expect(document.querySelector('link[hreflang="he"]')).toHaveAttribute('href', 'https://www.ultrapet.co.il/articles')
    expect(document.querySelector('link[hreflang="x-default"]')).toHaveAttribute('href', 'https://www.ultrapet.co.il/articles')
    const blog = jsonLd().find((d) => d['@type'] === 'Blog')
    expect(blog.blogPost).toHaveLength(articles.length)
    expect(blog.blogPost[0].url).toBe(`https://www.ultrapet.co.il/en/articles/${newest[0].slug}`)
  })
})

describe('Article page', () => {
  const article = articles.find((a) => a.slug === 'dog-mental-health-in-winter')!

  it('shows the title, photo, text and breadcrumbs (Hebrew)', async () => {
    await renderPage(`/articles/${article.slug}`)
    const main = screen.getByRole('article')
    expect(within(main).getByRole('heading', { level: 1, name: article.title.he })).toBeInTheDocument()
    expect(within(main).getByRole('img', { name: article.imageAlt.he })).toBeInTheDocument()
    expect(within(main).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5)
    const crumbs = screen.getByRole('navigation', { name: 'נתיב ניווט' })
    expect(within(crumbs).getByRole('link', { name: 'מאמרים' })).toHaveAttribute('href', '/articles')
    expect(within(crumbs).getByText(article.title.he)).toHaveAttribute('aria-current', 'page')
  })

  it('links to a store finder, related categories and more articles of the same topic first', async () => {
    await renderPage(`/en/articles/${article.slug}`)
    expect(screen.getByRole('link', { name: 'Find a store' })).toHaveAttribute('href', '/en/where-to-buy')
    const related = screen.getByRole('region', { name: 'Products worth knowing' })
    expect(within(related).getByRole('link', { name: /Dog Food/ })).toHaveAttribute('href', '/en/categories/dog-food')
    const more = screen.getByRole('region', { name: 'More articles' })
    const cards = within(more).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(cards).not.toContain(article.title.en)
    expect(cards[0]).toBe(articles.find((a) => a.topic === 'dogs' && a.slug !== article.slug)!.title.en)
  })

  it('sets the article head tags and BlogPosting + BreadcrumbList JSON-LD', async () => {
    await renderPage(`/articles/${article.slug}`)
    await waitFor(() => expect(document.title).toBe(`${article.title.he} | אולטרה פט ישראל`))
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', article.description.he)
    expect(document.querySelector('meta[property="og:type"]')).toHaveAttribute('content', 'article')
    expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute('content', expect.stringMatching(/^https:\/\/www\.ultrapet\.co\.il\//))
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `https://www.ultrapet.co.il/articles/${article.slug}`)
    expect(document.querySelector('link[hreflang="en"]')).toHaveAttribute('href', `https://www.ultrapet.co.il/en/articles/${article.slug}`)
    const posting = jsonLd().find((d) => d['@type'] === 'BlogPosting')
    expect(posting).toMatchObject({ headline: article.title.he, datePublished: article.publishedAt, dateModified: article.updatedAt, inLanguage: 'he' })
    const trail = jsonLd().find((d) => d['@type'] === 'BreadcrumbList')
    expect(trail.itemListElement.map((i: { name: string }) => i.name)).toEqual(['דף הבית', 'מאמרים', article.title.he])
  })

  it('shows "not found" for an unknown article', async () => {
    await renderPage('/articles/no-such-article')
    expect(await screen.findByRole('heading', { level: 1, name: 'הדף לא נמצא' })).toBeInTheDocument()
  })
})
