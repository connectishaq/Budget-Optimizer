import { describe, it, expect, beforeAll } from 'vitest';
import { computeTotals } from './calculate.js';
import { balancePlan, SAVE_TARGET } from './balance.js';
import { loadCountry } from './countries.js';

beforeAll(() => Promise.all(['US', 'PK'].map(loadCountry)));

const state = (values, over = {}) => ({
  profile: 'youngpro', country: 'PK', currency: 'PKR', values,
  debts: [], subscriptions: [], yearly: [], extras: [], custom: [], local: {}, ...over
});
const plan = (s) => balancePlan(computeTotals(s), s.country, s.profile);
const line = (p, id) => p.lines.find((l) => l.id === id);
const bigger = (p) => p.bigger.map((b) => b.key);

describe('balancePlan: a plan that fits your income', () => {
  it('is not needed when spending already leaves 10% to save', () => {
    expect(plan(state({ income: 200000, rent: 60000, groceries: 40000 }))).toBeNull();
    expect(plan(state({ rent: 60000 }))).toBeNull(); // no income
  });

  it('brings spending above income down to 90% of income when realistic cuts allow it', () => {
    const p = plan(state({ income: 200000, rent: 80000, groceries: 40000, dining: 40000, misc: 30000, electricity: 20000, fuel: 15000 }));
    expect(p.outcome).toBe('reached');
    expect(p.newSpend).toBeCloseTo(200000 * (1 - SAVE_TARGET), 0);
    expect(p.toSave).toBeCloseTo(20000, 0);
    expect(p.bigger).toEqual([]); // nothing more needed
    expect(p.lines.reduce((a, l) => a + l.cut, 0)).toBeCloseTo(p.cut, 5);
  });

  it('cuts bills above typical and nice-to-haves before trimming needs', () => {
    // Small gap: eating out above the typical top (Rs 28,000) covers it
    const p = plan(state({ income: 100000, groceries: 30000, dining: 40000, rent: 25000 }));
    expect(line(p, 'dining').reason).toBe('over');
    expect(line(p, 'groceries')).toBeUndefined();
    expect(line(p, 'rent')).toBeUndefined();
  });

  it('never asks for more than a realistic cut, even far above typical', () => {
    // Water and gas at 5x the typical top: flagged to check, cut by at most 25%
    const p = plan(state({ income: 200000, waterGas: 25000, familySupport: 40000, groceries: 50000, dining: 20000, misc: 20000, other: 25000, transit: 20000, homeHelp: 20000, electricity: 25000 },
      { subscriptions: [{ id: 's1', name: 'Netflix', cost: 20000 }] }));
    const water = line(p, 'waterGas');
    expect(water.cut).toBeLessThanOrEqual(25000 * 0.25 + 0.01);
    expect(water.check).toBe(true);
    expect(water.times).toBeCloseTo(5, 5);
    expect(line(p, 'familySupport').cut).toBeLessThanOrEqual(40000 * 0.25 + 0.01);
    expect(line(p, 'groceries').cut).toBeLessThanOrEqual(50000 * 0.2 + 0.01);
    // Every line has a how-to tip, local ones for Pakistan where they exist
    for (const l of p.lines) expect(l.tip).toBeTruthy();
    expect(water.tip).toBe('waterGasLocal');
  });

  it('only suggests bigger changes for what the household entered', () => {
    // No rent, loans, car, school or yearly costs: earning more is the only bigger change
    const p = plan(state({ income: 150000, waterGas: 25000, familySupport: 40000, groceries: 50000, dining: 20000, misc: 20000, other: 25000, transit: 20000, homeHelp: 20000, electricity: 25000 },
      { subscriptions: [{ id: 's1', name: 'Netflix', cost: 20000 }] }));
    expect(p.outcome).not.toBe('reached');
    expect(bigger(p)).toEqual(['income']);
    expect(p.kept).toEqual([]);
    // With rent, a car loan, school fees and yearly costs, each gets its own suggestion
    const q = plan(state({ income: 150000, rent: 70000, carLoan: 40000, carIns: 6000, fuel: 15000, school: 15000, groceries: 30000, dining: 15000 },
      { yearly: [{ id: 'y1', name: 'Fees', cost: 120000 }] }));
    expect(bigger(q)).toEqual(['housing', 'loans', 'car', 'school', 'yearly', 'income']);
    expect(q.kept.map((k) => k.field || k.id)).toEqual(['carLoan', 'school', 'yearly']);
  });

  it('never touches loans, school fees, medical costs, charity or once-a-year costs', () => {
    const p = plan(state(
      { income: 150000, rent: 70000, carLoan: 40000, school: 15000, medical: 8000, giving: 5000, groceries: 30000, dining: 15000 },
      { yearly: [{ id: 'y1', name: 'Fees', cost: 120000 }] }
    ));
    for (const id of ['carLoan', 'school', 'medical', 'giving']) expect(line(p, id)).toBeUndefined();
  });

  it('says how much income is still missing when cuts are not enough', () => {
    const p = plan(state({ income: 50000, rent: 60000, carLoan: 30000, groceries: 30000 }));
    expect(p.outcome).toBe('short');
    expect(p.newSpend).toBeGreaterThan(50000);
    // With that much more income the target would be met
    expect(p.newSpend).toBeCloseTo((50000 + p.incomeNeeded) * (1 - SAVE_TARGET), 0);
    expect(p.bigger.at(-1)).toEqual({ key: 'income', amount: p.incomeNeeded });
  });
});
