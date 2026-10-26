/**
 * routes/where-to-buy.tsx — "Where to Buy" (משווקים): the store locator with the map of branches.
 * The page itself lives in components/WhereToBuy.tsx; this file only registers the route that the
 * navbar link points to.
 */
import { createFileRoute } from '@tanstack/react-router'
import { WhereToBuy } from '@/components/WhereToBuy'

export const Route = createFileRoute('/where-to-buy')({
  component: WhereToBuy,
})
