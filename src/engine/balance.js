// Spending limits that fit the household's income: the second step of "Ways
// to spend less", for when the ideas switched on still leave less than 10% of
// income to save. It starts from each bill as the ideas leave it, so the two
// never count the same saving twice.
//
// It works backwards from a target (spend at most 90% of income). Every bill
// has a realistic most it could drop in the next few months (its `max`), and
// cuts come in stages, gentlest first, taking only what is still needed:
//   1. over   bills above the typical range for this household, towards its top
//   2. want   nice-to-haves (eating out, shopping, subscriptions…)
//   3. trim   flexible needs (groceries, power, fuel, help at home…)
//   4. big    rent towards the middle of its typical range (a bigger, slower change)
// Loan payments, school fees, medical costs, charity, maintenance and
// once-a-year costs are never cut. Each limit can be switched on or off like an
// idea (rent starts off: moving home is a plan, not a habit). What the limits
// can't cover is answered with bigger changes that come only from what the
// household entered (housing, loans, car, school, yearly costs) and with
// earning more.

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
// Ideas on these pools cut nice-to-have subscriptions
const SUB_POOLS = ['subsRarely', 'subsStreaming'];
// The country's own bills, by key; unknown ones go by need/want
const LOCAL = { generatorFuel: { type: 'flex', max: 0.3 }, committee: { type: 'want', max: 0.5 } };
const CUSTOM = { need: { type: 'flex', max: 0.15 }, want: { type: 'want', max: 0.5 } };
// Never cut: shown as "left as they are" when the household has them
const KEPT_FIELDS = ['carLoan', 'school', 'medical', 'giving', 'maintenance'];
// Bills this many times the typical top are worth checking for a typo
const CHECK_TIMES = 3;
// South Asian households get local how-to tips for these bills (slabs, load-shedding)
const SOUTH_ASIA = ['PK', 'IN'];
const LOCAL_TIPS = ['electricity', 'waterGas', 'fuel', 'homeHelp'];

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const ideasOn = (plan) => plan.filter((p) => p.committed && p.kind === 'cash');

/**
 * What a bill would be after the committed ideas in the plan. Each committed
 * cash idea on that bill cuts its share of whatever is left, the same way
 * evaluatePlan stacks them.
 */
export function fieldAfterPlan(plan, values, field) {
  return ideasOn(plan)
    .filter((p) => p.rule.pools.includes(field))
    .reduce((left, p) => left * (1 - p.pct), values[field] || 0);
}

/**
 * Spending limits that fit the household's income, starting from the bills as
 * the switched-on ideas in `plan` leave them. Null when there is no income,
 * nothing to cut, or spending after the ideas already leaves SAVE_TARGET to
 * save. Call settleBalance() with the user's switches to get the outcome.
 */
export function balancePlan(totals, country, profile, plan = []) {
  const { income, values } = totals;
  const ideas = sum(ideasOn(plan).map((p) => p.monthly));
  const spend = totals.spend - ideas;
  if (!(income > 0) || !(spend > 0)) return null;
  const target = income * (1 - SAVE_TARGET);
  let gap = spend - target;
  if (gap <= 0) return null;

  const B = benchmarkFor(country, profile, income);
  const southAsia = SOUTH_ASIA.includes(country);
  const items = [];
  // entered: the bill as typed; now: after the ideas; aim: the limit
  const add = (item, entered, now, { type, max }, range) => {
    if (!(now > 0.5)) return;
    const high = range?.[1] > 0 ? range[1] : null;
    items.push({ ...item, entered, now, aim: now, type, floor: now * (1 - max), range: high ? range : null, high, reason: null });
  };
  for (const [k, cfg] of Object.entries(FIELDS)) {
    add({ id: k, field: k, tip: southAsia && LOCAL_TIPS.includes(k) ? `${k}Local` : k }, values[k], fieldAfterPlan(plan, values, k), cfg, B.ranges[k]);
  }
  const subsWants = sum(totals.subs.filter((s) => !SUB_KINDS[s.kind]?.need).map((s) => s.cost));
  const subsIdeas = sum(ideasOn(plan).filter((p) => p.rule.pools.some((k) => SUB_POOLS.includes(k))).map((p) => p.monthly));
  add({ id: 'subscriptions', tip: 'subscriptions' }, subsWants, Math.max(0, subsWants - subsIdeas), { type: 'want', max: SUBS_MAX }, null);
  for (const f of totals.local) {
    const cfg = LOCAL[f.key] || (f.need ? CUSTOM.need : CUSTOM.want);
    const range = B.approximate ? null : f.ranges?.[profile];
    add({ id: f.key, local: f.key, localLabel: f.label, tip: LOCAL[f.key] ? f.key : f.need ? 'customNeed' : 'customWant' }, values[f.key], fieldAfterPlan(plan, values, f.key), cfg, range);
  }
  for (const x of totals.custom) {
    add({ id: `custom:${x.id}`, customName: x.name || '', tip: x.need ? 'customNeed' : 'customWant' }, x.amount, x.amount, x.need ? CUSTOM.need : CUSTOM.want, null);
  }

  // Takes up to `gap` from the items, in proportion to how much each can still give
  const stage = (reason, room) => {
    if (gap <= 0) return;
    const rooms = items.map((it) => Math.max(0, Math.min(room(it), it.aim - it.floor)));
    const total = sum(rooms);
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
      // Compared as entered, so a typo is flagged even when an idea already trims it
      const over = high != null && it.entered > high;
      return { ...it, big: type === 'big', cut: it.now - it.aim, times: over ? it.entered / high : null, check: over && it.entered > high * CHECK_TIMES };
    })
    .filter((it) => it.cut >= 0.5)
    .sort((a, b) => a.big - b.big || b.cut - a.cut);

  return { target, spend, lines, kept: keptItems(totals) };
}

/** The bill an idea's pool belongs to: an input field, the country's own bill or subscriptions. */
const billOf = (pool) => (pool.startsWith('subs') ? 'subscriptions' : pool === 'cardInterest' ? null : pool);

/**
 * The plan bill by bill, for households whose income the ideas alone don't fit:
 * each bill gathers the ideas that work on it and its spending limit, so the
 * household sees one number per bill, biggest first. Each row:
 * { id, key, line (the limit, or null), ideas, entered, after, monthly (counted
 * now), potential (if every part were on), committed (any part on) }.
 * The rows' `monthly` add up to the plan's cash savings. Ideas that save
 * interest rather than cash belong to no bill and are left to show on their own.
 */
export function billRows(totals, plan, balance) {
  const cash = plan.filter((p) => p.kind === 'cash');
  const keys = [];
  const add = (k) => { if (k && !keys.includes(k)) keys.push(k); };
  for (const l of balance?.lines || []) add(l.id);
  for (const p of cash) p.rule.pools.forEach((k) => add(billOf(k)));

  const rows = keys.map((key) => {
    const line = balance?.lines.find((l) => l.id === key) || null;
    const ideas = cash.filter((p) => p.rule.pools.some((k) => billOf(k) === key));
    const subs = key === 'subscriptions';
    const custom = key.startsWith('custom:');
    const entered = subs ? totals.subsTotal : custom ? line.entered : totals.values[key] || 0;
    // What the switched-on ideas take off this bill (only this bill's share of a shared idea)
    const ideasOn = subs
      ? sum(ideas.filter((p) => p.committed).map((p) => p.monthly))
      : custom ? 0 : entered - fieldAfterPlan(plan, totals.values, key);
    const limitOn = line?.committed ? line.cut : 0;
    const monthly = ideasOn + limitOn;
    const ideasOff = sum(ideas.filter((p) => !p.committed).map((p) => p.monthly));
    return {
      id: `bill:${key}`, key, line, ideas, entered,
      after: entered - monthly, monthly,
      potential: monthly + ideasOff + (line && !line.committed ? line.cut : 0),
      committed: ideas.some((p) => p.committed) || !!line?.committed
    };
  });
  return rows.filter((r) => r.potential >= 0.5).sort((a, b) => b.potential - a.potential);
}

/** Key the user's on/off switch for a limit is stored under (in plan.committed). */
export const limitKey = (line) => `limit:${line.id}`;

/**
 * Applies the user's switches (`committed`: plan.committed) to a balance plan:
 * marks each line, and works out where the switched-on limits leave the month.
 */
export function settleBalance(b, totals, committed = {}) {
  for (const l of b.lines) l.committed = committed[limitKey(l)] ?? !l.big;
  const cut = sum(b.lines.filter((l) => l.committed).map((l) => l.cut));
  const { income } = totals;
  const newSpend = b.spend - cut;
  const gap = newSpend - b.target;
  const outcome = gap <= 0.5 ? 'reached' : newSpend <= income ? 'under' : 'short';
  // Extra monthly income that would still be needed to reach the target
  const incomeNeeded = Math.max(0, gap) / (1 - SAVE_TARGET);
  const hasRentLine = b.lines.some((l) => l.big);
  return Object.assign(b, {
    cut, newSpend, outcome, incomeNeeded,
    toSave: income - newSpend,
    bigger: outcome === 'reached' ? [] : biggerChanges(totals, incomeNeeded, hasRentLine)
  });
}

/**
 * Bigger, slower changes for the gap that limits can't close, only for what the
 * household actually has. Each: { key, amount, share? }. Earning more is always last.
 */
function biggerChanges(totals, incomeNeeded, hasRentLine) {
  const { values, income } = totals;
  const out = [];
  // A rent limit already says it, with its own switch
  if (values.rent > 0 && !hasRentLine) out.push({ key: 'housing', amount: values.rent, share: values.rent / income });
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
