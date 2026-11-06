/**
 * hero-editor.spec.ts — End-to-end checks of the staff's hero editing in real Chromium: the edit buttons for
 * signed-in staff only; the two-language dialog (axe, a save that changes the hero's text, font and size, the picked
 * font really loads); editing in place (axe in edit mode, the one style bar following the focused box and dragged by
 * its grip, one Save
 * for every text, no horizontal overflow); and the largest sizes still fitting every screen width.
 *
 * The hero's saved content (its part of GET /api/sections) and the staff save (/api/staff/page-sections) are answered
 * in the browser (page.route), so these tests never change the shared dev database that the other specs'
 * screenshots read. The real save path is covered by the backend tests (test_staff_api.py).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signInStaff } from './utils.ts'

/**
 * Answers the hero's section API in the browser: the hero's part of GET /api/sections from memory (missing while
 * nothing is saved; the other sections are the real ones) and the staff create/update, which store the content they
 * receive.
 * @param page - The Playwright page, before it loads the home page.
 * @param initial - The content the hero starts with; null = never edited.
 * @returns The request bodies the page sent to the staff API, oldest first.
 */
async function fakeHeroSection(page: Page, initial: unknown = null) {
  let content = initial
  const sent: { method: string; body: { content: unknown } }[] = []
  // The home page reads every section at once: the real ones, with the hero's replaced (left out while never saved).
  await page.route('**/api/sections', async (route) => {
    const { hero: _saved, ...others } = (await (await route.fetch()).json()) as Record<string, unknown>
    return route.fulfill({ json: content === null ? others : { ...others, hero: content } })
  })
  await page.route('**/api/staff/page-sections**', (route) => {
    const body = route.request().postDataJSON() as { content: unknown }
    sent.push({ method: route.request().method(), body })
    content = body.content
    return route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, json: { key: 'hero', content } })
  })
  return sent
}

/** Every text at the largest size in both languages, to check the hero still fits. */
const LARGEST = Object.fromEntries(
  ['title', 'tagline', 'description'].map((text) => [text, { size: { he: 'xl', en: 'xl' }, font: { he: 'frank-ruhl-libre', en: 'frank-ruhl-libre' } }]),
)

test('the edit buttons are for staff only', async ({ page }) => {
  await page.goto('/en')
  await page.getByRole('heading', { level: 1 }).waitFor()
  await expect(page.getByRole('button', { name: 'Edit both languages' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit on page' })).toHaveCount(0)
})

test('staff edit the texts in place and save them at once', async ({ page }) => {
  const sent = await fakeHeroSection(page)
  await signInStaff(page)
  await page.goto('/en')
  await page.getByRole('button', { name: 'Edit on page: Hero' }).click()
  const hero = page.locator('#home')
  await expect(hero.getByRole('textbox', { name: 'Tagline' })).toBeVisible()

  // Measure contrast once the buttons have faded in (their entrance, hero-rise, runs on after the click).
  await hero.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => (animation as CSSAnimation).animationName === 'hero-rise')
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
  const axe = await new AxeBuilder({ page }).include('#home').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'no horizontal scrolling in edit mode').toBe(0)

  // One style bar; it starts on the title (focused) and follows the box that gets the focus.
  const bar = page.getByRole('toolbar', { name: 'Text style' })
  await expect(bar).toHaveCount(1)
  await expect(bar).toContainText('Editing: Title words')
  await expect(hero.getByRole('textbox', { name: 'Title words' })).toBeFocused()
  // The bar can be dragged out of the way by its grip and keeps working there.
  const before = (await bar.boundingBox())!
  const grip = (await bar.getByRole('button', { name: 'Move the style bar' }).boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2 - 60, grip.y + grip.height / 2 + 80, { steps: 5 })
  await page.mouse.up()
  const after = (await bar.boundingBox())!
  const heroBox = (await hero.boundingBox())!
  expect(Math.round(after.y - before.y)).toBe(80)
  // Sideways it moves the 60px asked for, or stops at the hero's edge (on a phone the bar is nearly as wide).
  const moved = Math.round(before.x - after.x)
  expect(moved === 60 || Math.round(after.x) === Math.round(heroBox.x), `moved ${moved}px`).toBe(true)
  expect(after.x + after.width).toBeLessThanOrEqual(heroBox.x + heroBox.width + 0.5)
  await hero.getByRole('textbox', { name: 'Title words' }).focus()
  await bar.getByRole('combobox', { name: 'Title words size' }).selectOption('Small')
  await hero.getByRole('textbox', { name: 'Tagline' }).fill('Wholesale only')
  await expect(bar).toContainText('Editing: Tagline')
  await bar.getByRole('combobox', { name: 'Tagline font' }).selectOption('Assistant')
  await hero.getByRole('button', { name: 'Save' }).click()

  await expect(hero.getByText('Wholesale only')).toHaveCSS('font-family', /Assistant Variable/)
  await expect(hero.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit on page: Hero' })).toBeFocused()
  expect(sent).toHaveLength(1)
  expect(sent[0].body.content).toMatchObject({ tagline: { text: { en: 'Wholesale only' }, font: { en: 'assistant' } }, title: { size: { en: 'sm' } } })
})

test('staff change the title text, font and size', async ({ page }) => {
  const sent = await fakeHeroSection(page)
  await signInStaff(page)
  await page.goto('/en')
  await page.getByRole('button', { name: 'Edit both languages' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit the hero' })
  await expect(dialog).toBeVisible()

  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])

  const title = dialog.getByRole('group', { name: 'Title' }).getByRole('group', { name: 'English' })
  await title.getByRole('textbox', { name: 'Title words' }).fill('Premium')
  await title.getByRole('combobox', { name: 'Font' }).selectOption('Rubik')
  await title.getByRole('combobox', { name: 'Size' }).selectOption('Extra large')
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect(dialog).toBeHidden()
  const heading = page.getByRole('heading', { level: 1, name: 'Premium Pet' })
  await expect(heading).toBeVisible()
  await expect(heading).toHaveCSS('font-family', /Rubik Variable/)
  await expect.poll(() => page.evaluate(() => document.fonts.check('700 64px "Rubik Variable"'))).toBe(true)
  await expect(page.getByRole('button', { name: 'Edit both languages' })).toBeFocused()
  expect(sent.map((request) => request.method)).toEqual(['POST'])
})

for (const path of ['/', '/en']) {
  test(`the largest sizes still fit every screen width (${path})`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'resizes the window itself')
    test.slow() // six page loads
    await fakeHeroSection(page, LARGEST)
    for (const width of [360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      await page.getByRole('heading', { level: 1 }).waitFor()
      // Measure with the picked font, not the fallback it replaces once downloaded.
      await expect.poll(() => page.evaluate(() => document.fonts.check('700 64px "Frank Ruhl Libre Variable"'))).toBe(true)
      await page.evaluate(() => document.fonts.ready)
      const report = await page.evaluate(() => {
        const hero = document.querySelector('#home')!.getBoundingClientRect()
        const h1 = document.querySelector('#home h1')!.getBoundingClientRect()
        const button = document.querySelector('#home a.group\\/button')!.getBoundingClientRect()
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          titleInside: h1.left >= 0 && h1.right <= document.documentElement.clientWidth,
          buttonInside: button.bottom <= hero.bottom,
        }
      })
      expect(report, `hero at ${width}px`).toEqual({ overflow: 0, titleInside: true, buttonInside: true })
    }
  })
}
