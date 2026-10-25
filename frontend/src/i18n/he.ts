/**
 * he.ts — Hebrew UI strings. Hebrew is the site's default language.
 *
 * The shape of this object defines the `Dictionary` type, so every other language file (en.ts, and
 * later ru.ts / ar.ts) must provide exactly the same keys — TypeScript reports anything missing.
 * Copy comes from legacy/src/lib/translations/he.ts, the legacy CMS export and the live WordPress site.
 * Add a section here (and in en.ts) whenever a new part of the site is built.
 */
export const he = {
  nav: {
    brands: 'מותגים',
    products: 'מוצרים',
    privateLabel: 'תווית פרטית',
    whereToBuy: 'משווקים',
    about: 'אודות',
    contact: 'צור קשר',
    allCategories: 'כל הקטגוריות',
    catalog: 'הקטלוג המלא להורדה (PDF)',
    businessCta: 'חשבון עסקי',
    login: 'התחברות',
  },
  categories: {
    dogFood: 'מזון לכלבים',
    catFood: 'מזון לחתולים',
    wetFood: 'מזון רטוב ומעדנים',
    litter: 'חול לחתולים',
    smallAnimals: 'בעלי חיים קטנים',
    birds: 'בעלי כנף',
  },
  header: {
    home: 'אולטרה פט – לדף הבית',
    mainMenu: 'תפריט ראשי',
    openMenu: 'פתיחת תפריט',
    closeMenu: 'סגירת תפריט',
    skipToContent: 'דילוג לתוכן',
  },
  lang: {
    switchLabel: 'שפה',
    comingSoon: 'בקרוב',
  },
  page: {
    comingSoon: 'העמוד הזה בבנייה ויעלה בקרוב.',
    notFoundTitle: 'הדף לא נמצא',
    notFoundBody: 'ייתכן שהקישור שגוי או שהדף הועבר.',
    backHome: 'חזרה לדף הבית',
  },
}

/** The type every language dictionary must match (derived from the Hebrew strings above). */
export type Dictionary = typeof he
