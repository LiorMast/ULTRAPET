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
    eyebrow: 'קטגוריות מוצרים',
    title: 'כל מה שחיית המחמד צריכה',
    intro: 'מזון, חול ואביזרים לכלבים, חתולים ובעלי חיים קטנים, במבחר סיטונאי רחב.',
    explore: 'לקטגוריה',
    products: '{n} מוצרים',
    carouselLabel: 'קטגוריות מוצרים',
    descriptions: {
      dogFood: 'תזונה יבשה ורטובה לכלבים מכל הגזעים ושלבי החיים.',
      catFood: 'תזונה פרמיום לחתולים מקורה ומחוץ.',
      wetFood: 'מזון רטוב גורמה ומעדנים פונקציונליים.',
      litter: 'חול מתקדם לחתולים בטכנולוגיה מתקדמת.',
      smallAnimals: 'תזונה מומחית לארנבות, חזירי ים, אוגרים ועוד.',
      birds: "תערובות זרעים ותוספים לתוכים, קנריות ופינצ'ות.",
    },
  },
  carousel: {
    previous: 'הקודם',
    next: 'הבא',
  },
  brands: {
    eyebrow: 'המותגים שלנו',
    title: 'מותגי פרימיום מהיצרנים המובילים בעולם',
    intro: 'בחרו מותג כדי לראות את המוצרים, הקטגוריות והמידע המלא.',
    explore: 'למותג',
    taglines: {
      ultraPet: 'תזונה פרמיום מלאה',
      internutri: 'פורמולות מדעיות',
      greenheart: 'טבעי ואורגני',
      paw: 'מצוינות יומיומית',
      jrFarm: 'מומחי בעלי חיים קטנים',
      ultraClean: 'היגיינת חתולים פרמיום',
    },
  },
  stats: {
    title: 'אולטרה פט במספרים',
    retail: 'נקודות מכירה',
    partners: 'שותפי ייצור',
    products: 'מוצרים',
    years: 'שנות ניסיון',
  },
  header: {
    home: 'אולטרה פט – לדף הבית',
    mainMenu: 'תפריט ראשי',
    openMenu: 'פתיחת תפריט',
    closeMenu: 'סגירת תפריט',
    skipToContent: 'דילוג לתוכן',
  },
  hero: {
    eyebrow: 'יבואן ומפיץ לאומי של מוצרי חיות מחמד בישראל',
    title: 'אולטרה',
    titleAccent: 'פט',
    tagline: 'יבוא והפצה של מזון ומוצרים לחיות מחמד',
    // description: 'מספקים מותגי חיות מחמד פרמיום לקמעונאים, רשתות ומפיצים ברחבי ישראל. מוערכים על ידי התעשייה מאז 2012.',
    description: `
    אנו חברה שמתמחה בייבוא ושיווק של מוצרי איכות לחיות מחמד
ניתן למצוא אצלו מבחר ענק של:
מתקני גירוד, עמודי גירוד, חול קריסטלי, פדים לאילוף וכו׳.
בנוסף ניתן למצוא אצלנו שימורים ומעדנים,
מזון יבש לכלב ולחתול ועוד...
**מכירה סיטונאית בלבד**
    `,
    ctaBrands: 'המותגים שלנו',
    ctaBusiness: 'הפוך ללקוח עסקי',
    scrollDown: 'המשך למטה',
    slideshowLabel: 'מצגת תמונות',
    showPhoto: 'הצג תמונה {n} מתוך {total}',
    pause: 'השהיית המצגת',
    play: 'הפעלת המצגת',
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
