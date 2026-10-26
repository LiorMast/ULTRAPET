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
  about: {
    eyebrow: 'אודות אולטרה פט',
    title: 'היבואן והמפיץ המוביל של מוצרי איכות לחיות מחמד',
    intro:
      'אולטרה פט היא חברה מובילה בישראל ביבוא והפצה של מזון וציוד איכותיים לחיות מחמד. אנו משרתים חנויות חיות מקצועיות, רשתות מזון וספקים מקומיים, ומספקים להם פתרונות מותאמים אישית.',
    visionTitle: 'חזון ומשימה',
    pillars: {
      expertise: {
        title: 'התמקצעות ומקצועיות',
        text: 'אנשי הצוות שלנו מחזיקים בידע מעמיק ובקשרים ענפים מול יצרנים מובילים בעולם, כדי להביא אליכם את המותגים החדשניים והאיכותיים ביותר.',
      },
      service: {
        title: 'שירות אישי ואמין',
        text: 'אנו מאמינים ביחס אישי ובשקיפות מלאה: מענה מהיר, ליווי מקצועי ובקרת איכות בלתי מתפשרת.',
      },
      care: {
        title: 'מחויבות לאיכות החיים של חיות המחמד',
        text: 'המטרה שלנו היא להבטיח לכל כלב וחתול בארץ תזונה מיטבית ואביזרים ברמה גבוהה, שישדרגו את חיי היומיום שלהם.',
      },
    },
    offerTitle: 'מה אנחנו מציעים',
    offers: {
      food: {
        title: 'מזון יבש ורטוב',
        text: 'מותגים מובילים גלובליים, בתמהיל מותאם לגיל, לגזע ולצרכים תזונתיים מיוחדים.',
      },
      litter: {
        title: 'חול לחתולים',
        text: 'מגוון סוגים: חול טופו, חול מתגבש, חול מתגבש בקופסה וחול קריסטלי.',
      },
      accessories: {
        title: 'אביזרים וציוד',
        text: 'כלי אוכל ופלסטיקה, מתקני גירוד לחתולים, מוצרי טיפוח ופדים לכלבים.',
      },
      privateLabel: {
        title: 'בניית מותג פרטי',
        text: 'ליווי מלא בתכנון, בעיצוב ובהשקה של מותג פרטי ללקוחות.',
      },
      logistics: {
        title: 'לוגיסטיקה ומלאי',
        text: 'משלוחים מהירים, ניהול מלאי חכם ומלאי זמין בכל רגע נתון.',
      },
    },
    advantagesTitle: 'יתרונות אולטרה פט',
    advantages: {
      import: 'יבוא רשמי ואספקה מהירה',
      prices: 'מחירים תחרותיים בזכות היקפי יבוא גדולים',
      support: 'תמיכה וליווי שוטף, כולל ייעוץ מקצועי לבחירת המוצרים המתאימים',
    },
    joinTitle: 'הצטרפו להצלחה',
    joinText:
      'אולטרה פט מזמינה אתכם להצטרף לשורה הראשונה של שותפי ההפצה בישראל. יחד נבנה אסטרטגיית מוצר מנצחת, נמקסם את שביעות רצון הלקוחות ונצעיד את העסק שלכם קדימה.',
    cta: 'לקבלת הצעת מחיר',
    closing:
      'אנו מאמינים בשירות מקצועי ואדיב, ומקדישים זמן להבנת הצרכים הייחודיים של לקוחותינו. באמצעות רשת ההפצה הרחבה שלנו אנו מספקים שירות מהיר ואמין לחנויות ולמרכזי חיות מחמד ברחבי הארץ, עם משלוחים מהירים ויעילים בכל רחבי הארץ.',
  },
  contact: {
    eyebrow: 'צור קשר',
    title: 'דברו איתנו',
    description: 'בין אם אתם בעלי חנות, רשת קמעונאית, מפיץ או סיטונאי, נשמח לשמוע מכם ולהכין הצעת מחיר מותאמת אישית.',
    methods: {
      phone: { label: 'טלפון', sub: 'א׳–ה׳, \u206609:00–16:00\u2069' },
      whatsapp: { label: 'וואטסאפ', sub: 'פניות עסקיות מהירות' },
      email: { label: 'דוא"ל', sub: 'נחזור אליכם בהקדם' },
      hours: { label: 'שעות פעילות', value: 'א׳–ה׳: \u206609:00–16:00\u2069', sub: 'שישי וערבי חג: סגור' },
    },
    formTitle: 'שלחו הודעה',
    formSubtitle: 'שדות המסומנים ב-* הם שדות חובה',
    fieldName: 'שם מלא',
    fieldPhone: 'טלפון',
    fieldEmail: 'דוא"ל',
    fieldMessage: 'הודעה',
    fieldNamePH: 'שמכם',
    fieldPhonePH: '050-0000000',
    fieldMessagePH: 'איך נוכל לעזור?',
    errorRequired: 'שדה חובה',
    errorEmail: 'כתובת דוא"ל לא תקינה',
    send: 'שליחת הודעה',
    mailSubject: 'פנייה מאתר אולטרה פט',
    successTitle: 'כמעט שם!',
    successDesc: 'תוכנת הדוא"ל שלכם נפתחה עם ההודעה. לחצו שם על שליחה כדי להשלים את הפנייה.',
  },
  login: {
    title: 'כניסה ללקוחות עסקיים',
    subtitle: 'מחירון, הנחות אישיות והזמנות ללקוחות רשומים.',
    email: 'דוא"ל',
    password: 'סיסמה',
    remember: 'זכור אותי',
    submit: 'התחברות',
    errorRequired: 'שדה חובה',
    errorEmail: 'כתובת דוא"ל לא תקינה',
    comingSoon: 'אזור הלקוחות ייפתח בקרוב. בינתיים אפשר לפנות אלינו ונשמח לעזור.',
    noAccount: 'עדיין אין לכם חשבון?',
    openAccount: 'פתיחת חשבון עסקי',
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
  whereToBuy: {
    eyebrow: 'משווקים',
    title: 'איתור חנויות',
    description: 'מוצרי אולטרה פט נמכרים בחנויות לחיות מחמד ברחבי הארץ. חפשו לפי עיר או כתובת, או מצאו את החנות הקרובה אליכם.',
    searchLabel: 'חיפוש חנות',
    searchPlaceholder: 'שם חנות, עיר או כתובת',
    nearest: 'חפש חנות קרובה',
    locating: 'מאתר את המיקום שלך…',
    locationDenied: 'לא הצלחנו לאתר את המיקום שלך. אפשר לחפש לפי עיר או כתובת.',
    locationUnsupported: 'הדפדפן לא תומך באיתור מיקום. אפשר לחפש לפי עיר או כתובת.',
    results: '{n} חנויות',
    noResults: 'לא נמצאו חנויות. נסו חיפוש אחר.',
    listLabel: 'רשימת חנויות',
    mapLabel: 'מפת חנויות',
    mapLoading: 'טוען מפה…',
    distance: '{km} ק"מ ממך',
    call: 'התקשרו',
    navigate: 'ניווט בוויז',
    website: 'לאתר',
    approximate: 'מיקום משוער',
    fullscreen: 'מסך מלא',
    exitFullscreen: 'יציאה ממסך מלא',
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
