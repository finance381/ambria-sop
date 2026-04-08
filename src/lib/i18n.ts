type Lang = 'hi' | 'en'

const T: Record<string, Record<Lang, string>> = {
  'app.name': { hi: 'Ambria Kitchen SOP', en: 'Ambria Kitchen SOP' },
  'app.tagline': { hi: 'मानक संचालन प्रक्रिया', en: 'Standard Operating Procedures' },
  'kiosk.enter_pin': { hi: 'स्टेशन PIN दर्ज करें', en: 'Enter Station PIN' },
  'kiosk.wrong_pin': { hi: 'गलत PIN, फिर से कोशिश करें', en: 'Wrong PIN, try again' },
  'kiosk.select_name': { hi: 'अपना नाम चुनें', en: 'Select your name' },
  'kiosk.today_menu': { hi: 'आज का मेन्यू', en: "Today's Menu" },
  'kiosk.full_menu': { hi: 'पूरा मेन्यू', en: 'Full Menu' },
  'kiosk.masala_kits': { hi: 'मसाला किट', en: 'Masala Kits' },
  'kiosk.community': { hi: 'समुदाय गाइड', en: 'Community Guides' },
  'kiosk.checklists': { hi: 'चेकलिस्ट', en: 'Checklists' },
  'kiosk.equipment': { hi: 'उपकरण', en: 'Equipment' },
  'kiosk.back': { hi: 'वापस', en: 'Back' },
  'kiosk.no_sops': { hi: 'कोई SOP उपलब्ध नहीं', en: 'No SOPs available' },
  'kiosk.pax': { hi: 'पैक्स', en: 'Pax' },
  'kiosk.min': { hi: 'मिनट', en: 'min' },
  'comply.title': { hi: 'कम्प्लायंस', en: 'Compliance' },
  'comply.pending': { hi: 'बाकी है', en: 'Pending' },
  'comply.submitted': { hi: 'जमा किया', en: 'Submitted' },
  'comply.approved': { hi: 'स्वीकृत', en: 'Approved' },
  'comply.flagged': { hi: 'चिह्नित', en: 'Flagged' },
  'comply.take_photo': { hi: 'फ़ोटो लें', en: 'Take Photo' },
  'comply.submit': { hi: 'जमा करें', en: 'Submit' },
  'comply.submitting': { hi: 'जमा हो रहा है...', en: 'Submitting...' },
  'comply.success': { hi: 'सफलतापूर्वक जमा!', en: 'Submitted successfully!' },
  'comply.offline_queued': { hi: 'ऑफलाइन सेव — कनेक्ट होने पर भेजा जाएगा', en: 'Saved offline — will sync when connected' },
  'comply.no_pending': { hi: 'कोई बाकी चेकलिस्ट नहीं', en: 'No pending checklists' },
  'admin.dashboard': { hi: 'डैशबोर्ड', en: 'Dashboard' },
  'admin.login': { hi: 'एडमिन लॉगिन', en: 'Admin Login' },
  'admin.email': { hi: 'ईमेल', en: 'Email' },
  'admin.password': { hi: 'पासवर्ड', en: 'Password' },
  'admin.login_btn': { hi: 'लॉगिन', en: 'Login' },
  'admin.logout': { hi: 'लॉगआउट', en: 'Logout' },
  'admin.approve': { hi: 'स्वीकृत करें', en: 'Approve' },
  'admin.flag': { hi: 'चिह्नित करें', en: 'Flag' },
  'common.loading': { hi: 'लोड हो रहा है...', en: 'Loading...' },
  'common.error': { hi: 'कुछ गलत हुआ', en: 'Something went wrong' },
  'common.search': { hi: 'खोजें', en: 'Search' },
}

let currentLang: Lang = (localStorage.getItem('ambria-lang') as Lang) || 'hi'

export function setLang(lang: Lang) {
  currentLang = lang
  localStorage.setItem('ambria-lang', lang)
}

export function getLang(): Lang { return currentLang }

export function t(key: string): string {
  return T[key]?.[currentLang] || T[key]?.['en'] || key
}

export function localized(hi: string | undefined, en: string): string {
  return (currentLang === 'hi' && hi) ? hi : en
}