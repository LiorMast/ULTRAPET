/**
 * InlineEditor.test.tsx — Tests for the reusable inline editing (EditableText, PropBar, InlineEditBar,
 * useInlineDraft) on a small test section with two texts and an accent word that follows the heading's style: read
 * mode, edit mode (labelled boxes, one PropBar that follows the selected box, live font and size), one Save for
 * every text, Cancel and Escape, a refused save, where the keyboard focus goes, and moving the PropBar (drag and
 * arrow keys, kept inside its section). A second test section is a list (like the FAQ): adding and removing texts
 * and where the focus goes then, a refusal by the section itself (InlineEditError), the light bar named after its
 * section, and the wrapping one-line box. The body text is resizable: its width handle (drag and slider keys, also
 * right to left), the width saved with the draft and applied in read mode.
 */
import { fireEvent, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import { EditableText, InlineEditBar, InlineEditError, PropBar, useInlineDraft, type TextValue } from '@/components/InlineEditor'
import { renderComponent } from '@/test/utils'

/** The test section's texts as saved. */
const SAVED: Record<'heading' | 'accent' | 'body', TextValue> = {
  heading: { text: 'Hello', font: 'default', size: 'md' },
  accent: { text: 'World', font: 'default', size: 'md' },
  body: { text: 'Some words', font: 'default', size: 'md' },
}

/** The test section's text names. */
const LABELS = { heading: 'Heading', accent: 'Accent', body: 'Body' }

/** The size classes of the test section's texts. */
const SIZES = { sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl' }

/**
 * A minimal editable section, built the way a real section uses the pieces.
 * @param props.onSave - Receives the draft on Save.
 * @returns The section.
 */
function TestSection({ onSave }: { onSave: (draft: Record<'heading' | 'accent' | 'body', TextValue>) => Promise<unknown> }) {
  const inline = useInlineDraft<'heading' | 'accent' | 'body'>(onSave)
  const propBar = inline.propBar(LABELS)
  return (
    <section>
      <InlineEditBar {...inline.bar} onEdit={() => inline.start(SAVED)} />
      {propBar && <PropBar {...propBar} locale="en" />}
      <form {...inline.formProps}>
        <EditableText
          as="h2"
          value={inline.draft?.heading ?? SAVED.heading}
          editing={inline.editing}
          onChange={(change) => inline.change('heading', change)}
          selected={inline.active === 'heading'}
          onSelect={() => inline.select('heading')}
          label="Heading"
          locale="en"
          sizeClass={(size) => SIZES[size]}
          className="font-bold leading-tight"
          after={
            <EditableText
              as="span"
              value={inline.draft?.accent ?? SAVED.accent}
              editing={inline.editing}
              onChange={(change) => inline.change('accent', change)}
              onSelect={() => inline.select('heading')}
              label="Accent"
              locale="en"
              controls={false}
            />
          }
        />
        <EditableText
          value={inline.draft?.body ?? SAVED.body}
          editing={inline.editing}
          onChange={(change) => inline.change('body', change)}
          selected={inline.active === 'body'}
          onSelect={() => inline.select('body')}
          label="Body"
          locale="en"
          multiline
          placeholder="Built-in words"
          sizeClass={(size) => SIZES[size]}
          resizable
        />
      </form>
    </section>
  )
}

describe('inline editing', () => {
  it('shows the plain elements until editing starts', async () => {
    renderComponent(<TestSection onSave={vi.fn()} />, 'en')
    const heading = await screen.findByRole('heading', { level: 2, name: 'HelloWorld' })
    expect(heading).toHaveClass('text-base', 'font-bold', 'leading-tight')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('turns every text into a labelled box, with one style bar on the first text, focused', async () => {
    const { user } = renderComponent(<TestSection onSave={vi.fn()} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page' }))

    expect(screen.getAllByRole('toolbar')).toHaveLength(1)
    const bar = screen.getByRole('toolbar', { name: 'Text style' })
    expect(bar).toHaveTextContent('Editing: Heading')
    expect(screen.getByRole('textbox', { name: 'Heading' })).toHaveValue('Hello')
    expect(screen.getByRole('textbox', { name: 'Heading' })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Heading' })).toHaveAttribute('data-selected', 'true')
    expect(screen.getByRole('textbox', { name: 'Body' })).toHaveAttribute('placeholder', 'Built-in words')
    expect(screen.getByRole('combobox', { name: 'Heading font' })).toHaveValue('default')
    expect(screen.getByRole('combobox', { name: 'Heading size' })).toHaveValue('md')
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('switches the bar to the focused box and styles only the selected text', async () => {
    const { user } = renderComponent(<TestSection onSave={vi.fn()} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Heading font' }), 'Rubik')

    await user.click(screen.getByRole('textbox', { name: 'Body' }))
    expect(screen.getByRole('toolbar')).toHaveTextContent('Editing: Body')
    expect(screen.getByRole('textbox', { name: 'Body' })).toHaveAttribute('data-selected', 'true')
    expect(screen.getByRole('textbox', { name: 'Heading' })).toHaveAttribute('data-selected', 'false')
    // The bar shows the body's own values, not the heading's.
    expect(screen.getByRole('combobox', { name: 'Body font' })).toHaveValue('default')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Body size' }), 'Extra large')

    const heading = screen.getByRole('textbox', { name: 'Heading' }).parentElement!
    const body = screen.getByRole('textbox', { name: 'Body' }).parentElement!
    expect(heading.style.fontFamily).toContain('Rubik Variable')
    expect(heading).toHaveClass('text-base', 'font-bold', 'leading-tight')
    expect(body.style.fontFamily).toBe('')
    expect(body).toHaveClass('text-xl')
  })

  it('selects the owner of the style when a part without its own style gets the focus', async () => {
    const { user } = renderComponent(<TestSection onSave={vi.fn()} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page' }))
    await user.click(screen.getByRole('textbox', { name: 'Body' }))
    await user.click(screen.getByRole('textbox', { name: 'Accent' }))
    expect(screen.getByRole('toolbar')).toHaveTextContent('Editing: Heading')
  })

  it('moves the style bar by its grip, with the pointer or the arrow keys, and keeps it inside the section', async () => {
    // jsdom has no layout: the section is 800×600 at the window's corner, the bar 300×40 at (100, 100) plus its offset.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.tagName === 'SECTION') return DOMRect.fromRect({ x: 0, y: 0, width: 800, height: 600 })
      if (this.getAttribute('role') === 'toolbar') {
        const [x = 0, y = 0] = this.style.translate.split(' ').map((part) => Number.parseFloat(part) || 0)
        return DOMRect.fromRect({ x: 100 + x, y: 100 + y, width: 300, height: 40 })
      }
      return DOMRect.fromRect()
    })
    const { user } = renderComponent(<TestSection onSave={vi.fn()} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page' }))
    const bar = screen.getByRole('toolbar')
    const grip = screen.getByRole('button', { name: 'Move the style bar' })

    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: 110, clientY: 110 })
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 150, clientY: 140 })
    fireEvent.pointerUp(grip, { pointerId: 1 })
    expect(bar.style.translate).toBe('40px 30px')
    // Moving the pointer after the release does nothing.
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 300, clientY: 300 })
    expect(bar.style.translate).toBe('40px 30px')

    grip.focus()
    await user.keyboard('{ArrowLeft}{ArrowUp}')
    expect(bar.style.translate).toBe('30px 20px')
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(bar.style.translate).toBe('80px 20px')

    // Far past the section's edges: the bar stops at them (800 - 300 - 100 = 400, and -100).
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 5000, clientY: -5000 })
    fireEvent.pointerUp(grip, { pointerId: 1 })
    expect(bar.style.translate).toBe('400px -100px')
    // The texts are still edited through the moved bar.
    expect(screen.getByRole('combobox', { name: 'Heading font' })).toBeInTheDocument()
  })

  it('saves every text at once and returns the focus to the Edit button', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { user } = renderComponent(<TestSection onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page' }))
    await user.clear(screen.getByRole('textbox', { name: 'Heading' }))
    await user.type(screen.getByRole('textbox', { name: 'Heading' }), 'Welcome')
    await user.type(screen.getByRole('textbox', { name: 'Body' }), ' more')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Body size' }), 'Large')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith({
      heading: { text: 'Welcome', font: 'default', size: 'md' },
      accent: { text: 'World', font: 'default', size: 'md' },
      body: { text: 'Some words more', font: 'default', size: 'lg' },
    })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit on page' })).toHaveFocus()
    expect(screen.getByText('Changes saved.')).toHaveAttribute('role', 'status')
  })

  it('saves with Enter in a one-line box', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { user } = renderComponent(<TestSection onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page' }))
    await user.type(screen.getByRole('textbox', { name: 'Heading' }), '!{Enter}')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ heading: expect.objectContaining({ text: 'Hello!' }) }))
  })

  it('throws the changes away on Cancel and on Escape', async () => {
    const onSave = vi.fn()
    const { user } = renderComponent(<TestSection onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page' }))
    await user.type(screen.getByRole('textbox', { name: 'Heading' }), ' there')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { level: 2, name: 'HelloWorld' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit on page' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Edit on page' }))
    await user.type(screen.getByRole('textbox', { name: 'Body' }), ' gone')
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Body' }), { key: 'Escape' })
    expect(screen.getByText('Some words')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('stays in edit mode and says why when the save is refused', async () => {
    const onSave = vi.fn().mockRejectedValue(new ApiError(400, { error: 'invalid' }))
    const { user } = renderComponent(<TestSection onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    expect(screen.getByRole('textbox', { name: 'Heading' })).toBeInTheDocument()
  })
})

/**
 * A text of the list section.
 * @param text - The words.
 * @returns The value, in the site's font at the "md" size.
 */
const item = (text: string): TextValue => ({ text, font: 'default', size: 'md' })

/**
 * A minimal list section (like the FAQ): one wrapping text per entry, a Remove button on each and an Add button,
 * on a white background with a named edit bar.
 * @param props.onSave - Receives the draft on Save.
 * @returns The section.
 */
function TestList({ onSave }: { onSave: (draft: Record<string, TextValue>) => Promise<unknown> }) {
  const inline = useInlineDraft<string>(onSave)
  const added = useRef(0)
  const { draft } = inline
  const keys = draft ? Object.keys(draft) : []
  return (
    <section>
      <InlineEditBar {...inline.bar} label="List" tone="light" onEdit={() => inline.start({ a: item('First') })} />
      {draft && (
        <form {...inline.formProps}>
          {keys.map((key, i) => (
            <div key={key}>
              <EditableText
                wrap
                editing
                value={draft[key]}
                onChange={(change) => inline.change(key, change)}
                selected={inline.active === key}
                onSelect={() => inline.select(key)}
                label={`Item ${i + 1}`}
                locale="en"
              />
              <button type="button" onClick={() => inline.remove([key], keys[i + 1] ?? keys[i - 1])}>
                Remove item {i + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              added.current += 1
              inline.add({ [`new${added.current}`]: item('') })
            }}
          >
            Add
          </button>
        </form>
      )}
    </section>
  )
}

describe('resizing a text box', () => {
  it('drags or steps the width of a resizable box and saves it with the draft', async () => {
    // jsdom has no layout: the form (the box's parent) is 800px wide, the body box 400px.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.tagName === 'FORM' ? 800 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => DOMRect.fromRect({ width: 400 }))
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { user } = renderComponent(<TestSection onSave={onSave} />, 'en')
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Edit on page' }))

    // Only the resizable text has a handle; it starts at the full width.
    expect(screen.getAllByRole('slider')).toHaveLength(1)
    const handle = screen.getByRole('slider', { name: 'Width: Body' })
    expect(handle).toHaveAttribute('aria-valuenow', '100')
    const box = screen.getByRole('textbox', { name: 'Body' }).parentElement!

    // Dragging 200px towards the start: 400 - 200 = 200px of 800 = 25%.
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 500 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300 })
    fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(handle).toHaveAttribute('aria-valuenow', '25')
    expect(handle).toHaveAttribute('aria-valuetext', '25%')
    expect(box.style.inlineSize).toBe('25%')
    // Focusing the handle selects its text for the style bar.
    expect(screen.getByRole('toolbar')).toHaveTextContent('Editing: Body')
    // Far past the start edge: the narrowest width.
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 500 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: -5000 })
    fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(handle).toHaveAttribute('aria-valuenow', '20')

    // The slider keys: the inline-end arrow (right, left to right) widens, End = the full width (nothing stored).
    await user.keyboard('{ArrowRight}{ArrowUp}')
    expect(handle).toHaveAttribute('aria-valuenow', '30')
    await user.keyboard('{End}')
    expect(box.style.inlineSize).toBe('')
    await user.keyboard('{ArrowLeft}{ArrowDown}')
    expect(handle).toHaveAttribute('aria-valuenow', '90')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ body: { text: 'Some words', font: 'default', size: 'md', width: 90 } }))
  })

  it('applies a saved width in read mode, and widens with the left arrow right to left', async () => {
    const onChange = vi.fn()
    /**
     * One resizable text.
     * @param props.editing - Edit mode.
     * @returns The text inside a right-to-left block.
     */
    const Text = ({ editing }: { editing: boolean }) => (
      <div dir="rtl">
        <EditableText value={{ text: 'שלום', font: 'default', size: 'md', width: 60 }} editing={editing} onChange={onChange} label="Body" locale="he" resizable />
      </div>
    )
    const { user } = renderComponent(
      <>
        <Text editing={false} />
        <Text editing />
      </>,
      'en',
    )
    expect((await screen.findByText('שלום')).style.inlineSize).toBe('60%')
    expect(screen.getByRole('textbox', { name: 'Body' }).parentElement!.style.inlineSize).toBe('60%')
    screen.getByRole('slider', { name: 'Width: Body' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith({ width: 65 })
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith({ width: 55 })
  })
})

describe('inline editing of a list', () => {
  it('names the edit button after its section and gives a light section an outlined Cancel', async () => {
    const { user } = renderComponent(<TestList onSave={vi.fn()} />, 'en')
    const edit = await screen.findByRole('button', { name: 'Edit on page: List' })
    expect(edit).toHaveTextContent(/^Edit on page$/)
    await user.click(edit)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('data-variant', 'outline')
  })

  it('adds and removes texts, moving the focus with them, and saves them in list order', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { user } = renderComponent(<TestList onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page: List' }))

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('textbox', { name: 'Item 2' })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Item 2' })).toHaveAttribute('data-selected', 'true')
    await user.type(screen.getByRole('textbox', { name: 'Item 2' }), 'Second')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByRole('textbox', { name: 'Item 3' }), 'Third')

    // Removing the first entry focuses the next one, which is now the first.
    await user.click(screen.getByRole('button', { name: 'Remove item 1' }))
    expect(screen.getByRole('textbox', { name: 'Item 1' })).toHaveValue('Second')
    expect(screen.getByRole('textbox', { name: 'Item 1' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ new1: item('Second'), new2: item('Third') })
    expect(Object.keys(onSave.mock.calls[0][0])).toEqual(['new1', 'new2'])
  })

  it('focuses the first control when the last text is removed', async () => {
    const { user } = renderComponent(<TestList onSave={vi.fn()} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page: List' }))
    await user.click(screen.getByRole('button', { name: 'Remove item 1' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus()
  })

  it('shows the message of a refusal by the section and focuses the text it names', async () => {
    const onSave = vi.fn().mockRejectedValue(new InlineEditError('Fix the first item.', 'a'))
    const { user } = renderComponent(<TestList onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page: List' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Fix the first item.')
    expect(screen.getByRole('textbox', { name: 'Item 1' })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Item 1' })).toHaveAttribute('data-selected', 'true')
  })

  it('keeps a wrapping box on one line: pasted line breaks become spaces and Enter saves', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { user } = renderComponent(<TestList onSave={onSave} />, 'en')
    await user.click(await screen.findByRole('button', { name: 'Edit on page: List' }))
    const box = screen.getByRole('textbox', { name: 'Item 1' })
    expect(box.tagName).toBe('TEXTAREA')
    await user.clear(box)
    await user.paste('two\nlines')
    expect(box).toHaveValue('two lines')
    await user.keyboard('{Enter}')
    expect(onSave).toHaveBeenCalledWith({ a: item('two lines') })
  })
})
