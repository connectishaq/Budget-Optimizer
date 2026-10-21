// "A plan that fits your income": a spending limit for each bill that brings
// the month under income and leaves a share of it to save, for when the
// percentage ideas alone can't close the gap.
//
// It works backwards from a target (spend at most 90% of income). Every bill
// has a realistic most it could drop in the next few months (its `max`), and
// cuts come in stages, gentlest first, taking only what is still needed:
//   1. over   bills above the typical range for this household, towards its top
//   2. want   nice-to-haves (eating out, shopping, subscriptions…)
//   3. trim   flexible needs (groceries, power, fuel, help at home…)
//   4. big    rent towards the middle of its typical range (a bigger, slower change)
// Loan payments, school fees, medical costs, charity and once-a-year costs are
// never cut. What cuts can't cover is answered with bigger changes that come
// only from what the household entered (housing, loans, car, school, yearly
// costs) and with earning more.

import { benchmarkFor } from './profiles.js';
import { SUB_KINDS } from './subscriptions.js';

/** Share of income the plan aims to leave for savings. */
export const SAVE_TARGET = 0.1;

// type: want (nice-to-have) | flex (need that can be trimmed) | big (slow change)
// max: the most it can realistically drop in the next few months
const FIELDS = {
  dining: { type: 'want', max: 0.75 },
  misc: { type: 'want', max: 0.6 },
  other: { type: 'flex', max: 0.25 },
  groceries: { type: 'flex', max: 0.2 },
  electricity: { type: 'flex', max: 0.25 },
  waterGas: { type: 'flex', max: 0.25 },
  internet: { type: 'flex', max: 0.3 },
  fuel: { type: 'flex', max: 0.3 },
  transit: { type: 'flex', max: 0.3 },
  homeHelp: { type: 'flex', max: 0.4 },
  familySupport: { type: 'flex', max: 0.25 },
  carIns: { type: 'flex', max: 0.15 },
  homeIns: { type: 'flex', max: 0.15 },
  rent: { type: 'big', max: 0.3 }
};
const SUBS_MAX = 0.75;
// The country's own bills, by key; unknown ones go by need/want
const LOCAL = { generatorFuel: { type: 'flex', max: 0.3 }, committee: { type: 'want', max: 0.5 } };
const CUSTOM = { need: { type: 'flex', max: 0.15 }, want: { type: 'want', max: 0.5 } };
// Never cut: shown as "left as they are" when the household has them
const KEPT_FIELDS = ['carLoan', 'school', 'medical', 'giving'];
// Bills this many times the typical top are worth checking for a typo
const CHECK_TIMES = 3;
// South Asian households get local how-to tips for these bills (slabs, load-shedding)
const SOUTH_ASIA = ['PK', 'IN'];
const LOCAL_TIPS = ['electricity', 'waterGas', 'fuel', 'homeHelp'];

/**
 * Spending limits that fit the household's income, or null when there is no
 * income, nothing to cut, or spending already leaves SAVE_TARGET to save.
 */
export function balancePlan(totals, country, profile) {
  const { income, values, spend } = totals;
  if (!(income > 0) || !(spend > 0)) return null;
  const target = income * (1 - SAVE_TARGET);
  let gap = spend - target;
  if (gap <= 0) return null;

  const B = benchmarkFor(country, profile, income);
  const southAsia = SOUTH_ASIA.includes(country);
  const items = [];
  const add = (item, now, { type, max }, range) => {
    if (!(now > 0)) return;
    const high = range?.[1] > 0 ? range[1] : null;
    items.push({ ...item, now, aim: now, type, floor: now * (1 - max), range: high ? range : null, high, reason: null });
  };
  for (const [k, cfg] of Object.entries(FIELDS)) {
    add({ id: k, field: k, tip: southAsia && LOCAL_TIPS.includes(k) ? `${k}Local` : k }, values[k], cfg, B.ranges[k]);
  }
  const subsWants = totals.subs.filter((s) => !SUB_KINDS[s.kind]?.need).reduce((a, s) => a + s.cost, 0);
  add({ id: 'subscriptions', tip: 'subscriptions' }, subsWants, { type: 'want', max: SUBS_MAX }, null);
  for (const f of totals.local) {
    const cfg = LOCAL[f.key] || (f.need ? CUSTOM.need : CUSTOM.want);
    const range = B.approximate ? null : f.ranges?.[profile];
    add({ id: f.key, local: f.key, localLabel: f.label, tip: LOCAL[f.key] ? f.key : f.need ? 'customNeed' : 'customWant' }, values[f.key], cfg, range);
  }
  for (const x of totals.custom) {
    add({ id: `custom:${x.id}`, customName: x.name || '', tip: x.need ? 'customNeed' : 'customWant' }, x.amount, x.need ? CUSTOM.need : CUSTOM.want, null);
  }

  // Takes up to `gap` from the items, in proportion to how much each can still give
  const stage = (reason, room) => {
    if (gap <= 0) return;
    const rooms = items.map((it) => Math.max(0, Math.min(room(it), it.aim - it.floor)));
    const total = rooms.reduce((a, b) => a + b, 0);
    if (total <= 0) return;
    const take = Math.min(gap, total);
    items.forEach((it, i) => {
      if (!rooms[i]) return;
      it.aim -= (rooms[i] * take) / total;
      it.reason ||= reason;
    });
    gap -= take;
  };
  stage('over', (it) => (it.type !== 'big' && it.high != null ? it.aim - it.high : 0));
  stage('want', (it) => (it.type === 'want' ? Infinity : 0));
  stage('trim', (it) => (it.type === 'flex' ? Infinity : 0));
  // Rent: towards the middle of its typical range, never below it
  stage('big', (it) => (it.type === 'big' && it.range ? it.aim - (it.range[0] + it.range[1]) / 2 : 0));

  const lines = items
    .map(({ type, floor, high, ...it }) => {
      const over = high != null && it.now > high;
      return { ...it, cut: it.now - it.aim, times: over ? it.now / high : null, check: over && it.now > high * CHECK_TIMES };
    })
    .filter((it) => it.cut >= 0.5)
    .sort((a, b) => b.cut - a.cut);
  const cut = lines.reduce((a, l) => a + l.cut, 0);
  const newSpend = spend - cut;
  const outcome = gap <= 0.5 ? 'reached' : newSpend <= income ? 'under' : 'short';
  // Extra monthly income that would still be needed to reach the target
  const incomeNeeded = Math.max(0, gap) / (1 - SAVE_TARGET);

  return {
    target, lines, cut, spend, newSpend, outcome, incomeNeeded,
    toSave: income - newSpend,
    bigger: outcome === 'reached' ? [] : biggerChanges(totals, incomeNeeded),
    kept: keptItems(totals)
  };
}

/**
 * Bigger, slower changes for the gap that cuts can't close, only for what the
 * household actually has. Each: { key, amount, share? }. Earning more is always last.
 */
function biggerChanges(totals, incomeNeeded) {
  const { values, income } = totals;
  const out = [];
  if (values.rent > 0) out.push({ key: 'housing', amount: values.rent, share: values.rent / income });
  const loans = values.carLoan + totals.debtPayments;
  if (loans > 0) out.push({ key: 'loans', amount: loans });
  // A car shows up as insurance or a car loan; fuel alone may be a motorbike
  if (values.carIns > 0 || values.carLoan > 0) out.push({ key: 'car', amount: values.fuel + values.carIns + values.carLoan });
  if (values.school > 0) out.push({ key: 'school', amount: values.school });
  if (totals.yearlyMonthly > 0) out.push({ key: 'yearly', amount: totals.yearlyMonthly });
  out.push({ key: 'income', amount: incomeNeeded });
  return out;
}

/** Bills the plan never cuts that this household has, for the "left as they are" note. */
function keptItems(totals) {
  const out = KEPT_FIELDS.filter((k) => totals.values[k] > 0).map((k) => ({ field: k }));
  if (totals.debtPayments > 0) out.push({ id: 'debt' });
  if (totals.yearlyMonthly > 0) out.push({ id: 'yearly' });
  if (totals.subs.some((s) => SUB_KINDS[s.kind]?.need && s.cost > 0)) out.push({ id: 'workSubs' });
  return out;
}
