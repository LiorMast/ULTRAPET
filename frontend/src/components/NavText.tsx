/**
 * NavText.tsx — The look of the header's menu entries, shared by everything that shows header menu links: the
 * main menu (Navbar: links and the Products dropdown trigger) and the admin drawer (SubNavDrawer). One style, so
 * every header link looks and reacts the same.
 */

/**
 * Text style of the header's menu entries: sentence case, medium weight, grey text that turns brand red on hover and
 * keyboard focus, with a thin red underline (Underline) growing in from the reading start; the active page
 * (TanStack's data-status="active") is red with its underline shown. Keyboard focus also draws a squircle ring.
 * The sizes are the text-nav* tokens of index.css (a step larger in Hebrew) at the base / 2xl / 1920px widths; don't
 * pass this through cn() (tailwind-merge would drop text-nav as a second text color).
 */
export const NAV_TEXT =
  'group relative whitespace-nowrap rounded-md font-heading text-nav font-medium 2xl:text-nav-lg min-[1920px]:text-nav-xl text-neutral-600 transition-colors duration-200 outline-none hover:text-brand-red focus-visible:text-brand-red focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-4 data-[state=open]:text-brand-red data-[status=active]:text-brand-red'

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
