/**
 * PageSkeleton.tsx — The first page load's waiting screen: a skeleton of the header and of the page being opened, in
 * its own layout (the catalog's grid of cards, a product's gallery and details, an article's column, an admin table…),
 * so the page arrives in place instead of after a blank screen and a spinner.
 *
 * The root route shows it (routes/__root.tsx `pendingComponent`) only on the very first load, when there is no page to
 * keep on screen; later navigations keep the current page and run the slim progress bar (RouteProgress). The page is
 * the deepest route being loaded (`matches`); the sign-in pages (/admin and /account signed out, /login) get the
 * sign-in card's skeleton, from the session copy the browser keeps (useAuth). One polite status says "Loading…".
 *
 * The skeletons are built from the shared pieces (ui/skeleton.tsx) and the cards' own skeletons (CatalogCardSkeleton,
 * ArticleCardSkeleton, BrandCardSkeleton, SectionHeadingSkeleton), in the same frames and grids as the real pages;
 * keep them in step when a page's layout changes. Also exports the hero's frame (HERO_FRAME_CLASS, HERO_GUTTER_CLASS),
 * shared with Hero.tsx so its skeleton has its exact size.
 */
import { rootRouteId, useMatch, useRouterState } from '@tanstack/react-router'
import { cn } from 'cn'
import type { User } from '@/api'
import { useAuth } from '@/auth'
import { ArticleCardSkeleton } from '@/components/ArticleCard'
import { BrandCardSkeleton } from '@/components/BrandCard'
import { CatalogCardSkeleton } from '@/components/CatalogCard'
import { Logo } from '@/components/Logo'
import { HEADER_BAR_CLASS, HEADER_ROW_CLASS } from '@/components/Navbar'
import { SectionHeadingSkeleton } from '@/components/SectionHeading'
import { Skeleton, SkeletonGroup, SkeletonText } from '@/components/ui/skeleton'
import { ADMIN_NAV, mainNav } from '@/config'
import { useI18n } from '@/i18n'
import type { ComponentType } from 'react'
import type { FileRoutesById } from '@/routeTree.gen'

/** The home hero's frame: full-bleed under the header, filling the rest of the first screen (Hero.tsx). */
export const HERO_FRAME_CLASS =
  'relative isolate h-[calc(100svh-5.5rem)] max-h-[960px] min-h-[600px] overflow-hidden bg-linear-to-br from-black via-brand-charcoal to-brand-charcoal-3'

/** The hero's side padding: the navbar's, so the hero text lines up with the logo (Hero.tsx). */
export const HERO_GUTTER_CLASS = 'px-6 lg:px-10 xl:px-6 2xl:px-10'

/** A page's ordinary width and padding (the catalog, product and brand pages are wider: WIDE_PAGE). */
const PAGE = 'mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20'
const WIDE_PAGE = 'mx-auto max-w-screen-2xl px-6 py-12 lg:px-10 lg:py-16'

/** The catalog's grid of product cards (Catalog.tsx). */
const CATALOG_GRID = 'grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4'

/** The Where to Buy page's list and map height (WhereToBuy.tsx). */
const PANE_HEIGHT = 'h-[34rem] lg:h-[40rem]'

/**
 * The first-load skeleton, wherever the router puts it (the first route still loading): in place of the whole layout
 * (the root route: the header's skeleton too), or inside the real layout's <main> once the header's data is in, or
 * inside the staff panel's layout (an admin page: only the page part). The wrapper's data-skeleton names the skeleton
 * shown (see skeletonFor).
 * @returns The skeleton, fading in.
 */
export function PageSkeleton() {
  // The route whose place the skeleton takes (strict: false gives its routeId a loose type).
  const boundary = String(useMatch({ strict: false, select: (match) => match.routeId }))
  const routeId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId })
  const { user } = useAuth()
  const kind = skeletonFor(routeId, user)
  const Body = SKELETONS[kind]
  const body = (
    <div data-skeleton={kind}>
      <SkeletonGroup>
        <Body nested={boundary.startsWith('/admin/')} />
      </SkeletonGroup>
    </div>
  )
  if (boundary !== rootRouteId) return <div className="animate-fade-in">{body}</div>
  return (
    <div className="animate-fade-in">
      <HeaderSkeleton />
      <main aria-busy="true" className="pt-22">
        {body}
      </main>
    </div>
  )
}

/**
 * Picks the skeleton of the page a route shows.
 * @param routeId - The deepest route being loaded (e.g. "/products/$slug"); undefined = not known yet.
 * @param user - Who is signed in, by the browser's session copy: the admin pages show a sign-in card to anyone but
 *   staff, My account to anyone but a business customer.
 * @returns The skeleton's name (a key of SKELETONS).
 */
export function skeletonFor(routeId: keyof FileRoutesById | undefined, user: User | null): SkeletonKind {
  if (routeId?.startsWith('/admin')) {
    if (user?.kind !== 'staff') return 'signIn'
    return routeId === '/admin/customers/$id' ? 'adminProfile' : 'admin'
  }
  switch (routeId) {
    case '/':
      return 'home'
    case '/catalog':
      return 'catalog'
    case '/products/$slug':
      return 'product'
    case '/brands/$slug':
      return 'brand'
    case '/articles/':
      return 'articles'
    case '/articles/$slug':
      return 'article'
    case '/where-to-buy':
      return 'whereToBuy'
    case '/login':
      return 'signIn'
    case '/account':
      return user?.kind === 'business' ? 'account' : 'signIn'
    default:
      return 'page'
  }
}

/**
 * The header's skeleton: the real logo (bundled, so it shows at once), a placeholder per menu entry (desktop) and the
 * end buttons, in the header's own bar.
 * @returns The decorative header.
 */
function HeaderSkeleton() {
  const { locale } = useI18n()
  return (
    <div aria-hidden="true" className={HEADER_BAR_CLASS}>
      <div className={HEADER_ROW_CLASS}>
        <Logo className="h-8 sm:h-14" />
        <div className="hidden flex-1 items-center justify-center gap-7 xl:flex">
          {mainNav([], locale).map((item) => (
            <Skeleton key={item.id} className="h-4 w-20" />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="hidden h-10 w-28 rounded-lg xl:block" />
          <Skeleton className="size-10 rounded-lg xl:hidden" />
        </div>
      </div>
    </div>
  )
}

/**
 * The breadcrumb trail's skeleton (Breadcrumbs.tsx).
 * @returns One short line of the trail's size.
 */
function BreadcrumbsSkeleton() {
  return <SkeletonText className="font-heading text-sm" width="w-64 max-w-full" />
}

/**
 * A grid of product card skeletons.
 * @param props.count - How many cards.
 * @param props.className - The grid's classes (CATALOG_GRID by default) and spacing.
 * @returns The grid.
 */
function CardGridSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn(CATALOG_GRID, className)}>
      {Array.from({ length: count }, (_, index) => (
        <CatalogCardSkeleton key={index} className="w-full" />
      ))}
    </div>
  )
}

/**
 * The home page: the hero (its frame, with the headline, pitch and buttons as faint lines), the stats band and the
 * start of the brands section.
 * @returns The home skeleton.
 */
function HomeSkeleton() {
  return (
    <>
      <div className={HERO_FRAME_CLASS}>
        <div className={cn('mx-auto flex h-full max-w-screen-2xl flex-col justify-center', HERO_GUTTER_CLASS)}>
          <div className="max-w-3xl">
            <SkeletonText tone="dark" className="mb-5 font-heading text-sm" width="w-40" />
            <SkeletonText tone="dark" lines={2} className="mb-5 text-[clamp(3.2rem,7.5vw,6.5rem)] leading-[1.05]" width="w-2/3" />
            <SkeletonText tone="dark" lines={2} className="text-lg" width="w-1/2" />
            <div className="mt-10 flex flex-wrap gap-4">
              <Skeleton tone="dark" className="h-12 w-40 rounded-lg" />
              <Skeleton tone="dark" className="h-12 w-52 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
      <div className="border-b border-neutral-150">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-14 lg:grid-cols-4 lg:px-10">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index}>
              <SkeletonText className="font-display text-5xl" width="w-28" />
              <SkeletonText className="mt-2 text-sm" width="w-36" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-black px-6 py-20 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeadingSkeleton tone="dark" className="max-w-2xl" />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <BrandCardSkeleton key={index} className={cn(index > 0 && 'hidden md:flex')} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * The catalog: heading, search box, category chips, toolbar, the results line and a page of cards.
 * @returns The catalog skeleton.
 */
function CatalogSkeleton() {
  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10 lg:py-20">
      <SectionHeadingSkeleton />
      <div className="mt-8 flex flex-col gap-5">
        <Skeleton className="h-12 w-full max-w-xl rounded-lg" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-28 rounded-lg" />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
      <div className="mt-8 border-b border-neutral-150 pb-4">
        <SkeletonText className="text-sm" width="w-48" />
      </div>
      <CardGridSkeleton count={8} className="mt-8" />
    </div>
  )
}

/**
 * The product page: breadcrumbs, the gallery (large photo + thumbnails) and the details column.
 * @returns The product skeleton.
 */
function ProductSkeleton() {
  return (
    <div className={WIDE_PAGE}>
      <BreadcrumbsSkeleton />
      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full rounded-3xl" />
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="aspect-square w-full rounded-xl" />
            ))}
          </div>
        </div>
        <DetailsSkeleton />
      </div>
    </div>
  )
}

/**
 * The details column of the product and brand pages: a red label, the name, a details line, the price block and the
 * service notes panel.
 * @returns The column's skeleton.
 */
function DetailsSkeleton() {
  return (
    <div className="flex flex-col">
      <SkeletonText className="text-sm" width="w-28" />
      <SkeletonText lines={2} className="mt-3 font-display text-3xl lg:text-4xl" width="w-1/2" />
      <SkeletonText className="mt-6 text-sm" width="w-64 max-w-full" />
      <div className="mt-8 border-t border-neutral-150 pt-6">
        <Skeleton className="h-9 w-40" />
        <SkeletonText className="mt-3 text-sm" width="w-56" />
      </div>
      <Skeleton className="mt-8 h-44 w-full rounded-2xl" />
    </div>
  )
}

/**
 * The brand page: breadcrumbs, the logo panel, the brand's details and the start of its products.
 * @returns The brand skeleton.
 */
function BrandSkeleton() {
  return (
    <div className={WIDE_PAGE}>
      <BreadcrumbsSkeleton />
      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
        <div className="flex flex-col">
          <SkeletonText className="font-heading text-sm" width="w-40" />
          <SkeletonText className="mt-3 font-display text-3xl lg:text-4xl" width="w-1/2" />
          <SkeletonText lines={4} className="mt-6 max-w-prose" />
          <div className="mt-8 space-y-4 border-y border-neutral-150 py-4">
            <SkeletonText className="text-sm" width="w-32" />
            <SkeletonText className="text-sm" width="w-72 max-w-full" />
          </div>
          <Skeleton className="mt-8 h-12 w-48 rounded-lg" />
        </div>
      </div>
      <CardGridSkeleton count={4} className="mt-16 lg:mt-20" />
    </div>
  )
}

/**
 * The articles page: breadcrumbs, heading, the featured article and a row of cards.
 * @returns The articles skeleton.
 */
function ArticlesSkeleton() {
  return (
    <div className={PAGE}>
      <BreadcrumbsSkeleton />
      <SectionHeadingSkeleton className="mt-10" />
      <ArticleCardSkeleton variant="featured" className="mt-12" />
      <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <ArticleCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

/**
 * An article: breadcrumbs, the meta line, the title, the photo and the first paragraphs, in the reading column.
 * @returns The article skeleton.
 */
function ArticleSkeleton() {
  return (
    <div className="px-6 py-16 lg:px-10 lg:py-20">
      <div className="mx-auto max-w-3xl">
        <BreadcrumbsSkeleton />
        <SkeletonText className="mt-10 font-heading text-xs" width="w-56" />
        <SkeletonText lines={2} className="mt-5 font-display text-4xl leading-tight lg:text-5xl" width="w-2/3" />
      </div>
      <Skeleton className="mx-auto mt-12 aspect-[16/9] w-full max-w-5xl rounded-3xl" />
      <div className="mx-auto mt-12 max-w-3xl space-y-6">
        <SkeletonText lines={4} className="text-lg leading-relaxed" />
        <SkeletonText lines={3} className="text-lg leading-relaxed" />
      </div>
    </div>
  )
}

/**
 * Where to Buy: heading, the search row, the results line, the store list and the map.
 * @returns The Where to Buy skeleton.
 */
function WhereToBuySkeleton() {
  return (
    <div className={PAGE}>
      <SectionHeadingSkeleton />
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-12 flex-1 rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg sm:w-56" />
      </div>
      <SkeletonText className="mt-3 text-sm" width="w-24" />
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className={cn(PANE_HEIGHT, 'overflow-hidden rounded-2xl border border-neutral-200')}>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="border-b border-neutral-150 p-5">
              <SkeletonText className="font-heading text-base" width="w-1/2" />
              <SkeletonText className="mt-1 text-sm" width="w-3/4" />
              <SkeletonText className="mt-3 text-sm" width="w-1/3" />
            </div>
          ))}
        </div>
        <Skeleton className={cn(PANE_HEIGHT, 'hidden w-full rounded-2xl lg:block')} />
      </div>
    </div>
  )
}

/**
 * A customer's profile (My account, and the staff view of a customer): heading and the profile's blocks.
 * @param props.className - The page's width and padding.
 * @returns The profile skeleton.
 */
function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <SectionHeadingSkeleton intro={1} className="mb-10" />
      <div className="grid gap-8">
        {[4, 2].map((rows, index) => (
          <div key={index} className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
            <SkeletonText className="font-display text-xl" width="w-40" />
            <div className="mt-6 space-y-4">
              {Array.from({ length: rows }, (_, row) => (
                <SkeletonText key={row} className="text-sm" width={row % 2 ? 'w-1/2' : 'w-2/3'} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The staff panel: its menu row (unless the panel's layout is already shown), then a page title with its buttons and a
 * table, or a customer's profile.
 * @param props.profile - The page is a customer's profile (/admin/customers/$id), not a table.
 * @param props.nested - Shown inside the panel's real layout (admin.tsx): the page part only.
 * @returns The admin skeleton.
 */
function AdminSkeleton({ profile, nested }: { profile: boolean; nested: boolean }) {
  const page = profile ? <ProfileSkeleton /> : <AdminTableSkeleton />
  if (nested) return page
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-10">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-150 pb-4">
        <div className="flex flex-wrap gap-1">
          {ADMIN_NAV.map(({ id }) => (
            <Skeleton key={id} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        <SkeletonText className="text-sm" width="w-48" />
      </div>
      {page}
    </div>
  )
}

/**
 * An admin table page: its title and buttons, the table's search box and rows.
 * @returns The table page's skeleton.
 */
function AdminTableSkeleton() {
  return (
    <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SkeletonText className="font-display text-3xl" width="w-48" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
          <div className="mt-8 flex justify-end">
            <Skeleton className="h-11 w-64 rounded-lg" />
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="flex items-center gap-6 border-b border-neutral-150 px-4 py-4 last:border-b-0">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/5" />
                <Skeleton className="hidden h-4 w-1/6 sm:block" />
                <Skeleton className="ms-auto h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
    </>
  )
}

/**
 * The sign-in card (LoginCard): title, subtitle, two fields and the button.
 * @returns The sign-in skeleton.
 */
function SignInSkeleton() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:py-24">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-soft sm:p-10">
        <SkeletonText className="font-display text-3xl" width="w-1/2" />
        <SkeletonText className="mb-8 mt-2 text-sm" width="w-3/4" />
        <div className="space-y-5">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index}>
              <SkeletonText className="text-sm" width="w-24" />
              <Skeleton className="mt-2 h-12 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/**
 * Any other page (Private Label, a category, a legal page…): its heading and a few paragraphs.
 * @returns The generic skeleton.
 */
function HeadingPageSkeleton() {
  return (
    <div className={PAGE}>
      <SectionHeadingSkeleton />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-neutral-200 p-7">
            <Skeleton className="size-12 rounded-xl" />
            <SkeletonText className="mt-5 font-display text-xl" width="w-2/3" />
            <SkeletonText lines={3} className="mt-3 text-sm leading-relaxed" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The name of a page skeleton (a key of SKELETONS). */
export type SkeletonKind = 'home' | 'catalog' | 'product' | 'brand' | 'articles' | 'article' | 'whereToBuy' | 'account' | 'admin' | 'adminProfile' | 'signIn' | 'page'

/** Every page skeleton, by name (skeletonFor picks one); `nested` = inside the staff panel's real layout. */
const SKELETONS: Record<SkeletonKind, ComponentType<{ nested: boolean }>> = {
  home: HomeSkeleton,
  catalog: CatalogSkeleton,
  product: ProductSkeleton,
  brand: BrandSkeleton,
  articles: ArticlesSkeleton,
  article: ArticleSkeleton,
  whereToBuy: WhereToBuySkeleton,
  account: () => <ProfileSkeleton className={PAGE} />,
  admin: ({ nested }) => <AdminSkeleton profile={false} nested={nested} />,
  adminProfile: ({ nested }) => <AdminSkeleton profile nested={nested} />,
  signIn: SignInSkeleton,
  page: HeadingPageSkeleton,
}


