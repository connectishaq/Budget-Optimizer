// Which languages are live. Only these appear in the language picker, are
// picked automatically from the browser, get their own language/country pages
// (/ur-pk/…), hreflang links and sitemap entries, and can be suggested by the
// "This page is also in…" banner.
//
// The other languages' translation files stay in src/i18n/locales untouched:
// to switch one back on, add its code here and rebuild. Nothing else to change.
//
// Off for now (waiting for a native-speaker review): fr, pt, de, id.

export const ENABLED_LANGUAGES = ['en', 'ur', 'hi', 'ar', 'es'];

export const isEnabledLanguage = (lang) => ENABLED_LANGUAGES.includes(lang);
