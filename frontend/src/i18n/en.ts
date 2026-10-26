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
  about: {
    eyebrow: 'About Ultra Pet',
    title: "Israel's leading importer and distributor of quality pet products",
    intro:
      'Ultra Pet is a leading importer and distributor of quality pet food and supplies in Israel. We serve professional pet stores, retail chains and local suppliers, and provide them with tailored solutions.',
    visionTitle: 'Vision & mission',
    pillars: {
      expertise: {
        title: 'Professional expertise',
        text: 'Our team has deep knowledge and wide-ranging relationships with leading manufacturers worldwide, so we can bring you the most innovative, highest-quality brands.',
      },
      service: {
        title: 'Personal, reliable service',
        text: 'We believe in a personal touch and full transparency: fast response, professional guidance and uncompromising quality control.',
      },
      care: {
        title: 'Committed to pets\' quality of life',
        text: 'Our goal is to give every dog and cat in Israel optimal nutrition and high-quality accessories that improve their everyday lives.',
      },
    },
    offerTitle: 'What we offer',
    offers: {
      food: {
        title: 'Dry & wet food',
        text: 'Leading global brands, with a range matched to age, breed and special dietary needs.',
      },
      litter: {
        title: 'Cat litter',
        text: 'A range of types: tofu, clumping, boxed clumping and crystal litter.',
      },
      accessories: {
        title: 'Accessories & equipment',
        text: 'Bowls and plastics, cat scratchers, grooming products and dog training pads.',
      },
      privateLabel: {
        title: 'Private label',
        text: 'Full support in planning, designing and launching a private-label brand for customers.',
      },
      logistics: {
        title: 'Logistics & inventory',
        text: 'Fast shipping, smart inventory management and stock available at any moment.',
      },
    },
    advantagesTitle: 'The Ultra Pet advantage',
    advantages: {
      import: 'Official import and fast supply',
      prices: 'Competitive prices thanks to large import volumes',
      support: 'Ongoing support and professional advice on choosing the right products',
    },
    joinTitle: 'Join the success',
    joinText:
      'Ultra Pet invites you to join the front row of distribution partners in Israel. Together we will build a winning product strategy, maximize customer satisfaction and move your business forward.',
    cta: 'Get a quote',
    closing:
      'We believe in professional, courteous service and take the time to understand our customers\' unique needs. Through our wide distribution network we serve pet stores and pet centers nationwide, with fast and efficient deliveries across the country.',
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Talk to us',
    description: 'Whether you run a store, a retail chain, a distribution business or a wholesale operation, we would be glad to hear from you and prepare a tailored quote.',
    methods: {
      phone: { label: 'Phone', sub: 'Sun–Thu, 09:00–16:00' },
      whatsapp: { label: 'WhatsApp', sub: 'Fast business inquiries' },
      email: { label: 'Email', sub: 'We will get back to you soon' },
      hours: { label: 'Opening hours', value: 'Sun–Thu: 09:00–16:00', sub: 'Fridays and holiday eves: closed' },
    },
    formTitle: 'Send a message',
    formSubtitle: 'Fields marked * are required',
    fieldName: 'Full name',
    fieldPhone: 'Phone',
    fieldEmail: 'Email',
    fieldMessage: 'Message',
    fieldNamePH: 'Your name',
    fieldPhonePH: '050-0000000',
    fieldMessagePH: 'How can we help?',
    errorRequired: 'Required field',
    errorEmail: 'Invalid email address',
    send: 'Send message',
    mailSubject: 'Inquiry from the Ultra Pet website',
    successTitle: 'Almost there!',
    successDesc: 'Your email app opened with the message. Press send there to complete your inquiry.',
  },
  login: {
    title: 'Business customer login',
    subtitle: 'Price list, personal discounts and orders for registered customers.',
    email: 'Email',
    password: 'Password',
    remember: 'Remember me',
    submit: 'Log in',
    errorRequired: 'Required field',
    errorEmail: 'Invalid email address',
    comingSoon: 'The customer area opens soon. In the meantime, contact us and we will gladly help.',
    noAccount: "Don't have an account yet?",
    openAccount: 'Open a business account',
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
