/**
 * audit.ts — The measurements of the phone audit (mobile-audit.spec.ts), usable by any spec: sideways overflow, touch
 * targets smaller than 44×44 px, controls covered by other elements, overlapping text, fixed chrome (the header, the
 * tab bar, the WhatsApp button, a bottom action bar, a toast, sticky bars) overlapping other chrome or hiding the
 * start or the end of a page, form fields whose text is under 16px (iOS Safari zooms the page when one gets the
 * focus), and axe with the WCAG 2.2 AA rules (which turn on axe's `target-size`).
 *
 * Each check returns its problems as readable strings instead of failing, so one run lists everything a page has.
 * The browser-side functions (`measureView`, `measurePage`) are passed to page.evaluate, so they are self-contained.
 */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/** The smallest comfortable touch target, in CSS px (Apple's 44pt; WCAG 2.5.5 AAA). */
export const MIN_TARGET = 44

/** The axe tags of the audit: WCAG 2.0 / 2.1 A and AA (IS 5568) plus 2.2 AA, whose `target-size` rule is off by default. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Options of one viewport measurement. */
type ViewOptions = {
  /** The smallest touch target, in px. */
  min: number
  /** Which edge of the page the window shows: at the top, nothing may hide under top chrome; at the end, under bottom chrome. */
  edge: 'top' | 'bottom' | 'both' | null
}

/**
 * Measures what the window shows now (runs in the browser): touch targets under `min` px (sampled with
 * elementFromPoint at the edge midpoints of a min×min square centred on each control, so an invisible hit area counts
 * and a neighbour inside the square fails it), controls whose centre another element covers, text lines that overlap
 * other text, chrome that overlaps other chrome, and (at the page's top or end) content hidden under the chrome.
 * Content scrolling under the chrome, and anything under an open overlay, are not problems.
 * @param options - See ViewOptions.
 * @returns The problems, each once.
 */
function measureView({ min, edge }: ViewOptions): string[] {
  type Box = { left: number; top: number; right: number; bottom: number }
  const problems = new Set<string>()
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const viewport: Box = { left: 0, top: 0, right: vw, bottom: vh }

  /** The overlap of two boxes (may be empty). */
  const intersect = (a: Box, b: Box): Box => ({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  })
  /** Whether a box is at least `size` px in both directions. */
  const big = (b: Box, size = 1) => b.right - b.left >= size && b.bottom - b.top >= size
  /** Whether a point lies inside a box. */
  const inside = (x: number, y: number, b: Box) => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom

  // The overlays above the page: dialogs, sheets, menus, popovers, tooltips. With a dialog or sheet open, only the
  // topmost one (and toasts) count; anything under an overlay is not a problem.
  const OVERLAY = '[data-slot="dialog-content"], [data-slot="sheet-content"], [data-radix-popper-content-wrapper], [role="tooltip"]'
  const modal = [...document.querySelectorAll<HTMLElement>('[data-slot="dialog-content"], [data-slot="sheet-content"]')]
    .filter((el) => el.checkVisibility())
    .at(-1)
  const TOAST = '[data-toast]'
  /** Whether an element is outside the part of the page that counts (behind the open dialog). */
  const outOfScope = (el: Element) => !!modal && !modal.contains(el) && !el.closest(TOAST) && !el.closest('[data-radix-popper-content-wrapper]')

  // Chrome = an element fixed to the window, or sticky and stuck to it now (not an overlay): the header, the tab bar,
  // the WhatsApp button, a section's edit bar while it sticks under the header...
  const chromeCache = new Map<Element, Element | null>()
  /** Whether a sticky element is stuck now (at its `top` offset), rather than in its place in the page's flow. */
  const stuck = (el: Element) => {
    const top = parseFloat(getComputedStyle(el).top)
    return Number.isFinite(top) && Math.abs(el.getBoundingClientRect().top - top) < 1
  }
  /** The fixed or stuck-sticky ancestor (or self) an element floats with, or null. */
  const chromeOf = (el: Element): Element | null => {
    if (chromeCache.has(el)) return chromeCache.get(el)!
    let found: Element | null = null
    if (!el.closest(OVERLAY)) {
      const position = getComputedStyle(el).position
      found = position === 'fixed' || (position === 'sticky' && stuck(el)) ? el : el.parentElement ? chromeOf(el.parentElement) : null
    }
    chromeCache.set(el, found)
    return found
  }
  /** The outermost chrome an element belongs to (a sticky bar inside the fixed header belongs to the header). */
  const chromeRoot = (el: Element): Element | null => {
    let root = chromeOf(el)
    while (root?.parentElement && chromeOf(root.parentElement)) root = chromeOf(root.parentElement)
    return root
  }

  const clipCache = new Map<Element, Box>()
  /** The part of the window an element may show in: the window cut by every ancestor that clips its overflow. */
  const clipOf = (el: Element): Box => {
    const cached = clipCache.get(el)
    if (cached) return cached
    const parent = el.parentElement
    let box = viewport
    if (parent && parent !== document.body && parent !== document.documentElement) {
      box = clipOf(parent)
      const style = getComputedStyle(parent)
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
        const r = parent.getBoundingClientRect()
        box = intersect(box, {
          left: style.overflowX === 'visible' ? box.left : r.left,
          right: style.overflowX === 'visible' ? box.right : r.right,
          top: style.overflowY === 'visible' ? box.top : r.top,
          bottom: style.overflowY === 'visible' ? box.bottom : r.bottom,
        })
      }
    }
    clipCache.set(el, box)
    return box
  }

  const hiddenCache = new Map<Element, boolean>()
  /**
   * Whether an element is not seen: display none, invisible, transparent, or visually hidden for screen readers only
   * (sr-only: clipped to nothing), itself or through an ancestor.
   */
  const unseen = (el: Element): boolean => {
    if (hiddenCache.has(el)) return hiddenCache.get(el)!
    const style = getComputedStyle(el)
    const clipped = style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)'
    const result = clipped || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || (!!el.parentElement && unseen(el.parentElement))
    hiddenCache.set(el, result)
    return result
  }

  /** A short, stable description of an element: its role, its name and the nearest id around it. */
  const describe = (el: Element) => {
    const name = (
      el.getAttribute('aria-label') ||
      el.textContent ||
      el.getAttribute('title') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('name') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 48)
    const role = el.getAttribute('role') || el.tagName.toLowerCase()
    const where = el.parentElement?.closest('[id]:not(#main):not(#root)')?.id ?? el.closest('header, nav, main, footer, [role="dialog"]')?.tagName.toLowerCase()
    return `${role} "${name}"${where ? ` in ${/^[a-z]+$/.test(where) ? `<${where}>` : `#${where}`}` : ''}`
  }

  // --- Touch targets and covered controls ---
  const TARGETS =
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="switch"], [role="slider"], [role="tab"], [role="radio"], [role="checkbox"], [role="option"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'
  // 1.5px inside the square's edge: two exactly-44px controls side by side meet on a fractional pixel.
  const half = min / 2 - 1.5
  for (const control of document.querySelectorAll<HTMLElement>(TARGETS)) {
    if (control.matches(':disabled') || control.closest('[inert]') || outOfScope(control)) continue
    // Exempt (WCAG 2.5.5): map pins and the map's attribution, and a link inside a sentence.
    if (control.closest('.leaflet-marker-icon, .leaflet-control-attribution')) continue
    if (control.tagName === 'A' && getComputedStyle(control).display === 'inline') {
      const own = (control.textContent ?? '').trim()
      const around = (control.parentElement?.textContent ?? '').replace(own, '').trim()
      if (around.length > 0 && control.parentElement && getComputedStyle(control.parentElement).display !== 'flex') continue
    }
    if (getComputedStyle(control).pointerEvents === 'none') continue
    // A visually hidden native control (a segmented switch's radio) is tapped through its label.
    const labels = 'labels' in control ? [...((control as HTMLInputElement).labels ?? [])] : []
    let target: HTMLElement = control
    let rect = control.getBoundingClientRect()
    if ((rect.width <= 2 || rect.height <= 2 || unseen(control)) && labels[0] && !unseen(labels[0])) {
      target = labels[0]
      rect = target.getBoundingClientRect()
    } else if (unseen(control)) continue
    else if (labels[0] && control.matches('input[type="checkbox"], input[type="radio"]') && !unseen(labels[0])) {
      // A checkbox is tapped through its label too: the target is the box and its label together.
      const label = labels[0].getBoundingClientRect()
      rect = new DOMRect(Math.min(rect.left, label.left), Math.min(rect.top, label.top), 0, 0)
      rect = new DOMRect(rect.left, rect.top, Math.max(control.getBoundingClientRect().right, label.right) - rect.left, Math.max(control.getBoundingClientRect().bottom, label.bottom) - rect.top)
      target = labels[0]
    }
    const shown = intersect(rect, clipOf(target))
    if (!big(shown, 4)) continue
    /** Whether the element found at a point belongs to this control (itself, inside it, or one of its labels). */
    const owns = (hit: Element | null) => !!hit && (control.contains(hit) || target.contains(hit) || labels.some((label) => label.contains(hit)))
    /** Whether a covering element is chrome or an overlay that the control merely scrolls under. */
    const passing = (hit: Element) => (!!chromeRoot(hit) && chromeRoot(hit) !== chromeRoot(control)) || (!!hit.closest(OVERLAY) && !control.closest(OVERLAY))
    const cx = (shown.left + shown.right) / 2
    const cy = (shown.top + shown.bottom) / 2
    const centre = document.elementFromPoint(cx, cy)
    if (!owns(centre)) {
      if (centre && !passing(centre)) problems.add(`covered: ${describe(control)} is under ${describe(centre)}`)
      continue
    }
    // Only a control wholly in view is measured: one cut by the window or by a scrolling row (a chip half past the
    // row's edge) is measured when it scrolls into view.
    if (shown.right - shown.left < rect.width - 1 || shown.bottom - shown.top < rect.height - 1) continue
    // The square is centred on the control.
    const fx = (rect.left + rect.right) / 2
    const fy = (rect.top + rect.bottom) / 2
    const points: [number, number][] = [
      [fx - half, fy],
      [fx + half, fy],
      [fx, fy - half],
      [fx, fy + half],
    ]
    const short = points.some(([x, y]) => {
      if (!inside(x, y, viewport) || !inside(x, y, clipOf(target))) return false
      const hit = document.elementFromPoint(x, y)
      return !owns(hit) && !(hit && passing(hit))
    })
    if (short) problems.add(`small target: ${describe(control)} is ${Math.round(rect.width)}×${Math.round(rect.height)}`)
  }

  // --- Text lines ---
  type Line = { node: Text; el: Element; chrome: Element | null; box: Box }
  const lines: Line[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode() && lines.length < 4000) {
    const node = walker.currentNode as Text
    const el = node.parentElement
    if (!el || !node.data.trim() || el.closest('script, style, noscript, template, option') || outOfScope(el) || unseen(el)) continue
    // The text's own box clips it too when it hides its overflow (a truncated label).
    const own = getComputedStyle(el)
    const clip = own.overflowX !== 'visible' || own.overflowY !== 'visible' ? intersect(clipOf(el), el.getBoundingClientRect()) : clipOf(el)
    const range = document.createRange()
    range.selectNodeContents(node)
    for (const r of range.getClientRects()) {
      // The middle of the line only: a font's ascent and descent reach into the lines above and below it.
      const trim = r.height * 0.2
      const box = intersect({ left: r.left, right: r.right, top: r.top + trim, bottom: r.bottom - trim }, clip)
      // An overlay (a menu, a popover) floats over the page on purpose, like chrome.
      if (big(box, 2)) lines.push({ node, el, chrome: chromeRoot(el) ?? el.closest(OVERLAY), box })
    }
  }
  lines.sort((a, b) => a.box.top - b.box.top)
  /** A short quote of a line's text. */
  const quote = (line: Line) => `"${line.node.data.replace(/\s+/g, ' ').trim().slice(0, 32)}"`
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i]
    for (let j = i + 1; j < lines.length && lines[j].box.top < a.box.bottom; j++) {
      const b = lines[j]
      if (a.node === b.node || !big(intersect(a.box, b.box), 2)) continue
      if (a.chrome === b.chrome) problems.add(`text overlap: ${quote(a)} (${describe(a.el)}) × ${quote(b)} (${describe(b.el)})`)
    }
  }

  // --- Chrome ---
  const chrome = new Map<Element, Box>()
  for (const el of document.querySelectorAll('body *')) {
    const root = chromeRoot(el)
    if (!root || chrome.has(root) || outOfScope(root)) continue
    if (unseen(root)) continue
    const box = intersect(root.getBoundingClientRect(), viewport)
    // Thin lines (a progress bar) and full-window layers are not chrome that can cover something.
    if (!big(box, 6) || (box.right - box.left) * (box.bottom - box.top) > vw * vh * 0.8) continue
    chrome.set(root, box)
  }
  const roots = [...chrome.keys()]
  /** Whether two chrome elements may overlap: a toast lies over the header band on purpose. */
  const allowed = (a: Element, b: Element) => [a, b].some((el) => el.matches(TOAST)) && [a, b].some((el) => el.matches('header'))
  for (let i = 0; i < roots.length; i++) {
    for (let j = i + 1; j < roots.length; j++) {
      if (big(intersect(chrome.get(roots[i])!, chrome.get(roots[j])!), 3) && !allowed(roots[i], roots[j])) {
        problems.add(`chrome overlap: ${describe(roots[i])} × ${describe(roots[j])}`)
      }
    }
  }

  // --- Content hidden under the chrome at the top or the end of the page ---
  if (edge) {
    for (const [root, box] of chrome) {
      const isTop = box.top <= 1 && box.bottom < vh / 2
      const isBottom = box.bottom >= vh - 1 && box.top > vh / 2
      const atEdge = (isTop && (edge === 'top' || edge === 'both')) || (isBottom && (edge === 'bottom' || edge === 'both'))
      if (!atEdge || root.matches(TOAST)) continue
      for (const line of lines) {
        if (!line.chrome && big(intersect(line.box, box), 2)) problems.add(`hidden under ${describe(root)}: ${quote(line)} (${describe(line.el)})`)
      }
      for (const control of document.querySelectorAll<HTMLElement>(TARGETS)) {
        if (chromeRoot(control) || outOfScope(control) || unseen(control)) continue
        const shown = intersect(control.getBoundingClientRect(), clipOf(control))
        if (big(shown, 4) && big(intersect(shown, box), 2)) problems.add(`hidden under ${describe(root)}: ${describe(control)}`)
      }
    }
  }
  return [...problems]
}

/**
 * Measures what does not depend on the scroll position (runs in the browser): sideways overflow of the page (with
 * the elements that stick out) and form fields whose text is under 16px.
 * @returns The problems.
 */
function measurePage(): string[] {
  const problems: string[] = []
  const root = document.documentElement
  const width = root.clientWidth
  const overflow = root.scrollWidth - width
  // The elements cut by the window's sides (partly in, partly out) without a scrolling or clipping box of their own
  // around them. Elements wholly outside (an off-screen measuring box) are hidden on purpose.
  const outside = [...document.querySelectorAll('body *')].filter((el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || (r.right <= width + 1 && r.left >= -1) || r.left >= width || r.right <= 0) return false
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') return false
    }
    return el.checkVisibility()
  })
  if (overflow > 0 || outside.length) {
    // The innermost ones say the most.
    const leaves = outside.filter((el) => !outside.some((other) => other !== el && el.contains(other))).slice(0, 4)
    const names = leaves.map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${[...el.classList].slice(0, 4).join('.')} (${Math.round(el.getBoundingClientRect().left)}…${Math.round(el.getBoundingClientRect().right)})`)
    problems.push(`overflow: the page is ${overflow}px wider than the ${width}px window; sticking out: ${names.join('; ') || 'nothing found'}`)
  }
  const FIELDS =
    'input:not([type="checkbox"], [type="radio"], [type="range"], [type="hidden"], [type="color"], [type="file"], [type="submit"], [type="button"], [type="reset"], [type="image"]), select, textarea, [contenteditable=""], [contenteditable="true"]'
  for (const field of document.querySelectorAll<HTMLElement>(FIELDS)) {
    if (!field.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
    const size = parseFloat(getComputedStyle(field).fontSize)
    if (size < 16) {
      const name = field.getAttribute('aria-label') || (field as HTMLInputElement).labels?.[0]?.textContent || field.getAttribute('placeholder') || field.getAttribute('name') || field.tagName.toLowerCase()
      problems.push(`zooms on focus: field "${name.replace(/\s+/g, ' ').trim().slice(0, 40)}" has ${size}px text (iOS zooms below 16px)`)
    }
  }
  return problems
}

/**
 * Waits for two animation frames, so a scroll or a click has been laid out and painted.
 * @param page - The Playwright page.
 */
async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

/**
 * The page's sideways overflow in px (0 = none): how much wider the document is than the window's layout width.
 * Unlike `scrollWidth <= innerWidth`, this also catches overflow on an emulated phone, where the visual viewport can
 * grow to fit the overflowing content.
 * @param page - The Playwright page.
 * @returns The overflow in CSS px.
 */
export async function overflowX(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

/**
 * Runs axe on the page (or a part of it) with the audit's WCAG 2.2 AA tags.
 * @param page - The Playwright page.
 * @param include - A selector of the part to scan (default: the whole page).
 * @returns One line per violation: the rule and the elements it found.
 */
export async function axeScan(page: Page, include?: string): Promise<string[]> {
  const builder = new AxeBuilder({ page }).withTags(AXE_TAGS)
  if (include) builder.include(include)
  const { violations } = await builder.analyze()
  return violations.map((v) => `axe ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 6).join(', ')}`)
}

/**
 * Audits the page in its current state: the page-wide checks, then every check of measureView one window at a time
 * from the top to the end (scrolling the open dialog's or sheet's body instead of the page while one is open), then
 * axe. Leaves the page scrolled back to the top.
 * @param page - The Playwright page, loaded and settled.
 * @param options.axe - Whether to run axe too (default true).
 * @returns Every problem found, each once.
 */
export async function auditPage(page: Page, { axe = true }: { axe?: boolean } = {}): Promise<string[]> {
  const problems = new Set<string>(await page.evaluate(measurePage))
  // The element that scrolls: the open dialog's scrolling body, else the page.
  const scroller = await page.evaluateHandle(() => {
    const modal = [...document.querySelectorAll<HTMLElement>('[data-slot="dialog-content"], [data-slot="sheet-content"]')].filter((el) => el.checkVisibility()).at(-1)
    if (!modal) return document.scrollingElement ?? document.documentElement
    const inner = [modal, ...modal.querySelectorAll<HTMLElement>('*')].find((el) => {
      const style = getComputedStyle(el)
      return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1
    })
    return inner ?? modal
  })
  for (let step = 0; step < 60; step++) {
    const { atTop, atEnd } = await scroller.evaluate((el, i) => {
      const view = el === document.scrollingElement ? window.innerHeight : el.clientHeight
      el.scrollTo({ top: Math.round(i * view * 0.8), behavior: 'instant' })
      return { atTop: el.scrollTop <= 0, atEnd: el.scrollTop + view >= el.scrollHeight - 1 }
    }, step)
    await nextFrames(page)
    const edge: ViewOptions['edge'] = atTop && atEnd ? 'both' : atTop ? 'top' : atEnd ? 'bottom' : null
    for (const problem of await page.evaluate(measureView, { min: MIN_TARGET, edge } satisfies ViewOptions)) problems.add(problem)
    if (atEnd) break
  }
  await scroller.evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' }))
  await scroller.dispose()
  if (axe) for (const problem of await axeScan(page)) problems.add(problem)
  return [...problems]
}

/**
 * Waits until a freshly loaded page shows its final layout: the network is idle, the fonts are in, every photo in
 * <main> has loaded (lazy ones are made eager first) and the entrance animations have finished.
 * @param page - The Playwright page.
 */
export async function settlePage(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.locator('main img').evaluateAll((imgs) => imgs.forEach((img) => img.setAttribute('loading', 'eager')))
  await page
    .waitForFunction(() => [...document.querySelectorAll('main img')].every((img) => (img as HTMLImageElement).complete), undefined, { timeout: 10_000 })
    .catch(() => undefined)
  await settleAnimations(page)
  // A route that settles its URL right after loading (e.g. /admin/customers) cross-fades once (a view transition,
  // router.ts): while it runs, the page under it takes no taps. Wait for one that starts just now, too.
  await page.waitForTimeout(250)
  await settleAnimations(page)
}

/**
 * Waits for the running finite animations (entrances, a dialog's fade) to finish; looping ones (spinners) are skipped.
 * @param page - The Playwright page.
 */
export async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]).then(() => undefined),
  )
  await nextFrames(page)
}
