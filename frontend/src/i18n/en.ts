/**
 * en.ts — English UI strings (secondary language, served under the /en URL prefix).
 *
 * Must have exactly the same keys as he.ts — the `Dictionary` type enforces it.
 * Copy comes from legacy/src/lib/translations/en.ts and the legacy CMS export.
 */
import type { Dictionary } from './he'

export const en: Dictionary = {
  nav: {
    brands: 'Brands',
    products: 'Products',
    privateLabel: 'Private Label',
    whereToBuy: 'Where to Buy',
    about: 'About',
    contact: 'Contact',
    allCategories: 'All categories',
    catalog: 'Download the full catalog (PDF)',
    businessCta: 'Business Account',
    login: 'Login',
  },
  categories: {
    dogFood: 'Dog Food',
    catFood: 'Cat Food',
    wetFood: 'Wet Food & Treats',
    litter: 'Cat Litter',
    smallAnimals: 'Small Animals',
    birds: 'Birds',
  },
  header: {
    home: 'UltraPet – home page',
    mainMenu: 'Main menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    skipToContent: 'Skip to content',
  },
  lang: {
    switchLabel: 'Language',
    comingSoon: 'Coming Soon',
  },
  page: {
    comingSoon: 'This page is under construction and will be available soon.',
    notFoundTitle: 'Page not found',
    notFoundBody: 'The link may be wrong, or the page has moved.',
    backHome: 'Back to the home page',
  },
}
