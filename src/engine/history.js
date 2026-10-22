// Month-by-month history: pure functions only (no DOM, no storage).
//
// One entry per calendar month ("2026-10"). A full entry keeps every input so
// the month can be loaded back into the form, plus the totals worked out at
// the time. Months carried over from the old snapshot list only kept totals
// and are marked `partial`.

import { CATEGORY_DEFS, computeBudget } from './calculate.js';
import { PROFILES } from './profiles.js';
import { CURRENCIES, dateLocale } from '../utils/format.js';
import { normalizeState } from '../state.js';
import { t } from '../i18n/index.js';

export const HISTORY_VERSION = 1;
export const MAX_MONTHS = 60;

export const COUNTRY = {
  USD: 'United States', GBP: 'United Kingdom', EUR: 'Eurozone', INR: 'India',
  PKR: 'Pakistan', AED: 'United Arab Emirates', CAD: 'Canada', AUD: 'Australia'
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo = -1e12, hi = 1e12) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : 0;
};
const numOrNull = (v, lo, hi) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : num(v, lo, hi));

// ---------------- Month keys ----------------
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** "2026-10" -> "2026-09" */
export function prevMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 2, 1));
}

/** "2026-10" -> "Oct 2026", or "October 2026" with { long: true }; "October" with { monthOnly: true }. */
export function monthLabel(key, { long = false, monthOnly = false } = {}) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  if (monthOnly) return d.toLocaleDateString(dateLocale(), { month: 'long' });
  return d.toLocaleDateString(dateLocale(), { month: long ? 'long' : 'short', year: 'numeric' });
}

// ---------------- Entries ----------------
// country: the local bills in `local` belong to it; payFrequency: how income is shown
const INPUT_KEYS = ['country', 'payFrequency', 'values', 'local', 'custom', 'extras', 'debts', 'subscriptions', 'yearly', 'goals', 'housingFree'];

/** Everything about one month: all inputs, the plan, and the results at the time. */
export function makeEntry(state, result = computeBudget(state), now = new Date(), month = monthKey(now)) {
  const t = result.totals;
  const inputs = {};
  for (const k of INPUT_KEYS) inputs[k] = JSON.parse(JSON.stringify(state[k] ?? null));
  inputs.plan = { committed: { ...(state.plan?.committed || {}) }, pct: { ...(state.plan?.pct || {}) } };
  return {
    month,
    savedAt: now.toISOString(),
    currency: state.currency,
    country: COUNTRY[state.currency] || '',
    profile: state.profile,
    partial: false,
    inputs,
    totals: {
      income: t.income,
      pay: t.pay,
      extras: t.extrasMonthly,
      spend: t.spend,
      optimized: result.optimized,
      // Money actually left after every bill this month (can be negative)
      leftOver: t.income - t.spend,
      planSavings: result.savings,
      score: result.health ? result.health.score : null,
      split: result.split ? { ...result.split.share } : null,
      categories: Object.fromEntries(t.categories.map((c) => [c.key, c.amount]))
    }
  };
}

/** Validates one stored or imported month. Returns null when it can't be used. */
export function normalizeEntry(raw) {
  if (!isObj(raw) || !MONTH_RE.test(raw.month)) return null;
  const currency = CURRENCIES[raw.currency] ? raw.currency : 'USD';
  const profile = PROFILES[raw.profile] ? raw.profile : 'suburban';
  const t = isObj(raw.totals) ? raw.totals : {};
  const partial = raw.partial === true || !isObj(raw.inputs);
  const entry = {
    month: raw.month,
    savedAt: typeof raw.savedAt === 'string' && !Number.isNaN(Date.parse(raw.savedAt)) ? raw.savedAt.slice(0, 30) : new Date(0).toISOString(),
    currency,
    country: COUNTRY[currency] || '',
    profile,
    partial,
    inputs: null,
    totals: {
      income: num(t.income, 0),
      pay: numOrNull(t.pay, 0),
      extras: numOrNull(t.extras, 0),
      spend: num(t.spend, 0),
      optimized: num(t.optimized, 0),
      leftOver: t.leftOver == null ? num(t.income, 0) - num(t.spend, 0) : num(t.leftOver),
      planSavings: num(t.planSavings, 0),
      score: numOrNull(t.score, 0, 100),
      split: isObj(t.split) ? { needs: num(t.split.needs, 0, 10), wants: num(t.split.wants, 0, 10), savings: num(t.split.savings, 0, 10) } : null,
      categories: isObj(t.categories)
        ? Object.fromEntries(CATEGORY_DEFS.map((c) => [c.key, num(t.categories[c.key], 0)]))
        : null
    }
  };
  if (!partial) {
    // Same checks as the live budget, so a stored month can always be loaded back
    const s = normalizeState({ ...raw.inputs, currency, profile });
    entry.inputs = Object.fromEntries(INPUT_KEYS.map((k) => [k, s[k]]));
    entry.inputs.plan = { committed: s.plan.committed, pct: s.plan.pct };
    // Months saved before these existed keep whatever the form uses now
    if (raw.inputs.country == null) delete entry.inputs.country;
    if (raw.inputs.payFrequency == null) delete entry.inputs.payFrequency;
  }
  return entry;
}

const byMonth = (a, b) => a.month.localeCompare(b.month);

/** Validates the whole stored history object. */
export function normalizeHistory(raw) {
  const out = { version: HISTORY_VERSION, months: [], lastBackup: null, meta: {} };
  if (!isObj(raw)) return out;
  if (Array.isArray(raw.months)) {
    const seen = new Map();
    for (const m of raw.months.map(normalizeEntry).filter(Boolean)) {
      const had = seen.get(m.month);
      if (!had || had.savedAt < m.savedAt) seen.set(m.month, m);
    }
    out.months = [...seen.values()].sort(byMonth).slice(-MAX_MONTHS);
  }
  if (typeof raw.lastBackup === 'string' && !Number.isNaN(Date.parse(raw.lastBackup))) out.lastBackup = raw.lastBackup;
  if (isObj(raw.meta)) {
    for (const k of ['persistAsked', 'safariNoteSeen']) if (raw.meta[k] === true) out.meta[k] = true;
    for (const k of ['reminderDismissed', 'welcomeDismissed']) if (MONTH_RE.test(raw.meta[k])) out.meta[k] = raw.meta[k];
    if (typeof raw.meta.firstSaved === 'string' && !Number.isNaN(Date.parse(raw.meta.firstSaved))) out.meta.firstSaved = raw.meta.firstSaved;
  }
  return out;
}

/** Old snapshot rows (totals only) become partial months. */
export function migrateSnapshots(snapshots) {
  if (!Array.isArray(snapshots)) return [];
  return normalizeHistory({
    months: snapshots.filter(isObj).map((s) => ({
      month: s.month,
      savedAt: s.savedAt,
      currency: s.currency,
      profile: s.profile,
      partial: true,
      totals: { income: s.income, spend: s.spend, optimized: s.optimized, planSavings: s.savings, score: s.score }
    }))
  }).months;
}

/** Adds a month, or replaces the one already saved for that month. */
export function upsertMonth(months, entry) {
  return months.filter((m) => m.month !== entry.month).concat(entry).sort(byMonth);
}

/** The month that would have to go to make room for `month`, or null if there's room. */
export function oldestToDrop(months, month) {
  if (months.some((m) => m.month === month) || months.length < MAX_MONTHS) return null;
  return [...months].sort(byMonth)[0];
}

// ---------------- Comparing ----------------
// Field -> message key (translated where the label is read)
const FIELD_LABEL = Object.fromEntries([
  'rent', 'maintenance', 'homeIns', 'electricity', 'waterGas', 'internet', 'fuel', 'transit', 'carIns',
  'carLoan', 'school', 'groceries', 'dining', 'misc', 'medical', 'homeHelp',
  'familySupport', 'giving', 'other'
].map((k) => [k, `historyEngine.fields.${k}`]));
// For "X has / X have" in alerts
const PLURAL = new Set(['waterGas', 'internet', 'transit', 'school', 'groceries', 'medical', 'other', 'subscriptions']);

const change = (a, b, higherIsBetter) => {
  if (a == null || b == null) return { diff: null, pct: null, better: null };
  const diff = b - a;
  const pct = a !== 0 ? diff / Math.abs(a) : null;
  const better = Math.abs(diff) < 0.005 ? null : higherIsBetter ? diff > 0 : diff < 0;
  return { diff, pct, better };
};

/**
 * Side-by-side rows for month `a` (earlier pick) and month `b`. Differences
 * are b − a. Spending going down counts as better; income, money left over
 * and the score going up count as better.
 */
export function compareMonths(a, b) {
  const sameCurrency = a.currency === b.currency;
  const partial = a.partial || b.partial;
  if (!sameCurrency) return { sameCurrency, partial, rows: [] };
  const rows = [];
  const add = (key, label, kind, va, vb, higherIsBetter, level = 0) =>
    rows.push({ key, label, kind, level, a: va, b: vb, ...change(va, vb, higherIsBetter) });

  add('pay', t('historyEngine.compare.pay'), 'income', a.totals.pay, b.totals.pay, true, 1);
  add('extras', t('historyEngine.compare.extras'), 'income', a.totals.extras, b.totals.extras, true, 1);
  add('income', t('historyEngine.compare.income'), 'income', a.totals.income, b.totals.income, true);
  for (const c of CATEGORY_DEFS) {
    const ca = a.totals.categories?.[c.key] ?? null;
    const cb = b.totals.categories?.[c.key] ?? null;
    if (!(ca > 0) && !(cb > 0)) continue;
    add(c.key, c.label, 'category', ca, cb, false);
    if (!c.fields || partial) continue;
    for (const f of c.fields) {
      const fa = a.inputs.values[f] || 0;
      const fb = b.inputs.values[f] || 0;
      if (fa > 0 || fb > 0) add(f, t(FIELD_LABEL[f]), 'field', fa, fb, false, 1);
    }
  }
  add('spend', t('historyEngine.compare.spend'), 'total', a.totals.spend, b.totals.spend, false);
  add('leftOver', t('historyEngine.compare.leftOver'), 'total', a.totals.leftOver, b.totals.leftOver, true);
  add('score', t('historyEngine.compare.score'), 'total', a.totals.score, b.totals.score, true);
  // Rows a partial month can't fill would only show dashes
  return { sameCurrency, partial, rows: rows.filter((r) => r.a != null || r.b != null) };
}

/** This month vs the previous saved month, for the "Welcome back" note. */
export function welcomeSummary(prev, cur) {
  if (!prev || !cur || prev.currency !== cur.currency) return null;
  return [
    { key: 'spend', ...change(prev.totals.spend, cur.totals.spend, false) },
    { key: 'leftOver', ...change(prev.totals.leftOver, cur.totals.leftOver, true) },
    { key: 'score', ...change(prev.totals.score, cur.totals.score, true) }
  ].filter((x) => x.diff != null);
}

// ---------------- Highlights ----------------
/** Highest money left over among months in the given currency (needs 2+ months). */
export function bestMonth(months, currency) {
  const same = months.filter((m) => m.currency === currency);
  if (same.length < 2) return null;
  return same.reduce((best, m) => (m.totals.leftOver > best.totals.leftOver ? m : best));
}

/**
 * Months in a row, ending with the latest saved month, where money was left
 * over or more was left over than the month before. A missing month breaks
 * the streak; "more than before" only counts within the same currency.
 */
export function savingsStreak(months) {
  const list = [...months].sort(byMonth);
  let count = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    const prev = list[i - 1];
    const improved = prev && prev.month === prevMonthKey(m.month) && prev.currency === m.currency && m.totals.leftOver > prev.totals.leftOver;
    if (!(m.totals.leftOver > 0 || improved)) break;
    count++;
    if (!prev || prev.month !== prevMonthKey(m.month)) break;
  }
  return count;
}

/**
 * Up to three plain-language alerts about bills moving the same way for a
 * while, from full months in the latest month's currency.
 */
export function trendAlerts(months, max = 3) {
  const all = [...months].sort(byMonth);
  if (all.length < 2) return [];
  const cur = all.at(-1).currency;
  const list = all.filter((m) => !m.partial && m.currency === cur);
  if (list.length < 2) return [];
  const latest = list.at(-1);
  const floor = Math.max(1, (latest.totals.income || 0) * 0.005); // ignore tiny wobbles
  const series = (key) => list.map((m) => (key === 'subscriptions' ? m.totals.categories?.subscriptions || 0 : m.inputs.values[key] || 0));
  const out = [];
  for (const key of [...Object.keys(FIELD_LABEL), 'subscriptions']) {
    const v = series(key);
    const label = t(key === 'subscriptions' ? 'historyEngine.fields.subscriptions' : FIELD_LABEL[key]);
    const plural = PLURAL.has(key);
    const n = v.length;
    // Rises (or falls) every month up to the latest
    let up = 0;
    let down = 0;
    for (let i = n - 1; i > 0 && v[i] > v[i - 1]; i--) up++;
    for (let i = n - 1; i > 0 && v[i] < v[i - 1]; i--) down++;
    const run = Math.max(up, down);
    if (run >= 2 && Math.abs(v[n - 1] - v[n - 1 - run]) >= floor) {
      const rising = up >= 2;
      out.push({
        key, tone: rising ? 'bad' : 'good',
        size: Math.abs((v[n - 1] - v[n - 1 - run]) / (v[n - 1 - run] || 1)),
        text: t(`historyEngine.alerts.${rising ? 'rising' : 'falling'}${plural ? 'Plural' : 'Singular'}`, { label, count: run })
      });
      continue;
    }
    // A clear change since a few months back
    const refIndex = Math.max(0, n - 4);
    const ref = v[refIndex];
    if (ref > 0 && n - 1 > refIndex) {
      const pct = (v[n - 1] - ref) / ref;
      if (Math.abs(pct) >= 0.15 && Math.abs(v[n - 1] - ref) >= floor) {
        out.push({
          key, tone: pct > 0 ? 'bad' : 'good', size: Math.abs(pct),
          text: t(`historyEngine.alerts.${pct > 0 ? 'upSince' : 'downSince'}${plural ? 'Plural' : 'Singular'}`, { label, pct: Math.round(Math.abs(pct) * 100), month: monthLabel(list[refIndex].month, { monthOnly: true }) })
        });
      }
    }
  }
  // Problems first, then the biggest changes
  return out.sort((a, b) => (a.tone === b.tone ? b.size - a.size : a.tone === 'bad' ? -1 : 1)).slice(0, max);
}

/** Each goal's "saved so far", month by month, from full saved months. */
export function goalsOverTime(months) {
  const goals = new Map();
  for (const m of [...months].sort(byMonth)) {
    if (m.partial) continue;
    for (const g of m.inputs.goals || []) {
      if (!goals.has(g.id)) goals.set(g.id, { id: g.id, name: g.name, target: g.target, currency: m.currency, points: [] });
      const rec = goals.get(g.id);
      rec.name = g.name || rec.name;
      rec.target = g.target;
      rec.currency = m.currency;
      rec.points.push({ month: m.month, saved: g.saved || 0 });
    }
  }
  return [...goals.values()].filter((g) => g.target > 0 || g.points.some((p) => p.saved > 0));
}

// ---------------- Backup files ----------------
export const BACKUP_APP = 'household-budget-optimizer';
export const BACKUP_FORMAT = 2;

export function backupFileName(now = new Date()) {
  return `budget-backup-${monthKey(now)}.json`;
}

export function makeBackup(state, months, now = new Date()) {
  const { snapshots, ...rest } = state;
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now.toISOString(), state: rest, history: { version: HISTORY_VERSION, months } };
}

/**
 * Reads any backup this app has ever made: the current format (state + months),
 * the older { app, data } file and a bare saved state. Old snapshot rows
 * inside it become partial months.
 */
export function parseBackup(obj) {
  if (!isObj(obj)) return { ok: false, error: 'not-object' };
  let rawState;
  let months = [];
  if (obj.app === BACKUP_APP && obj.format === BACKUP_FORMAT && isObj(obj.state)) {
    rawState = obj.state;
    months = normalizeHistory(obj.history).months;
    // No month in a file can be newer than the file itself, so a wrong clock
    // can't make an old backup win a merge against this device.
    const exported = Date.parse(obj.exportedAt);
    if (Number.isFinite(exported)) {
      const cap = new Date(exported).toISOString();
      months = months.map((m) => (Date.parse(m.savedAt) > exported ? { ...m, savedAt: cap } : m));
    }
  } else {
    rawState = isObj(obj.data) ? obj.data : obj;
    if (!isObj(rawState.values)) return { ok: false, error: 'not-backup' };
  }
  const state = normalizeState(rawState);
  if (!months.length) months = migrateSnapshots(state.snapshots);
  state.snapshots = [];
  return { ok: true, state, months };
}

/** "18 months, Apr 2025 – Oct 2026" style facts about a list of months. */
export function describeMonths(months) {
  const list = [...months].sort(byMonth);
  return { count: list.length, from: list[0]?.month ?? null, to: list.at(-1)?.month ?? null };
}

/**
 * Import: 'replace' uses the file's months; 'merge' adds them to what's here,
 * keeping whichever copy of a month was saved more recently. Either way only
 * the newest 60 months are kept; `dropped` lists the ones that didn't fit.
 */
export function mergeHistory(current, incoming, mode) {
  let list;
  if (mode === 'replace') list = [...incoming];
  else {
    const map = new Map(current.map((m) => [m.month, m]));
    for (const m of incoming) {
      const had = map.get(m.month);
      if (!had || had.savedAt < m.savedAt) map.set(m.month, m);
    }
    list = [...map.values()];
  }
  list.sort(byMonth);
  const dropped = list.length > MAX_MONTHS ? list.slice(0, list.length - MAX_MONTHS) : [];
  return { months: list.slice(-MAX_MONTHS), dropped };
}
