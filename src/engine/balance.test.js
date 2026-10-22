import { describe, it, expect, beforeAll } from 'vitest';
import { computeTotals, computeBudget, fieldAfterPlan } from './calculate.js';
import { balancePlan, settleBalance, SAVE_TARGET } from './balance.js';
import { loadCountry } from './countries.js';

beforeAll(() => Promise.all(['US', 'PK'].map(loadCountry)));

const state = (values, over = {}) => ({
  profile: 'youngpro', country: 'PK', currency: 'PKR', values,
  debts: [], subscriptions: [], yearly: [], extras: [], custom: [], local: {}, ...over
});
// Limits on their own (no ideas switched on), with every switch at its default
const plan = (s) => {
  const totals = computeTotals(s);
  const b = balancePlan(totals, s.country, s.profile);
  return b && settleBalance(b, totals, s.plan?.committed);
};
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

  it('leaves rent switched off until the household chooses to move', () => {
    // Rent far above the typical top: a limit is suggested, but not counted yet
    const p = plan(state({ income: 100000, rent: 150000, groceries: 20000, dining: 5000 }));
    const rent = line(p, 'rent');
    expect(rent.big).toBe(true);
    expect(rent.committed).toBe(false);
    expect(p.cut).toBeCloseTo(p.lines.filter((l) => l.committed).reduce((a, l) => a + l.cut, 0), 5);
    // The rent line already says "move somewhere cheaper", so no separate housing change
    expect(bigger(p)).not.toContain('housing');
    // Switched on, it counts
    const on = plan(state({ income: 100000, rent: 150000, groceries: 20000, dining: 5000 }, { plan: { committed: { 'limit:rent': true } } }));
    expect(on.cut).toBeCloseTo(p.cut + rent.cut, 5);
  });

  it('never cuts maintenance charges', () => {
    const p = plan(state({ income: 100000, rent: 60000, maintenance: 15000, groceries: 30000, dining: 20000 }));
    expect(line(p, 'maintenance')).toBeUndefined();
    expect(p.kept.map((k) => k.field || k.id)).toContain('maintenance');
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

describe('spending limits in the plan', () => {
  const s = state({ income: 150000, dining: 40000, misc: 30000, groceries: 50000, electricity: 20000, rent: 60000 });

  it('start from what the ideas leave, so no saving is counted twice', () => {
    const r = computeBudget(s);
    // "Wait 24 hours before you buy" already trims shopping; the limit starts there
    const misc = line(r.balance, 'misc');
    expect(misc.entered).toBe(30000);
    expect(misc.now).toBeCloseTo(fieldAfterPlan(r.plan, r.totals.values, 'misc'), 5);
    expect(misc.now).toBeLessThan(30000);
    expect(r.balance.spend).toBeCloseTo(r.totals.spend - r.ideaSavings, 5);
    // The plan's savings are the ideas plus the switched-on limits
    expect(r.savings).toBeCloseTo(r.ideaSavings + r.limitSavings, 5);
    expect(r.limitSavings).toBeCloseTo(r.balance.cut, 5);
    expect(r.optimized).toBeCloseTo(r.totals.spend - r.savings, 5);
    expect(r.balance.outcome).toBe('reached');
    expect(r.optimized).toBeCloseTo(150000 * (1 - SAVE_TARGET), 0);
  });

  it('can be switched off one by one', () => {
    const all = computeBudget(s);
    const off = computeBudget({ ...s, plan: { committed: { 'limit:dining': false }, pct: {} } });
    expect(line(off.balance, 'dining').committed).toBe(false);
    expect(off.limitSavings).toBeCloseTo(all.limitSavings - line(all.balance, 'dining').cut, 5);
    expect(off.balance.outcome).not.toBe('reached');
  });

  it('set the weekly allowance in the payday plan', () => {
    const r = computeBudget(s);
    const fun = line(r.balance, 'dining').aim + line(r.balance, 'misc').aim;
    expect(r.payday.funMonthly).toBeCloseTo(fun, 5);
  });

  it('are not needed when the ideas already leave 10% to save', () => {
    const r = computeBudget(state({ income: 200000, rent: 60000, groceries: 40000 }));
    expect(r.balance).toBeNull();
    expect(r.limitSavings).toBe(0);
  });
});

describe('the plan bill by bill', () => {
  const s = state({ income: 200000, rent: 80000, electricity: 25000, waterGas: 15000, fuel: 20000, groceries: 50000, dining: 20000, misc: 20000, familySupport: 40000, homeHelp: 20000, other: 20000 },
    { subscriptions: [{ id: 's1', name: 'Netflix', cost: 20000 }] });

  it('adds up to the same savings as the ideas and limits together', () => {
    const r = computeBudget(s);
    expect(r.bills.length).toBeGreaterThan(0);
    expect(r.bills.reduce((a, b) => a + b.monthly, 0)).toBeCloseTo(r.savings, 5);
    // Biggest first, and each bill shows once
    const pot = r.bills.map((b) => b.potential);
    expect(pot).toEqual([...pot].sort((a, b) => b - a));
    expect(new Set(r.bills.map((b) => b.key)).size).toBe(r.bills.length);
  });

  it('puts an idea and the limit for the same bill in one row', () => {
    const r = computeBudget(s);
    const misc = r.bills.find((b) => b.key === 'misc');
    expect(misc.ideas.map((p) => p.id)).toContain('impulse-24h');
    expect(misc.line).not.toBeNull();
    expect(misc.after).toBeCloseTo(misc.line.aim, 5);
    expect(misc.monthly).toBeCloseTo(20000 - misc.line.aim, 5);
  });

  it('counts nothing for a bill whose parts are all switched off', () => {
    const r = computeBudget({ ...s, plan: { committed: { 'impulse-24h': false, 'limit:misc': false }, pct: {} } });
    const misc = r.bills.find((b) => b.key === 'misc');
    expect(misc.committed).toBe(false);
    expect(misc.monthly).toBeCloseTo(0, 5);
    expect(misc.potential).toBeGreaterThan(0);
  });

  it('is only used when the ideas alone do not fit the income', () => {
    expect(computeBudget(state({ income: 200000, rent: 60000, groceries: 40000 })).bills).toBeNull();
  });
});
