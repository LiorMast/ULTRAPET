/**
 * ArticleCard.tsx — A rounded card for one article: photo (fades in once loaded), topic,
 * date and reading time, title, summary and a "read the article" line that underlines on hover; the whole card is one
 * link to the article page. Two looks (`variant`):
 * `default` for grids, `featured` (photo beside the text on large screens) for the latest article.
 * Used by the articles list page and the "more articles" row of an article page.
 *
 * Also exports ArticleMeta, the topic · date · reading-time line, shared with the article page header, and
 * ArticleCardSkeleton, the card's loading placeholder in the same frame (the pages' first-load skeletons,
 * PageSkeleton.tsx). While the photo downloads, its frame shimmers (img-frame).
 */
import { Link } from '@tanstack/react-router'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import type { Article } from '@/api'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import { articleImage, localized } from '@/config'
import { useI18n, type Locale } from '@/i18n'
import { imgFade } from '@/motion'

/** Reading speed used for the "N min read" estimate, in words per minute. */
const WORDS_PER_MINUTE = 200

/**
 * Estimates how long an article takes to read.
 * @param article - The article.
 * @param locale - The language whose text is counted.
 * @returns Whole minutes, at least 1.
 */
function readingMinutes(article: Article, locale: Locale) {
  const text = localized(article.body, locale)
    .flatMap((block) => (block.type === 'p' ? [block.text] : block.items))
    .join(' ')
  return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE))
}

/**
 * The topic, publication date and reading time of an article, on one line.
 * @param props.article - The article.
 * @param props.className - Extra classes, e.g. colour or spacing.
 * @returns The meta line.
 */
export function ArticleMeta({ article, className }: { article: Article; className?: string }) {
  const { t, locale } = useI18n()
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Asia/Jerusalem' }).format(new Date(article.publishedAt))
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 font-heading text-xs font-semibold text-brand-charcoal-muted', className)}>
      <span className="text-brand-red-dark">{t.articles.topics[article.topic]}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={article.publishedAt}>{date}</time>
      <span aria-hidden="true">·</span>
      <span>{t.articles.readingTime.replace('{n}', String(readingMinutes(article, locale)))}</span>
    </p>
  )
}

const cardVariants = cva(
  [
    'group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white outline-none',
    'transition-[box-shadow,border-color] duration-300 hover:border-neutral-300 hover:shadow-soft',
    'focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default: '',
        featured: 'lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

/**
 * The photo frame's classes (shared with the skeleton).
 * @param featured - The wide card (photo beside the text on large screens).
 * @returns The frame's size classes.
 */
const photoClass = (featured: boolean) => cn('relative aspect-[16/10] overflow-hidden', featured && 'lg:aspect-auto lg:min-h-96')

/**
 * The text column's classes (shared with the skeleton).
 * @param featured - The wide card.
 * @returns The column's layout classes.
 */
const bodyClass = (featured: boolean) => cn('flex flex-1 flex-col p-5 sm:p-7', featured && 'lg:justify-center lg:p-12')

/**
 * One article card. A real link (crawlable, keyboard-focusable); on hover its border darkens and it gains a soft shadow.
 * @param props.article - The article to show.
 * @param props.variant - `default` (grid card) or `featured` (wide card, photo beside the text).
 * @param props.headingLevel - The title's heading tag, so the card fits the page outline; default "h3".
 * @param props.priority - Load the photo immediately (for a card at the top of the page); default false.
 * @param props.className - Extra classes for the card, e.g. grid placement.
 * @returns The card link element.
 */
export function ArticleCard({
  article,
  variant,
  headingLevel: Heading = 'h3',
  priority = false,
  className,
}: { article: Article; headingLevel?: 'h2' | 'h3'; priority?: boolean; className?: string } & VariantProps<typeof cardVariants>) {
  const { t, locale } = useI18n()
  const featured = variant === 'featured'
  const image = articleImage(article.slug)
  return (
    <Link to="/articles/$slug" params={{ slug: article.slug }} className={cn(cardVariants({ variant }), className)}>
      <div className={cn(photoClass(featured), 'img-frame bg-neutral-150')}>
        {image && (
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes={featured ? '(min-width: 1024px) 60vw, 100vw' : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'}
            alt=""
            width={1280}
            height={800}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            {...imgFade}
            className="img-fade absolute inset-0 size-full object-cover"
          />
        )}
      </div>
      <div className={bodyClass(featured)}>
        <ArticleMeta article={article} />
        <Heading className={cn('mt-4 font-display font-bold text-brand-charcoal', featured ? 'text-2xl lg:text-3xl' : 'text-xl')}>
          {localized(article.title, locale)}
        </Heading>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-brand-charcoal-muted">{localized(article.description, locale)}</p>
        <span className="mt-6 w-fit font-heading text-sm font-semibold text-brand-red-dark underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-300 group-hover:decoration-current">
          {t.articles.readMore}
        </span>
      </div>
    </Link>
  )
}

/**
 * The loading placeholder of an article card: the same frame, photo and text rows, as skeletons.
 * @param props.variant - `default` (grid card) or `featured`, as the card it stands for.
 * @param props.className - Extra classes for the card, e.g. grid placement.
 * @returns The decorative placeholder card (put it inside a SkeletonGroup).
 */
export function ArticleCardSkeleton({ variant, className }: { className?: string } & VariantProps<typeof cardVariants>) {
  const featured = variant === 'featured'
  return (
    <div aria-hidden="true" className={cn(cardVariants({ variant }), 'pointer-events-none', className)}>
      <Skeleton className={cn(photoClass(featured), 'rounded-none')} />
      <div className={bodyClass(featured)}>
        <SkeletonText className="text-xs" width="w-1/2" />
        <SkeletonText className={cn('mt-4', featured ? 'text-2xl lg:text-3xl' : 'text-xl')} width="w-4/5" />
        <SkeletonText lines={3} className="mt-3 flex-1 text-sm leading-relaxed" />
        <SkeletonText className="mt-6 text-sm" width="w-28" />
      </div>
    </div>
  )
}
