// All budget math lives here as pure functions: no DOM, no storage, no globals.
// UI modules call computeBudget() once per change and render from the result.

import { RULES, highAprCards, localRules } from './rules.js';
import { PROFILES, benchmarkFor } from './profiles.js';
import { countryData } from './countries.js';
import { SUB_KINDS, subKind } from './subscriptions.js';
import { t } from '../i18n/index.js';
import { oneDecimal } from '../utils/format.js';
import { balancePlan, SAVE_TARGET } from './balance.js';

export const EXPENSE_FIELDS = [
  'rent', 'homeIns', 'electricity', 'waterGas', 'internet', 'fuel', 'transit',
  'carIns', 'carLoan', 'school', 'groceries', 'dining', 'misc',
  'medical', 'homeHelp', 'familySupport', 'giving', 'other'
];
export const VALUE_FIELDS = ['income', ...EXPENSE_FIELDS, 'emergencyFund'];

// How often pay arrives, and how many of those pays make one month on average.
// Income is always stored per month; the income box shows one pay.
export const PAY_FREQUENCIES = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1 };
export const isPayFrequency = (f) => Object.hasOwn(PAY_FREQUENCIES, f);
/** One pay -> a month's worth. */
export const toMonthly = (amount, freq) => amount * (PAY_FREQUENCIES[freq] ?? 1);
/** A month's worth -> one pay. */
export const fromMonthly = (monthly, freq) => monthly / (PAY_FREQUENCIES[freq] ?? 1);

/**
 * The selected country's own bills (council tax, society maintenance…), from
 * `extraFields` in its data file. Each has a group (= category), a need flag
 * and typical ranges per household type.
 */
export const localFields = (country) => countryData(country).extraFields || [];

export const CATEGORY_DEFS = [
  { key: 'housing', get label() { return t('calc.categories.housing'); }, fields: ['rent', 'homeIns'] },
  { key: 'utilities', get label() { return t('calc.categories.utilities'); }, fields: ['electricity', 'waterGas', 'internet'] },
  { key: 'transport', get label() { return t('calc.categories.transport'); }, fields: ['fuel', 'transit', 'carIns', 'carLoan'] },
  { key: 'family', get label() { return t('calc.categories.family'); }, fields: ['school', 'groceries', 'dining', 'misc'] },
  { key: 'care', get label() { return t('calc.categories.care'); }, fields: ['medical', 'homeHelp', 'familySupport', 'giving', 'other'] },
  { key: 'yearly', get label() { return t('calc.categories.yearly'); }, derived: 'yearlyMonthly' },
  { key: 'debt', get label() { return t('calc.categories.debt'); }, derived: 'debtPayments' },
  { key: 'subscriptions', get label() { return t('calc.categories.subscriptions'); }, derived: 'subsTotal' }
];

// The category (and input group) that custom expenses belong to
export const CUSTOM_CATEGORY = 'care';

// 50/30/20 classification. Minimum loan payments and the monthly set-aside
// for once-a-year costs count as must-pay bills.
const NEEDS_FIELDS = ['rent', 'homeIns', 'electricity', 'waterGas', 'internet', 'fuel', 'transit', 'carIns', 'carLoan', 'school', 'groceries',
  'medical', 'homeHelp', 'familySupport', 'giving'];
const WANTS_FIELDS = ['dining', 'misc', 'other'];
// Day-to-day spending that becomes the weekly allowance in the payday plan
const ALLOWANCE_FIELDS = ['dining', 'misc'];

const num = (n) => (Number.isFinite(+n) && +n > 0 ? +n : 0);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const plainFmt = (n) => String(Math.round(n));

/** Normalises raw state pieces into clean, non-negative numbers. */
export function cleanInputs(state) {
  const values = {};
  for (const f of VALUE_FIELDS) values[f] = num(state.values?.[f]);
  const debts = (state.debts || []).map((d) => ({
    ...d,
    type: d.type === 'loan' ? 'loan' : 'card',
    balance: num(d.balance),
    apr: clamp(num(d.apr), 0, 100),
    payment: num(d.payment)
  }));
  const subs = (state.subscriptions || []).map((s) => ({ ...s, cost: num(s.cost), rarely: !!s.rarely, kind: subKind(s) }));
  const yearly = (state.yearly || []).map((y) => ({ ...y, cost: num(y.cost) }));
  // Bonuses, overtime and other money that doesn't come every month, per year
  const extras = (state.extras || []).map((x) => ({ ...x, amount: num(x.amount) }));
  // The country's own bills join the values (so rules can use them too);
  // amounts kept for another country's bills are ignored
  const local = localFields(state.country);
  for (const f of local) values[f.key] = num(state.local?.[f.key]);
  // Expenses the user named themselves, monthly, each a need or a want
  const custom = (state.custom || []).map((x) => ({ ...x, amount: num(x.amount), need: x.need !== false }));
  return { values, debts, subs, yearly, extras, local, custom };
}

/** Totals, category breakdown and 50/30/20 buckets for the current budget. */
export function computeTotals(state) {
  const { values, debts, subs, yearly, extras, local, custom } = cleanInputs(state);
  // Income = monthly take-home pay + the year's extras spread evenly over 12 months
  const pay = values.income;
  const extrasYearly = sum(extras.map((x) => x.amount));
  const extrasMonthly = extrasYearly / 12;
  const income = pay + extrasMonthly;
  const B = benchmarkFor(state.country, state.profile, income);
  // A debt row with no balance left no longer needs a payment.
  const debtPayments = sum(debts.map((d) => (d.balance > 0 ? d.payment : 0)));
  const subsTotal = sum(subs.map((s) => s.cost));
  // Costs entered per year are spread evenly over 12 months
  const yearlyTotal = sum(yearly.map((y) => y.cost));
  const yearlyMonthly = yearlyTotal / 12;
  const derived = { debtPayments, subsTotal, yearlyMonthly };
  const customTotal = sum(custom.map((x) => x.amount));
  // Local bills count in their own group; custom expenses sit with "anything else"
  const groupExtra = (key) => sum(local.filter((f) => f.group === key).map((f) => values[f.key]))
    + (key === CUSTOM_CATEGORY ? customTotal : 0);

  const categories = CATEGORY_DEFS.map((c) => {
    const amount = c.derived ? derived[c.derived] : sum(c.fields.map((f) => values[f])) + groupExtra(c.key);
    const benchmark = B.categoryShare[c.key];
    const share = income > 0 ? amount / income : null;
    return { ...c, amount, share, benchmark, over: share != null && amount > 0 && share > benchmark };
  });

  const spend = sum(categories.map((c) => c.amount));
  // Work tools are a cost of earning; every other subscription is a nice-to-have
  const subsNeeds = sum(subs.filter((s) => SUB_KINDS[s.kind].need).map((s) => s.cost));
  const subsByKind = {};
  for (const s of subs) if (s.cost > 0) subsByKind[s.kind] = (subsByKind[s.kind] || 0) + s.cost;
  const localNeeds = sum(local.filter((f) => f.need).map((f) => values[f.key])) + sum(custom.filter((x) => x.need).map((x) => x.amount));
  const localWants = sum(local.filter((f) => !f.need).map((f) => values[f.key])) + sum(custom.filter((x) => !x.need).map((x) => x.amount));
  const needs = sum(NEEDS_FIELDS.map((f) => values[f])) + debtPayments + yearlyMonthly + subsNeeds + localNeeds;
  const wants = sum(WANTS_FIELDS.map((f) => values[f])) + subsTotal - subsNeeds + localWants;

  return {
    values, debts, subs, yearly, extras, local, custom, customTotal, income, pay, extrasYearly, extrasMonthly,
    debtPayments, subsTotal, subsByKind, yearlyTotal, yearlyMonthly,
    categories, spend, needs, wants, surplus: income - spend
  };
}

/** Months to recover an upfront cost from monthly savings. 0 = no upfront cost. */
export function paybackMonths(upfront, monthly) {
  if (!(upfront > 0)) return 0;
  if (!(monthly > 0)) return Infinity;
  return upfront / monthly;
}

/**
 * Runs every rule against the budget. Rules sharing a pool are applied in
 * dictionary order to the amount left by earlier *committed* rules, so the
 * total saving on any bill can never exceed the bill itself.
 */
export function evaluatePlan(state, totals, fmt = plainFmt) {
  const profile = PROFILES[state.profile] ? state.profile : 'suburban';
  const B = benchmarkFor(state.country, profile, totals.income);
  const C = countryData(state.country);
  const hidden = new Set(C.hideRules || []);
  const ctx = {
    v: totals.values, profile, P: PROFILES[profile], B, C, country: state.country, currency: state.currency,
    income: totals.income, debts: totals.debts, subs: totals.subs, fmt
  };
  const val = (x) => (typeof x === 'function' ? x(ctx) : x);
  const committedMap = state.plan?.committed || {};
  const pctMap = state.plan?.pct || {};

  const poolValue = (key) => {
    if (key === 'subsRarely') return sum(ctx.subs.filter((s) => s.rarely).map((s) => s.cost));
    if (key === 'subsStreaming') return sum(ctx.subs.filter((s) => !s.rarely && s.kind === 'streaming').map((s) => s.cost));
    if (key === 'subsTools') return sum(ctx.subs.filter((s) => !s.rarely && s.kind === 'tools').map((s) => s.cost));
    if (key === 'cardInterest') return sum(highAprCards(ctx.debts).map((d) => (d.balance * d.apr) / 1200));
    return ctx.v[key] || 0;
  };

  const pools = {};
  const items = [];
  // The country's own ideas come after the general ones, so they work on what's left
  for (const rule of [...RULES, ...localRules(C)]) {
    if (hidden.has(rule.id) || !rule.when(ctx)) continue;
    for (const key of rule.pools) if (!(key in pools)) pools[key] = poolValue(key);

    const rawBase = sum(rule.pools.map(poolValue)); // the bill as the user entered it
    const base = sum(rule.pools.map((key) => pools[key])); // what's left after earlier changes
    const defaultPct = typeof rule.pct === 'function' ? rule.pct(ctx) : rule.pct;
    const maxPct = rule.maxPct ?? Math.min(1, defaultPct * 2);
    const pct = clamp(pctMap[rule.id] ?? defaultPct, 0, maxPct);
    const monthly = base * pct;
    const committed = committedMap[rule.id] ?? true;
    const upfront = typeof rule.upfront === 'function' ? rule.upfront(ctx) : rule.upfront ? B.costs[rule.upfront] || 0 : 0;

    if (committed) for (const key of rule.pools) pools[key] *= 1 - pct;

    items.push({
      id: rule.id, rule, kind: rule.kind, rawBase, base, stacked: base < rawBase - 0.005,
      pct, defaultPct, maxPct, monthly, annual: monthly * 12,
      committed, upfront, payback: paybackMonths(upfront, monthly),
      effort: rule.effort, category: rule.category, icon: rule.icon,
      label: rule.label, noun: rule.noun, title: val(rule.title),
      why: rule.why(ctx),
      evidence: val(rule.evidence),
      tips: rule.tips(ctx), flag: rule.flag ? rule.flag(ctx) : null
    });
  }
  return items;
}

/**
 * How we treat an empty rent/mortgage box:
 *  'paid'    rent entered
 *  'free'    user said they own outright / live rent-free
 *  'missing' user said they DO pay but left it empty
 *  'unknown' not answered yet
 */
export function housingStatus(rent, housingFree) {
  if (rent > 0) return 'paid';
  if (housingFree === true) return 'free';
  if (housingFree === false) return 'missing';
  return 'unknown';
}

/**
 * Budget Health Score (0–100) from five weighted parts. Each part carries a
 * plain-language sentence saying what it measured and what to aim for.
 */
export function healthScore({ income, spend, rent, debtPayments, emergencyFund, needs, wants, hasHighApr, housing = 'paid', fmt = plainFmt }) {
  if (!(income > 0)) return null;
  const pc = (r) => `${Math.round(r * 100)}%`;
  const saveRate = (income - spend) / income;
  const housingShare = rent / income;
  const dti = debtPayments / income;
  const months = needs > 0 ? emergencyFund / needs : null;
  const wantsShare = wants / income;

  const housingEarned = { paid: 20 * clamp((0.5 - housingShare) / 0.2, 0, 1), free: 20, unknown: 10, missing: 0 }[housing];
  const housingText = {
    paid: () => (housingShare <= 0.3
      ? t('calc.health.housing.comfortable', { pct: pc(housingShare) })
      : t('calc.health.housing.high', { pct: pc(housingShare), target: fmt(income * 0.3) })),
    free: () => t('calc.health.housing.free'),
    unknown: () => t('calc.health.housing.unknown'),
    missing: () => t('calc.health.housing.missing')
  }[housing]();

  let emergencyText;
  if (months == null) emergencyText = t('calc.health.emergency.noBills');
  else if (emergencyFund <= 0) emergencyText = t('calc.health.emergency.none', { target: fmt(needs * 3) });
  else if (months < 3) emergencyText = t('calc.health.emergency.under3', { months: oneDecimal(months), target: fmt(needs * 3) });
  else if (months < 6) emergencyText = t('calc.health.emergency.under6', { months: oneDecimal(months), target: fmt(needs * 6) });
  else emergencyText = t('calc.health.emergency.done');

  const parts = [
    {
      key: 'savings', label: t('calc.health.parts.savings'), max: 30,
      earned: 30 * clamp(saveRate / 0.2, 0, 1),
      text: saveRate < 0
        ? t('calc.health.savings.negative', { target: fmt(income * 0.2) })
        : saveRate < 0.2
          ? t('calc.health.savings.low', { pct: pc(saveRate), target: fmt(income * 0.2) })
          : t('calc.health.savings.good', { pct: pc(saveRate) })
    },
    { key: 'housing', label: t('calc.health.parts.housing'), max: 20, earned: housingEarned, text: housingText },
    {
      key: 'debt', label: t('calc.health.parts.debt'), max: 15,
      earned: Math.min(hasHighApr ? 10 : 15, 15 * clamp((0.36 - dti) / 0.26, 0, 1)),
      text: (debtPayments > 0
        ? t('calc.health.debt.payments', { pct: pc(dti) })
        : t('calc.health.debt.none')) + (hasHighApr ? ` ${t('calc.health.debt.highApr')}` : '')
    },
    { key: 'emergency', label: t('calc.health.parts.emergency'), max: 20, earned: needs > 0 ? 20 * clamp(emergencyFund / needs / 6, 0, 1) : 20, text: emergencyText },
    {
      key: 'wants', label: t('calc.health.parts.wants'), max: 15,
      earned: 15 * clamp((0.45 - wantsShare) / 0.15, 0, 1),
      text: `${t('calc.health.wants.share', { pct: pc(wantsShare) })} ` +
        (wantsShare <= 0.3 ? t('calc.health.wants.good') : t('calc.health.wants.high', { target: fmt(income * 0.3) }))
    }
  ];
  const score = Math.round(sum(parts.map((p) => p.earned)));
  const worst = [...parts].sort((a, b) => b.max - b.earned - (a.max - a.earned))[0];
  const gain = Math.round(worst.max - worst.earned);
  // Message keys for "Biggest boost: … could add up to N points."
  const TIPS = {
    savings: 'savings',
    housing: housing === 'paid' ? 'housingPaid' : 'housingQuestion',
    debt: hasHighApr ? 'debtHighApr' : 'debtLoans',
    emergency: 'emergency',
    wants: 'wants'
  };
  const level = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'okay' : 'needsAttention';
  const label = t(`calc.health.labels.${level}`);
  return {
    score, label, parts,
    tip: gain > 0 ? t(`calc.health.tip.${TIPS[worst.key]}`, { count: gain }) : t('calc.health.tip.perfect')
  };
}

/** Actual needs/wants/savings vs the 50/30/20 guideline. */
export function fiftyThirtyTwenty({ income, needs, wants, spend }) {
  if (!(income > 0)) return null;
  const savings = Math.max(0, income - spend);
  const actual = { needs, wants, savings };
  const target = { needs: income * 0.5, wants: income * 0.3, savings: income * 0.2 };
  const share = { needs: needs / income, wants: wants / income, savings: savings / income };
  const diffs = {
    needs: needs - target.needs,
    wants: wants - target.wants,
    savings: target.savings - savings // positive = short of target
  };
  return { actual, target, share, diffs };
}

// ---------------- Where should the savings go? ----------------
export const BUCKETS = ['emergency', 'debt', 'goals'];
export const ALLOCATION_PRESETS = {
  emergency: { get label() { return t('calc.presets.emergency'); }, emergency: 60, debt: 20, goals: 20 },
  debt: { get label() { return t('calc.presets.debt'); }, emergency: 20, debt: 60, goals: 20 },
  even: { get label() { return t('calc.presets.even'); }, emergency: 34, debt: 33, goals: 33 },
  goals: { get label() { return t('calc.presets.goals'); }, emergency: 20, debt: 20, goals: 60 }
};

/**
 * Sets one bucket's % and rebalances the other two in proportion so the
 * total always stays exactly 100.
 */
export function rebalanceAllocation(alloc, key, value) {
  const v = Math.round(clamp(Number(value) || 0, 0, 100));
  const [a, b] = BUCKETS.filter((k) => k !== key);
  const rest = 100 - v;
  const wa = alloc[a] || 0;
  const wb = alloc[b] || 0;
  const na = wa + wb > 0 ? Math.round((rest * wa) / (wa + wb)) : Math.ceil(rest / 2);
  return { preset: 'custom', [key]: v, [a]: na, [b]: rest - na };
}

/**
 * The split actually used. A bucket with nothing to fund (no debts, no goals,
 * emergency fund already at 6 months) passes its share to the others, so
 * every unit of savings is assigned and the three timelines add up.
 */
export function effectiveAllocation(alloc, needed) {
  const active = BUCKETS.filter((k) => needed[k]);
  const inactive = BUCKETS.filter((k) => !needed[k] && (alloc[k] || 0) > 0);
  const shares = { emergency: 0, debt: 0, goals: 0 };
  if (!active.length) return { shares, inactive, unassigned: true };
  const weight = sum(active.map((k) => alloc[k] || 0));
  for (const k of active) shares[k] = weight > 0 ? (alloc[k] || 0) / weight : 1 / active.length;
  return { shares, inactive, unassigned: false };
}

/**
 * What a bill would be after the committed ideas in the plan. Each committed
 * cash idea on that bill cuts its share of whatever is left, the same way
 * evaluatePlan stacks them.
 */
export function fieldAfterPlan(plan, values, field) {
  return plan
    .filter((p) => p.committed && p.kind === 'cash' && p.rule.pools.includes(field))
    .reduce((left, p) => left * (1 - p.pct), values[field] || 0);
}

/** Names of the rows, with any unnamed ones gathered under one label so counts stay right. */
function rowNames(rows, unnamedLabel) {
  const names = rows.map((r) => (r.name || '').trim()).filter(Boolean);
  return names.length < rows.length ? [...names, unnamedLabel] : names;
}

/**
 * The three things to do on payday: set aside money for once-a-year costs,
 * move what's left to savings first, and keep a weekly allowance for
 * eating out and shopping. Null without income.
 */
export function paydayPlan(totals, plan, optimized) {
  if (!(totals.income > 0)) return null;
  const left = totals.income - optimized;
  const funMonthly = sum(ALLOWANCE_FIELDS.map((f) => fieldAfterPlan(plan, totals.values, f)));
  return {
    yearlyMonthly: totals.yearlyMonthly,
    yearlyTotal: totals.yearlyTotal,
    yearlyNames: rowNames(totals.yearly.filter((y) => y.cost > 0), t('calc.otherCosts')),
    extrasMonthly: totals.extrasMonthly,
    extrasNames: rowNames(totals.extras.filter((x) => x.amount > 0), t('calc.otherIncome')),
    toSave: Math.max(0, left),
    short: Math.max(0, -left),
    funMonthly,
    funWeekly: (funMonthly * 12) / 52
  };
}

/** Splits a monthly amount by fractional shares. */
export const splitSavings = (monthly, shares) =>
  Object.fromEntries(BUCKETS.map((k) => [k, monthly * (shares[k] || 0)]));

// ---------------- Projections, debt and goals ----------------
/**
 * Future value of a monthly contribution with monthly compounding.
 * Returns one point per year (index 0 = today). `real` is deflated by
 * annual inflation so values read in today's money.
 */
export function projectGrowth({ monthly, annualRate, years, inflation = 0 }) {
  const r = annualRate / 12;
  const nominal = [0];
  const contributed = [0];
  let bal = 0;
  for (let m = 1; m <= years * 12; m++) {
    bal = bal * (1 + r) + monthly;
    if (m % 12 === 0) {
      nominal.push(bal);
      contributed.push(monthly * m);
    }
  }
  const real = nominal.map((v, y) => v / Math.pow(1 + inflation, y));
  return { nominal, real, contributed };
}

/**
 * Month-by-month debt simulation.
 *  - 'minimum': each debt gets only its own payment; finished debts free nothing.
 *  - 'avalanche': the full payment budget (+ extra) is kept; after minimums,
 *    leftover money goes to the highest-interest balance first.
 * Returns { months, interest, feasible }. Infeasible = never paid off in 100 years.
 */
export function simulateDebts(debts, { extra = 0, strategy = 'minimum' } = {}) {
  const list = debts.filter((d) => d.balance > 0).map((d) => ({ b: d.balance, rate: d.apr / 1200, pay: d.payment, apr: d.apr }));
  if (!list.length) return { months: 0, interest: 0, feasible: true };
  const budget = sum(list.map((d) => d.pay)) + extra;
  const byApr = [...list].sort((a, b) => b.apr - a.apr);
  let interest = 0;
  for (let month = 1; month <= 1200; month++) {
    for (const d of list) {
      if (d.b <= 0) continue;
      const i = d.b * d.rate;
      d.b += i;
      interest += i;
    }
    if (strategy === 'minimum') {
      for (const d of list) if (d.b > 0) d.b -= Math.min(d.pay, d.b);
    } else {
      let left = budget;
      for (const d of list) {
        if (d.b <= 0) continue;
        const p = Math.min(d.pay, d.b, left);
        d.b -= p;
        left -= p;
      }
      for (const d of byApr) {
        if (left <= 0) break;
        if (d.b <= 0) continue;
        const p = Math.min(d.b, left);
        d.b -= p;
        left -= p;
      }
    }
    if (list.every((d) => d.b <= 0.005)) return { months: month, interest, feasible: true };
  }
  return { months: null, interest, feasible: false };
}

/** Current payoff vs putting extra money toward debt, highest interest first. */
export function debtFreeComparison(debts, extra) {
  const current = simulateDebts(debts, { strategy: 'minimum' });
  const accelerated = simulateDebts(debts, { extra: Math.max(0, extra), strategy: 'avalanche' });
  return {
    current,
    accelerated,
    interestSaved: current.feasible && accelerated.feasible ? Math.max(0, current.interest - accelerated.interest) : null,
    monthsSaved: current.feasible && accelerated.feasible ? Math.max(0, current.months - accelerated.months) : null
  };
}

/** Goals are funded one after another (top of the list first). */
export function goalTimeline(goals, monthly) {
  let cumulative = 0;
  return goals.map((g) => {
    const target = num(g.target);
    const saved = Math.min(num(g.saved), target || Infinity);
    const remaining = Math.max(0, target - saved);
    const progress = target > 0 ? saved / target : 0;
    if (remaining === 0) return { ...g, target, saved, remaining, progress: target > 0 ? 1 : 0, months: 0, reachable: true };
    if (!(monthly > 0)) return { ...g, target, saved, remaining, progress, months: null, reachable: false };
    cumulative += remaining / monthly;
    return { ...g, target, saved, remaining, progress, months: cumulative, reachable: true };
  });
}

/** Emergency fund coverage vs 3 and 6 months of essential expenses. */
export function emergencyFundStatus(essentials, fund, monthly) {
  const target3 = essentials * 3;
  const target6 = essentials * 6;
  const gap3 = Math.max(0, target3 - fund);
  const gap6 = Math.max(0, target6 - fund);
  const time = (gap) => (gap === 0 ? 0 : monthly > 0 ? gap / monthly : null);
  return {
    essentials, fund, target3, target6, gap3, gap6,
    coverage: essentials > 0 ? fund / essentials : null,
    monthsTo3: time(gap3), monthsTo6: time(gap6)
  };
}

/** One call that produces everything the dashboard renders. */
/**
 * What the household could save each month: what is left after bills plus
 * what the switched-on ideas free up. Without an income only the ideas' part
 * is known. Negative when spending is more than income.
 */
export function canSave(result) {
  const { income, spend } = result.totals;
  return income > 0 ? income - spend + result.savings : result.savings;
}

export function computeBudget(state, fmt = plainFmt) {
  const totals = computeTotals(state);
  const plan = evaluatePlan(state, totals, fmt);
  const committed = plan.filter((p) => p.committed);
  // Only cash changes lower monthly spending. Avoided interest is shown separately.
  const savings = sum(committed.filter((p) => p.kind === 'cash').map((p) => p.monthly));
  const interestAvoided = sum(committed.filter((p) => p.kind === 'interest').map((p) => p.monthly));
  const optimized = Math.max(0, totals.spend - savings);
  const housing = housingStatus(totals.values.rent, state.housingFree);
  const health = healthScore({
    income: totals.income, spend: totals.spend, rent: totals.values.rent,
    debtPayments: totals.debtPayments, emergencyFund: totals.values.emergencyFund,
    needs: totals.needs, wants: totals.wants, hasHighApr: highAprCards(totals.debts).length > 0,
    housing, fmt
  });
  const split = fiftyThirtyTwenty(totals);

  const goals = state.goals || [];
  const needed = {
    emergency: totals.needs > 0 && totals.values.emergencyFund < totals.needs * 6,
    debt: totals.debts.some((d) => d.balance > 0),
    goals: goals.some((g) => num(g.target) > num(g.saved))
  };
  // The money split between the three timelines is what's left after every
  // bill and the plan's changes: the same amount the payday plan moves to
  // savings. Over budget means nothing to split. Without income we can't tell,
  // so only the plan's savings count (as in the growth chart).
  const monthly = totals.income > 0 ? Math.max(0, totals.income - optimized) : savings;
  const eff = effectiveAllocation(state.allocation || ALLOCATION_PRESETS.even, needed);
  const allocation = { ...eff, needed, monthly, amounts: splitSavings(monthly, eff.shares) };

  const payday = paydayPlan(totals, plan, optimized);
  // When even the switched-on ideas leave less than 10% to save, spending limits that fit the income
  const balance = totals.income > 0 && totals.income - optimized < totals.income * SAVE_TARGET
    ? balancePlan(totals, state.country, state.profile)
    : null;

  return { totals, plan, savings, interestAvoided, optimized, housing, health, split, allocation, payday, balance };
}
