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

/** Whole-unit currency, e.g. "$1,234". */
export const money = (n, currency = 'USD') => formatter(currency, 0).format(Math.round(safe(n)));
/** Currency with cents, e.g. "$1,234.50". */
export const money2 = (n, currency = 'USD') => formatter(currency, 2).format(safe(n));
/** Compact currency for chart labels, e.g. "$46.2K". */
export const moneyShort = (n, currency = 'USD') =>
  Math.abs(safe(n)) < 10000 ? money(n, currency) : formatter(currency, 0, true).format(safe(n));

/** The symbol used as the input prefix, e.g. "$", "£", "₹", "AED". */
export function currencySymbol(currency = 'USD') {
  const part = formatter(currency, 0).formatToParts(0).find((p) => p.type === 'currency');
  return part ? part.value : currency;
}

export const pct = (ratio, digits = 0) => `${(safe(ratio) * 100).toFixed(digits)}%`;

/** 14 -> "1 yr 2 mo", 5 -> "5 mo". */
export function duration(months) {
  if (months == null || !Number.isFinite(months)) return '—';
  const m = Math.max(0, Math.ceil(months));
  if (m === 0) return 'now';
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (!y) return `${r} mo`;
  return r ? `${y} yr ${r} mo` : `${y} yr${y > 1 ? 's' : ''}`;
}

/** Calendar label for "n months from now", e.g. "Mar 2028". */
export function monthsFromNow(months, from = new Date()) {
  if (months == null || !Number.isFinite(months)) return '—';
  const d = new Date(from.getFullYear(), from.getMonth() + Math.ceil(months), 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Parses free-typed amounts ("1,200", "$45.50", " 300 ") into a number.
 * Returns { value, error } where value is always a usable non-negative number.
 */
export function parseAmount(raw) {
  const str = String(raw ?? '').trim();
  if (str === '') return { value: 0, error: null };
  const cleaned = str.replace(/[,\s]/g, '').replace(/[^\d.\-]/g, '');
  const n = Number(cleaned);
  if (cleaned === '' || cleaned === '-' || !Number.isFinite(n)) return { value: 0, error: 'Numbers only, please' };
  if (n < 0) return { value: 0, error: "Can't be negative" };
  return { value: n, error: null };
}
