/**
 * routes/where-to-buy.tsx — "Where to Buy" (משווקים): the store locator with the map of branches.
 * The page itself lives in components/WhereToBuy.tsx; this file only registers the route that the
 * navbar link points to, and its head tags (title, description, canonical, hreflang).
 */
import { createFileRoute } from '@tanstack/react-router'
import { WhereToBuy } from '@/components/WhereToBuy'
import { dictionaryFor } from '@/i18n'
import { pageHead } from '@/seo'

export const Route = createFileRoute('/where-to-buy')({
  head: ({ match }) => {
    const { locale } = match.context
    const t = dictionaryFor(locale)
    return pageHead({ locale, path: '/where-to-buy', title: t.whereToBuy.title, description: t.whereToBuy.description })
  },
  component: WhereToBuy,
})
