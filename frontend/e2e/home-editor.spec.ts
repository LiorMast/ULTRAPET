/**
 * home-editor.spec.ts — End-to-end checks of the staff's in-place editing of the home page sections other than the
 * hero and the FAQ list (those have hero-editor.spec.ts and faq-editor.spec.ts) in real Chromium: Stats, Brands,
 * Categories, About and Contact. For each: the edit button for staff only; edit mode passes axe and has no horizontal
 * overflow, also at phone width; screenshots of edit mode in Hebrew and English. Plus save round trips: About's texts
 * (page_sections), the stats numbers and the contact details (settings).
 *
 * The staff writes (POST/PATCH /api/staff/page-sections, PATCH /api/staff/settings/<key>) are answered in the browser
 * (page.route) and kept in memory, and the reads that follow (GET /api/sections, /api/stats, /api/contact) are the
 * real answers with those writes laid over them, so these tests never change the shared dev database that the other
 * specs' screenshots read. The real save path is covered by the backend tests.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { hideFixedOverlays, scrollIntoViewSettled, signInStaff } from './utils.ts'

/** The editable sections: their anchor and the accessible name of their edit button per language. */
const SECTIONS = [
  { id: 'stats', en: 'Ultra Pet in numbers', he: 'אולטרה פט במספרים' },
  { id: 'brands', en: 'Our Brands', he: 'המותגים שלנו' },
  { id: 'categories', en: 'Product Categories', he: 'קטגוריות מוצרים' },
  { id: 'about', en: 'About Ultra Pet', he: 'אודות אולטרה פט' },
  { id: 'contact', en: 'Contact', he: 'צור קשר' },
] as const

/** What the page sent to the faked staff API. */
type Writes = { sections: Record<string, Record<string, unknown>>; settings: Record<string, unknown> }

/**
 * Answers the staff writes in memory and lays them over the real reads (see the file header).
 * @param page - The Playwright page, before it loads the home page.
 * @returns The writes, filled in as the page saves.
 */
async function fakeWrites(page: Page): Promise<Writes> {
  const writes: Writes = { sections: {}, settings: {} }
  await page.route('**/api/staff/page-sections**', (route) => {
    const body = route.request().postDataJSON() as { key?: string; content: Record<string, unknown> }
    const key = body.key ?? decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)
    writes.sections[key] = body.content
    return route.fulfill({ json: { key, content: body.content } })
  })
  await page.route('**/api/staff/settings/*', (route) => {
    const key = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!)
    writes.settings[key] = (route.request().postDataJSON() as { value: unknown }).value
    return route.fulfill({ json: { key, value: writes.settings[key] } })
  })
  await page.route('**/api/sections', async (route) => {
    const real = (await (await route.fetch()).json()) as Record<string, unknown>
    return route.fulfill({ json: { ...real, ...writes.sections } })
  })
  await page.route('**/api/stats', async (route) => {
    const real = (await (await route.fetch()).json()) as { id: string; value: number; suffix: string }[]
    const setting = (id: string, part: string) => writes.settings[`stat_${id}_${part}`]
    return route.fulfill({ json: real.map((stat) => ({ ...stat, value: setting(stat.id, 'value') ?? stat.value, suffix: setting(stat.id, 'suffix') ?? stat.suffix })) })
  })
  await page.route('**/api/contact', async (route) => {
    const real = (await (await route.fetch()).json()) as Record<string, string>
    return route.fulfill({ json: Object.fromEntries(Object.entries(real).map(([field, value]) => [field, writes.settings[`contact_${field}`] ?? value])) })
  })
  return writes
}

/**
 * Signs in as staff, opens the home page and turns one section's edit mode on.
 * @param page - The Playwright page.
 * @param section - The section (see SECTIONS).
 * @param path - The home page in a language, "/" or "/en".
 * @returns The section.
 */
async function editSection(page: Page, section: (typeof SECTIONS)[number], path: '/' | '/en' = '/en') {
  await signInStaff(page)
  await page.goto(path)
  const element = page.locator(`#${section.id}`)
  await scrollIntoViewSettled(element)
  const name = path === '/en' ? `Edit on page: ${section.en}` : `עריכה בעמוד: ${section.he}`
  await element.getByRole('button', { name }).click()
  await expect(element.getByRole('textbox').first()).toBeFocused()
  return element
}

test('the sections have no edit buttons for visitors', async ({ page }) => {
  await page.goto('/en')
  await page.locator('#contact').waitFor()
  await expect(page.getByRole('button', { name: /^Edit on page/ })).toHaveCount(0)
})

for (const section of SECTIONS) {
  test(`${section.id}: edit mode is accessible and fits the window, also on a phone`, async ({ page }) => {
    await fakeWrites(page)
    const element = await editSection(page, section)
    const axe = await new AxeBuilder({ page }).include(`#${section.id}`).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
    /** The page's horizontal overflow in pixels. */
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(await overflow(), 'no horizontal scrolling in edit mode').toBe(0)
    await page.setViewportSize({ width: 360, height: 800 })
    await expect(element.getByRole('button', { name: 'Save' })).toBeVisible()
    expect(await overflow(), 'no horizontal scrolling in edit mode at 360px').toBe(0)
    await element.getByRole('button', { name: 'Cancel' }).click()
    // Edit mode is over (the Contact section keeps the message form's own fields).
    await expect(element.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
    await expect(element.getByRole('button', { name: `Edit on page: ${section.en}` })).toBeFocused()
  })

  for (const path of ['/', '/en'] as const) {
    const language = path === '/' ? 'he' : 'en'
    test(`${section.id}: screenshot in edit mode (${language})`, async ({ page }) => {
      await fakeWrites(page)
      const element = await editSection(page, section, path)
      await hideFixedOverlays(page)
      // The sticky Save bar would land wherever the capture's scrolling stops (see faq-editor.spec.ts).
      await page.addStyleTag({ content: `#${section.id} .sticky { position: static !important; }` })
      await page.mouse.move(0, 0)
      await expect(element).toHaveScreenshot(`home-editor-${section.id}-${language}.png`)
    })
  }
}

test('About: staff change texts and save them in the page language', async ({ page }) => {
  const writes = await fakeWrites(page)
  const about = await editSection(page, SECTIONS[3])
  await about.getByRole('textbox', { name: 'Title', exact: true }).fill('Who we are')
  await about.getByRole('textbox', { name: 'Text: Professional expertise' }).fill('Decades of know-how.')
  await about.getByRole('button', { name: 'Save' }).click()

  await expect(about.getByRole('heading', { level: 2, name: 'Who we are' })).toBeVisible()
  await expect(about.getByText('Decades of know-how.')).toBeVisible()
  await expect(about.getByRole('button', { name: 'Edit on page: About Ultra Pet' })).toBeFocused()
  const content = writes.sections.about as Record<string, { text: Record<string, string> }>
  expect(content.title.text.en).toBe('Who we are')
  expect(content['pillar.expertise.text'].text.en).toBe('Decades of know-how.')
})

test('Stats: staff change a number, which goes to the settings', async ({ page }) => {
  const writes = await fakeWrites(page)
  const stats = await editSection(page, SECTIONS[0])
  await stats.getByRole('textbox', { name: 'Number: Retail locations' }).fill('375')
  await stats.getByRole('button', { name: 'Save' }).click()
  await expect(stats.getByText('375+', { exact: true }).first()).toBeVisible()
  expect(writes.settings).toEqual({ stat_retail_value: 375 })
})

test('Contact: staff change the phone; the card links to the new number', async ({ page }) => {
  const writes = await fakeWrites(page)
  const contact = await editSection(page, SECTIONS[4])
  await contact.getByRole('textbox', { name: 'Phone number' }).fill('03-555-1234')
  await contact.getByRole('button', { name: 'Save' }).click()
  await expect(contact.getByRole('link', { name: /03-555-1234/ })).toHaveAttribute('href', 'tel:035551234')
  expect(writes.settings).toEqual({ contact_phone: '03-555-1234' })
})
