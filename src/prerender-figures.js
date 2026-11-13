// Example figures for the static HTML of each page (run at build time through
// Vite's SSR loader, see vite.config.js). The country's example budget is put
// through the real calculator and formatted with the same helpers the
// dashboard uses, so crawlers and slow phones see real numbers instead of 0
// and dashes; the page's scripts then replace them as usual. The build marks
// them "Example" (scripts/prerender-locales.mjs, fillFigures).

import { setLanguage } from './i18n/index.js';
import { loadCountry } from './engine/countries.js';
import { sampleFor } from './engine/profiles.js';
import { computeBudget, canSave } from './engine/calculate.js';
import { defaultState, returnOptions } from './state.js';
import { setFormatRegion, moneyNice } from './utils/format.js';
import { makeView } from './ui/dom.js';
import { receiptFigures, healthMarkup, plainSummary } from './ui/dashboard.js';
import { projectionData, projectionFigures } from './ui/charts.js';

/** Formatted example figures for a language + country (household: family of four). */
export async function exampleFigures(lang, country) {
  await setLanguage(lang);
  const base = defaultState();
  await loadCountry(base.country);
  const C = await loadCountry(country);
  setFormatRegion(country);
  const sample = sampleFor('suburban', country);
  // The country's defaults, as main.js applies them (applyCountry): currency,
  // inflation, and the growth choice in the same position (e.g. "long-term")
  const pick = returnOptions(base.country).findIndex((o) => o.value === base.projection.rate);
  const projection = {
    ...base.projection,
    ...(C.inflation != null ? { inflation: C.inflation } : {}),
    rate: returnOptions(country)[pick >= 0 ? pick : 2].value
  };
  const state = { ...base, country, currency: C.currency, ...(C.payFrequency ? { payFrequency: C.payFrequency } : {}), ...sample, projection };
  const view = makeView(state);
  const r = computeBudget(state, (n) => view.raw(n));
  const raw = (n) => moneyNice(n, C.currency);
  const nice = (n) => moneyNice(n, C.currency, { friendly: true });
  const left = r.totals.income - r.totals.spend;
  // The results headline, as renderSummary shows it: left over + the plan's savings
  const headline = Math.abs(canSave(r));
  return {
    // Hero "Your month" card
    income: raw(r.totals.income),
    bills: raw(r.totals.spend),
    left: raw(left),
    plan: raw(r.savings),
    toSave: raw(left + r.savings),
    // Results summary and the phone's sticky bar
    monthly: raw(headline),
    annual: raw(headline * 12),
    current: raw(r.totals.spend),
    optimized: nice(r.optimized),
    summary: plainSummary(r, view),
    // "Your month, added up", Budget health and "How your savings could grow"
    receipt: receiptFigures(r, view),
    health: r.health ? healthMarkup(r.health) : null,
    growth: projectionFigures(state, projectionData(state, r), view)
  };
}
