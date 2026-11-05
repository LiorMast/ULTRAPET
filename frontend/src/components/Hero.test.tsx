/**
 * Hero.test.tsx — Tests for the home page hero: its text and buttons in both languages, the photo
 * slideshow (one image per photo, controls, auto-advance, pausing), the reduced-motion behavior and the content staff
 * saved (texts, fonts and sizes per language, with the dictionary as fallback; the editor slot).
 * Small cases render <Hero> alone with fake photos via renderComponent(); one case renders the real
 * home page to prove the photos in src/assets/hero are picked up.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HeroContent } from '@/api'
import { Hero, mergeHero } from '@/components/Hero'
import type { HeroImage } from '@/config'
import { renderComponent, renderPage } from '@/test/utils'

/**
 * Makes a fake photo for the tests.
 * @param n - Photo number, used in the file names.
 * @returns A HeroImage with a 960w and a 1920w file.
 */
const photo = (n: number): HeroImage => ({ src: `/p${n}.webp`, srcSet: `/p${n}-960.webp 960w, /p${n}.webp 1920w` })
const THREE = [photo(1), photo(2), photo(3)]

/**
 * Pretends the visitor does (or doesn't) have "reduce motion" turned on.
 * @param reduce - true to simulate prefers-reduced-motion: reduce.
 */
function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

afterEach(() => setReducedMotion(false))

/**
 * Fires the "CSS animation finished" event on an element, the way a browser would. jsdom has no
 * AnimationEvent class, and React then listens for the old prefixed event name; this picks the name
 * React registered, so the handler runs exactly once.
 * @param element - The element whose animation "finished".
 */
function endAnimation(element: Element) {
  const name = 'AnimationEvent' in window ? 'animationend' : 'webkitAnimationEnd'
  fireEvent(element, new Event(name, { bubbles: true }))
}

/**
 * Lists the photo <img> elements of the rendered hero.
 * @returns The images, in document order.
 */
const photos = () => [...document.querySelectorAll<HTMLImageElement>('#home img.hero-slide')]

describe('Hero text and buttons', () => {
  it('shows the Hebrew content with unprefixed links', async () => {
    renderComponent(<Hero images={THREE} />, 'he')
    expect(await screen.findByRole('heading', { level: 1, name: 'אולטרה פט' })).toBeInTheDocument()
    expect(screen.getByText('יבוא והפצה של מזון ומוצרים לחיות מחמד')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'המותגים שלנו' })).toHaveAttribute('href', '/#brands')
    expect(screen.queryByRole('link', { name: 'הפוך ללקוח עסקי' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'המשך למטה' })).toHaveAttribute('href', '/#stats')
  })

  it('shows the English content with /en links', async () => {
    renderComponent(<Hero images={THREE} />, 'en')
    expect(await screen.findByRole('heading', { level: 1, name: 'Ultra Pet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Our Brands' })).toHaveAttribute('href', '/en#brands')
    expect(screen.queryByRole('link', { name: 'Become a Business Customer' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Scroll down' })).toHaveAttribute('href', '/en#stats')
  })
})

describe('Hero saved content', () => {
  const CONTENT: HeroContent = {
    title: { text: { he: 'כותרת', en: 'Headline' }, accent: { en: 'Now' }, font: { he: 'rubik' }, size: { he: 'xl' } },
    tagline: { text: { en: '  ' }, size: { en: 'sm' } },
    description: { text: { he: 'תיאור חדש' }, font: { he: 'frank-ruhl-libre' }, size: { he: 'lg' } },
  }

  it('shows the saved texts, fonts and sizes of the page language', async () => {
    renderComponent(<Hero images={[]} content={CONTENT} />, 'he')
    const heading = await screen.findByRole('heading', { level: 1, name: 'כותרת פט' })
    expect(heading.style.fontFamily).toContain('Rubik Variable')
    expect(heading).toHaveClass('text-[clamp(3.6rem,9.5vw,8.5rem)]')
    const description = screen.getByText('תיאור חדש')
    expect(description.style.fontFamily).toContain('Frank Ruhl Libre Variable')
    expect(description).toHaveClass('text-lg')
    // Not saved: the dictionary text, the site's font and the design size.
    const tagline = screen.getByText('יבוא והפצה של מזון ומוצרים לחיות מחמד')
    expect(tagline.style.fontFamily).toBe('')
    expect(tagline).toHaveClass('text-lg', 'lg:text-xl')
    // A size step keeps each text's own line height.
    expect(heading).toHaveClass('leading-[1.05]')
    expect(tagline).toHaveClass('leading-snug')
    expect(description).toHaveClass('leading-relaxed')
  })

  it('falls back per language and for blank texts', async () => {
    renderComponent(<Hero images={[]} content={CONTENT} />, 'en')
    const heading = await screen.findByRole('heading', { level: 1, name: 'Headline Now' })
    expect(heading.style.fontFamily).toBe('')
    expect(heading).toHaveClass('text-[clamp(3.2rem,7.5vw,6.5rem)]')
    expect(screen.getByText('Import and Distribution of Pet Food and Pet Supplies')).toHaveClass('text-base', 'lg:text-lg')
  })

  it('ignores unknown fonts and sizes', async () => {
    const odd = { title: { font: { he: 'comic-sans' }, size: { he: 'huge' } } } as unknown as HeroContent
    renderComponent(<Hero images={[]} content={odd} />, 'he')
    const heading = await screen.findByRole('heading', { level: 1, name: 'אולטרה פט' })
    expect(heading.style.fontFamily).toBe('')
    expect(heading).toHaveClass('text-[clamp(3.2rem,7.5vw,6.5rem)]')
  })

  it('merges an inline edit into one language and keeps the others', () => {
    const merged = mergeHero(CONTENT, 'he', {
      title: { text: ' שלום ', font: 'assistant', size: 'sm' },
      accent: { text: 'עולם', font: 'assistant', size: 'sm' },
      tagline: { text: '', font: 'default', size: 'md' },
      description: { text: '', font: 'heebo', size: 'lg' },
    })
    expect(merged.title).toEqual({
      text: { he: 'שלום', en: 'Headline' },
      accent: { he: 'עולם', en: 'Now' },
      font: { he: 'assistant' },
      size: { he: 'sm' },
    })
    // An emptied text is removed, so the built-in one shows; the English values stay.
    expect(merged.tagline).toEqual({ text: { en: '  ' }, font: { he: 'default' }, size: { en: 'sm', he: 'md' } })
    expect(merged.description?.text).toEqual({})
    expect(mergeHero(null, 'en', {
      title: { text: 'A', font: 'default', size: 'md' },
      accent: { text: '', font: 'default', size: 'md' },
      tagline: { text: '', font: 'default', size: 'md' },
      description: { text: '', font: 'default', size: 'md' },
    }).title?.text).toEqual({ en: 'A' })
  })

  it('has no inline editing without onSave', async () => {
    renderComponent(<Hero images={[]} content={CONTENT} />, 'en')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Edit on page' })).not.toBeInTheDocument()
  })

  it('shows the editor slot only when given', async () => {
    renderComponent(<Hero images={[]} editor={<button type="button">Edit me</button>} />)
    expect(await screen.findByRole('button', { name: 'Edit me' })).toBeInTheDocument()
  })
})

describe('Hero photos', () => {
  it('shows the decorative logo mark inside the headline', async () => {
    renderComponent(<Hero images={THREE} />)
    const heading = await screen.findByRole('heading', { level: 1 })

    expect(heading.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('renders one decorative image per photo, the first one eager and high priority', async () => {
    renderComponent(<Hero images={THREE} />)
    await screen.findByRole('heading', { level: 1 })

    const images = photos()
    expect(images).toHaveLength(3)
    expect(images.map((img) => img.getAttribute('alt'))).toEqual(['', '', ''])
    expect(images[0]).toHaveAttribute('srcset', '/p1-960.webp 960w, /p1.webp 1920w')
    expect(images[0]).toHaveAttribute('loading', 'eager')
    expect(images[0]).toHaveAttribute('fetchpriority', 'high')
    expect(images[1]).toHaveAttribute('loading', 'lazy')
    expect(images.map((img) => img.dataset.active)).toEqual(['true', 'false', 'false'])
  })

  it('works with no photos: no images and no controls', async () => {
    renderComponent(<Hero images={[]} />)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(photos()).toHaveLength(0)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('shows a single photo without controls', async () => {
    renderComponent(<Hero images={[photo(1)]} />)
    await screen.findByRole('heading', { level: 1 })
    expect(photos()).toHaveLength(1)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('picks up the photos in src/assets/hero on the real home page', async () => {
    await renderPage('/')
    expect(photos().length).toBeGreaterThanOrEqual(3)
    expect(photos()[0].getAttribute('srcset')).toMatch(/ 960w, .* 1920w$/)
  })
})

describe('Hero slideshow', () => {
  it('has one labelled dash per photo, in a labelled group', async () => {
    renderComponent(<Hero images={THREE} />, 'en')
    const group = await screen.findByRole('group', { name: 'Photo slideshow' })
    const dashes = within(group).getAllByRole('button', { name: /^Show photo/ })
    expect(dashes.map((d) => d.getAttribute('aria-label'))).toEqual([
      'Show photo 1 of 3',
      'Show photo 2 of 3',
      'Show photo 3 of 3',
    ])
    expect(dashes[0]).toHaveAttribute('aria-current', 'true')
  })

  it('shows the photo of the dash that was clicked', async () => {
    const { user } = renderComponent(<Hero images={THREE} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Show photo 2 of 3' }))
    expect(screen.getByRole('button', { name: 'Show photo 2 of 3' })).toHaveAttribute('aria-current', 'true')
    expect(photos().map((img) => img.dataset.active)).toEqual(['false', 'true', 'false'])
  })

  it('advances when the progress dash finishes, and wraps around', async () => {
    renderComponent(<Hero images={THREE} />)
    await screen.findByRole('heading', { level: 1 })
    /** Finds which photo is showing (zero-based). */
    const activeIndex = () => photos().findIndex((img) => img.dataset.active === 'true')

    for (const expected of [1, 2, 0]) {
      endAnimation(document.querySelector('.hero-progress')!)
      await waitFor(() => expect(activeIndex()).toBe(expected))
    }
  })

  it('pauses and resumes with the pause button', async () => {
    const { user } = renderComponent(<Hero images={THREE} />, 'en')
    /** The progress bar of the active dash. */
    const progress = () => document.querySelector<HTMLElement>('.hero-progress')!
    await screen.findByRole('heading', { level: 1 })
    expect(progress().dataset.running).toBe('true')

    await user.click(screen.getByRole('button', { name: 'Pause slideshow' }))
    expect(progress().dataset.running).toBe('false')

    await user.click(screen.getByRole('button', { name: 'Play slideshow' }))
    expect(progress().dataset.running).toBe('true')
  })

})

describe('Hero with reduced motion', () => {
  it('does not advance by itself and has no pause button, but the dashes still work', async () => {
    setReducedMotion(true)
    const { user } = renderComponent(<Hero images={THREE} />, 'en')
    await screen.findByRole('heading', { level: 1 })

    expect(document.querySelector('.hero-progress')).toBeNull()
    expect(screen.queryByRole('button', { name: /slideshow/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show photo 3 of 3' }))
    expect(photos().map((img) => img.dataset.active)).toEqual(['false', 'false', 'true'])
  })
})

describe('Hero scroll-down arrow', () => {
  it('scrolls to the next section on every click, not only the first one', async () => {
    const scrollIntoView = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView
    const stats = document.createElement('section')
    stats.id = 'stats'
    document.body.append(stats)
    try {
      const { user } = renderComponent(<Hero images={THREE} />, 'en')
      const arrow = await screen.findByRole('link', { name: 'Scroll down' })
      await user.click(arrow)
      await user.click(arrow)
      expect(scrollIntoView).toHaveBeenCalledTimes(2)
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
      expect(arrow).toHaveAttribute('href', '/en#stats')
    } finally {
      Element.prototype.scrollIntoView = original
      stats.remove()
    }
  })
})
