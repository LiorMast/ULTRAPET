/**
 * button.test.tsx — Tests for the Button primitive's waiting state (ui/button.tsx `loading`): the spinner shows, the
 * name and focus stay, clicks and Enter-in-the-form send nothing until it finishes, and buttons without `loading`
 * render their children as they are.
 */
import { useState } from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import { renderComponent } from '@/test/utils'

/**
 * A form whose Save waits on a "server" until the test resolves it, like the admin dialogs.
 * @param props.send - Spy standing for the server call; resolves when the test says so.
 * @returns The form with a text field and the Save button.
 */
function SaveForm({ send }: { send: () => Promise<void> }) {
  const [pending, setPending] = useState(false)
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        await send()
        setPending(false)
      }}
    >
      <label htmlFor="name">Name</label>
      <input id="name" />
      <Button type="submit" loading={pending}>
        Save
      </Button>
    </form>
  )
}

/**
 * A server call the test finishes by hand.
 * @returns The spy and a function that resolves every pending call.
 */
function deferredSend() {
  let finish = () => {}
  const send = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
  return { send, finish: () => finish() }
}

describe('Button loading', () => {
  it('shows the spinner, keeps the name and the focus, and ignores clicks while it waits', async () => {
    const { send, finish } = deferredSend()
    const { user } = renderComponent(<SaveForm send={send} />, 'en')
    const save = await screen.findByRole('button', { name: 'Save' })
    expect(save).not.toHaveAttribute('aria-busy')
    // An idle button has no ring (no endless animation running unseen).
    expect(save.querySelector('[data-slot="spinner"]')).toBeNull()

    await user.click(save)
    expect(send).toHaveBeenCalledTimes(1)
    expect(save).toHaveAttribute('aria-busy', 'true')
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(save).toHaveAttribute('data-loading')
    expect(save.querySelector('[data-slot="spinner"]')).not.toBeNull()
    expect(save).not.toBeDisabled()
    expect(save).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Save' })).toBe(save)

    await user.click(save)
    await user.click(save)
    expect(send).toHaveBeenCalledTimes(1)

    finish()
    await vi.waitFor(() => expect(save).not.toHaveAttribute('aria-busy'))
    expect(save).not.toHaveAttribute('aria-disabled')
    expect(save.querySelector('[data-slot="spinner"]')).toBeNull()
    await user.click(save)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('ignores Enter in a field of the form while it waits', async () => {
    const { send } = deferredSend()
    const { user } = renderComponent(<SaveForm send={send} />, 'en')
    await user.type(await screen.findByLabelText('Name'), 'Shop{Enter}')
    expect(send).toHaveBeenCalledTimes(1)
    await user.type(screen.getByLabelText('Name'), '{Enter}{Enter}')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('renders a plain button when loading is not given, and passes clicks through', async () => {
    const onClick = vi.fn()
    const { user } = renderComponent(<Button onClick={onClick}>Open</Button>, 'en')
    const open = await screen.findByRole('button', { name: 'Open' })
    expect(open.querySelector('[data-slot="spinner"]')).toBeNull()
    expect(open).not.toHaveAttribute('aria-busy')
    await user.click(open)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('keeps a caller-given aria-disabled when not loading', async () => {
    renderComponent(<Button loading={false} aria-disabled>Later</Button>, 'en')
    expect(await screen.findByRole('button', { name: 'Later' })).toHaveAttribute('aria-disabled', 'true')
  })
})
