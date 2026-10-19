// The countries the site has local data for, plus "GLOBAL" (any other country,
// percentage-based benchmarks). Country and language are independent settings:
// the country decides benchmarks, currency defaults and local tips; the language
// decides the words.

export const COUNTRY_CODES = ['US', 'GB', 'CA', 'AU', 'IN', 'PK', 'AE', 'SA', 'DE', 'FR', 'ES', 'BR', 'MX', 'ID', 'NG'];
export const GLOBAL = 'GLOBAL';
export const ALL_COUNTRIES = [...COUNTRY_CODES, GLOBAL];
const COUNTRY_KEY = 'hbo:country';

/** Currency a saved budget used before countries existed -> its country. EUR is ambiguous. */
const COUNTRY_FOR_CURRENCY = { USD: 'US', GBP: 'GB', CAD: 'CA', AUD: 'AU', INR: 'IN', PKR: 'PK', AED: 'AE', SAR: 'SA', BRL: 'BR', MXN: 'MX', IDR: 'ID', NGN: 'NG' };

export const isCountry = (c) => ALL_COUNTRIES.includes(c);

/** 🇺🇸 from "US" (regional indicator symbols); 🌐 for any other country. */
export function flagOf(code) {
  if (!COUNTRY_CODES.includes(code)) return '🌐';
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

const nameCache = new Map();
/** The country's name in the given language, e.g. ("DE", "es") -> "Alemania". */
export function countryName(code, lang, otherLabel) {
  if (!COUNTRY_CODES.includes(code)) return otherLabel;
  const key = `${lang}|${code}`;
  if (!nameCache.has(key)) {
    let name = code;
    try { name = new Intl.DisplayNames([lang, 'en'], { type: 'region' }).of(code) || code; } catch { /* old browser */ }
    nameCache.set(key, name);
  }
  return nameCache.get(key);
}

export function getStoredCountry() {
  try {
    const c = localStorage.getItem(COUNTRY_KEY);
    return isCountry(c) ? c : null;
  } catch { return null; }
}

export function storeCountry(code) {
  try { localStorage.setItem(COUNTRY_KEY, isCountry(code) ? code : GLOBAL); } catch { /* storage unavailable */ }
}

/** First supported region in the browser's language list ("en-GB" -> "GB"), or null. */
export function detectCountry(list = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []) {
  for (const tag of list || []) {
    const region = String(tag || '').split('-')[1]?.toUpperCase();
    if (COUNTRY_CODES.includes(region)) return region;
  }
  return null;
}

/**
 * The country to use when none is stored yet: a returning user's saved
 * currency wins (so their numbers keep making sense), then the browser's
 * region, then GLOBAL.
 */
export function initialCountry(savedCurrency, list) {
  return getStoredCountry() || COUNTRY_FOR_CURRENCY[savedCurrency] || detectCountry(list) || GLOBAL;
}
