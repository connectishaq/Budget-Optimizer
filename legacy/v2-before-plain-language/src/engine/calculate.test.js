import { describe, it, expect } from 'vitest';
import {
  computeTotals, evaluatePlan, computeBudget, projectGrowth, simulateDebts,
  debtFreeComparison, goalTimeline, emergencyFundStatus, healthScore,
  fiftyThirtyTwenty, paybackMonths
} from './calculate.js';
import { RULES } from './rules.js';
import { sampleFor } from './profiles.js';
import { parseAmount, duration } from '../utils/format.js';

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
  it('has at least 15 rules with unique ids and required fields', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const r of RULES) {
      expect(['Easy', 'Medium', 'Requires purchase']).toContain(r.effort);
      expect(typeof r.when).toBe('function');
      expect(r.pools.length).toBeGreaterThan(0);
    }
  });
});

describe('evaluatePlan', () => {
  it('fires carpooling at exactly 15% for suburban fuel > 200', () => {
    const s = base({ values: { income: 6000, fuel: 300 } });
    const plan = evaluatePlan(s, computeTotals(s));
    const carpool = plan.find((p) => p.id === 'fuel-carpool');
    expect(carpool.monthly).toBeCloseTo(45, 5);
    expect(carpool.annual).toBeCloseTo(540, 5);
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

  it('computes credit card interest savings and transfer-fee payback', () => {
    const s = base({ debts: [{ id: 'c', type: 'card', name: 'Card', balance: 6000, apr: 24, payment: 200 }] });
    const item = evaluatePlan(s, computeTotals(s)).find((p) => p.id === 'debt-avalanche');
    expect(item.base).toBeCloseTo(120, 5); // 6000 * 24% / 12
    expect(item.monthly).toBeCloseTo(90, 5); // 75%
    expect(item.upfront).toBeCloseTo(180, 5); // 3% fee
    expect(item.payback).toBeCloseTo(2, 5);
  });

  it('scales thresholds by currency', () => {
    // 300 INR of fuel is tiny in local terms — no carpool rule
    const s = base({ currency: 'INR', values: { income: 150000, fuel: 300 } });
    expect(ids(evaluatePlan(s, computeTotals(s)))).not.toContain('fuel-carpool');
  });

  it('every sample profile produces a plan with savings', () => {
    for (const p of ['single', 'suburban', 'youngpro']) {
      const smp = sampleFor(p, 'USD');
      const r = computeBudget(base({ profile: p, values: smp.values, debts: smp.debts, subscriptions: smp.subscriptions }));
      expect(r.plan.length).toBeGreaterThan(3);
      expect(r.savings).toBeGreaterThan(0);
    }
  });
});

describe('projection math', () => {
  it('matches the closed-form future value of an annuity', () => {
    const { nominal } = projectGrowth({ monthly: 250, annualRate: 0.08, years: 10 });
    const r = 0.08 / 12;
    const fv = 250 * ((Math.pow(1 + r, 120) - 1) / r);
    expect(nominal[10]).toBeCloseTo(fv, 6);
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

  it('redirecting savings pays off sooner and saves interest', () => {
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

  it('scores a model budget at 100', () => {
    const h = healthScore({ income: 10000, spend: 7000, rent: 2500, debtPayments: 500, emergencyFund: 60000, needs: 5000, wants: 2000, hasHighApr: false });
    expect(h.score).toBe(100);
  });

  it('reports wants over the 30% guideline', () => {
    const s = fiftyThirtyTwenty({ income: 5000, needs: 2500, wants: 1800, spend: 4300 });
    expect(s.diffs.wants).toBe(300);
    expect(s.actual.savings).toBe(700);
  });
});

describe('helpers', () => {
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
  it('duration formatting', () => {
    expect(duration(14)).toBe('1 yr 2 mo');
    expect(duration(24)).toBe('2 yrs');
    expect(duration(3.2)).toBe('4 mo');
  });
});
