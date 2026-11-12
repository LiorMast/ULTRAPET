/**
 * faq-editor.spec.ts — End-to-end checks of the staff's in-place editing of the FAQ questions in real Chromium: the
 * edit button for signed-in staff only; edit mode (axe, no horizontal overflow, Save and Cancel kept in reach below
 * the header while scrolling the list, screenshots in Hebrew and English); and one save of the whole list after
 * changing, adding (the plus button) and deleting questions.
 *
 * The FAQ list (GET /api/faq), the staff save (PUT /api/staff/faq-items) and the save of the section's texts
 * (/api/staff/page-sections, read back through GET /api/sections) are answered in the browser (page.route),
 * starting from the seed's questions (src/stubs/faq.json), so these tests never change the shared dev database that
 * the other specs' screenshots read. The real save path is covered by the backend tests (test_staff_api.py).
 */
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { hideFixedOverlays, scrollIntoViewSettled, signInStaff } from './utils.ts'

/** A question as the API serves it. */
type Question = { id: string; question: Record<string, string>; answer: Record<string, string> }

/** The seed's questions, with ids, as the API serves them. */
const SEEDED: Question[] = (JSON.parse(readFileSync(new URL('../src/stubs/faq.json', import.meta.url), 'utf8')) as Omit<Question, 'id'>[]).map((item, i) => ({ id: `q${i + 1}`, ...item }))

/**
 * Answers the FAQ's API in the browser: GET /api/faq from memory and the staff PUT, which replaces the list in memory
 * (new questions get an id) the way the server does.
 * @param page - The Playwright page, before it loads the home page.
 * @returns The bodies the page sent to the staff PUT, oldest first.
 */
async function fakeFaq(page: Page) {
  let items = SEEDED
  const sent: { id?: string; question: Record<string, string>; answer: Record<string, string> }[][] = []
  await page.route('**/api/faq', (route) => route.fulfill({ json: items }))
  await page.route('**/api/staff/faq-items', (route) => {
    const body = route.request().postDataJSON() as (typeof sent)[number]
    sent.push(body)
    items = body.map((item, i) => ({ id: item.id ?? `new${i}`, question: item.question, answer: item.answer }))
    return route.fulfill({ json: items.map((item, i) => ({ ...item, sortOrder: i })) })
  })
  // The section's own texts (heading, contact box) are saved after the list: answered in memory too.
  let texts: Record<string, unknown> | null = null
  await page.route('**/api/staff/page-sections**', (route) => {
    texts = (route.request().postDataJSON() as { content: Record<string, unknown> }).content
    return route.fulfill({ json: { key: 'faq', content: texts } })
  })
  await page.route('**/api/sections', async (route) => {
    const real = (await (await route.fetch()).json()) as Record<string, unknown>
    return route.fulfill({ json: texts ? { ...real, faq: texts } : real })
  })
  return sent
}

/**
 * Signs in as staff, opens the home page and turns the FAQ's edit mode on.
 * @param page - The Playwright page.
 * @param path - The home page in a language, "/" or "/en".
 * @returns The FAQ section.
 */
async function editFaq(page: Page, path = '/en') {
  await signInStaff(page)
  await page.goto(path)
  const faq = page.locator('#faq')
  await scrollIntoViewSettled(faq)
  await faq.getByRole('button', { name: path === '/en' ? 'Edit on page: FAQ' : 'עריכה בעמוד: שאלות נפוצות' }).click()
  // The first question's box gets the focus (the heading's boxes come before it in the page).
  await expect(faq.getByRole('textbox', { name: path === '/en' ? 'Question 1' : 'שאלה 1' })).toBeFocused()
  return faq
}

test('the FAQ edit button is for staff only', async ({ page }) => {
  await page.goto('/en')
  const faq = page.locator('#faq')
  await scrollIntoViewSettled(faq)
  await expect(faq.getByRole('button', { name: 'Do you sell to private customers?' })).toBeVisible()
  await expect(faq.getByRole('button', { name: 'Edit on page' })).toHaveCount(0)
})

test('staff change, add and delete questions and save the list at once', async ({ page }) => {
  const sent = await fakeFaq(page)
  const faq = await editFaq(page)

  const axe = await new AxeBuilder({ page }).include('#faq').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'no horizontal scrolling in edit mode').toBe(0)

  await faq.getByRole('textbox', { name: 'Question 1' }).fill('Do you sell to the public?')
  await faq.getByRole('button', { name: 'Add a question' }).click()
  const added = faq.getByRole('textbox', { name: `Question ${SEEDED.length + 1}` })
  await expect(added).toBeFocused()
  await added.fill('Do you ship abroad?')
  await faq.getByRole('textbox', { name: `Answer ${SEEDED.length + 1}` }).fill('No, within Israel only.')
  await faq.getByRole('button', { name: 'Delete Question 2' }).click()
  await expect(faq.getByRole('textbox', { name: 'Question 2' })).toHaveValue('Where can I see the prices?')
  await expect(faq.getByRole('textbox', { name: 'Question 2' })).toBeFocused()
  await faq.getByRole('button', { name: 'Save' }).click()

  await expect(faq.getByRole('button', { name: 'Do you ship abroad?' })).toBeVisible()
  await expect(faq.getByRole('textbox')).toHaveCount(0)
  await expect(faq.getByRole('button', { name: 'Edit on page: FAQ' })).toBeFocused()
  expect(sent).toHaveLength(1)
  expect(sent[0].map((item) => item.id)).toEqual(['q1', ...SEEDED.slice(2).map((item) => item.id), undefined])
  expect(sent[0][0].question).toEqual({ he: SEEDED[0].question.he, en: 'Do you sell to the public?' })
  expect(sent[0].at(-1)).toEqual({ question: { en: 'Do you ship abroad?' }, answer: { en: 'No, within Israel only.' } })
})

test('Save and Cancel stay in reach below the header while editing a long list', async ({ page }) => {
  await fakeFaq(page)
  const faq = await editFaq(page)
  await faq.getByRole('button', { name: 'Add a question' }).scrollIntoViewIfNeeded()
  const header = (await page.getByRole('banner').boundingBox())!
  const save = (await faq.getByRole('button', { name: 'Save' }).boundingBox())!
  expect(save.y, 'Save sits below the header').toBeGreaterThanOrEqual(header.y + header.height)
  expect(save.y + save.height, 'Save is inside the window').toBeLessThanOrEqual(page.viewportSize()!.height)
  await expect(faq.getByRole('button', { name: 'Cancel' })).toBeInViewport()
})

for (const [name, path] of [['he', '/'], ['en', '/en']] as const) {
  test(`screenshot in edit mode (${name})`, async ({ page }) => {
    await fakeFaq(page)
    const faq = await editFaq(page, path)
    await hideFixedOverlays(page)
    // The sticky Save bar (and the desktop's sticky heading) would land wherever the capture's scrolling stops, like
    // the fixed overlays; the test above checks the sticking, so here they keep their place in the layout.
    await page.addStyleTag({ content: '#faq .sticky, #faq .lg\\:sticky { position: static !important; }' })
    // Save takes the place of the clicked "Edit on page": move the mouse away so it is not shown hovered.
    await page.mouse.move(0, 0)
    // The first question stays focused (its box has the solid frame); the screenshot hides the caret.
    await expect(faq).toHaveScreenshot(`faq-editor-${name}.png`)
  })
}
