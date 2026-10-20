// Example figures for the static HTML of each page (run at build time through
// Vite's SSR loader, see vite.config.js). The country's example budget is put
// through the real calculator and formatted the way the dashboard formats it,
// so crawlers and slow phones see real numbers instead of 0 and dashes; the
// page's scripts then replace them as usual.

import { setLanguage } from './i18n/index.js';
import { loadCountry } from './engine/countries.js';
import { sampleFor } from './engine/profiles.js';
import { computeBudget } from './engine/calculate.js';
import { defaultState } from './state.js';
import { setFormatRegion, moneyNice } from './utils/format.js';

/** Formatted example figures for a language + country (household: family of four). */
export async function exampleFigures(lang, country) {
  await setLanguage(lang);
  const C = await loadCountry(country);
  setFormatRegion(country);
  const sample = sampleFor('suburban', country);
  const state = { ...defaultState(), country, currency: C.currency, ...sample };
  const r = computeBudget(state);
  const raw = (n) => moneyNice(n, C.currency);
  const nice = (n) => moneyNice(n, C.currency, { friendly: true });
  const left = r.totals.income - r.totals.spend;
  return {
    // Hero "Your month" card
    income: raw(r.totals.income),
    bills: raw(r.totals.spend),
    left: raw(left),
    plan: raw(r.savings),
    toSave: raw(left + r.savings),
    // Results summary and the phone's sticky bar
    monthly: nice(r.savings),
    annual: nice(r.savings * 12),
    current: raw(r.totals.spend),
    optimized: nice(r.optimized)
  };
}
