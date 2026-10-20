// Household profiles, and the benchmarks for the selected country.
//
// Every typical range, rule threshold, one-off cost and example budget comes
// from the country's data file (src/data/countries, see SCHEMA.md). GLOBAL, for
// any other country, stores shares of take-home pay instead of amounts; they
// are turned into amounts with the household's own income and flagged
// `approximate: true` in the UI.
//
// Profile names and the example budgets' row names are shown in the active
// language (the "profiles" messages); the data below keeps the English text.

import { t } from '../i18n/index.js';
import { guessSubKind } from './subscriptions.js';
import { countryData } from './countries.js';

export const PROFILES = {
  single: { get name() { return t('profiles.single.name'); }, get group() { return t('profiles.single.group'); } },
  suburban: { get name() { return t('profiles.suburban.name'); }, get group() { return t('profiles.suburban.group'); } },
  youngpro: { get name() { return t('profiles.youngpro.name'); }, get group() { return t('profiles.youngpro.group'); } }
};
export const PROFILE_KEYS = Object.keys(PROFILES);


const mapObj = (o, fn) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fn(v)]));
// Amounts derived from shares of income: whole units above 100, cents below
const roundMoney = (n) => (n >= 100 ? Math.round(n) : Math.round(n * 100) / 100);

/**
 * Benchmarks for a country + profile, in local money:
 * { ranges, thresholds, categoryShare, costs, approximate }.
 * `income` (monthly) turns GLOBAL's shares into amounts; without it they're 0.
 */
export function benchmarkFor(country, profile, income = 0) {
  const C = countryData(country);
  const p = C.profiles[profile] || C.profiles.suburban;
  if (!C.relative) return { ...p, costs: C.costs, approximate: false };
  const k = income > 0 ? income : 0;
  return {
    ranges: mapObj(p.ranges, ([lo, hi]) => [roundMoney(lo * k), roundMoney(hi * k)]),
    thresholds: mapObj(p.thresholds, (x) => roundMoney(x * k)),
    categoryShare: p.categoryShare,
    costs: mapObj(C.costs, (x) => roundMoney(x * k)),
    approximate: true
  };
}

/** Typical [low, high] monthly range for an input field. */
export function typicalRange(profile, field, country, income = 0) {
  return benchmarkFor(country, profile, income).ranges[field] || null;
}

// Example row names that are words rather than brand names, by their English text
const SAMPLE_NAME_KEYS = {
  'Visa card': 'visaCard',
  'Store credit card': 'storeCreditCard',
  'Personal loan': 'personalLoan',
  'Rewards card': 'rewardsCard',
  'Student loan': 'studentLoan',
  'Credit card': 'creditCard',
  'Gym membership': 'gymMembership',
  'iCloud storage': 'icloudStorage',
  'Streaming bundle': 'streamingBundle',
  'Cloud storage': 'cloudStorage',
  'Language app': 'languageApp',
  'Fitness app': 'fitnessApp',
  'Google One storage': 'googleOneStorage',
  'Festivals (Eid, Diwali, Christmas…)': 'festivals',
  'Festivals (Diwali, Eid, Christmas…)': 'festivalsDiwali',
  'School books, uniforms and admission': 'schoolBooks',
  'Car service and repairs': 'carService',
  'Travel and trips home': 'travelHome',
  'Overtime': 'overtime',
  'Festival bonus (Eid, Diwali, Christmas…)': 'festivalBonus',
  'Yearly performance bonus': 'performanceBonus',
  'Extra work or side jobs': 'sideJobs'
};
const sampleName = (name) => (SAMPLE_NAME_KEYS[name] ? t(`profiles.sample.${SAMPLE_NAME_KEYS[name]}`) : name);

/** A sample subscription with its name translated. If the translated name would
 *  be guessed as a different type, the English name's type is kept. */
function sampleSub(x) {
  const name = sampleName(x.name);
  if (name === x.name || x.kind) return { ...x, name };
  const kind = guessSubKind(x.name);
  return guessSubKind(name) === kind ? { ...x, name } : { ...x, name, kind };
}

let seq = 0;
const rid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Example budget for a profile in the country's money, with fresh row ids.
 * GLOBAL's example is stored as shares of income and scaled to `income`
 * (the household's own, or 5,000 in their currency when none is entered).
 */
export function sampleFor(profile, country, income = 0) {
  const C = countryData(country);
  const s = C.samples[profile] || C.samples.suburban;
  const k = C.relative ? (income > 0 ? income : 5000) : 1;
  const m = C.relative ? (x) => roundMoney(x * k) : (x) => x;
  return {
    values: mapObj(s.values, m),
    debts: s.debts.map((d) => ({ id: rid('d'), ...d, balance: m(d.balance), payment: m(d.payment), name: sampleName(d.name) })),
    subscriptions: s.subscriptions.map((x) => ({ id: rid('s'), ...sampleSub({ ...x, cost: m(x.cost) }) })),
    yearly: s.yearly.map((x) => ({ id: rid('y'), ...x, cost: m(x.cost), name: sampleName(x.name) })),
    extras: (s.extras || []).map((x) => ({ id: rid('x'), ...x, amount: m(x.amount), name: sampleName(x.name) })),
    // The country's own must-pay bills, at the middle of their typical range
    local: Object.fromEntries((C.extraFields || []).filter((f) => f.need && f.ranges?.[profile])
      .map((f) => [f.key, Math.round((f.ranges[profile][0] + f.ranges[profile][1]) / 2)]))
  };
}

export const newId = rid;
