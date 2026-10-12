// All budget math lives here as pure functions: no DOM, no storage, no globals.
// UI modules call computeBudget() once per change and render from the result.

import { RULES, highAprCards } from './rules.js';
import { PROFILES, benchmarkFor } from './profiles.js';

export const EXPENSE_FIELDS = [
  'rent', 'homeIns', 'electricity', 'waterGas', 'internet', 'fuel', 'transit',
  'carIns', 'carLoan', 'school', 'groceries', 'dining', 'misc'
];
export const VALUE_FIELDS = ['income', ...EXPENSE_FIELDS, 'emergencyFund'];

export const CATEGORY_DEFS = [
  { key: 'housing', label: 'Housing', fields: ['rent', 'homeIns'] },
  { key: 'utilities', label: 'Bills & utilities', fields: ['electricity', 'waterGas', 'internet'] },
  { key: 'transport', label: 'Getting around', fields: ['fuel', 'transit', 'carIns', 'carLoan'] },
  { key: 'family', label: 'Food, family & fun', fields: ['school', 'groceries', 'dining', 'misc'] },
  { key: 'debt', label: 'Loan payments', derived: 'debtPayments' },
  { key: 'subscriptions', label: 'Subscriptions', derived: 'subsTotal' }
];

// 50/30/20 classification. Minimum loan payments count as must-pay bills.
const NEEDS_FIELDS = ['rent', 'homeIns', 'electricity', 'waterGas', 'internet', 'fuel', 'transit', 'carIns', 'carLoan', 'school', 'groceries'];
const WANTS_FIELDS = ['dining', 'misc'];

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
  const subs = (state.subscriptions || []).map((s) => ({ ...s, cost: num(s.cost), rarely: !!s.rarely }));
  return { values, debts, subs };
}

/** Totals, category breakdown and 50/30/20 buckets for the current budget. */
export function computeTotals(state) {
  const { values, debts, subs } = cleanInputs(state);
  const B = benchmarkFor(state.currency, state.profile);
  const income = values.income;
  // A debt row with no balance left no longer needs a payment.
  const debtPayments = sum(debts.map((d) => (d.balance > 0 ? d.payment : 0)));
  const subsTotal = sum(subs.map((s) => s.cost));
  const derived = { debtPayments, subsTotal };

  const categories = CATEGORY_DEFS.map((c) => {
    const amount = c.derived ? derived[c.derived] : sum(c.fields.map((f) => values[f]));
    const benchmark = B.categoryShare[c.key];
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
export function evaluatePlan(state, totals, fmt = plainFmt) {
  const profile = PROFILES[state.profile] ? state.profile : 'suburban';
  const B = benchmarkFor(state.currency, profile);
  const ctx = {
    v: totals.values, profile, P: PROFILES[profile], B,
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
      label: rule.label, noun: rule.noun, title: rule.title,
      why: rule.why(ctx),
      evidence: typeof rule.evidence === 'function' ? rule.evidence(ctx) : rule.evidence,
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
    paid: housingShare <= 0.3
      ? `Housing takes ${pc(housingShare)} of your income. Under 30% is comfortable.`
      : `Housing takes ${pc(housingShare)} of your income. Try to keep it under 30% (${fmt(income * 0.3)}).`,
    free: 'You own your home or live rent-free, so housing isn’t a worry.',
    unknown: 'Your rent or mortgage is empty. Tell us if you own your home or live rent-free to get these points.',
    missing: 'You said you pay for housing. Add your rent or mortgage to get these points.'
  }[housing];

  let emergencyText;
  if (months == null) emergencyText = 'Add your bills so we can check this.';
  else if (emergencyFund <= 0) emergencyText = `You have no savings set aside for emergencies. Aim for ${fmt(needs * 3)} (3 months of essential bills).`;
  else if (months < 3) emergencyText = `Your emergency savings cover ${months.toFixed(1)} months of essential bills. Aim for 3 months (${fmt(needs * 3)}) first.`;
  else if (months < 6) emergencyText = `Your emergency savings cover ${months.toFixed(1)} months of essential bills. Next goal: 6 months (${fmt(needs * 6)}).`;
  else emergencyText = 'You have 6 months or more of essential bills saved. Excellent.';

  const parts = [
    {
      key: 'savings', label: 'Saving each month', max: 30,
      earned: 30 * clamp(saveRate / 0.2, 0, 1),
      text: saveRate < 0
        ? `Your bills cost more than you earn, so nothing is left to save. The goal is to keep 20% (${fmt(income * 0.2)}) each month.`
        : saveRate < 0.2
          ? `You keep ${pc(saveRate)} of your income after bills. Aim for 20% (${fmt(income * 0.2)} a month).`
          : `You keep ${pc(saveRate)} of your income after bills. That beats the 20% goal.`
    },
    { key: 'housing', label: 'Housing cost', max: 20, earned: housingEarned, text: housingText },
    {
      key: 'debt', label: 'Debt', max: 15,
      earned: Math.min(hasHighApr ? 10 : 15, 15 * clamp((0.36 - dti) / 0.26, 0, 1)),
      text: (debtPayments > 0
        ? `Loan payments take ${pc(dti)} of your income. Under 10% is healthy.`
        : 'You have no loan payments. Great.') + (hasHighApr ? ' A card charges over 15% interest a year, which costs you extra.' : '')
    },
    { key: 'emergency', label: 'Emergency fund', max: 20, earned: needs > 0 ? 20 * clamp(emergencyFund / needs / 6, 0, 1) : 20, text: emergencyText },
    {
      key: 'wants', label: 'Nice-to-haves', max: 15,
      earned: 15 * clamp((0.45 - wantsShare) / 0.15, 0, 1),
      text: `Eating out, shopping and subscriptions take ${pc(wantsShare)} of your income. ` +
        (wantsShare <= 0.3 ? 'Under 30% is a good target.' : `Try to bring them under 30% (${fmt(income * 0.3)}).`)
    }
  ];
  const score = Math.round(sum(parts.map((p) => p.earned)));
  const worst = [...parts].sort((a, b) => b.max - b.earned - (a.max - a.earned))[0];
  const gain = Math.round(worst.max - worst.earned);
  const TIPS = {
    savings: 'Saving more of your income each month',
    housing: housing === 'paid' ? 'Lowering your housing cost' : 'Answering the housing question',
    debt: hasHighApr ? 'Paying off high-interest cards' : 'Lowering your loan payments',
    emergency: 'Building your emergency fund',
    wants: 'Spending a little less on nice-to-haves'
  };
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Okay' : 'Needs attention';
  return {
    score, label, parts,
    tip: gain > 0 ? `Biggest boost: ${TIPS[worst.key].toLowerCase()} could add up to ${gain} points.` : 'Every part is in great shape. Keep it up!'
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
  emergency: { label: 'Emergency fund first', emergency: 60, debt: 20, goals: 20 },
  debt: { label: 'Debt first', emergency: 20, debt: 60, goals: 20 },
  even: { label: 'Split evenly', emergency: 34, debt: 33, goals: 33 },
  goals: { label: 'Goals first', emergency: 20, debt: 20, goals: 60 }
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
  const eff = effectiveAllocation(state.allocation || ALLOCATION_PRESETS.even, needed);
  const allocation = { ...eff, needed, amounts: splitSavings(savings, eff.shares) };

  return { totals, plan, savings, interestAvoided, optimized, housing, health, split, allocation };
}
