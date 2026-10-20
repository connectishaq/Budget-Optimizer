// The pre-rendered pages, one per language + country (/en-gb/, /ar-ae/…).
// Each is the same page as / with its words, country and the "5 Hidden
// Household Expense Leaks" article adapted (src/i18n/articles/<path>.json;
// en-us uses the article in en.json). The root / stays the English page and
// is the x-default for search engines.

export const LOCALE_PAGES = [
  { path: 'en-us', lang: 'en', country: 'US' },
  { path: 'en-gb', lang: 'en', country: 'GB' },
  { path: 'en-in', lang: 'en', country: 'IN' },
  { path: 'en-pk', lang: 'en', country: 'PK' },
  { path: 'en-ae', lang: 'en', country: 'AE' },
  { path: 'en-ca', lang: 'en', country: 'CA' },
  { path: 'en-au', lang: 'en', country: 'AU' },
  { path: 'es-es', lang: 'es', country: 'ES' },
  { path: 'es-mx', lang: 'es', country: 'MX' },
  { path: 'hi-in', lang: 'hi', country: 'IN' },
  { path: 'ur-pk', lang: 'ur', country: 'PK' },
  { path: 'ar-ae', lang: 'ar', country: 'AE' },
  { path: 'ar-sa', lang: 'ar', country: 'SA' },
  { path: 'fr-fr', lang: 'fr', country: 'FR' },
  { path: 'pt-br', lang: 'pt', country: 'BR' },
  { path: 'id-id', lang: 'id', country: 'ID' },
  { path: 'de-de', lang: 'de', country: 'DE' }
];

/** "en-gb" -> "en-GB" (the form used in hreflang and lang attributes). */
export const bcp47 = (path) => path.replace(/-([a-z]{2})$/, (m, r) => `-${r.toUpperCase()}`);

/** The page for this language and country, else the first page in that language, else null. */
export function pageFor(lang, country) {
  return LOCALE_PAGES.find((p) => p.lang === lang && p.country === country)
    || LOCALE_PAGES.find((p) => p.lang === lang) || null;
}

/**
 * Where to send someone who wants this language while looking at this
 * country: its own page, else (English) the home page, else the language's
 * first page, else the home page (which follows the saved language).
 */
export function hrefFor(lang, country) {
  const exact = LOCALE_PAGES.find((p) => p.lang === lang && p.country === country);
  if (exact) return `/${exact.path}/`;
  const any = lang === 'en' ? null : pageFor(lang, country);
  return any ? `/${any.path}/` : '/';
}
