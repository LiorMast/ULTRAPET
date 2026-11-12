/**
 * routes/where-to-buy.tsx — "Where to Buy" (משווקים): the store locator with the map of branches.
 * The page itself lives in components/WhereToBuy.tsx; this file registers the route that the navbar link
 * points to, loads the reseller stores from the API, and sets the head tags (title, description, canonical,
 * hreflang).
 */
import { createFileRoute } from '@tanstack/react-router'
import { fetchResellers } from '@/api'
import { WhereToBuy } from '@/components/WhereToBuy'
import { dictionaryFor } from '@/i18n'
import { pageHead } from '@/seo'

export const Route = createFileRoute('/where-to-buy')({
  loader: ({ abortController }) => fetchResellers(abortController.signal),
  head: ({ match }) => {
    const { locale } = match.context
    const t = dictionaryFor(locale)
    return pageHead({ locale, path: '/where-to-buy', title: t.whereToBuy.title, description: t.whereToBuy.description })
  },
  component: WhereToBuyPage,
})

/**
 * The Where to Buy page.
 * @returns The store locator with the loaded stores.
 */
function WhereToBuyPage() {
  return <WhereToBuy branches={Route.useLoaderData()} />
}
