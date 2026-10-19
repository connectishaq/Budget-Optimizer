// Country data: one JSON file per country in src/data/countries (see SCHEMA.md).
// Only the active country is loaded; GLOBAL (any other country, shares of
// income) is bundled so there is always a complete set to fall back on.
//
// Values marked { "value": …, "verify": true } in the files are estimates still
// to be checked (npm run benchmarks:review); here they're simply unwrapped.

import GLOBAL_RAW from '../data/countries/GLOBAL.json';

const loaders = import.meta.glob('../data/countries/[A-Z][A-Z].json');

/** Replaces every { value, verify } wrapper with its value. */
export function unwrap(node) {
  if (Array.isArray(node)) return node.map(unwrap);
  if (node && typeof node === 'object') {
    if ('value' in node && 'verify' in node) return unwrap(node.value);
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, unwrap(v)]));
  }
  return node;
}

const cache = new Map([['GLOBAL', unwrap(GLOBAL_RAW)]]);

/** True once a country's file is loaded (GLOBAL always is). */
export const isCountryLoaded = (code) => cache.has(code);

/** Loads a country's data; unknown codes resolve to GLOBAL. */
export async function loadCountry(code) {
  if (cache.has(code)) return cache.get(code);
  const load = loaders[`../data/countries/${code}.json`];
  if (!load) return cache.get('GLOBAL');
  const data = unwrap((await load()).default);
  cache.set(code, data);
  return data;
}

/** The loaded data for a country, or GLOBAL while it's still loading / unknown. */
export function countryData(code) {
  return cache.get(code) || cache.get('GLOBAL');
}

/** Order of the four growth-rate choices, matching the existing options. */
export const RETURN_KINDS = ['savings', 'balanced', 'longTerm', 'shares'];
