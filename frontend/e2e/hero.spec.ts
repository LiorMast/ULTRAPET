/**
 * hero.spec.ts — End-to-end checks of the home page hero in real Chromium: its layout and text side in
 * both languages, no horizontal overflow at common widths, the photo slideshow (auto-advance, dashes,
 * pause/play), the reduced-motion behavior, accessibility (axe) and screenshots for visual review.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** Waits until the first hero photo has finished loading, so screenshots show the photo, not a blank. */
async function waitForFirstPhoto(page: Page) {
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>('#home img')
    return !!img && img.complete && img.naturalWidth > 0
  })
}

/**
 * Makes each photo stay 2.5s instead of 7s, so the slideshow tests don't wait long. It stays longer
 * than the 1.6s crossfade, so a photo can finish fading in before the next one starts.
 * @param page - The Playwright page, already on the home page.
 */
async function speedUpSlideshow(page: Page) {
  await page.addStyleTag({ content: ':root { --hero-interval: 2500ms; }' })
}

/**
 * Finds which photo is showing.
 * @param page - The Playwright page, on the home page.
 * @returns The zero-based number of the active photo.
 */
function activeIndex(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#home img')].findIndex((img) => img.dataset.active === 'true'))
}

test.describe('layout', () => {
  test('fills the space below the header, with the text on the start side (desktop)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop layout only')
    for (const [path, side] of [
      ['/', 'right'],
      ['/en', 'left'],
    ] as const) {
      await page.goto(path)
      const hero = await page.locator('#home').boundingBox()
      const headerBottom = await page.getByRole('banner').evaluate((el) => el.getBoundingClientRect().bottom)
      expect(Math.round(hero!.y), `hero top (${path})`).toBe(Math.round(headerBottom))
      expect(hero!.height, `hero height (${path})`).toBeGreaterThanOrEqual(600)

      const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!
      const center = title.x + title.width / 2
      const viewport = page.viewportSize()!.width
      if (side === 'right') expect(center, `H1 on the right (${path})`).toBeGreaterThan(viewport / 2)
      else expect(center, `H1 on the left (${path})`).toBeLessThan(viewport / 2)
    }
  })

  test('shows the headline and both buttons above the fold (mobile)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile layout only')
    for (const path of ['/', '/en']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeInViewport({ ratio: 1 })
      const buttons = page.locator('#home a.group\\/button')
      await expect(buttons).toHaveCount(2)
      for (let i = 0; i < 2; i++) await expect(buttons.nth(i)).toBeInViewport({ ratio: 1 })
    }
  })

  for (const path of ['/', '/en']) {
    test(`fits every screen width without horizontal scrolling (${path})`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'resizes the window itself')
      for (const width of [360, 390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(path)
        await page.getByRole('heading', { level: 1 }).waitFor()
        const report = await page.evaluate(() => {
          const h1 = document.querySelector('#home h1')!.getBoundingClientRect()
          return {
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            titleInside: h1.left >= 0 && h1.right <= document.documentElement.clientWidth,
          }
        })
        expect(report, `hero at ${width}px`).toEqual({ overflow: 0, titleInside: true })
      }
    })
  }
})

test.describe('slideshow', () => {
  test('advances by itself and the dashes select a photo', async ({ page }) => {
    await page.goto('/en')
    await speedUpSlideshow(page)
    const photos = page.locator('#home img')
    /** Finds the dash button that selects photo number `n` (1-based). */
    const dash = (n: number) => page.getByRole('button', { name: new RegExp(`^Show photo ${n} of`) })

    await expect(dash(1)).toHaveAttribute('aria-current', 'true')
    await expect(dash(2)).toHaveAttribute('aria-current', 'true', { timeout: 8000 })
    await expect(photos.nth(1)).toHaveAttribute('data-active', 'true')
    await expect(photos.nth(1)).toHaveCSS('opacity', '1', { timeout: 5000 })

    await dash(1).click()
    await expect(photos.nth(0)).toHaveAttribute('data-active', 'true')
  })

  test('pauses and resumes', async ({ page }) => {
    await page.goto('/en')
    await speedUpSlideshow(page)

    await page.getByRole('button', { name: 'Pause slideshow' }).click()
    await expect(page.locator('.hero-progress')).toHaveAttribute('data-running', 'false')
    const pausedAt = await activeIndex(page)
    await page.waitForTimeout(3500)
    expect(await activeIndex(page)).toBe(pausedAt)

    await page.getByRole('button', { name: 'Play slideshow' }).click()
    await expect.poll(() => activeIndex(page), { timeout: 8000 }).not.toBe(pausedAt)
  })
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('never advances by itself and has no pause button, but the dashes work', async ({ page }) => {
    await page.goto('/en')
    await speedUpSlideshow(page)
    await page.waitForTimeout(2500)
    await expect(page.locator('#home img').nth(0)).toHaveAttribute('data-active', 'true')
    await expect(page.locator('.hero-progress')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /slideshow/ })).toHaveCount(0)

    await page.getByRole('button', { name: /^Show photo 3 of/ }).click()
    await expect(page.locator('#home img').nth(2)).toHaveAttribute('data-active', 'true')
  })

  test('has no accessibility violations', async ({ page }) => {
    for (const path of ['/', '/en']) {
      await page.goto(path)
      await waitForFirstPhoto(page)
      const results = await new AxeBuilder({ page })
        .include('#home')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), path).toEqual([])
    }
  })

  test('screenshots', async ({ page, isMobile }) => {
    const suffix = isMobile ? '-mobile' : ''
    for (const [path, name] of [
      ['/', 'he'],
      ['/en', 'en'],
    ] as const) {
      await page.goto(path)
      await waitForFirstPhoto(page)
      await expect(page).toHaveScreenshot(`hero-${name}${suffix}.png`)
    }
  })
})
