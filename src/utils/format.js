// Currency and number formatting. Formatters are cached because Intl
// constructors are comparatively expensive and we format on every render.

export const CURRENCIES = {
  USD: { label: 'USD — US Dollar', locale: 'en-US' },
  GBP: { label: 'GBP — British Pound', locale: 'en-GB' },
  EUR: { label: 'EUR — Euro', locale: 'en-IE' },
  INR: { label: 'INR — Indian Rupee', locale: 'en-IN' },
  PKR: { label: 'PKR — Pakistani Rupee', locale: 'en-PK' },
  AED: { label: 'AED — UAE Dirham', locale: 'en-AE' },
  CAD: { label: 'CAD — Canadian Dollar', locale: 'en-CA' },
  AUD: { label: 'AUD — Australian Dollar', locale: 'en-AU' }
};

/** Currencies whose readers count large amounts in lakh (100,000) and crore (10,000,000). */
const LAKH_CURRENCIES = new Set(['PKR', 'INR']);
export const usesLakh = (currency) => LAKH_CURRENCIES.has(currency);

const cache = new Map();
function formatter(currency, digits, compact = false) {
  const key = `${currency}|${digits}|${compact}`;
  let f = cache.get(key);
  if (!f) {
    const { locale } = CURRENCIES[currency] || CURRENCIES.USD;
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
export const money = (n, currency = 'USD') => formatter(currency, 0).format(Math.round(safe(n)));
/** Currency with cents, e.g. "$1,234.50". */
export const money2 = (n, currency = 'USD') => formatter(currency, 2).format(safe(n));

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
    const [value, unit] = abs >= 1e7 ? [abs / 1e7, 'crore'] : [abs / 1e5, 'lakh'];
    return `${sign}${sym}${symbolGap(sym)}${trim(value)} ${unit}`;
  }
  return money(v, currency);
}

/** Short labels for chart axes, e.g. "$46.2K", "Rs 25 L", "Rs 1.2 Cr". */
export function moneyShort(n, currency = 'USD') {
  const v = safe(n);
  if (usesLakh(currency)) {
    const sym = currencySymbol(currency);
    const gap = symbolGap(sym);
    if (Math.abs(v) >= 1e7) return `${sym}${gap}${trim(v / 1e7, 1)} Cr`;
    if (Math.abs(v) >= 1e5) return `${sym}${gap}${trim(v / 1e5, 1)} L`;
    return money(v, currency);
  }
  return Math.abs(v) < 10000 ? money(v, currency) : formatter(currency, 0, true).format(v);
}

export const pct = (ratio, digits = 0) => `${(safe(ratio) * 100).toFixed(digits)}%`;

/** 14 -> "1 year 2 months", 5 -> "5 months", 0 -> "right away". */
export function duration(months) {
  if (months == null || !Number.isFinite(months)) return '—';
  const m = Math.max(0, Math.ceil(months));
  if (m === 0) return 'right away';
  const y = Math.floor(m / 12);
  const r = m % 12;
  const part = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (!y) return part(r, 'month');
  return r ? `${part(y, 'year')} ${part(r, 'month')}` : part(y, 'year');
}

/** Calendar label for "n months from now", e.g. "Mar 2028". */
export function monthsFromNow(months, from = new Date()) {
  if (months == null || !Number.isFinite(months)) return '—';
  const d = new Date(from.getFullYear(), from.getMonth() + Math.ceil(months), 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export const MAX_AMOUNT = 1e12;
const CURRENCY_MARK = /^(?:[$£€₹]|rs\.?|aed|usd|gbp|eur|inr|pkr|cad|aud|[ca]\$)|(?:[$£€₹]|rs\.?|aed|usd|gbp|eur|inr|pkr|cad|aud)$/gi;

/**
 * Parses free-typed amounts ("1,200", "$45.50", "1,50,000", "1.234,56") into a number.
 * Anything else ("5k", "1e6", "12abc") is an error rather than a guess.
 * Returns { value, error } where value is always a usable non-negative number.
 */
export function parseAmount(raw) {
  const str = String(raw ?? '').replace(/\s/g, '');
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
  if (!Number.isFinite(n)) return { value: 0, error: 'Please type digits only, like 1500' };
  if (negative && n > 0) return { value: 0, error: "This can't be less than zero" };
  if (n > MAX_AMOUNT) return { value: 0, error: 'That number is too big' };
  return { value: n, error: null };
}

/** "about a quarter (25%)" style wording for plain-language explanations. */
export function pctWords(ratio) {
  const p = Math.round(safe(ratio) * 100);
  const named = { 100: 'all of it (100%)', 75: 'about three quarters (75%)', 50: 'about half (50%)', 33: 'about a third (33%)', 25: 'about a quarter (25%)', 20: 'about a fifth (20%)', 10: 'about a tenth (10%)' };
  return named[p] || `about ${p}%`;
}
