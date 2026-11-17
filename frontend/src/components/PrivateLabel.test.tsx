/**
 * PrivateLabel.test.tsx — Tests for the home page's Private Label section: the heading and the five built-in steps in
 * order, numbered, in both languages, with the call to action and the link to /private-label; a step without a title in
 * the page language hidden; and the staff's in-place editing: change, add (with an icon), move and delete steps and save
 * them at once (both page_sections rows), a description without a title refused, Cancel, and mergeSteps.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FlowStep, FlowStepsContent } from '@/api'
import { mergeSteps, PrivateLabel } from '@/components/PrivateLabel'
import { en } from '@/i18n/en'
import { signInFakeUser, TEST_STAFF } from '@/test/api'
import { renderComponent, renderPage } from '@/test/utils'

/** The Private Label section of the rendered page. */
const section = () => within(document.getElementById('private-label')!)

/** The titles of the shown steps, in order. */
const stepTitles = () => section().getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)

/** A text of the editor's draft (step texts have no font or size of their own). */
const plain = (text: string) => ({ text, font: 'default' as const, size: 'md' as const })

describe('Private Label section', () => {
  it('shows the heading and the five steps in order, numbered, with its links (Hebrew)', async () => {
    await renderPage('/')
    expect(section().getByRole('heading', { level: 2, name: 'המותג שלכם. המומחיות שלנו.' })).toBeInTheDocument()
    const list = section().getByRole('list', { name: 'שלבי פרויקט תווית פרטית' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(stepTitles()).toEqual(['רעיון', 'גרפיקה', 'פיתוח', 'ייצור', 'שילוח'])
    expect(section().getByText('גיבוש קונספט ואפיון המוצר בהתאם לצרכים וליעדי השוק')).toBeInTheDocument()
    expect([...list.querySelectorAll('[data-flowchart-ordinal]')].map((node) => node.textContent)).toEqual(['01', '02', '03', '04', '05'])
    expect(section().getByRole('link', { name: 'התחילו פרויקט תווית פרטית' })).toHaveAttribute('href', '/#contact')
    expect(section().getByRole('link', { name: 'עוד על תווית פרטית' })).toHaveAttribute('href', '/private-label')
    expect(section().queryByRole('button', { name: /^עריכה בעמוד/ })).not.toBeInTheDocument()
  })

  it('shows the English texts and links on /en', async () => {
    await renderPage('/en')
    expect(section().getByRole('heading', { level: 2, name: 'Your brand. Our expertise.' })).toBeInTheDocument()
    expect(stepTitles()).toEqual(['Idea', 'Design', 'Development', 'Production', 'Shipping'])
    expect(section().getByRole('link', { name: 'More about private label' })).toHaveAttribute('href', '/en/private-label')
  })

  it('shows a step only in the languages that have its title; a built-in step falls back to the dictionary', async () => {
    const steps: FlowStep[] = [
      { id: 'idea', icon: 'lightbulb', title: { he: 'רעיון חדש' } },
      { id: 'x', icon: 'unknown', title: { he: 'רק בעברית' }, text: { he: 'טקסט' } },
      { id: 'y', icon: 'truck', title: { en: 'Aftercare' } },
    ]
    renderComponent(<PrivateLabel steps={steps} />, 'en')
    await screen.findByRole('list')
    expect(stepTitles()).toEqual(['Idea', 'Aftercare'])
  })
})

describe('Private Label in-place editing', () => {
  it('staff change, add, move and delete steps and save them at once', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    await user.click(section().getByRole('button', { name: 'Edit on page: Private label' }))

    expect(section().getAllByRole('textbox', { name: /^Step \d+ title$/ })).toHaveLength(5)
    expect(section().getByRole('textbox', { name: 'Step 1 title' })).toHaveValue('Idea')
    // Pasted, not typed: every keystroke re-renders the whole home page.
    await user.clear(section().getByRole('textbox', { name: 'Step 1 title' }))
    await user.paste('Concept')

    await user.click(section().getByRole('button', { name: 'Add a step' }))
    expect(section().getByRole('textbox', { name: 'Step 6 title' })).toHaveFocus()
    await user.paste('Aftercare')
    await user.selectOptions(section().getByRole('combobox', { name: 'Icon of step 6' }), 'Truck')

    // Moving keeps the focus on the button that moved the step.
    await user.click(section().getByRole('button', { name: 'Move step 6 earlier' }))
    expect(section().getByRole('textbox', { name: 'Step 5 title' })).toHaveValue('Aftercare')
    await waitFor(() => expect(section().getByRole('button', { name: 'Move step 5 earlier' })).toHaveFocus())
    expect(section().getByRole('button', { name: 'Move step 1 earlier' })).toBeDisabled()

    await user.click(section().getByRole('button', { name: 'Delete Step 2' }))
    expect(section().getByRole('textbox', { name: 'Step 2 title' })).toHaveValue('Development')

    await user.click(section().getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(stepTitles()).toEqual(['Concept', 'Development', 'Production', 'Aftercare', 'Shipping']))
    expect(section().queryByRole('textbox')).not.toBeInTheDocument()

    const saved = (await (await fetch('/api/sections')).json()) as Record<string, FlowStepsContent>
    const steps = saved.private_label_steps.steps!
    expect(steps.map((step) => step.id).slice(0, 3)).toEqual(['idea', 'development', 'production'])
    expect(steps[0].title).toEqual({ en: 'Concept' })
    expect(steps[3]).toMatchObject({ icon: 'truck', title: { en: 'Aftercare' } })
    expect(steps[3].title!.he).toBeUndefined()
    expect(saved.private_label).toBeDefined()
  })

  it('refuses a step with a description but no title and focuses its title box', async () => {
    const onSave = vi.fn()
    const { user } = renderComponent(<PrivateLabel onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page: Private label' }))
    await user.click(screen.getByRole('button', { name: 'Add a step' }))
    await user.click(screen.getByRole('textbox', { name: 'Step 6 description' }))
    await user.paste('No title')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(en.privateLabel.edit.missingTitle)
    expect(screen.getByRole('textbox', { name: 'Step 6 title' })).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows a step’s picture instead of its icon, and staff upload, replace and remove pictures', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const steps: FlowStep[] = [
      { id: 'idea', icon: 'lightbulb', image: 'private-label/a.webp', imageUrl: '/api/media/private-label/a.webp' },
      { id: 'design', icon: 'palette' },
    ]
    const { user } = renderComponent(<PrivateLabel steps={steps} onSave={onSave} />, 'en')
    const list = await screen.findByRole('list')
    expect(list.querySelector('[data-flowchart-card] img')).toHaveAttribute('src', '/api/media/private-label/a.webp')
    expect(list.querySelectorAll('[data-flowchart-card] img')).toHaveLength(1)

    signInFakeUser(TEST_STAFF)
    await user.click(screen.getByRole('button', { name: 'Edit on page: Private label' }))
    await user.click(screen.getByRole('button', { name: 'Remove picture: Step 1' }))
    const file = new File(['png'], 'b.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Upload picture: Step 2', { selector: 'input' }), file)
    expect(await screen.findByRole('img', { name: 'Current picture: Step 2' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const [saved] = onSave.mock.calls[0] as [FlowStep[]]
    expect(saved[0].image).toBeUndefined()
    expect(saved[1].image).toMatch(/^private-label\/fake-\d+\.png$/)
    expect(saved.every((step) => step.imageUrl === undefined)).toBe(true)
  })

  it('throws the changes away on Cancel', async () => {
    const onSave = vi.fn()
    const { user } = renderComponent(<PrivateLabel onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page: Private label' }))
    await user.click(screen.getByRole('button', { name: 'Delete Step 1' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(stepTitles()).toEqual(['Idea', 'Design', 'Development', 'Production', 'Shipping'])
    expect(onSave).not.toHaveBeenCalled()
  })

  it('merges one language into the steps: other languages kept, new steps get an id, untitled new ones dropped', () => {
    const saved: FlowStep[] = [
      { id: 'idea', icon: 'lightbulb', image: 'private-label/old.webp', imageUrl: '/api/media/private-label/old.webp' },
      { id: 'x', icon: 'truck', image: 'private-label/x.webp', title: { he: 'שלב', en: 'Step' }, text: { he: 'טקסט' } },
    ]
    const draft = {
      'x:title': plain(' Step 2 '),
      'x:text': plain('Text'),
      'idea:title': plain(''),
      'idea:text': plain(''),
      'new-1:title': plain('New'),
      'new-1:text': plain(''),
      'new-2:title': plain(''),
      'new-2:text': plain(''),
    }
    // The idea step's picture was removed (null), x keeps its own (left out), the new step got one; no imageUrl is saved.
    const pictures = { idea: null, 'new-1': { key: 'private-label/new.png', url: '/api/media/private-label/new.png' } }
    expect(mergeSteps(saved, 'en', draft, { 'new-1': 'globe' }, pictures, en, () => 'made')).toEqual([
      { id: 'x', icon: 'truck', image: 'private-label/x.webp', title: { he: 'שלב', en: 'Step 2' }, text: { he: 'טקסט', en: 'Text' } },
      { id: 'idea', icon: 'lightbulb', title: {}, text: {} },
      { id: 'made', icon: 'globe', image: 'private-label/new.png', title: { en: 'New' }, text: {} },
    ])
  })
})
