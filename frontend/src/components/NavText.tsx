/**
 * NavText.tsx — The look of the header's menu entries, shared by everything that shows header menu links: the
 * main menu (Navbar: links and the Products dropdown trigger) and the admin drawer (SubNavDrawer). One style, so
 * every header link looks and reacts the same.
 */

/**
 * Text style of the header's menu entries (legacy look). Left-to-right (English) labels use 0.1em
 * letter-spacing instead of the 0.25em `tracking-widest`, so the seven main entries fit on one line at every
 * desktop width (Hebrew has its own tight tracking). The active page (TanStack's data-status="active") is red.
 */
export const NAV_TEXT =
  'group relative whitespace-nowrap font-heading text-xs font-medium uppercase tracking-widest ltr:tracking-[0.1em] 2xl:text-sm min-[1920px]:text-base text-neutral-600 transition-colors duration-200 outline-none hover:text-brand-red focus-visible:text-brand-red data-[status=active]:text-brand-red'

/**
 * The thin red underline of a menu entry (put it inside an element styled with NAV_TEXT): grows from the start
 * side on hover or keyboard focus (a scale, so it animates on the compositor), and stays visible on the active
 * page and while a dropdown is open.
 * @returns A decorative <span>, hidden from screen readers.
 */
export function Underline() {
  return (
    <span
      aria-hidden="true"
      className="absolute -bottom-1 start-0 h-px w-full origin-left scale-x-0 bg-brand-red transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100 group-data-[state=open]:scale-x-100 group-data-[status=active]:scale-x-100 rtl:origin-right"
    />
  )
}
