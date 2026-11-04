/**
 * hero-editor.spec.ts — End-to-end checks of the staff's hero editor in real Chromium: the Edit button for signed-in
 * staff only, the dialog's accessibility (axe), a save that changes the hero's text, font and size (the picked font
 * really loads), and the largest sizes still fitting every screen width.
 *
 * The hero's saved content (GET /api/sections/hero) and the staff save (/api/staff/page-sections) are answered
 * in the browser (page.route), so these tests never change the shared dev database that the other specs'
 * screenshots read. The real save path is covered by the backend tests (test_staff_api.py).
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signInStaff } from './utils.ts'

/**
 * Answers the hero's section API in the browser: GET /api/sections/hero from memory (404 while nothing is
 * saved) and the staff create/update, which store the content they receive.
 * @param page - The Playwright page, before it loads the home page.
 * @param initial - The content the hero starts with; null = never edited.
 * @returns The request bodies the page sent to the staff API, oldest first.
 */
async function fakeHeroSection(page: Page, initial: unknown = null) {
  let content = initial
  const sent: { method: string; body: { content: unknown } }[] = []
  await page.route('**/api/sections/hero', (route) =>
    content === null
      ? route.fulfill({ status: 404, json: { error: 'not_found' } })
      : route.fulfill({ json: { key: 'hero', content, updatedAt: new Date().toISOString() } }),
  )
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

test('the Edit button is for staff only', async ({ page }) => {
  await page.goto('/en')
  await page.getByRole('heading', { level: 1 }).waitFor()
  await expect(page.getByRole('button', { name: 'Edit hero' })).toHaveCount(0)
})

test('staff change the title text, font and size', async ({ page }) => {
  const sent = await fakeHeroSection(page)
  await signInStaff(page)
  await page.goto('/en')
  await page.getByRole('button', { name: 'Edit hero' }).click()
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
  await expect(page.getByRole('button', { name: 'Edit hero' })).toBeFocused()
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
