/**
 * ImageUploadField.tsx — Edits a picture by uploading a file: a preview of the current picture (or a quiet
 * placeholder) and "Upload / Replace picture" and "Remove picture" buttons. The file goes to the server's file
 * storage (uploadImage in src/api.ts; an S3 stub for now) and the field's value becomes the stored file's URL; the
 * caller saves it with the rest of its form. There is no address input on purpose: every picture the site shows
 * comes from our storage (or is bundled with the site), never from another site.
 *
 * Only JPEG, PNG, WebP and AVIF pictures of up to 5 MB are sent (the server checks again). Upload progress and
 * results are announced in a live region; while a file uploads, `onBusyChange(true)` lets the form hold its Save.
 * Used by the admin forms (RecordDialog, column type "image", e.g. a category's picture on the home carousel); the
 * caller gives the group label (a <fieldset> legend), the hint and the form errors, like with SearchableField.
 */
import { useEffect, useId, useRef, useState, type ChangeEvent, type ComponentProps } from 'react'
import { ImageIcon, Trash2, Upload } from 'lucide-react'
import { ApiError, uploadImage, type UploadFolder } from '@/api'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/i18n/he'
import { useI18n } from '@/i18n'

/** The largest picture the server accepts (MAX_UPLOAD_BYTES in backend/app/staff/routes.py): 5 MB. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** The picture types the server accepts (IMAGE_TYPES in backend/app/staff/routes.py; no SVG). */
export const UPLOAD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * The message for a failed upload.
 * @param error - What uploadImage threw.
 * @param t - The dictionary.
 * @returns The translated message: the wrong type, too large, or a general failure.
 */
function uploadErrorMessage(error: unknown, t: Dictionary): string {
  const code = error instanceof ApiError ? error.code : undefined
  if (code === 'unsupported_type') return t.admin.errors.fileType
  if (code === 'too_large' || code === 'request_entity_too_large') return t.admin.errors.fileTooLarge
  return t.admin.errors.failed
}

/** The props of ImageUploadField (see the component); the form's state attributes go to the upload button. */
type ImageUploadFieldProps = Pick<ComponentProps<'button'>, 'className' | 'disabled' | 'aria-invalid' | 'aria-describedby'> & {
  id: string
  value: string
  onChange: (url: string) => void
  folder: UploadFolder
  onBusyChange?: (busy: boolean) => void
}

/**
 * The picture field.
 * @param props.id - The upload button's id (the form's error focus target).
 * @param props.value - The current picture URL; "" = none.
 * @param props.onChange - Called with the new URL: the uploaded file's, or "" after "Remove".
 * @param props.folder - The storage folder the files go to, e.g. "categories".
 * @param props.onBusyChange - Told true when an upload starts and false when it ends (the form disables Save).
 * @param props.className - Classes of the wrapper (outer spacing).
 * @param props.disabled - Read-only: no upload or remove.
 * @param props.aria-invalid - The form found the field wrong (set on the upload button).
 * @param props.aria-describedby - The ids of the form's hint and error (the upload button's description, plus the
 *   field's own upload error).
 * @returns The preview, the buttons and the status line.
 */
export function ImageUploadField({
  id,
  value,
  onChange,
  folder,
  onBusyChange,
  className,
  disabled,
  'aria-invalid': invalid,
  'aria-describedby': describedBy,
}: ImageUploadFieldProps) {
  const { t } = useI18n()
  const fileId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const chooseButton = useRef<HTMLButtonElement>(null)
  const controller = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [problem, setProblem] = useState('')
  const problemId = `${id}-upload-error`

  // Closing the form mid-upload drops the upload.
  useEffect(() => () => controller.current?.abort(), [])

  /**
   * Marks an upload as running or done, here and for the form.
   * @param next - True while a file uploads.
   */
  const changeBusy = (next: boolean) => {
    setBusy(next)
    onBusyChange?.(next)
  }

  /**
   * File-picker handler: checks the chosen file, uploads it and puts its URL in the field.
   * @param event - The file input's change event.
   */
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Cleared, so choosing the same file again (after an error) still fires a change.
    event.target.value = ''
    if (!file) return
    setStatus('')
    if (!UPLOAD_IMAGE_TYPES.includes(file.type)) return setProblem(t.admin.errors.fileType)
    if (file.size > MAX_UPLOAD_BYTES) return setProblem(t.admin.errors.fileTooLarge)
    setProblem('')
    setStatus(t.admin.upload.uploading)
    controller.current = new AbortController()
    const { signal } = controller.current
    changeBusy(true)
    try {
      const { url } = await uploadImage(folder, file, signal)
      onChange(url)
      setStatus(t.admin.upload.uploaded)
    } catch (error) {
      if (signal.aborted) return
      setStatus('')
      setProblem(uploadErrorMessage(error, t))
    } finally {
      if (!signal.aborted) changeBusy(false)
    }
  }

  /** "Remove picture" handler: empties the field and moves the focus to the upload button (Remove disappears). */
  const handleRemove = () => {
    onChange('')
    setProblem('')
    setStatus(t.admin.upload.removed)
    chooseButton.current?.focus()
  }

  return (
    <div className={className}>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <div className="flex aspect-[4/3] w-40 shrink-0 items-center justify-center overflow-hidden border border-neutral-300 bg-neutral-50">
          {value ? (
            <img src={value} alt={t.admin.upload.preview} width={160} height={120} className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-xs text-brand-charcoal-muted">
              <ImageIcon aria-hidden className="size-8" strokeWidth={1.25} />
              {t.admin.upload.none}
            </span>
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <Button
            ref={chooseButton}
            id={id}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            aria-invalid={invalid}
            aria-describedby={[describedBy, problem && problemId].filter(Boolean).join(' ') || undefined}
            onClick={() => fileInput.current?.click()}
          >
            <Upload aria-hidden />
            {value ? t.admin.upload.replace : t.admin.upload.choose}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled || busy} onClick={handleRemove}>
              <Trash2 aria-hidden />
              {t.admin.upload.remove}
            </Button>
          )}
        </div>
      </div>
      {/* The real file picker, opened by the button above (a styled button is keyboard- and screen-reader-friendly). */}
      <input
        ref={fileInput}
        id={fileId}
        type="file"
        accept={UPLOAD_IMAGE_TYPES.join(',')}
        aria-label={value ? t.admin.upload.replace : t.admin.upload.choose}
        tabIndex={-1}
        hidden
        disabled={disabled || busy}
        onChange={handleFile}
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
