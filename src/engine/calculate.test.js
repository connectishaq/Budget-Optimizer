import { describe, it, expect } from 'vitest';
import {
  computeTotals, evaluatePlan, computeBudget, projectGrowth, simulateDebts,
  debtFreeComparison, goalTimeline, emergencyFundStatus, healthScore,
  fiftyThirtyTwenty, paybackMonths, housingStatus,
  rebalanceAllocation, effectiveAllocation, splitSavings, ALLOCATION_PRESETS,
  fieldAfterPlan, paydayPlan
} from './calculate.js';
import { RULES } from './rules.js';
import { paydayIcs, nextPayday } from '../utils/ics.js';
import { guessSubKind, subKind } from './subscriptions.js';
import { sampleFor, benchmarkFor } from './profiles.js';
import { parseAmount, duration, moneyNice, roundFriendly, pctWords } from '../utils/format.js';

const base = (over = {}) => ({
  profile: 'suburban',
  currency: 'USD',
  values: { income: 6000 },
  debts: [],
  subscriptions: [],
  plan: { committed: {}, pct: {} },
  ...over
});
const ids = (plan) => plan.map((p) => p.id);

describe('rule dictionary', () => {
  it('has at least 15 rules with unique ids and the plain-language fields', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const r of RULES) {
      expect(['Easy', 'Medium', 'Requires purchase']).toContain(r.effort);
      expect(['cash', 'interest']).toContain(r.kind);
      expect(typeof r.why).toBe('function');
      expect(r.label && r.noun && r.title && r.evidence).toBeTruthy();
      expect(r.pools.length).toBeGreaterThan(0);
    }
  });
});

describe('evaluatePlan', () => {
  it('fires carpooling at exactly 15% for suburban fuel > 200', () => {
    const s = base({ values: { income: 6000, fuel: 300 } });
    const carpool = evaluatePlan(s, computeTotals(s)).find((p) => p.id === 'fuel-carpool');
    expect(carpool.monthly).toBeCloseTo(45, 5);
    expect(carpool.annual).toBeCloseTo(540, 5);
    expect(carpool.why).toMatch(/higher than what's typical for families/);
  });

  it('profile changes which rules fire', () => {
    const values = { income: 6000, fuel: 300 };
    const sub = evaluatePlan(base({ values }), computeTotals(base({ values })));
    const single = evaluatePlan(base({ profile: 'single', values }), computeTotals(base({ profile: 'single', values })));
    expect(ids(sub)).toContain('fuel-carpool');
    expect(ids(single)).not.toContain('fuel-carpool');
    expect(ids(single)).toContain('fuel-carlight');
  });

  it('profile changes thresholds (utilities 170 fires for young pro, not suburban)', () => {
    const values = { income: 6000, electricity: 120, waterGas: 50 };
    const yp = base({ profile: 'youngpro', values });
    const sb = base({ values });
    expect(ids(evaluatePlan(yp, computeTotals(yp)))).toContain('utilities-efficiency');
    expect(ids(evaluatePlan(sb, computeTotals(sb)))).not.toContain('utilities-efficiency');
  });

  it('stacked rules on the same bill never double-count', () => {
    const s = base({ values: { income: 6000, electricity: 250, waterGas: 100 } }); // pool = 350
    const plan = evaluatePlan(s, computeTotals(s));
    const eff = plan.find((p) => p.id === 'utilities-efficiency');
    const smart = plan.find((p) => p.id === 'smart-thermostat');
    expect(eff.monthly).toBeCloseTo(350 * 0.12, 5);
    expect(smart.monthly).toBeCloseTo(350 * 0.88 * 0.08, 5); // applies to what is left
    expect(smart.rawBase).toBe(350);
    expect(smart.stacked).toBe(true);
  });

  it('uncommitted actions do not reduce the optimized total', () => {
    const s = base({ values: { income: 6000, misc: 400 }, plan: { committed: { 'impulse-24h': false }, pct: {} } });
    const r = computeBudget(s);
    expect(r.savings).toBe(0);
    expect(r.optimized).toBe(r.totals.spend);
  });

  it('custom % is clamped to 0..2x default', () => {
    const s = base({ values: { income: 6000, misc: 400 }, plan: { committed: {}, pct: { 'impulse-24h': 0.9 } } });
    const item = evaluatePlan(s, computeTotals(s)).find((p) => p.id === 'impulse-24h');
    expect(item.pct).toBe(0.5);
    expect(item.monthly).toBeCloseTo(200, 5);
  });

  it('cancels 100% of subscriptions marked rarely used', () => {
    const s = base({
      subscriptions: [
        { id: 'a', name: 'Gym', cost: 45, rarely: true },
        { id: 'b', name: 'Music', cost: 10, rarely: false }
      ]
    });
    const item = evaluatePlan(s, computeTotals(s)).find((p) => p.id === 'subs-cancel-unused');
    expect(item.monthly).toBeCloseTo(45, 5);
  });

  it('flags rent above 35% of income', () => {
    const s = base({ profile: 'single', values: { income: 4000, rent: 1600 } });
    const item = evaluatePlan(s, computeTotals(s)).find((p) => p.id === 'rent-burden');
    expect(item.flag).toMatch(/40%/);
  });

  it('every sample profile produces a plan with cash savings, in USD and PKR', () => {
    for (const currency of ['USD', 'PKR']) {
      for (const p of ['single', 'suburban', 'youngpro']) {
        const smp = sampleFor(p, currency);
        const r = computeBudget(base({ profile: p, currency, values: smp.values, debts: smp.debts, subscriptions: smp.subscriptions }));
        expect(r.plan.length).toBeGreaterThan(3);
        expect(r.savings).toBeGreaterThan(0);
        expect(r.totals.income).toBeGreaterThan(r.totals.spend); // samples are realistic, not overspending
      }
    }
  });
});

describe('debt interest is not cash savings', () => {
  const s = base({ debts: [{ id: 'c', type: 'card', name: 'Card', balance: 6000, apr: 24, payment: 200 }] });

  it('computes interest avoided and transfer-fee payback', () => {
    const item = evaluatePlan(s, computeTotals(s)).find((p) => p.id === 'debt-avalanche');
    expect(item.kind).toBe('interest');
    expect(item.base).toBeCloseTo(120, 5); // 6000 * 24% / 12
    expect(item.monthly).toBeCloseTo(90, 5); // 75%
    expect(item.upfront).toBeCloseTo(180, 5); // 3% fee
    expect(item.payback).toBeCloseTo(2, 5);
  });

  it('excludes avoided interest from monthly savings and optimized spend', () => {
    const r = computeBudget(s);
    expect(r.savings).toBe(0);
    expect(r.interestAvoided).toBeCloseTo(90, 5);
    expect(r.optimized).toBe(r.totals.spend);
  });
});

describe('country benchmarks', () => {
  it('PKR has its own hand-written set (not scaled from USD)', () => {
    const pk = benchmarkFor('PKR', 'suburban');
    expect(pk.approximate).toBe(false);
    expect(pk.thresholds.utilities).toBe(40000);
    expect(pk.ranges.fuel).toEqual([18000, 28000]);
  });

  it('INR has its own hand-written set', () => {
    const inr = benchmarkFor('INR', 'suburban');
    expect(inr.approximate).toBe(false);
    expect(inr.thresholds.utilities).toBe(8500);
    expect(inr.ranges.homeHelp).toEqual([4000, 12000]);
  });

  it('INR thresholds drive the rules, including local ideas', () => {
    const s = base({ currency: 'INR', values: { income: 180000, fuel: 9500, electricity: 7000 } });
    const got = ids(evaluatePlan(s, computeTotals(s)));
    expect(got).toContain('fuel-carpool');
    expect(got).toContain('electricity-slab');
    expect(got).not.toContain('smart-thermostat');
  });

  it('every INR sample leaves the household in a believable spot', () => {
    for (const p of ['single', 'suburban', 'youngpro']) {
      const r = computeBudget({ ...base({ profile: p, currency: 'INR' }), ...sampleFor(p, 'INR') });
      expect(r.totals.spend).toBeGreaterThan(r.totals.income * 0.7);
      expect(r.totals.spend).toBeLessThan(r.totals.income * 1.1);
      expect(r.plan.length).toBeGreaterThan(2);
    }
  });

  it('currencies without a set fall back to scaled US figures and are flagged', () => {
    const gb = benchmarkFor('GBP', 'suburban');
    expect(gb.approximate).toBe(true);
    expect(gb.thresholds.fuel).toBe(150); // 200 x 0.75
  });

  it('PKR thresholds drive the rules', () => {
    const s = base({ currency: 'PKR', values: { income: 300000, fuel: 30000 } });
    expect(ids(evaluatePlan(s, computeTotals(s)))).toContain('fuel-carpool');
    const low = base({ currency: 'PKR', values: { income: 300000, fuel: 20000 } });
    expect(ids(evaluatePlan(low, computeTotals(low)))).not.toContain('fuel-carpool');
  });
});

describe('housing check', () => {
  it('classifies an empty rent box by the user answer', () => {
    expect(housingStatus(1200, null)).toBe('paid');
    expect(housingStatus(0, true)).toBe('free');
    expect(housingStatus(0, false)).toBe('missing');
    expect(housingStatus(0, null)).toBe('unknown');
  });

  it('does not give full housing points until the question is answered', () => {
    const args = { income: 5000, spend: 3000, rent: 0, debtPayments: 0, emergencyFund: 0, needs: 2000, wants: 500, hasHighApr: false };
    const part = (housing) => healthScore({ ...args, housing }).parts.find((p) => p.key === 'housing');
    expect(part('unknown').earned).toBe(10);
    expect(part('missing').earned).toBe(0);
    expect(part('free').earned).toBe(20);
    expect(part('unknown').text).toMatch(/own your home or live rent-free/);
  });

  it('computeBudget passes the answer through', () => {
    const r = computeBudget({ ...base({ values: { income: 5000, groceries: 400 } }), housingFree: true });
    expect(r.housing).toBe('free');
  });
});

describe('savings split', () => {
  it('rebalances the other two buckets so the total stays 100', () => {
    const a = rebalanceAllocation({ emergency: 34, debt: 33, goals: 33 }, 'emergency', 60);
    expect(a.emergency + a.debt + a.goals).toBe(100);
    expect(a.emergency).toBe(60);
    expect(a.debt).toBe(20);
    expect(a.goals).toBe(20);
    const b = rebalanceAllocation({ emergency: 100, debt: 0, goals: 0 }, 'emergency', 40);
    expect(b.debt + b.goals).toBe(60);
  });

  it('passes an unused bucket share to the others', () => {
    const eff = effectiveAllocation(ALLOCATION_PRESETS.debt, { emergency: true, debt: false, goals: true });
    expect(eff.shares.debt).toBe(0);
    expect(eff.shares.emergency + eff.shares.goals).toBeCloseTo(1, 10);
    expect(eff.inactive).toEqual(['debt']);
  });

  it('splits savings so the three amounts add up', () => {
    const eff = effectiveAllocation(ALLOCATION_PRESETS.even, { emergency: true, debt: true, goals: true });
    const amounts = splitSavings(900, eff.shares);
    expect(amounts.emergency + amounts.debt + amounts.goals).toBeCloseTo(900, 8);
  });

  it('computeBudget gives each timeline only its share', () => {
    const s = {
      ...base({
        values: { income: 6000, misc: 400, groceries: 300, emergencyFund: 0 },
        debts: [{ id: 'l', type: 'loan', name: 'Loan', balance: 5000, apr: 8, payment: 200 }]
      }),
      goals: [{ id: 'g', name: 'Trip', target: 1000, saved: 0 }],
      allocation: { preset: 'custom', emergency: 50, debt: 25, goals: 25 }
    };
    const r = computeBudget(s);
    expect(r.savings).toBeCloseTo(100, 5); // 25% of 400 misc
    // Everything left after bills and the plan: 6000 - (900 - 100)
    expect(r.allocation.monthly).toBeCloseTo(5200, 5);
    expect(r.allocation.amounts.emergency).toBeCloseTo(2600, 5);
    expect(r.allocation.amounts.debt).toBeCloseTo(1300, 5);
    expect(r.allocation.amounts.goals).toBeCloseTo(1300, 5);
  });

  it('shares out money already left over, even with no ideas in the plan', () => {
    const s = {
      ...base({ profile: 'single', values: { income: 5000, rent: 1200, groceries: 300 } }),
      goals: [{ id: 'g', name: 'Car', target: 6000, saved: 0 }],
      allocation: { preset: 'even', emergency: 34, debt: 33, goals: 33 }
    };
    const r = computeBudget(s);
    expect(r.savings).toBe(0);
    expect(r.allocation.monthly).toBeCloseTo(r.payday.toSave, 8);
    expect(r.allocation.amounts.goals).toBeGreaterThan(0);
  });

  it('shares out nothing while bills cost more than income', () => {
    const s = {
      ...base({ profile: 'single', values: { income: 2000, rent: 1500, dining: 900, groceries: 400 } }),
      goals: [{ id: 'g', name: 'Car', target: 6000, saved: 0 }]
    };
    const r = computeBudget(s);
    expect(r.savings).toBeGreaterThan(0);
    expect(r.payday.short).toBeGreaterThan(0);
    expect(r.allocation.monthly).toBe(0);
    expect(r.allocation.amounts).toEqual({ emergency: 0, debt: 0, goals: 0 });
  });
});

describe('projection math', () => {
  it('matches the closed-form future value of an annuity', () => {
    const { nominal } = projectGrowth({ monthly: 250, annualRate: 0.08, years: 10 });
    const r = 0.08 / 12;
    expect(nominal[10]).toBeCloseTo(250 * ((Math.pow(1 + r, 120) - 1) / r), 6);
    expect(Math.round(nominal[10])).toBe(45737);
  });

  it('zero return equals total contributions', () => {
    const { nominal, contributed } = projectGrowth({ monthly: 100, annualRate: 0, years: 5 });
    expect(nominal[5]).toBe(6000);
    expect(contributed[5]).toBe(6000);
  });

  it('deflates by inflation for real values', () => {
    const { nominal, real } = projectGrowth({ monthly: 100, annualRate: 0.05, years: 3, inflation: 0.03 });
    expect(real[3]).toBeCloseTo(nominal[3] / Math.pow(1.03, 3), 6);
    expect(real[0]).toBe(0);
  });
});

describe('debt simulation', () => {
  it('pays a 0% loan in balance / payment months', () => {
    expect(simulateDebts([{ balance: 1200, apr: 0, payment: 100 }])).toEqual({ months: 12, interest: 0, feasible: true });
  });

  it('detects payments that never cover interest', () => {
    expect(simulateDebts([{ balance: 10000, apr: 30, payment: 100 }]).feasible).toBe(false);
  });

  it('putting extra toward debt pays off sooner and saves interest', () => {
    const debts = [
      { balance: 5000, apr: 22, payment: 150 },
      { balance: 8000, apr: 9, payment: 250 }
    ];
    const cmp = debtFreeComparison(debts, 200);
    expect(cmp.accelerated.months).toBeLessThan(cmp.current.months);
    expect(cmp.interestSaved).toBeGreaterThan(0);
  });
});

describe('goals and emergency fund', () => {
  it('funds goals sequentially', () => {
    const g = goalTimeline([{ name: 'A', target: 1000, saved: 0 }, { name: 'B', target: 600, saved: 100 }], 100);
    expect(g[0].months).toBe(10);
    expect(g[1].months).toBe(15);
    expect(g[1].progress).toBeCloseTo(100 / 600, 6);
  });

  it('marks goals unreachable without savings', () => {
    expect(goalTimeline([{ name: 'A', target: 500 }], 0)[0].reachable).toBe(false);
  });

  it('computes emergency fund gaps and time to close them', () => {
    const e = emergencyFundStatus(2000, 3000, 500);
    expect(e.target3).toBe(6000);
    expect(e.gap3).toBe(3000);
    expect(e.monthsTo3).toBe(6);
    expect(e.gap6).toBe(9000);
    expect(e.coverage).toBe(1.5);
  });
});

describe('health score & 50/30/20', () => {
  it('returns null without income', () => {
    expect(healthScore({ income: 0 })).toBeNull();
    expect(fiftyThirtyTwenty({ income: 0 })).toBeNull();
  });

  it('scores a model budget at 100, with a sentence for every part', () => {
    const h = healthScore({ income: 10000, spend: 7000, rent: 2500, debtPayments: 500, emergencyFund: 60000, needs: 5000, wants: 2000, hasHighApr: false });
    expect(h.score).toBe(100);
    for (const p of h.parts) expect(p.text.length).toBeGreaterThan(20);
  });

  it('explains an empty emergency fund with a target', () => {
    const h = healthScore({ income: 5000, spend: 4000, rent: 1000, debtPayments: 0, emergencyFund: 0, needs: 2000, wants: 500, fmt: (n) => `$${n}` });
    expect(h.parts.find((p) => p.key === 'emergency').text).toBe('You have no savings set aside for emergencies. Aim for $6000 (3 months of essential bills).');
  });

  it('reports wants over the 30% guideline', () => {
    const s = fiftyThirtyTwenty({ income: 5000, needs: 2500, wants: 1800, spend: 4300 });
    expect(s.diffs.wants).toBe(300);
    expect(s.actual.savings).toBe(700);
  });
});

// Intl separates 'Rs' and the amount with a non-breaking space
const sp = (s) => s.replace(/ /g, ' ');

describe('formatting', () => {
  it('shows PKR/INR in lakh and crore', () => {
    expect(sp(moneyNice(11600000, 'PKR'))).toBe('Rs 1.16 crore');
    expect(sp(moneyNice(350000, 'PKR'))).toBe('Rs 3.5 lakh');
    expect(sp(moneyNice(250000, 'INR'))).toBe('₹2.5 lakh');
    expect(sp(moneyNice(20000, 'PKR'))).toBe('Rs 20,000');
  });

  it('rounds estimates to friendly numbers but keeps USD exact to the unit', () => {
    expect(roundFriendly(5049, 'PKR')).toBe(5000);
    expect(sp(moneyNice(5049, 'PKR', { friendly: true }))).toBe('Rs 5,000');
    expect(moneyNice(45.4, 'USD', { friendly: true })).toBe('$45');
  });

  it('payback months', () => {
    expect(paybackMonths(0, 10)).toBe(0);
    expect(paybackMonths(120, 10)).toBe(12);
    expect(paybackMonths(50, 0)).toBe(Infinity);
  });

  it('parseAmount validates input', () => {
    expect(parseAmount('1,250.50')).toEqual({ value: 1250.5, error: null });
    expect(parseAmount('-5').error).toBeTruthy();
    expect(parseAmount('abc').error).toBeTruthy();
    expect(parseAmount('')).toEqual({ value: 0, error: null });
  });

  it('plain durations and percentages', () => {
    expect(duration(14)).toBe('1 year 2 months');
    expect(duration(24)).toBe('2 years');
    expect(duration(3.2)).toBe('4 months');
    expect(duration(1)).toBe('1 month');
    expect(pctWords(0.25)).toBe('about a quarter (25%)');
    expect(pctWords(0.12)).toBe('about 12%');
  });
});

describe('yearly costs and new bills', () => {
  it('spreads once-a-year costs over 12 months and counts them as must-pay bills', () => {
    const s = base({ yearly: [{ id: 'a', name: 'Festivals', cost: 1200 }, { id: 'b', name: 'Car', cost: 600 }] });
    const t = computeTotals(s);
    expect(t.yearlyTotal).toBe(1800);
    expect(t.yearlyMonthly).toBe(150);
    expect(t.spend).toBe(150);
    expect(t.needs).toBe(150);
    expect(t.categories.find((c) => c.key === 'yearly').amount).toBe(150);
  });

  it('adds health, help and giving to spending; "anything else" is a nice-to-have', () => {
    const t = computeTotals(base({ values: { income: 6000, medical: 100, homeHelp: 200, familySupport: 300, giving: 50, other: 80 } }));
    expect(t.categories.find((c) => c.key === 'care').amount).toBe(730);
    expect(t.needs).toBe(650);
    expect(t.wants).toBe(80);
  });

  it('suggests generic medicines when medical costs are above typical', () => {
    const s = base({ values: { income: 6000, medical: 400 } });
    const item = evaluatePlan(s, computeTotals(s)).find((p) => p.id === 'medical-generic');
    expect(item.monthly).toBeCloseTo(80, 5);
  });
});

describe('local savings ideas', () => {
  const pk = (values, over = {}) => base({ currency: 'PKR', values: { income: 300000, ...values }, ...over });

  it('PKR gets the electricity slab idea instead of a smart thermostat', () => {
    const s = pk({ electricity: 45000, waterGas: 6000 });
    const got = ids(evaluatePlan(s, computeTotals(s)));
    expect(got).toContain('electricity-slab');
    expect(got).not.toContain('smart-thermostat');
    const us = base({ values: { income: 6000, electricity: 250, waterGas: 100 } });
    expect(ids(evaluatePlan(us, computeTotals(us)))).not.toContain('electricity-slab');
  });

  it('card debt advice is worded for the region', () => {
    const debts = [{ id: 'c', type: 'card', name: 'Card', balance: 100000, apr: 40, payment: 8000 }];
    const local = evaluatePlan(pk({}, { debts }), computeTotals(pk({}, { debts }))).find((p) => p.id === 'debt-avalanche');
    expect(local.title).toBe('Pay off the card with a cheaper loan');
    const us = base({ debts: [{ ...debts[0], balance: 5000, apr: 24, payment: 200 }] });
    expect(evaluatePlan(us, computeTotals(us)).find((p) => p.id === 'debt-avalanche').title).toBe('Move the balance to a 0% card');
  });
});

describe('payday plan', () => {
  it('works out what to save and a weekly allowance after the plan', () => {
    const s = base({ values: { income: 6000, dining: 500, groceries: 400, misc: 400 }, yearly: [{ id: 'y', name: 'Gifts', cost: 1200 }] });
    const r = computeBudget(s);
    // dining-swap (40%) and impulse-24h (25%) are on by default
    expect(fieldAfterPlan(r.plan, r.totals.values, 'dining')).toBeCloseTo(300, 5);
    expect(fieldAfterPlan(r.plan, r.totals.values, 'misc')).toBeCloseTo(300, 5);
    expect(r.payday.funMonthly).toBeCloseTo(600, 5);
    expect(r.payday.funWeekly).toBeCloseTo((600 * 12) / 52, 5);
    expect(r.payday.yearlyMonthly).toBe(100);
    expect(r.payday.toSave).toBeCloseTo(6000 - r.optimized, 5);
    expect(r.payday.yearlyNames).toEqual(['Gifts']);
  });

  it('reports a shortfall instead of savings when costs beat income', () => {
    const t = computeTotals(base({ values: { income: 1000, rent: 1500 } }));
    const p = paydayPlan(t, [], t.spend);
    expect(p.toSave).toBe(0);
    expect(p.short).toBe(500);
    expect(paydayPlan(computeTotals(base({ values: {} })), [], 0)).toBeNull();
  });
});

describe('payday reminder file', () => {
  it('finds the next payday, including the last day of the month', () => {
    const from = new Date(2026, 1, 10); // 10 Feb 2026
    expect(nextPayday(25, from).getDate()).toBe(25);
    expect(nextPayday(5, from).getMonth()).toBe(2);
    expect(nextPayday('last', from).getDate()).toBe(28);
  });

  it('builds a monthly event with escaped, folded text', () => {
    const ics = paydayIcs({ day: 'last', title: 'Payday', lines: ['1. Save Rs 7,000; then relax', 'x'.repeat(120)], now: new Date(2026, 9, 13) });
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=-1');
    expect(ics).toContain('DTSTART:20261031T090000');
    expect(ics).toContain('Rs 7\\,000\\; then relax');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe('subscription types', () => {
  it('guesses the type from the name', () => {
    expect(guessSubKind('Netflix')).toBe('streaming');
    expect(guessSubKind('Claude Pro')).toBe('tools');
    expect(guessSubKind('Gym membership')).toBe('fitness');
    expect(guessSubKind('Amazon Prime')).toBe('membership');
    expect(guessSubKind('iCloud+')).toBe('cloud');
    expect(guessSubKind('Duolingo')).toBe('learning');
    expect(guessSubKind('Something else')).toBe('other');
    expect(subKind({ name: 'Netflix', kind: 'tools' })).toBe('tools'); // the user's pick wins
  });

  it('counts work tools as must-pay bills and groups costs by type', () => {
    const t = computeTotals(base({ subscriptions: [
      { id: 'a', name: 'Claude', cost: 20 },
      { id: 'b', name: 'Netflix', cost: 15 },
      { id: 'c', name: 'Spotify', cost: 10 }
    ] }));
    expect(t.needs).toBe(20);
    expect(t.wants).toBe(25);
    expect(t.subsByKind).toEqual({ tools: 20, streaming: 25 });
  });

  it('streaming and tools ideas only look at their own type', () => {
    const s = base({ subscriptions: [
      { id: 'a', name: 'Claude', cost: 20 }, { id: 'b', name: 'ChatGPT', cost: 20 }, { id: 'c', name: 'Cursor', cost: 20 },
      { id: 'd', name: 'Netflix', cost: 15 }
    ] });
    const plan = evaluatePlan(s, computeTotals(s));
    expect(ids(plan)).not.toContain('subs-rotate');
    expect(plan.find((p) => p.id === 'subs-tools-yearly').monthly).toBeCloseTo(9, 5);
  });
});
