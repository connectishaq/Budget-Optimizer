import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { computeTotals, evaluatePlan, computeBudget } from './calculate.js';
import { localRules, EFFORT_ORDER } from './rules.js';
import { loadCountry, countryData, unwrap } from './countries.js';
import { defaultState } from '../state.js';
import en from '../i18n/locales/en.json';

const CODES = ['AE', 'AU', 'BR', 'CA', 'DE', 'ES', 'FR', 'GB', 'ID', 'IN', 'MX', 'NG', 'PK', 'SA', 'US'];
beforeAll(() => Promise.all(CODES.map(loadCountry)));

const budget = (country, currency, over = {}) => ({ ...defaultState(), country, currency, ...over });
const plan = (s) => evaluatePlan(s, computeTotals(s));
const ids = (items) => items.map((p) => p.id);

describe('country savings ideas', () => {
  it('appear only for their own country', () => {
    const gb = plan(budget('GB', 'GBP', { values: { income: 3000, electricity: 120 } }));
    const de = plan(budget('DE', 'EUR', { values: { income: 3000, electricity: 120 } }));
    expect(ids(gb)).toContain('gb-energy-switch');
    expect(ids(gb)).not.toContain('de-energy-switch');
    expect(ids(de)).toContain('de-energy-switch');
    expect(ids(plan(budget('GLOBAL', 'EUR', { values: { income: 3000, electricity: 120 } }))).every((id) => !/^[a-z]{2}-/.test(id))).toBe(true);
  });

  it('need the bill they work on', () => {
    expect(ids(plan(budget('DE', 'EUR', { values: { income: 3000 } })))).not.toContain('de-energy-switch');
  });

  it("can work on the country's own bills, with an upfront cost", () => {
    const pk = plan(budget('PK', 'PKR', { values: { income: 200000 }, local: { generatorFuel: 15000 } }));
    const solar = pk.find((p) => p.id === 'pk-solar-ups');
    expect(solar.rawBase).toBe(15000);
    expect(solar.effort).toBe('Requires purchase');
    expect(solar.upfront).toBe(unwrap(countryData('PK').localTips.find((x) => x.id === 'pk-solar-ups').upfront));
    expect(solar.payback).toBeGreaterThan(0);
  });

  it('respect the household types they fit (UK single person discount)', () => {
    const s = (profile) => budget('GB', 'GBP', { profile, values: { income: 2500 }, local: { councilTax: 150 } });
    expect(ids(plan(s('single')))).toContain('gb-council-tax-discount');
    expect(ids(plan(s('suburban')))).not.toContain('gb-council-tax-discount');
  });

  it('save interest, not cash, on card debt', () => {
    const debts = [{ id: 'd', type: 'card', name: 'Cartão', balance: 5000, apr: 300, payment: 400 }];
    const br = plan(budget('BR', 'BRL', { values: { income: 6000 }, debts }));
    expect(br.find((p) => p.id === 'br-sair-do-rotativo').kind).toBe('interest');
  });

  it('never save more than the bill when stacked with general ideas', () => {
    const s = budget('GB', 'GBP', { values: { income: 3000, electricity: 400, waterGas: 200 } });
    const r = computeBudget(s);
    const onElectricity = r.plan.filter((p) => p.committed && p.rule.pools.includes('electricity'));
    expect(onElectricity.length).toBeGreaterThan(1);
    const left = onElectricity.reduce((x, p) => x * (1 - p.pct), 400);
    expect(left).toBeGreaterThan(0);
  });

  it('can still be hidden like any rule', () => {
    const C = countryData('GB');
    const saved = C.hideRules;
    C.hideRules = [...saved, 'gb-energy-switch'];
    try {
      expect(ids(plan(budget('GB', 'GBP', { values: { income: 3000, electricity: 120 } })))).not.toContain('gb-energy-switch');
    } finally {
      C.hideRules = saved;
    }
  });

  it('are complete in every country file and in the messages', () => {
    for (const code of CODES) {
      const C = countryData(code);
      for (const r of localRules(C)) {
        const tip = C.localTips.find((x) => x.id === r.id);
        expect(EFFORT_ORDER[tip.effort], r.id).toBeDefined();
        expect(tip.tips).toHaveLength(3);
        expect(tip.pct > 0 && tip.pct <= 1, r.id).toBe(true);
        const m = en.localTips[r.id];
        expect(m && m.label && m.noun && m.title && m.why && m.evidence, r.id).toBeTruthy();
        expect(Object.keys(m.tips)).toEqual(['1', '2', '3']);
        expect(r.title).toBe(m.title);
        expect(r.tips()).toEqual([m.tips[1], m.tips[2], m.tips[3]]);
      }
    }
  });

  it('only use rule ids that exist in hideRules', () => {
    const rules = fs.readFileSync(path.resolve(__dirname, 'rules.js'), 'utf8');
    for (const code of [...CODES, 'GLOBAL']) {
      const C = code === 'GLOBAL' ? countryData('GLOBAL') : countryData(code);
      for (const id of C.hideRules || []) expect(rules.includes(`id: '${id}'`), `${code}: ${id}`).toBe(true);
    }
  });
});
