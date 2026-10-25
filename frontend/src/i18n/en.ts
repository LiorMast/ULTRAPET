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
    eyebrow: 'Product Categories',
    title: 'Everything a pet needs',
    intro: 'Food, litter and supplies for dogs, cats and small animals, in a wide wholesale range.',
    explore: 'Explore category',
    products: '{n} products',
    carouselLabel: 'Product categories',
    descriptions: {
      dogFood: 'Complete dry and wet nutrition for dogs of all breeds and life stages.',
      catFood: 'Premium feline nutrition crafted for indoor and outdoor cats.',
      wetFood: 'Gourmet wet food and functional treats for daily supplementation.',
      litter: 'Advanced clumping and non-clumping litter for superior hygiene.',
      smallAnimals: 'Specialist nutrition for rabbits, guinea pigs, hamsters and more.',
      birds: 'Complete seed mixes and supplements for parrots, canaries and finches.',
    },
  },
  carousel: {
    previous: 'Previous',
    next: 'Next',
  },
  brands: {
    eyebrow: 'Our Brands',
    title: "Premium brands from the world's leading manufacturers",
    intro: 'Choose a brand to see its products, categories and full details.',
    explore: 'Explore brand',
    taglines: {
      ultraPet: 'Premium Complete Nutrition',
      internutri: 'Science-Based Formulas',
      greenheart: 'Natural & Organic',
      paw: 'Everyday Excellence',
      jrFarm: 'Small Animal Specialists',
      ultraClean: 'Premium Cat Hygiene',
    },
  },
  stats: {
    title: 'Ultra Pet in numbers',
    retail: 'Retail locations',
    partners: 'Manufacturing partners',
    products: 'Products',
    years: 'Years of experience',
  },
  header: {
    home: 'UltraPet – home page',
    mainMenu: 'Main menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    skipToContent: 'Skip to content',
  },
  hero: {
    eyebrow: "Israel's National Pet Import & Distribution Company",
    title: 'Ultra',
    titleAccent: 'Pet',
    tagline: 'Import and Distribution of Pet Food and Pet Supplies',
    description:
      'Supplying premium pet brands to retailers, chains and distributors across Israel. Trusted by the industry since 2012.',
    ctaBrands: 'Our Brands',
    ctaBusiness: 'Become a Business Customer',
    scrollDown: 'Scroll down',
    slideshowLabel: 'Photo slideshow',
    showPhoto: 'Show photo {n} of {total}',
    pause: 'Pause slideshow',
    play: 'Play slideshow',
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
