/**
 * navbar.spec.ts — End-to-end checks of the site header in real Chromium: the transparent-to-solid
 * scroll behavior, #section links, the Products menu, language switching, the mobile drawer, layout
 * overflow at common widths, accessibility (axe) and screenshots for visual review.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Fails the test if the page is wider than the window (which would cause horizontal scrolling).
 * @param page - The Playwright page to check.
 */
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

  test('is always white, over the hero and after scrolling', async ({ page }) => {
    await page.goto('/')
    const header = page.getByRole('banner')
    await expect(header).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(header).toHaveScreenshot('header-he-top.png')

    await page.mouse.wheel(0, 600)
    await expect(header).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(header).toHaveScreenshot('header-he-scrolled.png')
  })

  test('menu links scroll to their section, below the header', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'תפריט ראשי' }).getByRole('link', { name: 'אודות' }).click()
    await expect(page).toHaveURL(/\/#about$/)
    await expectSectionBelowHeader(page, 'about')
  })

  test('the Products menu works with the mouse and the keyboard', async ({ page }) => {
    await page.goto('/en')
    const products = page.getByRole('button', { name: 'Products' })
    const menu = page.getByRole('menu')

    await products.click()
    await expect(menu.getByRole('menuitem')).toHaveCount(9)
    await expect(page.getByRole('banner')).toHaveScreenshot('header-en-products-open.png')
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(products).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Cat Food' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/en/categories/cat-food')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cat Food')
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
    await page.getByRole('button', { name: 'מוצרים' }).click()
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
