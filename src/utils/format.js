// Currency and number formatting. Formatters are cached because Intl
// constructors are comparatively expensive and we format on every render.
// Words (currency names, durations, errors) come from the "format" messages.

import { t, getLanguage, dirOf } from '../i18n/index.js';

// ---------------- Locale ----------------
// English keeps each currency's own English locale (the page reads exactly as
// before). Other languages use language + the country's region, with Latin
// digits so typed and shown numbers match: "de-DE", "hi-IN", "ar-AE".
let region = null; // ISO region of the selected country; null for GLOBAL
export function setFormatRegion(country) {
  region = /^[A-Z]{2}$/.test(country || '') ? country : null;
  cache.clear();
}
const currencyRegion = (currency) => (CURRENCIES[currency] || CURRENCIES.USD).locale.split('-')[1];

/** BCP 47 locale for numbers and money in this currency. */
export function numberLocale(currency = 'USD') {
  const lang = getLanguage();
  if (lang === 'en') return (CURRENCIES[currency] || CURRENCIES.USD).locale;
  return `${lang}-${region || currencyRegion(currency)}-u-nu-latn`;
}

/** Locale for dates and month names: US English for English, otherwise language + region. */
export function dateLocale() {
  const lang = getLanguage();
  return lang === 'en' ? 'en-US' : `${lang}-${region || 'US'}-u-nu-latn`;
}

// Right-to-left pages keep amounts reading left to right ("+$544", not "$544+")
const LRI = '\u2066';
const PDI = '\u2069';
const ltr = (s) => (dirOf(getLanguage()) === 'rtl' ? `${LRI}${s}${PDI}` : s);
const unwrapLtr = (s) => String(s).replace(/^\u2066|\u2069$/g, '');
/** A formatted amount with a sign in front, kept together in right-to-left text. */
export const withSign = (sign, formatted) => ltr(`${sign}${unwrapLtr(formatted)}`);

export const CURRENCIES = {
  USD: { get label() { return t('format.currencies.USD'); }, locale: 'en-US' },
  GBP: { get label() { return t('format.currencies.GBP'); }, locale: 'en-GB' },
  EUR: { get label() { return t('format.currencies.EUR'); }, locale: 'en-IE' },
  INR: { get label() { return t('format.currencies.INR'); }, locale: 'en-IN' },
  PKR: { get label() { return t('format.currencies.PKR'); }, locale: 'en-PK' },
  AED: { get label() { return t('format.currencies.AED'); }, locale: 'en-AE' },
  CAD: { get label() { return t('format.currencies.CAD'); }, locale: 'en-CA' },
  AUD: { get label() { return t('format.currencies.AUD'); }, locale: 'en-AU' },
  SAR: { get label() { return t('format.currencies.SAR'); }, locale: 'en-SA' },
  BRL: { get label() { return t('format.currencies.BRL'); }, locale: 'en-BR' },
  MXN: { get label() { return t('format.currencies.MXN'); }, locale: 'en-MX' },
  IDR: { get label() { return t('format.currencies.IDR'); }, locale: 'en-ID' },
  NGN: { get label() { return t('format.currencies.NGN'); }, locale: 'en-NG' }
};

/** Currencies whose readers count large amounts in lakh (100,000) and crore (10,000,000). */
const LAKH_CURRENCIES = new Set(['PKR', 'INR']);
export const usesLakh = (currency) => LAKH_CURRENCIES.has(currency);

const cache = new Map();
function formatter(currency, digits, compact = false) {
  const locale = numberLocale(currency);
  const key = `${locale}|${currency}|${digits}|${compact}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: CURRENCIES[currency] ? currency : 'USD',
      minimumFractionDigits: compact ? 0 : digits,
      maximumFractionDigits: compact ? 1 : digits,
      notation: compact ? 'compact' : 'standard'
    });
    cache.set(key, f);
  }
  return f;
}

const safe = (n) => (Number.isFinite(n) ? n : 0);
const trim = (x, digits = 2) => String(Number(x.toFixed(digits)));

/** The symbol used as the input prefix, e.g. "$", "£", "₹", "Rs". */
export function currencySymbol(currency = 'USD') {
  const part = formatter(currency, 0).formatToParts(0).find((p) => p.type === 'currency');
  return part ? part.value : currency;
}
// "Rs 5" reads better with a (non-breaking, like Intl uses) space; "$5" and "₹5" without.
const symbolGap = (sym) => (/[A-Za-z]$/.test(sym) ? ' ' : '');

/** Exact whole-unit currency, e.g. "$1,234" or "Rs 1,160,000". Used for hover text and inputs. */
export const money = (n, currency = 'USD') => ltr(formatter(currency, 0).format(Math.round(safe(n))));
/** Currency with cents, e.g. "$1,234.50". */
export const money2 = (n, currency = 'USD') => ltr(formatter(currency, 2).format(safe(n)));

/**
 * Friendly rounding for estimates: nearest 100 for PKR/INR, nearest 1 elsewhere.
 * Only for display; calculations always use the exact value.
 */
export function roundFriendly(n, currency = 'USD') {
  const step = usesLakh(currency) ? 100 : 1;
  return Math.round(safe(n) / step) * step;
}

/**
 * Display format: for PKR/INR, amounts of 1 lakh or more read as
 * "Rs 3.5 lakh" / "Rs 1.16 crore"; everything else uses normal grouping.
 * Pass { friendly: true } for estimated savings so they round to a tidy number.
 */
export function moneyNice(n, currency = 'USD', { friendly = false } = {}) {
  const v = friendly ? roundFriendly(n, currency) : Math.round(safe(n));
  if (usesLakh(currency) && Math.abs(v) >= 1e5) {
    const sym = currencySymbol(currency);
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    const [value, unit] = abs >= 1e7 ? [abs / 1e7, 'format.crore'] : [abs / 1e5, 'format.lakh'];
    return t(unit, { amount: ltr(`${sign}${sym}${symbolGap(sym)}${trim(value)}`) });
  }
  return money(v, currency);
}

/** Short labels for chart axes, e.g. "$46.2K", "Rs 25 L", "Rs 1.2 Cr". */
export function moneyShort(n, currency = 'USD') {
  const v = safe(n);
  if (usesLakh(currency)) {
    const sym = currencySymbol(currency);
    const gap = symbolGap(sym);
    if (Math.abs(v) >= 1e7) return t('format.croreShort', { amount: ltr(`${sym}${gap}${trim(v / 1e7, 1)}`) });
    if (Math.abs(v) >= 1e5) return t('format.lakhShort', { amount: ltr(`${sym}${gap}${trim(v / 1e5, 1)}`) });
    return money(v, currency);
  }
  return Math.abs(v) < 10000 ? money(v, currency) : ltr(formatter(currency, 0, true).format(v));
}

/** A number with one decimal in the page's language (1.5, 1,5…), e.g. months of savings. */
export const oneDecimal = (n) => new Intl.NumberFormat(numberLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(safe(n));

export const pct = (ratio, digits = 0) => `${(safe(ratio) * 100).toFixed(digits)}%`;

/** 14 -> "1 year 2 months", 5 -> "5 months", 0 -> "right away". */
export function duration(months) {
  if (months == null || !Number.isFinite(months)) return '—';
  const m = Math.max(0, Math.ceil(months));
  if (m === 0) return t('format.duration.now');
  const y = Math.floor(m / 12);
  const r = m % 12;
  const monthsTxt = (n) => t('format.duration.months', { count: n });
  const yearsTxt = (n) => t('format.duration.years', { count: n });
  if (!y) return monthsTxt(r);
  return r ? t('format.duration.yearsMonths', { years: yearsTxt(y), months: monthsTxt(r) }) : yearsTxt(y);
}

/** Calendar label for "n months from now", e.g. "Mar 2028". */
export function monthsFromNow(months, from = new Date()) {
  if (months == null || !Number.isFinite(months)) return '—';
  const d = new Date(from.getFullYear(), from.getMonth() + Math.ceil(months), 1);
  return d.toLocaleDateString(dateLocale(), { month: 'short', year: 'numeric' });
}

/** The decimal mark people type for this currency in the active language: "." or ",". */
export function decimalSeparator(currency = 'USD') {
  return formatter(currency, 2).formatToParts(1.5).find((p) => p.type === 'decimal')?.value === ',' ? ',' : '.';
}

export const MAX_AMOUNT = 1e12;
const CURRENCY_MARK = /^(?:[$£€₹]|rs\.?|aed|usd|gbp|eur|inr|pkr|cad|aud|[ca]\$)|(?:[$£€₹]|rs\.?|aed|usd|gbp|eur|inr|pkr|cad|aud)$/gi;

/**
 * Parses free-typed amounts ("1,200", "$45.50", "1,50,000", "1.234,56") into a number.
 * Anything else ("5k", "1e6", "12abc") is an error rather than a guess.
 * Returns { value, error } where value is always a usable non-negative number.
 */
export function parseAmount(raw, { decimal = '.' } = {}) {
  let str = String(raw ?? '').replace(/\s/g, '');
  // Where the decimal mark is a comma, swap the two marks and read it the same way
  if (decimal === ',') str = str.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'));
  if (str === '') return { value: 0, error: null };
  let s = str.replace(CURRENCY_MARK, '');
  const negative = s.startsWith('-');
  if (negative) s = s.slice(1).replace(CURRENCY_MARK, '');
  let normalized = null;
  if (/^\d+$/.test(s)) normalized = s;
  // 1,200 · 1,50,000 · 1,200.50
  else if (/^\d{1,3}(,\d{2,3})*(\.\d+)?$/.test(s) && !/^\d+,\d{1,2}$/.test(s)) normalized = s.replace(/,/g, '');
  // 45.50 · .5
  else if (/^\d*\.\d+$/.test(s)) normalized = s;
  // European style: 1.234,56 · 1.234.567 · 12,5
  else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d{1,2}$/.test(s)) normalized = s.replace(/\./g, '').replace(',', '.');
  const n = normalized == null ? NaN : Number(normalized);
  if (!Number.isFinite(n)) return { value: 0, error: t('format.parse.digits') };
  if (negative && n > 0) return { value: 0, error: t('format.parse.negative') };
  if (n > MAX_AMOUNT) return { value: 0, error: t('format.parse.tooBig') };
  return { value: n, error: null };
}

/** "about a quarter (25%)" style wording for plain-language explanations. */
export function pctWords(ratio) {
  const p = Math.round(safe(ratio) * 100);
  const named = { 100: 'all', 75: 'threeQuarters', 50: 'half', 33: 'third', 25: 'quarter', 20: 'fifth', 10: 'tenth' };
  return named[p] ? t(`format.pctWords.${named[p]}`) : t('format.pctWords.about', { pct: p });
}
