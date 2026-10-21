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

describe('balancePlan: a plan that fits your income', () => {
  it('is not needed when spending already leaves 10% to save', () => {
    expect(plan(state({ income: 200000, rent: 60000, groceries: 40000 }))).toBeNull();
    expect(plan(state({ rent: 60000 }))).toBeNull(); // no income
  });

  it('brings spending above income down to 90% of income', () => {
    const p = plan(state({ income: 200000, rent: 80000, groceries: 40000, dining: 40000, misc: 30000, electricity: 20000, fuel: 15000 }));
    expect(p.outcome).toBe('reached');
    expect(p.newSpend).toBeCloseTo(200000 * (1 - SAVE_TARGET), 0);
    expect(p.toSave).toBeCloseTo(20000, 0);
    // Nothing is cut below zero, and the cuts add up
    for (const l of p.lines) expect(l.aim).toBeGreaterThanOrEqual(0);
    expect(p.lines.reduce((a, l) => a + l.cut, 0)).toBeCloseTo(p.cut, 5);
  });

  it('cuts bills above typical and nice-to-haves before trimming needs', () => {
    // Small gap: eating out above the typical top (Rs 28,000) covers it
    const p = plan(state({ income: 100000, groceries: 30000, dining: 40000, rent: 25000 }));
    expect(line(p, 'dining').reason).toBe('typical');
    expect(line(p, 'groceries')).toBeUndefined();
    expect(line(p, 'rent')).toBeUndefined();
  });

  it('never touches loans, insurance, school fees or once-a-year costs', () => {
    const p = plan(state(
      { income: 150000, rent: 70000, carLoan: 40000, carIns: 6000, school: 15000, groceries: 30000, dining: 15000 },
      { yearly: [{ id: 'y1', name: 'Fees', cost: 120000 }] }
    ));
    for (const id of ['carLoan', 'carIns', 'school']) expect(line(p, id)).toBeUndefined();
  });

  it('says how much income is still missing when cuts are not enough', () => {
    const p = plan(state({ income: 50000, rent: 60000, carLoan: 30000, groceries: 30000 }));
    expect(p.outcome).toBe('short');
    expect(p.newSpend).toBeGreaterThan(50000);
    // With that much more income the target would be met
    expect(p.newSpend).toBeCloseTo((50000 + p.incomeNeeded) * (1 - SAVE_TARGET), 0);
  });
});
