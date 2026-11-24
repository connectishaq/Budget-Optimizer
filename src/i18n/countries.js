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

/** The country a currency most likely belongs to; GLOBAL when it's ambiguous (EUR) or unknown. */
export const countryForCurrency = (currency) => COUNTRY_FOR_CURRENCY[currency] || GLOBAL;

let flagsOk = null;
/**
 * Whether this device draws flag emoji. Windows doesn't: 🇺🇸 shows as the
 * letters "US", which beside "United States" just looks like a typo. An
 * undrawn flag is two letter boxes, about twice as wide as one.
 */
export function flagsDrawn() {
  if (flagsOk == null) {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = '32px sans-serif';
      flagsOk = ctx.measureText('🇺🇸').width < ctx.measureText('🇺').width * 1.5;
    } catch { flagsOk = true; }
  }
  return flagsOk;
}

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

// ---------------- Time zone -> country ----------------
// Only the IANA zones of the countries we have data for. The browser reports
// the zone itself (Intl, no network request), so this never leaves the device.
const AMERICA = {
  US: 'New_York Detroit Chicago Denver Boise Phoenix Los_Angeles Anchorage Juneau Sitka Metlakatla Yakutat Nome Adak Menominee Shiprock',
  CA: 'Toronto Montreal Vancouver Edmonton Winnipeg Halifax St_Johns Regina Moncton Glace_Bay Goose_Bay Whitehorse Dawson Dawson_Creek Fort_Nelson Creston Iqaluit Rankin_Inlet Resolute Cambridge_Bay Inuvik Swift_Current Atikokan Coral_Harbour Blanc-Sablon Nipigon Thunder_Bay Rainy_River Yellowknife Pangnirtung',
  MX: 'Mexico_City Monterrey Merida Cancun Chihuahua Ciudad_Juarez Ojinaga Hermosillo Mazatlan Tijuana Matamoros Bahia_Banderas Ensenada Santa_Isabel',
  BR: 'Sao_Paulo Bahia Fortaleza Recife Belem Maceio Araguaina Manaus Cuiaba Campo_Grande Porto_Velho Boa_Vista Rio_Branco Eirunepe Santarem Noronha Porto_Acre'
};
const TZ_COUNTRY = {
  'Asia/Karachi': 'PK', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA',
  'Europe/London': 'GB', 'Europe/Belfast': 'GB', GB: 'GB', 'GB-Eire': 'GB',
  'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE', 'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES', 'Africa/Ceuta': 'ES', 'Atlantic/Canary': 'ES',
  'Africa/Lagos': 'NG', 'Asia/Jakarta': 'ID', 'Asia/Pontianak': 'ID', 'Asia/Makassar': 'ID', 'Asia/Ujung_Pandang': 'ID', 'Asia/Jayapura': 'ID',
  'Pacific/Honolulu': 'US'
};
for (const [code, names] of Object.entries(AMERICA)) for (const n of names.split(' ')) TZ_COUNTRY[`America/${n}`] = code;
const TZ_PREFIX = [['America/Indiana/', 'US'], ['America/Kentucky/', 'US'], ['America/North_Dakota/', 'US'], ['US/', 'US'],
  ['Canada/', 'CA'], ['Australia/', 'AU'], ['Mexico/', 'MX'], ['Brazil/', 'BR']];

/** "Asia/Karachi" -> "PK"; null for a zone of a country we don't cover (or none). */
export function countryFromTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return null;
  if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  return TZ_PREFIX.find(([p]) => tz.startsWith(p))?.[1] || null;
}

/** The browser's time zone ("Europe/London"), or null. */
export function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
}

/**
 * Best guess at the visitor's country: the time zone's country when we cover
 * it, otherwise the region in the browser's languages (en-GB, ur-PK) as the
 * tiebreaker, otherwise null (keep the default).
 */
export function guessCountry({ timeZone = browserTimeZone(), languages } = {}) {
  return countryFromTimeZone(timeZone) || detectCountry(languages);
}

/** The country of a language/country page (/en-gb/ -> "GB"), or null on the home page. */
export function pageCountry() {
  const c = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-page-country') : null;
  return COUNTRY_CODES.includes(c) ? c : null;
}

/**
 * The country to use when none is stored yet: the page's own country
 * (/en-gb/), then a returning user's saved currency (so their numbers keep
 * making sense), then the browser's region, then GLOBAL.
 */
export function initialCountry(savedCurrency, list) {
  return getStoredCountry() || pageCountry() || COUNTRY_FOR_CURRENCY[savedCurrency] || detectCountry(list) || GLOBAL;
}

/** True on the home page (/), false on the language/country pages (/en-gb/ …). */
export function isHomePage() {
  if (typeof document === 'undefined') return false;
  const html = document.documentElement;
  return !html.hasAttribute('data-page-lang') && !pageCountry();
}

/**
 * The calculator's starting country and whether it was guessed.
 * A country the visitor chose (saved by the dropdown, a saved budget or a share
 * link) or the page's own country always wins. Only a first visit to the home
 * page, with nothing saved, gets the time-zone/language guess. A saved budget
 * starts exactly as before this guess existed (browser language region, else GLOBAL).
 * Nothing here changes the page address.
 */
export function startCountry({ restored = false, stored = getStoredCountry(), page = pageCountry(), home = isHomePage(), languages, timeZone } = {}) {
  // A saved GLOBAL with no saved budget is usually an old automatic default
  // (before the time-zone guess existed), so it doesn't count as a choice
  if (stored && !(stored === GLOBAL && !restored)) return { country: stored, guessed: false };
  if (page) return { country: page, guessed: false };
  if (restored || !home) return { country: detectCountry(languages) || GLOBAL, guessed: false };
  const g = guessCountry({ timeZone, languages });
  return g ? { country: g, guessed: true } : { country: GLOBAL, guessed: false };
}

// The country the site guessed (not chosen), so the "Showing … figures" note
// can say so; cleared as soon as the country changes any other way.
const AUTO_KEY = 'hbo:countryAuto';
export function getAutoCountry() {
  try {
    const c = localStorage.getItem(AUTO_KEY);
    return isCountry(c) ? c : null;
  } catch { return null; }
}
export function setAutoCountry(code) {
  try {
    if (isCountry(code)) localStorage.setItem(AUTO_KEY, code);
    else localStorage.removeItem(AUTO_KEY);
  } catch { /* storage unavailable */ }
}
