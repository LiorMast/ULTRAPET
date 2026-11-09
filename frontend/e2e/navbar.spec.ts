/**
 * navbar.spec.ts — End-to-end checks of the site header in real Chromium: the transparent-to-solid
 * scroll behavior, #section links, the home-page scrollspy, the Products menu, language switching, the mobile drawer (including
 * swipe-to-close), layout overflow at common widths, accessibility (axe) and screenshots for visual review.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Fails the test if the page is wider than the window (which would cause horizontal scrolling).
 * @param page - The Playwright page to check.
 */
/**
 * Drags one finger horizontally across the page with real touch events (Chromium DevTools protocol), the
 * way a phone would: press, move in steps, lift. Every event carries an explicit timestamp, so the
 * gesture's speed is exact however busy the test machine is.
 * @param page - The Playwright page.
 * @param from - Start point in CSS px.
 * @param dx - Horizontal distance to travel (negative = leftwards).
 * @param steps - Number of moves.
 * @param stepMs - Time between moves in ms; fewer steps or less time over the same distance = a faster flick.
 */
async function swipe(page: Page, from: { x: number; y: number }, dx: number, steps: number, stepMs: number) {
  const cdp = await page.context().newCDPSession(page)
  const start = Date.now() / 1000
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', i: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      timestamp: start + (i * stepMs) / 1000,
      touchPoints: type === 'touchEnd' ? [] : [{ x: from.x + (dx * i) / steps, y: from.y }],
    })
  await touch('touchStart', 0)
  for (let i = 1; i <= steps; i++) await touch('touchMove', i)
  await touch('touchEnd', steps)
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}

/**
 * Waits until a section has been scrolled into view just below the fixed header.
 * @param page - The Playwright page.
 * @param id - The section's id, e.g. "about".
 */
async function expectSectionBelowHeader(page: Page, id: string) {
  /** Reads the section's current distance from the top of the window, in px. */
  const sectionTop = () => page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top)
  const headerBottom = await page.getByRole('banner').evaluate((el) => el.getBoundingClientRect().bottom)
  // Smooth scrolling is still running right after the click, so wait until the section has settled
  // at the header's bottom edge instead of checking once.
  const settled = async () => Math.round(await sectionTop())
  await expect.poll(settled, { timeout: 5000 }).toBeGreaterThanOrEqual(Math.floor(headerBottom))
  await expect.poll(settled, { timeout: 5000 }).toBeLessThanOrEqual(Math.floor(headerBottom) + 8)
}

/**
 * Runs axe on the page and fails on any WCAG A/AA violation. First waits for the hero's text entrance
 * (`hero-rise`) to finish, because axe reads colours mid-fade and reports false contrast failures.
 * @param page - The Playwright page, in the state to check (e.g. with a menu open).
 */
async function expectNoA11yViolations(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => !(a instanceof CSSAnimation && a.animationName === 'hero-rise') || a.playState === 'finished'),
  )
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop layout only')

  test('is the same translucent white material over the hero and after scrolling', async ({ page }) => {
    await page.goto('/')
    const header = page.getByRole('banner')
    await expect(header).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.85)')
    await expect(header).toHaveCSS('backdrop-filter', /blur\(20px\)/)
    await expect(header).toHaveScreenshot('header-he-top.png')

    await page.mouse.wheel(0, 600)
    await expect(header).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.85)')
    await expect(header).toHaveScreenshot('header-he-scrolled.png')
  })

  test('is solid white for visitors who ask for more contrast', async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' })
    await page.goto('/')
    const header = page.getByRole('banner')
    await expect(header).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(header).toHaveCSS('backdrop-filter', 'none')
  })

  test('menu links scroll to their section, below the header', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'תפריט ראשי' }).getByRole('link', { name: 'אודות' }).click()
    await expect(page).toHaveURL(/\/#about$/)
    await expectSectionBelowHeader(page, 'about')
  })

  for (const { path, about, prefix } of [
    { path: '/', about: 'אודות', prefix: '/' },
    { path: '/en', about: 'About', prefix: '/en' },
  ]) {
    test(`the menu follows the section being read, without adding history entries (${path})`, async ({ page }) => {
      await page.goto(path)
      const nav = page.getByRole('navigation', { name: path === '/' ? 'תפריט ראשי' : 'Main menu' })
      const historyLength = await page.evaluate(() => history.length)

      // Scrolled by the visitor (wheel), not by a link: the URL hash and the menu follow.
      await page.locator('#about').evaluate((el: HTMLElement) => window.scrollTo({ top: el.offsetTop - 88, behavior: 'instant' }))
      await page.mouse.wheel(0, 1)
      await expect(page).toHaveURL(new RegExp(`${prefix}#about$`))
      await expect(nav.getByRole('link', { name: about })).toHaveAttribute('aria-current', 'page')

      await page.mouse.wheel(0, 100_000)
      await expect(page).toHaveURL(new RegExp(`${prefix}#contact$`))

      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await expect(page).toHaveURL((url) => url.pathname === prefix && url.hash === '')
      await expect(nav.locator('[aria-current]')).toHaveCount(0)
      expect(await page.evaluate(() => history.length)).toBe(historyLength)
    })
  }

  test('the Products menu opens on hover, its label links to the catalog, and the keyboard works', async ({ page }) => {
    await page.goto('/en')
    const products = page.getByRole('banner').getByRole('link', { name: 'Products' })
    const menu = page.getByRole('menu')

    await products.hover()
    await expect(menu.getByRole('menuitem')).toHaveCount(17)
    await expect(page.getByRole('banner')).toHaveScreenshot('header-en-products-open.png')
    await page.mouse.move(0, 400)
    await expect(menu).toBeHidden()

    await products.click()
    await expect(page).toHaveURL('/en/catalog')

    await page.goto('/en')
    await products.focus()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Dry Cat Food' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Dry Dog Food' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/en/catalog?category=dry-dog-food')
  })

  test('switching language opens the same page in the other language', async ({ page }) => {
    await page.goto('/where-to-buy')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    await page.getByRole('button', { name: 'שפה: עב' }).click()
    await page.getByRole('menuitem', { name: 'English' }).click()

    await expect(page).toHaveURL('/en/where-to-buy')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find a store')
    await expect(page.getByRole('banner')).toHaveScreenshot('header-en-solid.png')
  })

  for (const path of ['/', '/en']) {
    test(`fits on one line without horizontal scrolling (${path})`, async ({ page }) => {
      for (const width of [1024, 1280, 1366, 1440, 1536, 1920]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(path)
        await expectNoHorizontalOverflow(page)
        const header = page.getByRole('banner')
        const height = await header.evaluate((el) => el.getBoundingClientRect().height)
        expect(height, `header height at ${width}px`).toBeLessThanOrEqual(96)

        // Every text label in the header row stays on one line (no wrapped labels), and nothing spills
        // out of the header row. Icon-only buttons have no text and are skipped.
        const report = await header.evaluate((el) => {
          const row = el.firstElementChild as HTMLElement
          const wrapped = [...row.querySelectorAll<HTMLElement>('a, button')]
            .filter((e) => e.offsetParent !== null && e.textContent?.trim())
            .filter((e) => {
              const tops = new Set<number>()
              const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT)
              for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (node.parentElement?.classList.contains('sr-only')) continue
                const range = document.createRange()
                range.selectNodeContents(node)
                for (const rect of range.getClientRects()) tops.add(Math.round(rect.top))
              }
              return tops.size > 1
            })
            .map((e) => e.textContent)
          return { wrapped, overflow: row.scrollWidth - row.clientWidth }
        })
        expect(report, `header row at ${width}px`).toEqual({ wrapped: [], overflow: 0 })
      }
    })
  }

  test('has no accessibility violations, with menus closed and open', async ({ page }) => {
    await page.goto('/')
    await expectNoA11yViolations(page)
    await page.getByRole('banner').getByRole('link', { name: 'מוצרים' }).hover()
    await expect(page.getByRole('menu')).toBeVisible()
    await expectNoA11yViolations(page)
  })
})

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile layout only')

  test('the drawer opens from the end side, traps focus and closes on Escape', async ({ page }) => {
    for (const [path, side] of [
      ['/', 'left'],
      ['/en', 'right'],
    ] as const) {
      await page.goto(path)
      await page.getByRole('button', { name: path === '/' ? 'פתיחת תפריט' : 'Open menu' }).click()
      const drawer = page.getByRole('dialog')
      await expect(drawer).toBeVisible()

      const viewportWidth = page.viewportSize()!.width
      await expect
        .poll(async () => {
          const box = (await drawer.boundingBox())!
          return side === 'left' ? Math.round(box.x) : Math.round(viewportWidth - (box.x + box.width))
        })
        .toBe(0)

      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab')
        expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true)
      }

      if (path === '/') await expect(page).toHaveScreenshot('drawer-he.png')
      await page.keyboard.press('Escape')
      await expect(drawer).toBeHidden()
    }
  })

  test('the drawer follows a swipe: a short drag springs back, a flick towards the edge closes it', async ({ page }) => {
    for (const [path, open, sign] of [
      ['/en', 'Open menu', 1],
      ['/', 'פתיחת תפריט', -1],
    ] as const) {
      await page.goto(path)
      await page.getByRole('button', { name: open }).click()
      const drawer = page.getByRole('dialog')
      await expect(drawer).toBeVisible()
      await page.waitForTimeout(600) // let the slide-in finish
      const box = (await drawer.boundingBox())!
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

      // A slow, short drag towards the edge: the panel moves with the finger, then springs back open.
      await swipe(page, start, sign * 60, 12, 40)
      await expect(drawer).toBeVisible()
      await expect.poll(async () => Math.round((await drawer.boundingBox())!.x)).toBe(Math.round(box.x))

      // A quick flick that travels well under half the panel: only its momentum carries it closed.
      await swipe(page, start, sign * 130, 3, 16)
      await expect(drawer).toBeHidden()
    }
  })

  test('a vertical swipe in the drawer does not move it sideways', async ({ page }) => {
    await page.goto('/en')
    await page.getByRole('button', { name: 'Open menu' }).click()
    const drawer = page.getByRole('dialog')
    await page.waitForTimeout(600)
    const box = (await drawer.boundingBox())!
    const cdp = await page.context().newCDPSession(page)
    const x = box.x + box.width / 2
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: 400 }] })
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 2, y: 400 - i * 15 }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(drawer).toBeVisible()
    expect(Math.round((await drawer.boundingBox())!.x)).toBe(Math.round(box.x))
  })

  test('choosing a section in the drawer closes it and scrolls there', async ({ page }) => {
    await page.goto('/en')
    await page.getByRole('button', { name: 'Open menu' }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('link', { name: 'About' }).click()

    await expect(drawer).toBeHidden()
    await expect(page).toHaveURL(/\/en#about$/)
    await expectSectionBelowHeader(page, 'about')
  })

  test('fits the phone screen in both languages', async ({ page }) => {
    for (const path of ['/', '/en']) {
      await page.goto(path)
      await expectNoHorizontalOverflow(page)
    }
    await expect(page.getByRole('banner')).toHaveScreenshot('header-en-mobile.png')
  })

  test('has no accessibility violations with the drawer open', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'פתיחת תפריט' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoA11yViolations(page)
  })
})
