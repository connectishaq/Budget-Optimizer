import { describe, it, expect, beforeAll } from 'vitest';
import {
  PAY_FREQUENCIES, toMonthly, fromMonthly, computeTotals, computeBudget, localFields
} from './calculate.js';
import { sampleFor } from './profiles.js';
import { loadCountry } from './countries.js';
import { normalizeState, defaultState, hasData } from '../state.js';

beforeAll(() => Promise.all(['US', 'GB', 'PK', 'IN', 'SA'].map(loadCountry)));

const base = (over = {}) => ({
  ...defaultState(),
  country: 'GB',
  currency: 'GBP',
  values: { income: 3000 },
  ...over
});

describe('pay frequency', () => {
  it('converts one pay to a month: ×52÷12, ×26÷12, ×2, ×1', () => {
    expect(toMonthly(1200, 'weekly')).toBeCloseTo(5200, 6);
    expect(toMonthly(1200, 'biweekly')).toBeCloseTo(2600, 6);
    expect(toMonthly(1200, 'semimonthly')).toBe(2400);
    expect(toMonthly(1200, 'monthly')).toBe(1200);
    expect(Object.keys(PAY_FREQUENCIES)).toEqual(['weekly', 'biweekly', 'semimonthly', 'monthly']);
  });

  it('round-trips the amount shown in the income box', () => {
    for (const f of Object.keys(PAY_FREQUENCIES)) {
      for (const pay of [1, 999.99, 1234.5, 85000]) {
        expect(Math.round(fromMonthly(toMonthly(pay, f), f) * 100) / 100).toBe(pay);
      }
    }
  });

  it('treats an unknown frequency as monthly', () => {
    expect(toMonthly(500, 'daily')).toBe(500);
    expect(fromMonthly(500, undefined)).toBe(500);
  });

  it('is saved, and old saves without it read as monthly', () => {
    expect(normalizeState({ payFrequency: 'biweekly' }).payFrequency).toBe('biweekly');
    expect(normalizeState({ payFrequency: 'hourly' }).payFrequency).toBe('monthly');
    expect(normalizeState({ values: { income: 4000 } }).payFrequency).toBe('monthly');
  });
});

describe("the country's own bills", () => {
  it('appear only for their country', () => {
    expect(localFields('GB').map((f) => f.key)).toEqual(['councilTax', 'tvLicence']);
    expect(localFields('US').map((f) => f.key)).toEqual(['healthPremium']);
    expect(localFields('GLOBAL')).toEqual([]);
    expect(localFields('IN').map((f) => f.key)).toContain('powerBackup');
  });

  it('count in their group, the 50/30/20 split and the health score', () => {
    const without = computeBudget(base({ values: { income: 3000, rent: 1000 } }));
    const withTax = computeBudget(base({ values: { income: 3000, rent: 1000 }, local: { councilTax: 150, tvLicence: 15 } }));
    const cat = (r, k) => r.totals.categories.find((c) => c.key === k).amount;
    expect(cat(withTax, 'housing')).toBe(1150);
    expect(cat(withTax, 'utilities')).toBe(15);
    expect(withTax.totals.spend).toBe(without.totals.spend + 165);
    // Council tax is a must-pay bill, the TV licence a nice-to-have
    expect(withTax.totals.needs).toBe(without.totals.needs + 150);
    expect(withTax.totals.wants).toBe(without.totals.wants + 15);
    expect(withTax.split.actual.needs).toBe(withTax.totals.needs);
    expect(withTax.health.score).toBeLessThanOrEqual(without.health.score);
  });

  it("ignore amounts kept for another country's bills", () => {
    const r = computeTotals(base({ country: 'US', currency: 'USD', local: { councilTax: 150 } }));
    expect(r.spend).toBe(0);
    expect(r.values.councilTax).toBeUndefined();
  });

  it('are available to the savings rules as values', () => {
    const r = computeTotals(base({ country: 'PK', currency: 'PKR', local: { generatorFuel: 8000 } }));
    expect(r.values.generatorFuel).toBe(8000);
    expect(r.categories.find((c) => c.key === 'utilities').amount).toBe(8000);
  });

  it('are filled in the example budget at the middle of their range', () => {
    const s = sampleFor('suburban', 'GB');
    expect(s.local.councilTax).toBeGreaterThan(0);
    expect(s.local.tvLicence).toBeUndefined(); // optional bills stay empty
    expect(sampleFor('suburban', 'GLOBAL').local).toEqual({});
  });

  it('are validated when loaded', () => {
    const s = normalizeState({ local: { councilTax: '120', tvLicence: -5, 'bad key!': 9, __proto__x: 'x' } });
    expect(s.local.councilTax).toBe(120);
    expect(s.local.tvLicence).toBe(0);
    expect(s.local['bad key!']).toBeUndefined();
    expect(hasData(normalizeState({ local: { councilTax: 50 } }))).toBe(true);
  });
});

describe('custom expenses', () => {
  const custom = [
    { id: 'c1', name: 'Pet food', amount: 60, need: true },
    { id: 'c2', name: 'Hobby club', amount: 40, need: false }
  ];

  it('add to "Health, help & giving" and to needs or wants', () => {
    const plain = computeBudget(base());
    const r = computeBudget(base({ custom }));
    expect(r.totals.categories.find((c) => c.key === 'care').amount).toBe(100);
    expect(r.totals.spend).toBe(100);
    expect(r.totals.needs - plain.totals.needs).toBe(60);
    expect(r.totals.wants - plain.totals.wants).toBe(40);
    expect(r.split.actual.wants).toBe(40);
  });

  it('are validated when loaded', () => {
    const s = normalizeState({ custom: [{ name: 'Gym', amount: '35', need: false }, 'junk', { name: 'x'.repeat(99), amount: -1 }] });
    expect(s.custom).toHaveLength(2);
    expect(s.custom[0]).toMatchObject({ name: 'Gym', amount: 35, need: false });
    expect(s.custom[0].id).toBeTruthy();
    expect(s.custom[1]).toMatchObject({ amount: 0, need: true });
    expect(s.custom[1].name).toHaveLength(60);
    expect(hasData(normalizeState({ custom: [{ name: 'Gym', amount: 0 }] }))).toBe(true);
  });
});
