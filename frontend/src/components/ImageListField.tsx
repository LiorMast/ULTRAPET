/**
 * ImageListField.tsx — Edits an ordered list of pictures by uploading files: a product's photo gallery in the admin
 * (RecordDialog, column type "images"). Each picture shows as a thumbnail with its place ("Photo 2"; the first is the
 * "Main photo") and Earlier / Later / Remove buttons; "Add photos" uploads one or more files (one after another) to the
 * server's file storage (uploadImage in src/api.ts: the local stub or S3) and appends them. Like ImageUploadField
 * (whose limits and messages it reuses) there is no address input: every picture comes from our storage.
 *
 * The value is the staff API's list ({ url, thumbnailUrl, srcset, alt }); pictures already there keep their srcset and
 * alt text, a new upload has its thumbnail (the server's small WebP copy) and no srcset or alt. The caller saves the
 * list with the rest of its form; while files upload, `onBusyChange(true)` lets the form hold its Save. Progress and
 * results are announced in a live region; after a move the focus stays on the moved picture's button, after a removal
 * it goes to the next picture's Remove button (or "Add photos").
 */
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ComponentProps } from 'react'
import { ArrowDown, ArrowUp, Trash2, Upload } from 'lucide-react'
import { uploadImage, type StaffProductImage, type UploadFolder } from '@/api'
import { MAX_UPLOAD_BYTES, UPLOAD_IMAGE_TYPES, uploadErrorMessage } from '@/components/ImageUploadField'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

/** Which button gets the focus after the list re-renders: a picture's move / remove button, or "Add photos". */
type FocusTarget = { index: number; control: 'earlier' | 'later' | 'remove' } | { index: -1; control: 'add' }

/** The props of ImageListField (see the component); the form's state attributes go to the "Add photos" button. */
type ImageListFieldProps = Pick<ComponentProps<'button'>, 'className' | 'disabled' | 'aria-invalid' | 'aria-describedby'> & {
  id: string
  value: StaffProductImage[]
  onChange: (images: StaffProductImage[]) => void
  folder: UploadFolder
  onBusyChange?: (busy: boolean) => void
}

/**
 * The picture list field.
 * @param props.id - The "Add photos" button's id (the form's error focus target).
 * @param props.value - The pictures in order; the first is the main one.
 * @param props.onChange - Called with the new list after an upload, a move or a removal.
 * @param props.folder - The storage folder the files go to, e.g. "products".
 * @param props.onBusyChange - Told true when uploads start and false when they end (the form disables Save).
 * @param props.className - Classes of the wrapper (outer spacing).
 * @param props.disabled - Read-only: no upload, move or removal.
 * @param props.aria-invalid - The form found the field wrong (set on the "Add photos" button).
 * @param props.aria-describedby - The ids of the form's hint and error (plus the field's own upload error).
 * @returns The list, the "Add photos" button and the status line.
 */
export function ImageListField({
  id,
  value,
  onChange,
  folder,
  onBusyChange,
  className,
  disabled,
  'aria-invalid': invalid,
  'aria-describedby': describedBy,
}: ImageListFieldProps) {
  const { t } = useI18n()
  const g = t.admin.gallery
  const list = useRef<HTMLOListElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  // The latest list: uploads append to it one by one while the parent re-renders between them.
  const latest = useRef(value)
  useLayoutEffect(() => {
    latest.current = value
  }, [value])
  const focusAfter = useRef<FocusTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [problem, setProblem] = useState('')
  const problemId = `${id}-upload-error`

  // Closing the form mid-upload drops the uploads.
  useEffect(() => () => controller.current?.abort(), [])

  // Moves the focus once the list shows the change (see FocusTarget).
  useEffect(() => {
    const target = focusAfter.current
    if (!target) return
    focusAfter.current = null
    const button = target.control === 'add' ? null : list.current?.querySelector<HTMLButtonElement>(`[data-photo="${target.index}"] [data-control="${target.control}"]`)
    // A move button that became disabled (the picture reached an end) hands the focus to its other move button.
    const other = target.control === 'earlier' ? 'later' : 'earlier'
    const fallback = list.current?.querySelector<HTMLButtonElement>(`[data-photo="${target.index}"] [data-control="${other}"]`)
    ;(button && !button.disabled ? button : target.control !== 'remove' && fallback && !fallback.disabled ? fallback : addButton.current)?.focus()
  }, [value])

  /**
   * Marks the uploads as running or done, here and for the form.
   * @param next - True while files upload.
   */
  const changeBusy = (next: boolean) => {
    setBusy(next)
    onBusyChange?.(next)
  }

  /**
   * File-picker handler: checks the chosen files, uploads the acceptable ones in order and appends each one as it is
   * stored; stops at the first upload the server refuses.
   * @param event - The file input's change event.
   */
  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    // Cleared, so choosing the same files again (after an error) still fires a change.
    event.target.value = ''
    if (files.length === 0) return
    const accepted = files.filter((file) => UPLOAD_IMAGE_TYPES.includes(file.type) && file.size <= MAX_UPLOAD_BYTES)
    const refused = files.find((file) => !accepted.includes(file))
    setProblem(refused ? (UPLOAD_IMAGE_TYPES.includes(refused.type) ? t.admin.errors.fileTooLarge : t.admin.errors.fileType) : '')
    setStatus('')
    if (accepted.length === 0) return
    controller.current = new AbortController()
    const { signal } = controller.current
    changeBusy(true)
    try {
      for (const [index, file] of accepted.entries()) {
        setStatus(g.uploading.replace('{n}', String(index + 1)).replace('{total}', String(accepted.length)))
        const uploaded = await uploadImage(folder, file, signal)
        const image: StaffProductImage = { url: uploaded.url, thumbnailUrl: uploaded.thumbnailUrl ?? null, srcset: null, alt: null }
        latest.current = [...latest.current, image]
        onChange(latest.current)
      }
      setStatus(g.uploaded)
    } catch (error) {
      if (signal.aborted) return
      setStatus('')
      setProblem(uploadErrorMessage(error, t))
    } finally {
      if (!signal.aborted) changeBusy(false)
    }
  }

  /**
   * Earlier / Later handler: swaps a picture with its neighbour; the focus follows the picture.
   * @param index - The picture's place (0 = main).
   * @param step - -1 = earlier, 1 = later.
   */
  const handleMove = (index: number, step: -1 | 1) => {
    const next = [...value]
    const [moved] = next.splice(index, 1)
    next.splice(index + step, 0, moved)
    focusAfter.current = { index: index + step, control: step < 0 ? 'earlier' : 'later' }
    setStatus(g.moved.replace('{n}', String(index + step + 1)))
    onChange(next)
  }

  /**
   * Remove handler: drops a picture; the focus goes to the Remove button now in its place (the next picture), else the
   * previous one's, else "Add photos".
   * @param index - The picture's place.
   */
  const handleRemove = (index: number) => {
    const next = value.filter((_, i) => i !== index)
    focusAfter.current = next.length === 0 ? { index: -1, control: 'add' } : { index: Math.min(index, next.length - 1), control: 'remove' }
    setProblem('')
    setStatus(g.removed)
    onChange(next)
  }

  return (
    <div className={className}>
      {value.length === 0 ? (
        <p className="mt-2 text-sm text-brand-charcoal-muted">{g.none}</p>
      ) : (
        <ol ref={list} className="mt-2 space-y-3">
          {value.map((image, index) => {
            const n = String(index + 1)
            const name = g.photo.replace('{n}', n)
            return (
              <li key={image.url} data-photo={index} className="flex flex-wrap items-center gap-4 rounded-2xl border border-neutral-200 p-3">
                <img
                  src={image.thumbnailUrl ?? image.url}
                  alt={name}
                  width={96}
                  height={96}
                  loading="lazy"
                  className="size-24 shrink-0 rounded-md border border-neutral-200 bg-neutral-100 object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-charcoal">
                    {name}
                    {index === 0 && <span className="rounded-md bg-brand-red-muted px-2 py-0.5 text-xs font-semibold text-brand-red-dark">{g.main}</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="action" size="action" data-control="earlier" disabled={disabled || busy || index === 0} aria-label={g.moveEarlierOf.replace('{n}', n)} onClick={() => handleMove(index, -1)}>
                      <ArrowUp aria-hidden />
                      {g.moveEarlier}
                    </Button>
                    <Button
                      type="button"
                      variant="action"
                      size="action"
                      data-control="later"
                      disabled={disabled || busy || index === value.length - 1}
                      aria-label={g.moveLaterOf.replace('{n}', n)}
                      onClick={() => handleMove(index, 1)}
                    >
                      <ArrowDown aria-hidden />
                      {g.moveLater}
                    </Button>
                    <Button type="button" variant="actionDanger" size="action" data-control="remove" disabled={disabled || busy} aria-label={g.removeOf.replace('{n}', n)} onClick={() => handleRemove(index)}>
                      <Trash2 aria-hidden />
                      {g.remove}
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <Button
        ref={addButton}
        id={id}
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        disabled={disabled}
        loading={busy}
        aria-invalid={invalid}
        aria-describedby={[describedBy, problem && problemId].filter(Boolean).join(' ') || undefined}
        onClick={() => fileInput.current?.click()}
      >
        <Upload aria-hidden />
        {g.add}
      </Button>
      {/* The real file picker, opened by the button above (a styled button is keyboard- and screen-reader-friendly). */}
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={UPLOAD_IMAGE_TYPES.join(',')}
        aria-label={g.add}
        tabIndex={-1}
        hidden
        disabled={disabled || busy}
        onChange={handleFiles}
      />
      <p role="status" className="mt-2 min-h-4 text-xs text-brand-charcoal-muted">
        {status}
      </p>
      {problem && (
        <p id={problemId} role="alert" className="mt-1 text-xs font-medium text-brand-red-dark">
          {problem}
        </p>
      )}
    </div>
  )
}
