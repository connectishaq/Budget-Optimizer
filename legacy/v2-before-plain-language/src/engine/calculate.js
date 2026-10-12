// All budget math lives here as pure functions: no DOM, no storage, no globals.
// UI modules call computeBudget() once per change and render from the result.

import { RULES, highAprCards } from './rules.js';
import { PROFILES, scaleFor } from './profiles.js';

export const EXPENSE_FIELDS = [
  'rent', 'homeIns', 'electricity', 'waterGas', 'internet', 'fuel', 'transit',
  'carIns', 'carLoan', 'school', 'groceries', 'dining', 'misc'
];
export const VALUE_FIELDS = ['income', ...EXPENSE_FIELDS, 'emergencyFund'];

export const CATEGORY_DEFS = [
  { key: 'housing', label: 'Housing', fields: ['rent', 'homeIns'] },
  { key: 'utilities', label: 'Utilities', fields: ['electricity', 'waterGas', 'internet'] },
  { key: 'transport', label: 'Transport', fields: ['fuel', 'transit', 'carIns', 'carLoan'] },
  { key: 'family', label: 'Family & Lifestyle', fields: ['school', 'groceries', 'dining', 'misc'] },
  { key: 'debt', label: 'Debt payments', derived: 'debtPayments' },
  { key: 'subscriptions', label: 'Subscriptions', derived: 'subsTotal' }
];

// 50/30/20 classification. Debt minimum payments count as needs.
const NEEDS_FIELDS = ['rent', 'homeIns', 'electricity', 'waterGas', 'internet', 'fuel', 'transit', 'carIns', 'carLoan', 'school', 'groceries'];
const WANTS_FIELDS = ['dining', 'misc'];

const num = (n) => (Number.isFinite(+n) && +n > 0 ? +n : 0);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

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
  const subs = (state.subscriptions || []).map((s) => ({ ...s, cost: num(s.cost), rarely: !!s.rarely }));
  return { values, debts, subs };
}

/** Totals, category breakdown and 50/30/20 buckets for the current budget. */
export function computeTotals(state) {
  const { values, debts, subs } = cleanInputs(state);
  const P = PROFILES[state.profile] || PROFILES.suburban;
  const income = values.income;
  // A debt row with no balance left no longer needs a payment.
  const debtPayments = sum(debts.map((d) => (d.balance > 0 ? d.payment : 0)));
  const subsTotal = sum(subs.map((s) => s.cost));
  const derived = { debtPayments, subsTotal };

  const categories = CATEGORY_DEFS.map((c) => {
    const amount = c.derived ? derived[c.derived] : sum(c.fields.map((f) => values[f]));
    const benchmark = P.categoryShare[c.key];
    const share = income > 0 ? amount / income : null;
    return { ...c, amount, share, benchmark, over: share != null && amount > 0 && share > benchmark };
  });

  const spend = sum(categories.map((c) => c.amount));
  const needs = sum(NEEDS_FIELDS.map((f) => values[f])) + debtPayments;
  const wants = sum(WANTS_FIELDS.map((f) => values[f])) + subsTotal;

  return { values, debts, subs, income, debtPayments, subsTotal, categories, spend, needs, wants, surplus: income - spend };
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
export function evaluatePlan(state, totals, fmt = (n) => String(Math.round(n))) {
  const k = scaleFor(state.currency);
  const profile = PROFILES[state.profile] ? state.profile : 'suburban';
  const ctx = {
    v: totals.values, profile, P: PROFILES[profile], k,
    income: totals.income, debts: totals.debts, subs: totals.subs, fmt
  };
  const committedMap = state.plan?.committed || {};
  const pctMap = state.plan?.pct || {};

  const poolValue = (key) => {
    if (key === 'subsRarely') return sum(ctx.subs.filter((s) => s.rarely).map((s) => s.cost));
    if (key === 'subsActive') return sum(ctx.subs.filter((s) => !s.rarely).map((s) => s.cost));
    if (key === 'cardInterest') return sum(highAprCards(ctx.debts).map((d) => (d.balance * d.apr) / 1200));
    return ctx.v[key] || 0;
  };

  const pools = {};
  const items = [];
  for (const rule of RULES) {
    if (!rule.when(ctx)) continue;
    for (const key of rule.pools) if (!(key in pools)) pools[key] = poolValue(key);

    const base = sum(rule.pools.map((key) => pools[key]));
    const defaultPct = typeof rule.pct === 'function' ? rule.pct(ctx) : rule.pct;
    const maxPct = rule.maxPct ?? Math.min(1, defaultPct * 2);
    const pct = clamp(pctMap[rule.id] ?? defaultPct, 0, maxPct);
    const monthly = base * pct;
    const committed = committedMap[rule.id] ?? true;
    const upfront = typeof rule.upfront === 'function' ? rule.upfront(ctx) : (rule.upfront || 0) * k;

    if (committed) for (const key of rule.pools) pools[key] *= 1 - pct;

    items.push({
      id: rule.id, rule, base, pct, defaultPct, maxPct, monthly, annual: monthly * 12,
      committed, upfront, payback: paybackMonths(upfront, monthly),
      effort: rule.effort, category: rule.category, icon: rule.icon, title: rule.title,
      description: rule.description(ctx), tips: rule.tips(ctx), flag: rule.flag ? rule.flag(ctx) : null
    });
  }
  return items;
}

/**
 * Budget Health Score (0–100) from five weighted components. Returns the
 * component with the most missing points as the "biggest improvement" tip.
 */
export function healthScore({ income, spend, rent, debtPayments, emergencyFund, needs, wants, hasHighApr }) {
  if (!(income > 0)) return null;
  const parts = [
    { key: 'savings', label: 'Savings rate', max: 30, earned: 30 * clamp((income - spend) / income / 0.2, 0, 1) },
    { key: 'housing', label: 'Housing cost', max: 20, earned: 20 * clamp((0.5 - rent / income) / 0.2, 0, 1) },
    {
      key: 'debt', label: 'Debt load', max: 15,
      earned: Math.min(hasHighApr ? 10 : 15, 15 * clamp((0.36 - debtPayments / income) / 0.26, 0, 1))
    },
    { key: 'emergency', label: 'Emergency fund', max: 20, earned: needs > 0 ? 20 * clamp(emergencyFund / needs / 6, 0, 1) : 20 },
    { key: 'wants', label: 'Wants spending', max: 15, earned: 15 * clamp((0.45 - wants / income) / 0.15, 0, 1) }
  ];
  const score = Math.round(sum(parts.map((p) => p.earned)));
  const worst = [...parts].sort((a, b) => b.max - b.earned - (a.max - a.earned))[0];
  const gain = Math.round(worst.max - worst.earned);
  const TIPS = {
    savings: 'Raising your savings rate toward 20% of income',
    housing: 'Bringing housing costs closer to 30% of income',
    debt: hasHighApr ? 'Clearing high-APR card balances' : 'Reducing debt payments below 10% of income',
    emergency: 'Growing your emergency fund toward 6 months of essentials',
    wants: 'Trimming wants (dining, impulse buys, subscriptions) toward 30% of income'
  };
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs attention';
  return {
    score, label, parts,
    tip: gain > 0 ? `${TIPS[worst.key]} would improve your score the most (up to +${gain} points).` : 'Every area is in great shape. Keep it up!'
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
 *    leftover money goes to the highest-APR balance first.
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

/** Current payoff vs redirecting committed savings to debt (avalanche). */
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
export function computeBudget(state, fmt) {
  const totals = computeTotals(state);
  const plan = evaluatePlan(state, totals, fmt);
  const savings = sum(plan.filter((p) => p.committed).map((p) => p.monthly));
  const optimized = Math.max(0, totals.spend - savings);
  const health = healthScore({
    income: totals.income, spend: totals.spend, rent: totals.values.rent,
    debtPayments: totals.debtPayments, emergencyFund: totals.values.emergencyFund,
    needs: totals.needs, wants: totals.wants, hasHighApr: highAprCards(totals.debts).length > 0
  });
  const split = fiftyThirtyTwenty(totals);
  return { totals, plan, savings, optimized, health, split };
}
