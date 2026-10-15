import { describe, it, expect } from 'vitest';
import { normalizeState, defaultState, hasData } from './state.js';

describe('normalizeState: saved, shared and imported data', () => {
  it('turns anything that is not an object into a fresh default state', () => {
    for (const bad of [null, undefined, 42, 'text', [], true]) expect(normalizeState(bad)).toEqual(defaultState());
  });

  it('keeps a well-formed state as it is', () => {
    const s = {
      ...defaultState(),
      profile: 'single', currency: 'PKR', period: 'annual',
      values: { income: 150000, rent: 35000 },
      debts: [{ id: 'd1', type: 'loan', name: 'Bike', balance: 50000, apr: 18, payment: 4000 }],
      subscriptions: [{ id: 's1', name: 'Netflix', cost: 1100, rarely: false, kind: 'streaming' }],
      yearly: [{ id: 'y1', name: 'Eid', cost: 30000 }],
      goals: [{ id: 'g1', name: 'Car', target: 500000, saved: 20000 }],
      allocation: { preset: 'custom', emergency: 50, debt: 30, goals: 20 },
      housingFree: false
    };
    expect(normalizeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('falls back to defaults for unknown choices', () => {
    const s = normalizeState({ profile: 'billionaire', currency: 'XYZ', period: 'weekly', plan: { sort: 'random' } });
    expect(s.profile).toBe('suburban');
    expect(s.currency).toBe('USD');
    expect(s.period).toBe('monthly');
    expect(s.plan.sort).toBe('savings');
  });

  it('clamps numbers and drops bad values', () => {
    const s = normalizeState({
      values: { income: '5000', rent: -200, groceries: 'lots', dining: Infinity, notAField: 99 },
      debts: [{ balance: 1000, apr: 250, payment: -5, type: 'mortgage' }]
    });
    expect(s.values.income).toBe(5000);
    expect(s.values.rent).toBe(0);
    expect(s.values.groceries).toBe(0);
    expect(s.values.dining).toBe(0);
    expect(s.values.notAField).toBeUndefined();
    expect(s.debts[0]).toMatchObject({ type: 'card', apr: 100, payment: 0, balance: 1000 });
    expect(s.debts[0].id).toMatch(/^d/);
  });

  it('caps list lengths and text lengths', () => {
    const s = normalizeState({
      debts: Array.from({ length: 50 }, () => ({ balance: 1 })),
      subscriptions: Array.from({ length: 80 }, () => ({ name: 'x'.repeat(500), cost: 1 })),
      snapshots: Array.from({ length: 60 }, (_, i) => ({ month: `2026-${i}`, spend: i }))
    });
    expect(s.debts).toHaveLength(20);
    expect(s.subscriptions).toHaveLength(40);
    expect(s.subscriptions[0].name).toHaveLength(60);
    expect(s.snapshots).toHaveLength(36);
    expect(s.snapshots[0].spend).toBe(24); // the newest 36 are kept
  });

  it('skips list entries that are not objects', () => {
    const s = normalizeState({ goals: [null, 'goal', { name: 'Trip', target: 100 }], yearly: [5, { name: 'Eid', cost: 10 }] });
    expect(s.goals).toHaveLength(1);
    expect(s.yearly).toHaveLength(1);
  });

  it('only accepts a savings split that adds up to 100', () => {
    expect(normalizeState({ allocation: { emergency: 90, debt: 90, goals: 90 } }).allocation).toEqual(defaultState().allocation);
    expect(normalizeState({ allocation: { preset: 'bogus', emergency: 60, debt: 20, goals: 20 } }).allocation)
      .toEqual({ preset: 'custom', emergency: 60, debt: 20, goals: 20 });
  });

  it('only accepts known growth rates and keeps years in range', () => {
    expect(normalizeState({ projection: { rate: 0.5, years: 99 } }).projection).toMatchObject({ rate: 0.08, years: 20 });
    expect(normalizeState({ projection: { rate: 0.04, years: 0 } }).projection).toMatchObject({ rate: 0.04, years: 1 });
  });

  it('checks the payday plan', () => {
    expect(normalizeState({ payday: { day: 'last', month: '2026-10' } }).payday).toMatchObject({ day: 'last', month: '2026-10' });
    expect(normalizeState({ payday: { day: 31, month: 'October' } }).payday).toMatchObject({ day: 28, month: '' });
  });

  it('keeps the housing answer only when it is a real yes or no', () => {
    expect(normalizeState({ housingFree: true }).housingFree).toBe(true);
    expect(normalizeState({ housingFree: 'yes' }).housingFree).toBeNull();
  });
});

describe('hasData', () => {
  it('counts amounts, loans, subscriptions and once-a-year costs', () => {
    expect(hasData(defaultState())).toBe(false);
    expect(hasData({ ...defaultState(), values: { income: 1 } })).toBe(true);
    expect(hasData({ ...defaultState(), yearly: [{ cost: 100 }] })).toBe(true);
  });
});

describe('extra income in saved data', () => {
  it('keeps valid extras and cleans bad ones', () => {
    const s = normalizeState({ extras: [{ id: 'x1', name: 'Overtime', amount: '1200' }, { name: 'y'.repeat(99), amount: -4 }, 'junk'] });
    expect(s.extras).toHaveLength(2);
    expect(s.extras[0]).toEqual({ id: 'x1', name: 'Overtime', amount: 1200 });
    expect(s.extras[1].name).toHaveLength(60);
    expect(s.extras[1].amount).toBe(0);
    expect(s.extras[1].id).toMatch(/^x/);
  });

  it('caps extras at 20 and treats old data without them as none', () => {
    expect(normalizeState({ extras: Array.from({ length: 30 }, () => ({ amount: 1 })) }).extras).toHaveLength(20);
    expect(normalizeState({ values: { income: 100 } }).extras).toEqual([]);
  });

  it('counts a budget with only extras as having data', () => {
    expect(hasData({ ...defaultState(), extras: [{ amount: 100 }] })).toBe(true);
  });
});
