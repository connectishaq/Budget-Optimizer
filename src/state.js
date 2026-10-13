// Single source of truth for the app + privacy-first persistence (localStorage only).
//
// Mutations go through setState(mutator, { reason }). Subscribers receive the
// reason so typing ('input') can be debounced while toggles render instantly.

import { PROFILES } from './engine/profiles.js';
import { CURRENCIES } from './utils/format.js';
import { VALUE_FIELDS, ALLOCATION_PRESETS, BUCKETS } from './engine/calculate.js';
import { SUB_KINDS } from './engine/subscriptions.js';

const STORAGE_KEY = 'hbo:v3';
const THEME_KEY = 'hbo:theme';
const SAVE_DELAY = 400;

export const RETURN_OPTIONS = [
  { value: 0.04, label: '4%: Safe savings account', hint: 'Grows slowly, with very little risk.' },
  { value: 0.06, label: '6%: Savings and investing', hint: 'Some ups and downs along the way.' },
  { value: 0.08, label: '8%: Long-term investing', hint: 'More ups and downs. Works best over 10+ years.' },
  { value: 0.1, label: '10%: Mostly shares', hint: 'Big ups and downs, and never guaranteed.' }
];

export function defaultState() {
  return {
    version: 3,
    profile: 'suburban',
    currency: 'USD',
    period: 'monthly',
    values: {},
    debts: [],
    subscriptions: [],
    // Costs that come once a year (festivals, school books…), amount per year
    yearly: [],
    plan: { committed: {}, pct: {}, sort: 'savings' },
    projection: { years: 10, rate: 0.08, inflationOn: false, inflation: 3 },
    goals: [],
    snapshots: [],
    // Where committed savings go (percentages, always summing to 100)
    allocation: { preset: 'even', ...pick(ALLOCATION_PRESETS.even) },
    // Answer to "Do you own your home or live rent-free?" (null = not asked/answered)
    housingFree: null,
    // Payday plan: which day pay arrives ('last' = last day of the month) and
    // the steps ticked off; ticks only count for the month they were made in
    payday: { day: 1, month: '', done: {} },
    // mode: 'wizard' (guided steps) | 'results'; step 1–3 and sub-page inside step 2
    ui: { collapsed: {}, sample: false, mode: 'wizard', step: 1, sub: 0, showAll: false }
  };
}

const pick = (p) => ({ emergency: p.emergency, debt: p.debt, goals: p.goals });
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const n = (v, lo = 0, hi = 1e12) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : 0;
};
const str = (v, max = 60) => String(v ?? '').slice(0, max);
const id = (v, prefix) => (typeof v === 'string' && v ? v.slice(0, 40) : `${prefix}${Math.random().toString(36).slice(2, 9)}`);

/**
 * Validates any untrusted object (localStorage, imported file, share link)
 * into a well-formed state. Unknown keys are dropped; bad values become defaults.
 */
export function normalizeState(raw) {
  const d = defaultState();
  if (!isObj(raw)) return d;
  const s = d;
  if (PROFILES[raw.profile]) s.profile = raw.profile;
  if (CURRENCIES[raw.currency]) s.currency = raw.currency;
  if (raw.period === 'annual') s.period = 'annual';
  if (isObj(raw.values)) for (const f of VALUE_FIELDS) if (raw.values[f] != null) s.values[f] = n(raw.values[f]);
  if (Array.isArray(raw.debts)) {
    s.debts = raw.debts.slice(0, 20).filter(isObj).map((x) => ({
      id: id(x.id, 'd'), type: x.type === 'loan' ? 'loan' : 'card', name: str(x.name),
      balance: n(x.balance), apr: n(x.apr, 0, 100), payment: n(x.payment)
    }));
  }
  if (Array.isArray(raw.subscriptions)) {
    s.subscriptions = raw.subscriptions.slice(0, 40).filter(isObj).map((x) => ({
      id: id(x.id, 's'), name: str(x.name), cost: n(x.cost), rarely: !!x.rarely,
      // '' = not picked yet, so the type follows the name
      kind: SUB_KINDS[x.kind] ? x.kind : ''
    }));
  }
  if (Array.isArray(raw.yearly)) {
    s.yearly = raw.yearly.slice(0, 30).filter(isObj).map((x) => ({ id: id(x.id, 'y'), name: str(x.name), cost: n(x.cost) }));
  }
  if (isObj(raw.payday)) {
    const p = raw.payday;
    s.payday.day = p.day === 'last' ? 'last' : Math.round(n(p.day, 1, 28)) || 1;
    s.payday.month = /^\d{4}-\d{2}$/.test(p.month) ? p.month : '';
    if (isObj(p.done)) for (const [k, v] of Object.entries(p.done)) s.payday.done[str(k, 20)] = !!v;
  }
  if (isObj(raw.plan)) {
    if (isObj(raw.plan.committed)) for (const [k, v] of Object.entries(raw.plan.committed)) s.plan.committed[str(k, 40)] = !!v;
    if (isObj(raw.plan.pct)) for (const [k, v] of Object.entries(raw.plan.pct)) s.plan.pct[str(k, 40)] = n(v, 0, 1);
    if (raw.plan.sort === 'easy') s.plan.sort = 'easy';
  }
  if (isObj(raw.projection)) {
    const p = raw.projection;
    s.projection.years = Math.round(n(p.years, 1, 20)) || 10;
    if (RETURN_OPTIONS.some((o) => o.value === Number(p.rate))) s.projection.rate = Number(p.rate);
    s.projection.inflationOn = !!p.inflationOn;
    s.projection.inflation = p.inflation == null ? 3 : n(p.inflation, 0, 20);
  }
  if (Array.isArray(raw.goals)) {
    s.goals = raw.goals.slice(0, 20).filter(isObj).map((g) => ({ id: id(g.id, 'g'), name: str(g.name), target: n(g.target), saved: n(g.saved) }));
  }
  if (Array.isArray(raw.snapshots)) {
    s.snapshots = raw.snapshots.slice(-36).filter(isObj).map((x) => ({
      id: id(x.id, 'h'), month: str(x.month, 7), savedAt: str(x.savedAt, 30), currency: CURRENCIES[x.currency] ? x.currency : s.currency,
      income: n(x.income), spend: n(x.spend), optimized: n(x.optimized), savings: n(x.savings), score: x.score == null ? null : n(x.score, 0, 100)
    }));
  }
  if (isObj(raw.allocation)) {
    const a = raw.allocation;
    const vals = BUCKETS.map((k) => Math.round(n(a[k], 0, 100)));
    if (vals.reduce((x, y) => x + y, 0) === 100) {
      BUCKETS.forEach((k, i) => { s.allocation[k] = vals[i]; });
      s.allocation.preset = ALLOCATION_PRESETS[a.preset] ? a.preset : 'custom';
    }
  }
  if (raw.housingFree === true || raw.housingFree === false) s.housingFree = raw.housingFree;
  if (isObj(raw.ui)) {
    s.ui.sample = !!raw.ui.sample;
    s.ui.mode = raw.ui.mode === 'results' ? 'results' : 'wizard';
    s.ui.step = Math.round(n(raw.ui.step, 1, 3)) || 1;
    s.ui.sub = Math.round(n(raw.ui.sub, 0, 5));
    s.ui.showAll = !!raw.ui.showAll;
  }
  if (isObj(raw.ui) && isObj(raw.ui.collapsed)) for (const [k, v] of Object.entries(raw.ui.collapsed)) s.ui.collapsed[str(k, 30)] = !!v;
  return s;
}

// ---------------- Store ----------------
let state = defaultState();
const listeners = new Set();
const savedListeners = new Set();
let saveTimer = null;

export const getState = () => state;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const onSaved = (fn) => savedListeners.add(fn);

/** Mutate state in place, notify subscribers and schedule a save. */
export function setState(mutator, { reason = 'change', persist = true } = {}) {
  mutator(state);
  listeners.forEach((fn) => fn(reason));
  if (persist) scheduleSave();
}

/** Swap in a whole new state (sample data, import, share link, reset). */
export function replaceState(next, reason = 'replace') {
  state = normalizeState(next);
  listeners.forEach((fn) => fn(reason));
  scheduleSave();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, SAVE_DELAY);
}

export function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    savedListeners.forEach((fn) => fn(true));
  } catch {
    savedListeners.forEach((fn) => fn(false));
  }
}

/** Returns true when a previous session was restored. */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    state = normalizeState(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

export function clearStorage() {
  clearTimeout(saveTimer);
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
}

/** True when the user has entered anything worth calculating. */
export function hasData(s = state) {
  return Object.values(s.values).some((v) => v > 0) || s.debts.length > 0 || s.subscriptions.length > 0 || s.yearly.length > 0;
}

// ---------------- Theme ----------------
export function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}
export function storeTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable */ }
}
