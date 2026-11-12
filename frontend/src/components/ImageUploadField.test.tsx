/**
 * ImageUploadField.test.tsx — Tests for the picture upload field (ImageUploadField, the "image" column type of
 * DataTable/RecordDialog) on the real /admin/categories page against the fake staff API (src/test/api.ts): uploading
 * a category picture that then shows in the table and on the home page carousel, the type and size checks before
 * sending, the server's refusal, Save held while a file uploads, removing a picture, no address input (pictures come
 * only from uploads) with a refused value's error on the upload button, and the Hebrew labels.
 */
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fetchStaffRows, updateStaffRow } from '@/api'
import categories from '@/stubs/product-categories.json'
import { fakeFetch, signInFakeUser, TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The category the tests edit (the first in the stub, so its row is on the table's first page). */
const category = categories[0]

/** A tiny "PNG" (the fake checks the file's type, not its bytes). */
const png = (name = 'photo.png', size = 64) => new File([new Uint8Array(size)], name, { type: 'image/png' })

/**
 * Opens the edit form of the test category on /en/admin/categories.
 * @param options.user - A user-event instance of the test's own (e.g. one that ignores `accept`); default renderPage's.
 * @returns The dialog, its picture group, the file input and the user-event instance.
 */
async function openEditForm({ user: own }: { user?: ReturnType<typeof userEvent.setup> } = {}) {
  const page = await renderPage('/en/admin/categories', { staff: TEST_STAFF })
  const user = own ?? page.user
  await user.click(screen.getByRole('button', { name: `Edit ${category.name.en}` }))
  const dialog = await screen.findByRole('dialog', { name: `Edit ${category.name.en}` })
  const picture = within(dialog).getByRole('group', { name: 'Picture' })
  const fileInput = dialog.querySelector<HTMLInputElement>('input[type="file"]')!
  return { dialog, picture, fileInput, user }
}

/**
 * Gives the test category a picture through the fake staff API (as a saved form would).
 * @param imageUrl - The picture URL.
 */
async function setPicture(imageUrl: string) {
  signInFakeUser(TEST_STAFF)
  const rows = await fetchStaffRows<{ id: string; slug: string }>('categories')
  await updateStaffRow('categories', rows.find((row) => row.slug === category.slug)!.id, { imageUrl })
}

describe('ImageUploadField on /admin/categories', () => {
  it('uploads a picture, saves it, and the home page carousel shows it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { dialog, picture, fileInput, user } = await openEditForm()
    expect(within(picture).getByText('No picture')).toBeInTheDocument()
    expect(within(picture).getByText(/Shown on the home page categories carousel/)).toBeInTheDocument()

    await user.upload(fileInput, png())
    expect(await within(picture).findByText('Picture uploaded. Save to keep it.')).toBeInTheDocument()
    expect(within(picture).getByRole('img', { name: 'Current picture' })).toHaveAttribute('src', '/api/media/categories/fake-1.png')
    expect(within(picture).getByRole('button', { name: 'Replace picture' })).toBeInTheDocument()
    const upload = fetchSpy.mock.calls.find(([url]) => url === '/api/staff/uploads')!
    expect(upload[1]?.method).toBe('POST')
    expect(upload[1]?.body).toBeInstanceOf(FormData)

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    const patch = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(String(patch[1]?.body))).toEqual({ imageUrl: '/api/media/categories/fake-1.png' })
    const row = screen.getByRole('row', { name: new RegExp(category.name.en) })
    expect(row.querySelector('img')).toHaveAttribute('src', '/api/media/categories/fake-1.png')

    cleanup()
    await renderPage('/en')
    const card = within(document.getElementById('categories')!).getByRole('link', { name: category.name.en })
    expect(card.querySelector('img')).toHaveAttribute('src', '/api/media/categories/fake-1.png')
  })

  it('refuses a file that is not a picture or is over 5 MB, without sending it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    // A user-event that ignores the input's `accept`, as a browser does when "All files" is picked.
    const { picture, fileInput, user } = await openEditForm({ user: userEvent.setup({ applyAccept: false }) })
    await user.upload(fileInput, new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    expect(await within(picture).findByRole('alert')).toHaveTextContent('Choose a JPEG, PNG, WebP or AVIF picture.')
    await user.upload(fileInput, png('huge.png', 5 * 1024 * 1024 + 1))
    expect(await within(picture).findByRole('alert')).toHaveTextContent('The file is larger than 5 MB.')
    expect(within(picture).getByRole('button', { name: 'Upload picture' })).toHaveAccessibleDescription(/larger than 5 MB/)
    expect(fetchSpy.mock.calls.some(([url]) => url === '/api/staff/uploads')).toBe(false)
  })

  it("shows the server's refusal", async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      input === '/api/staff/uploads' ? Promise.resolve(Response.json({ error: 'unsupported_type', field: 'file' }, { status: 400 })) : fakeFetch(input, init),
    )
    const { picture, fileInput, user } = await openEditForm()
    await user.upload(fileInput, png())
    expect(await within(picture).findByRole('alert')).toHaveTextContent('Choose a JPEG, PNG, WebP or AVIF picture.')
    expect(within(picture).queryByRole('img')).not.toBeInTheDocument()
  })

  it('holds Save while the file uploads', async () => {
    let finish: (response: Response) => void = () => {}
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      input === '/api/staff/uploads' ? new Promise<Response>((resolve) => (finish = resolve)) : fakeFetch(input, init),
    )
    const { dialog, picture, fileInput, user } = await openEditForm()
    await user.upload(fileInput, png())
    expect(await within(picture).findByText('Uploading the picture…')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(within(picture).getByRole('button', { name: 'Upload picture' })).toBeDisabled()
    finish(Response.json({ key: 'categories/slow.png', url: '/api/media/categories/slow.png' }, { status: 201 }))
    expect(await within(picture).findByText('Picture uploaded. Save to keep it.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('removes a picture and saves the category without one', async () => {
    await setPicture('/api/media/categories/old.png')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { dialog, picture, user } = await openEditForm()
    expect(within(picture).getByRole('img', { name: 'Current picture' })).toHaveAttribute('src', '/api/media/categories/old.png')
    await user.click(within(picture).getByRole('button', { name: 'Remove picture' }))
    expect(within(picture).getByText('No picture')).toBeInTheDocument()
    expect(within(picture).getByText('Picture removed. Save to keep the change.')).toBeInTheDocument()
    expect(within(picture).getByRole('button', { name: 'Upload picture' })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    const patch = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(String(patch[1]?.body))).toEqual({ imageUrl: null })
  })

  it('has no address input: a picture can only be uploaded', async () => {
    const { picture } = await openEditForm()
    expect(within(picture).queryByRole('textbox')).not.toBeInTheDocument()
    expect(picture.querySelector('input:not([type="file"])')).toBeNull()
  })

  it("puts the server's refusal of the picture on the upload button", async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      init?.method === 'PATCH' ? Promise.resolve(Response.json({ error: 'invalid', field: 'imageUrl' }, { status: 400 })) : fakeFetch(input, init),
    )
    const { dialog, picture, fileInput, user } = await openEditForm()
    await user.upload(fileInput, png())
    await within(picture).findByText('Picture uploaded. Save to keep it.')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Invalid value')).toBeInTheDocument()
    const button = within(picture).getByRole('button', { name: 'Replace picture' })
    expect(button).toHaveAttribute('aria-invalid', 'true')
    expect(button).toHaveAccessibleDescription(/Invalid value/)
    expect(button).toHaveFocus()
  })

  it('keeps out a picture of another site (the fake API refuses it like the server)', async () => {
    signInFakeUser(TEST_STAFF)
    const rows = await fetchStaffRows<{ id: string; slug: string }>('categories')
    await expect(updateStaffRow('categories', rows[0].id, { imageUrl: 'https://example.com/birds.png' })).rejects.toMatchObject({ code: 'invalid', field: 'imageUrl' })
  })

  it('has Hebrew labels', async () => {
    const { user } = await renderPage('/admin/categories', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `עריכה: ${category.name.he}` }))
    const dialog = await screen.findByRole('dialog')
    const picture = within(dialog).getByRole('group', { name: 'תמונה' })
    expect(within(picture).getByRole('button', { name: 'העלאת תמונה' })).toBeInTheDocument()
    expect(within(picture).getByText('אין תמונה')).toBeInTheDocument()
  })
})
