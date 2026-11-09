/**
 * SearchableField.tsx — A text input that suggests completions from database data (suppliers, products,
 * categories, brands, ...) while the user types: an accessible combobox (WAI-ARIA 1.2, list autocomplete).
 *
 * Two modes:
 * - free (default): the user types anything; the suggestions only help. `value` is the text, and picking a
 *   suggestion fills in its label.
 * - `strict`: the value can only be one of the options. Typing filters the list; `value` is the chosen option's
 *   `value` (e.g. a database id), '' when empty. Leaving the field with text that matches no option puts back the
 *   last choice; text that exactly matches an option's label picks it.
 *
 * The suggestions come from `options` (already loaded, e.g. by a route loader; filtered here, every language's
 * letters and accents ignored) or from `loadOptions` (a server search, called after a short pause with an
 * AbortSignal, for tables too big to load whole). Keyboard: arrows move, Enter picks, Escape closes, Tab leaves.
 * The list is a Radix Popover anchored to the input (not in a portal), so it escapes a dialog's scrolling body
 * and Escape closes the list without closing the dialog. A polite live region announces the number of
 * suggestions. Used by RecordDialog (a DataColumn with `searchable`), e.g. the product's category and brand.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { cn } from 'cn'
import { Check, ChevronDown } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { useI18n } from '@/i18n'

/** One suggestion: the stored `value` (e.g. an id), the shown `label`, and an optional second line `detail`. */
export type SearchOption = { value: string; label: string; detail?: string }

/** The props of SearchableField (see the component); other <input> attributes pass through to the input. */
export type SearchableFieldProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'role' | 'id'> & {
  id: string
  label: string
  value: string
  onChange: (value: string, option: SearchOption | null) => void
  options?: SearchOption[]
  loadOptions?: (query: string, signal: AbortSignal) => Promise<SearchOption[]>
  strict?: boolean
  valueLabel?: string
  minChars?: number
  maxResults?: number
  debounceMs?: number
  inputClassName?: string
}

/**
 * Prepares text for matching: lowercase, without accents or Hebrew vowel points, trimmed.
 * @param text - Any text.
 * @returns The comparable form.
 */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim()
}

/**
 * Filters and ranks the options for a search: labels that start with the text first, then labels with a word
 * that starts with it, then labels or details that contain it; ties keep the given order.
 * @param options - All the options.
 * @param term - What the user typed ('' = every option).
 * @param limit - The most options to return.
 * @returns The matching options, best first.
 */
function rankOptions(options: SearchOption[], term: string, limit: number): SearchOption[] {
  const needle = normalize(term)
  if (!needle) return options.slice(0, limit)
  const scored: { option: SearchOption; score: number; index: number }[] = []
  options.forEach((option, index) => {
    const label = normalize(option.label)
    let score = -1
    if (label.startsWith(needle)) score = 0
    else if (label.split(/[\s\-_/.,()]+/).some((word) => word.startsWith(needle))) score = 1
    else if (label.includes(needle)) score = 2
    else if (option.detail && normalize(option.detail).includes(needle)) score = 3
    if (score >= 0) scored.push({ option, score, index })
  })
  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.option)
}

/**
 * The searchable field. Render your own visible `<label htmlFor={id}>` next to it.
 * @param props.id - The input's id (the label's `htmlFor`); the list and options derive their ids from it.
 * @param props.label - The field's name, also the suggestion list's accessible name.
 * @param props.value - Free mode: the text. Strict mode: the chosen option's value, '' when none.
 * @param props.onChange - Called with the new value and the picked option (null while typing freely, or when
 *   a strict field is cleared).
 * @param props.options - The suggestions, filtered here as the user types; defaults to none.
 * @param props.loadOptions - Searches on the server instead: gets the trimmed text and an AbortSignal, returns
 *   the matches. Called after `debounceMs`; a newer search aborts the older one.
 * @param props.strict - Restricts the value to the options (see the file header); defaults to false.
 * @param props.valueLabel - Strict mode: the label of the current value when it is not among the options
 *   (e.g. a record's saved choice before any search with `loadOptions`).
 * @param props.minChars - Characters needed before `loadOptions` searches; defaults to 1 (0 with `options`).
 * @param props.maxResults - The most suggestions shown; defaults to 50.
 * @param props.debounceMs - The typing pause before `loadOptions` runs, in ms; defaults to 200.
 * @param props.className - Classes of the wrapper (outer spacing, width).
 * @param props.inputClassName - Classes of the input (its look, e.g. the admin forms' INPUT_CLASS).
 * @param props - Other <input> attributes (disabled, placeholder, aria-invalid, aria-describedby, dir, ...).
 * @returns The input with its suggestion list.
 */
export function SearchableField({
  id,
  label,
  value,
  onChange,
  options = [],
  loadOptions,
  strict = false,
  valueLabel,
  minChars = loadOptions ? 1 : 0,
  maxResults = 50,
  debounceMs = 200,
  className,
  inputClassName,
  disabled,
  onBlur,
  onKeyDown,
  onClick,
  ...inputProps
}: SearchableFieldProps) {
  const { t } = useI18n()
  const listId = `${id}-listbox`
  const optionId = (index: number) => `${id}-option-${index}`
  const wrapper = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  // Strict mode: the text being typed; null = the input shows the chosen option's label.
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(-1)
  const [chosen, setChosen] = useState<SearchOption | null>(null)
  const [loaded, setLoaded] = useState<{ term: string; options: SearchOption[]; failed?: boolean } | null>(null)

  // The latest loadOptions, so a caller's inline function never restarts the search on every render.
  const load = useRef(loadOptions)
  useLayoutEffect(() => {
    load.current = loadOptions
  })

  const known = strict && value ? [chosen, ...options, ...(loaded?.options ?? [])].find((option) => option?.value === value) : undefined
  const text = strict ? (query ?? (value ? (known?.label ?? valueLabel ?? value) : '')) : value
  const term = strict && query === null ? '' : text.trim()
  const searching = Boolean(loadOptions) && open && term.length >= minChars
  const loading = searching && loaded?.term !== term

  useEffect(() => {
    if (!searching || loaded?.term === term) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      load.current?.(term, controller.signal).then(
        (found) => setLoaded({ term, options: found }),
        () => !controller.signal.aborted && setLoaded({ term, options: [], failed: true }),
      )
    }, debounceMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [searching, term, loaded?.term, debounceMs])

  const ranked = useMemo(() => rankOptions(options, term, maxResults), [options, term, maxResults])
  const results = loadOptions ? (searching ? (loaded?.options ?? []).slice(0, maxResults) : []) : ranked
  const activeIndex = active < results.length ? active : -1
  const showList = open && !disabled && (strict || loading || results.length > 0)

  let message = ''
  if (loading) message = t.searchField.loading
  else if (loadOptions && term.length < minChars) message = t.searchField.typeToSearch
  else if (loaded?.failed && loaded.term === term) message = t.searchField.failed
  else if (results.length === 0) message = t.searchField.noMatches

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' })
  })

  /**
   * Picks an option: stores it, shows its label and closes the list.
   * @param option - The picked option.
   */
  const choose = (option: SearchOption) => {
    setChosen(option)
    setQuery(null)
    setOpen(false)
    setActive(-1)
    onChange(strict ? option.value : option.label, option)
  }

  /**
   * Closes the list. A strict field then picks the option its text names exactly, or puts back the last choice.
   */
  const settle = () => {
    setOpen(false)
    setActive(-1)
    if (!strict || query === null) return
    const exact = query.trim() ? results.find((option) => normalize(option.label) === normalize(query)) : undefined
    if (exact) choose(exact)
    else setQuery(null)
  }

  /**
   * Typing handler: updates the text (free mode: the value itself), opens the list and, in strict mode,
   * highlights the best match; clearing a strict field clears its value.
   * @param next - The input's new text.
   */
  const handleType = (next: string) => {
    setOpen(true)
    setActive(strict && next.trim() ? 0 : -1)
    if (!strict) onChange(next, null)
    else {
      setQuery(next)
      if (!next.trim() && value) onChange('', null)
    }
  }

  /**
   * Keyboard handler: arrows open the list and move the highlight (wrapping around), Enter picks the
   * highlighted option (a strict field keeps Enter until its text names an option); Escape is Radix's.
   * @param event - The keydown event.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    const count = results.length
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const down = event.key === 'ArrowDown'
      if (!open) {
        setOpen(true)
        setActive(event.altKey ? -1 : down ? 0 : count - 1)
      } else if (count > 0) setActive(down ? (activeIndex + 1) % count : activeIndex <= 0 ? count - 1 : activeIndex - 1)
    } else if (event.key === 'Enter') {
      if (showList && activeIndex >= 0) {
        event.preventDefault()
        choose(results[activeIndex])
      } else if (strict && query !== null) {
        event.preventDefault()
        settle()
      }
    }
  }

  return (
    <PopoverPrimitive.Root open={showList} onOpenChange={(isOpen) => !isOpen && settle()}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={wrapper} className={cn('relative', className)}>
          <input
            {...inputProps}
            id={id}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
            dir={inputProps.dir ?? 'auto'}
            disabled={disabled}
            value={text}
            onChange={(event) => handleType(event.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(event) => {
              onClick?.(event)
              setOpen(true)
            }}
            onBlur={(event) => {
              onBlur?.(event)
              settle()
            }}
            className={cn(inputClassName, 'mt-0 pe-10')}
          />
          <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-brand-charcoal-muted" />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Content
        role={undefined}
        align="start"
        sideOffset={4}
        collisionPadding={16}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // A click on the input itself, or focus leaving it (onBlur settles), is not "outside".
          if (event.type === 'dismissableLayer.focusOutside' || wrapper.current?.contains(event.target as Node)) event.preventDefault()
        }}
        className="z-50 w-(--radix-popover-trigger-width) min-w-48 max-w-[calc(100vw-2rem)] bg-white text-brand-charcoal shadow-premium ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      >
        {results.length > 0 && (
          <div id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto py-1">
            {results.map((option, index) => (
              <div
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onPointerMove={() => index !== activeIndex && setActive(index)}
                onClick={() => choose(option)}
                className={cn(
                  'flex cursor-pointer items-start gap-2 px-4 py-2.5 text-sm transition-colors',
                  index === activeIndex && 'bg-brand-red-muted',
                )}
              >
                <Check aria-hidden className={cn('mt-0.5 size-4 shrink-0 text-brand-red', (strict ? option.value === value : option.label === value) ? 'visible' : 'invisible')} />
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {/* The muted grey is under 4.5:1 on the highlighted row's pink, so that row's detail is darker. */}
                  {option.detail && (
                    <span className={cn('block truncate text-xs', index === activeIndex ? 'text-brand-charcoal-3' : 'text-brand-charcoal-muted')}>
                      {option.detail}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        {message && <p className="px-4 py-3 text-sm text-brand-charcoal-muted">{message}</p>}
      </PopoverPrimitive.Content>
      <span role="status" aria-live="polite" className="sr-only">
        {showList ? (loading || results.length === 0 ? message : t.searchField.count.replace('{count}', String(results.length))) : ''}
      </span>
    </PopoverPrimitive.Root>
  )
}
