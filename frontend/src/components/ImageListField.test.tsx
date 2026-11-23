/**
 * ImageListField.test.tsx — Tests for the photo list field (ImageListField, the "images" column type of
 * DataTable/RecordDialog) on the real /admin/products page against the fake staff API (src/test/api.ts): the main
 * photo in the table, uploading several photos (each with its thumbnail), moving and removing them with the focus kept
 * in place, the whole list saved in order, the type and size checks before sending, the server's refusal, Save held
 * while files upload, a new product without photos, and the Hebrew labels.
 */
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import products from '@/stubs/products.json'
import { fakeFetch, holdRequests, TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The product the tests edit (the first in the catalog order, so its row is on the table's first page). */
const product = products[0]

/** Its photo as the staff API answers it (the stub stores object keys; the API answers /api/media/ URLs). */
const stubPhoto = `/api/media/${product.images[0].src}`
const stubThumbnail = `/api/media/${product.images[0].thumbnail}`

/**
 * A tiny picture file (the fake checks the file's type, not its bytes).
 * @param name - The file name.
 * @param type - Its media type.
 * @param size - Its size in bytes.
 * @returns The file.
 */
const picture = (name = 'photo.png', type = 'image/png', size = 64) => new File([new Uint8Array(size)], name, { type })

/**
 * Opens the edit form of the test product on /en/admin/products.
 * @param options.user - A user-event instance of the test's own (e.g. one that ignores `accept`); default renderPage's.
 * @returns The dialog, its photo group, the file input and the user-event instance.
 */
async function openEditForm({ user: own }: { user?: ReturnType<typeof userEvent.setup> } = {}) {
  const page = await renderPage('/en/admin/products', { staff: TEST_STAFF })
  const user = own ?? page.user
  await user.click(screen.getByRole('button', { name: `Edit ${product.name.en}` }))
  const dialog = await screen.findByRole('dialog', { name: `Edit ${product.name.en}` })
  const photos = within(dialog).getByRole('group', { name: 'Photos' })
  const fileInput = photos.querySelector<HTMLInputElement>('input[type="file"]')!
  return { dialog, photos, fileInput, user }
}

describe('ImageListField on /admin/products', () => {
  it('shows the main photo in the table and the photo list in the form', async () => {
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    const row = screen.getByRole('row', { name: new RegExp(product.name.en) })
    expect(row.querySelector('img')).toHaveAttribute('src', stubThumbnail)
    await user.click(within(row).getByRole('button', { name: `Edit ${product.name.en}` }))
    const photos = within(await screen.findByRole('dialog')).getByRole('group', { name: 'Photos' })
    expect(within(photos).getByRole('img', { name: 'Photo 1' })).toHaveAttribute('src', stubThumbnail)
    expect(within(photos).getByText('Main photo')).toBeInTheDocument()
    expect(within(photos).getByText(/The first photo is the main one/)).toBeInTheDocument()
    expect(within(photos).getByRole('button', { name: 'Move photo 1 earlier' })).toBeDisabled()
    expect(within(photos).getByRole('button', { name: 'Move photo 1 later' })).toBeDisabled()
    // Pictures come only from uploads: no address input.
    expect(within(photos).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('uploads several photos, reorders and removes them, and saves the list in order', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { dialog, photos, fileInput, user } = await openEditForm()
    await user.upload(fileInput, [picture('a.png'), picture('b.jpg', 'image/jpeg')])
    expect(await within(photos).findByText('Photos uploaded. Save to keep them.')).toBeInTheDocument()
    expect(within(photos).getByRole('img', { name: 'Photo 2' })).toHaveAttribute('src', '/api/media/products/fake-1-thumb.webp')
    expect(within(photos).getByRole('img', { name: 'Photo 3' })).toHaveAttribute('src', '/api/media/products/fake-2-thumb.webp')
    const uploads = fetchSpy.mock.calls.filter(([url]) => url === '/api/staff/uploads')
    expect(uploads.map(([, init]) => (init!.body as FormData).get('folder'))).toEqual(['products', 'products'])

    // The last photo moves to the front: the focus follows it, and its "earlier" button disables at the start.
    await user.click(within(photos).getByRole('button', { name: 'Move photo 3 earlier' }))
    expect(within(photos).getByRole('button', { name: 'Move photo 2 earlier' })).toHaveFocus()
    expect(within(photos).getByRole('status')).toHaveTextContent('Photo moved to place 2.')
    await user.click(within(photos).getByRole('button', { name: 'Move photo 2 earlier' }))
    expect(within(photos).getByRole('button', { name: 'Move photo 1 later' })).toHaveFocus()
    expect(within(photos).getByRole('img', { name: 'Photo 1' })).toHaveAttribute('src', '/api/media/products/fake-2-thumb.webp')

    // Removing the old photo (now second) moves the focus to the Remove button of the photo now in its place.
    expect(within(photos).getByRole('img', { name: 'Photo 2' })).toHaveAttribute('src', stubThumbnail)
    await user.click(within(photos).getByRole('button', { name: 'Remove photo 2' }))
    expect(within(photos).getByRole('button', { name: 'Remove photo 2' })).toHaveFocus()
    expect(within(photos).getByRole('img', { name: 'Photo 2' })).toHaveAttribute('src', '/api/media/products/fake-1-thumb.webp')
    expect(within(photos).getByText('Photo removed. Save to keep the change.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    const patch = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(String(patch[1]?.body))).toEqual({
      images: [
        { url: '/api/media/products/fake-2.jpg', thumbnailUrl: '/api/media/products/fake-2-thumb.webp', srcset: null, alt: null },
        { url: '/api/media/products/fake-1.png', thumbnailUrl: '/api/media/products/fake-1-thumb.webp', srcset: null, alt: null },
      ],
    })
    const row = screen.getByRole('row', { name: new RegExp(product.name.en) })
    expect(row.querySelector('img')).toHaveAttribute('src', '/api/media/products/fake-2-thumb.webp')
  })

  it('keeps the srcset and alt text of the photos already there', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { dialog, fileInput, user } = await openEditForm()
    await user.upload(fileInput, picture())
    await screen.findByText('Photos uploaded. Save to keep them.')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await screen.findByText('Changes saved.')
    const patch = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    const [kept] = JSON.parse(String(patch[1]?.body)).images
    expect(kept).toMatchObject({ url: stubPhoto, thumbnailUrl: stubThumbnail, alt: product.images[0].alt })
  })

  it('removing the only photo moves the focus to "Add photos"', async () => {
    const { photos, user } = await openEditForm()
    await user.click(within(photos).getByRole('button', { name: 'Remove photo 1' }))
    expect(within(photos).getByText('No photos yet.')).toBeInTheDocument()
    expect(within(photos).getByRole('button', { name: 'Add photos' })).toHaveFocus()
  })

  it('refuses a file that is not a picture or is over 5 MB, and uploads the others', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { photos, fileInput, user } = await openEditForm({ user: userEvent.setup({ applyAccept: false }) })
    await user.upload(fileInput, new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    expect(await within(photos).findByRole('alert')).toHaveTextContent('Choose a JPEG, PNG, WebP or AVIF picture.')
    expect(fetchSpy.mock.calls.some(([url]) => url === '/api/staff/uploads')).toBe(false)
    await user.upload(fileInput, [picture('huge.png', 'image/png', 5 * 1024 * 1024 + 1), picture('ok.png')])
    expect(await within(photos).findByRole('alert')).toHaveTextContent('The file is larger than 5 MB.')
    expect(within(photos).getByRole('button', { name: 'Add photos' })).toHaveAccessibleDescription(/larger than 5 MB/)
    expect(await within(photos).findByRole('img', { name: 'Photo 2' })).toBeInTheDocument()
    expect(fetchSpy.mock.calls.filter(([url]) => url === '/api/staff/uploads')).toHaveLength(1)
  })

  it("shows the server's refusal", async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      input === '/api/staff/uploads' ? Promise.resolve(Response.json({ error: 'too_large', field: 'file' }, { status: 400 })) : fakeFetch(input, init),
    )
    const { photos, fileInput, user } = await openEditForm()
    await user.upload(fileInput, picture())
    expect(await within(photos).findByRole('alert')).toHaveTextContent('The file is larger than 5 MB.')
    expect(within(photos).queryByRole('img', { name: 'Photo 2' })).not.toBeInTheDocument()
  })

  it('holds Save while the files upload', async () => {
    const held = holdRequests((path, method) => path === '/api/staff/uploads' && method === 'POST')
    const { dialog, photos, fileInput, user } = await openEditForm()
    await user.upload(fileInput, picture())
    expect(await within(photos).findByText('Uploading photo 1 of 1…')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    const add = within(photos).getByRole('button', { name: 'Add photos' })
    expect(add).toHaveAttribute('aria-busy', 'true')
    expect(within(photos).getByRole('button', { name: 'Remove photo 1' })).toBeDisabled()
    held.release()
    expect(await within(photos).findByText('Photos uploaded. Save to keep them.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(held.calls).toEqual(['POST /api/staff/uploads'])
  })

  it('starts a new product without photos', async () => {
    const { user } = await renderPage('/en/admin/products', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const dialog = await screen.findByRole('dialog')
    const photos = within(dialog).getByRole('group', { name: 'Photos' })
    expect(within(photos).getByText('No photos yet.')).toBeInTheDocument()
  })

  it('has Hebrew labels', async () => {
    const { user } = await renderPage('/admin/products', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: `עריכה: ${product.name.he}` }))
    const dialog = await screen.findByRole('dialog')
    const photos = within(dialog).getByRole('group', { name: 'תמונות' })
    expect(within(photos).getByRole('button', { name: 'הוספת תמונות' })).toBeInTheDocument()
    expect(within(photos).getByText('תמונה ראשית')).toBeInTheDocument()
    expect(within(photos).getByRole('button', { name: 'הסרה: תמונה 1' })).toBeInTheDocument()
  })
})
