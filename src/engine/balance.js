// "A plan that fits your income": a spending limit for each bill that brings
// the month under income and leaves a share of it to save, for when the
// percentage ideas alone can't close the gap.
//
// It works backwards from a target (spend at most 90% of income) and cuts in
// stages, gentlest first, taking only what is still needed at each stage:
//   1. typical  bills above the typical range for this household come down to its top
//   2. want     nice-to-haves (eating out, shopping, subscriptions…) by up to half
//   3. trim     flexible needs (groceries, power, fuel…) by up to 15%
//   4. want     nice-to-haves by up to three quarters in all
//   5. big      rent down to the middle of its typical range (a bigger, slower change)
// Loan payments, insurance, school fees, medical and once-a-year costs are
// never cut. Whatever gap is left after stage 5 is reported, not hidden.

import { benchmarkFor } from './profiles.js';
import { SUB_KINDS } from './subscriptions.js';

/** Share of income the plan aims to leave for savings. */
export const SAVE_TARGET = 0.1;

const WANTS = ['dining', 'misc', 'other'];
const FLEX = ['groceries', 'electricity', 'waterGas', 'internet', 'fuel', 'transit', 'homeHelp', 'familySupport', 'giving'];
const WANT_FIRST = 0.5;
const FLEX_MAX = 0.15;
const WANT_MAX = 0.75;

/**
 * Spending limits that fit the household's income, or null when there is no
 * income, nothing to cut, or spending already leaves SAVE_TARGET to save.
 * Lines: { id, field?, local?, customName?, now, aim, cut, reason } (largest cut first).
 */
export function balancePlan(totals, country, profile) {
  const { income, values, spend } = totals;
  if (!(income > 0) || !(spend > 0)) return null;
  const target = income * (1 - SAVE_TARGET);
  let gap = spend - target;
  if (gap <= 0) return null;

  const B = benchmarkFor(country, profile, income);
  const items = [];
  const add = (item, now, type, high) => {
    if (now > 0) items.push({ ...item, now, aim: now, type, high: high > 0 ? high : null, reason: null });
  };
  for (const k of WANTS) add({ id: k, field: k }, values[k], 'want', B.ranges[k]?.[1]);
  const subsWants = totals.subs.filter((s) => !SUB_KINDS[s.kind]?.need).reduce((a, s) => a + s.cost, 0);
  add({ id: 'subscriptions' }, subsWants, 'want', null);
  for (const k of FLEX) add({ id: k, field: k }, values[k], 'flex', B.ranges[k]?.[1]);
  // The country's own bills (absolute ranges only; relative countries have none)
  for (const f of totals.local) {
    const high = B.approximate ? null : f.ranges?.[profile]?.[1];
    add({ id: f.key, local: f.key, localLabel: f.label }, values[f.key], f.need ? 'flex' : 'want', high);
  }
  for (const x of totals.custom) add({ id: `custom:${x.id}`, customName: x.name || '' }, x.amount, x.need ? 'flex' : 'want', null);
  // Rent aims for the middle of its typical range: a cheaper home, not the cheapest
  const rentRange = B.ranges.rent;
  add({ id: 'rent', field: 'rent' }, values.rent, 'big', rentRange ? (rentRange[0] + rentRange[1]) / 2 : null);

  // Takes up to `gap` from the items, in proportion to how much each can give at this stage
  const stage = (reason, room) => {
    if (gap <= 0) return;
    const rooms = items.map((it) => Math.max(0, room(it)));
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
  stage('typical', (it) => (it.type !== 'big' && it.high != null ? it.aim - it.high : 0));
  stage('want', (it) => (it.type === 'want' ? it.aim - it.now * (1 - WANT_FIRST) : 0));
  stage('trim', (it) => (it.type === 'flex' ? it.aim - it.now * (1 - FLEX_MAX) : 0));
  stage('want', (it) => (it.type === 'want' ? it.aim - it.now * (1 - WANT_MAX) : 0));
  stage('big', (it) => (it.type === 'big' && it.high != null ? it.aim - it.high : 0));

  const lines = items
    .map(({ type, high, ...it }) => ({ ...it, cut: it.now - it.aim }))
    .filter((it) => it.cut >= 0.5)
    .sort((a, b) => b.cut - a.cut);
  const cut = lines.reduce((a, l) => a + l.cut, 0);
  const newSpend = spend - cut;
  return {
    target, lines, cut, spend, newSpend,
    toSave: income - newSpend,
    // Reached the target, only got under income, or still short
    outcome: gap <= 0.5 ? 'reached' : newSpend <= income ? 'under' : 'short',
    // Extra monthly income that would still be needed to reach the target
    incomeNeeded: Math.max(0, gap) / (1 - SAVE_TARGET)
  };
}
