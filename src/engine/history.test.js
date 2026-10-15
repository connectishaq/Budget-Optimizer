import { describe, it, expect, beforeEach } from 'vitest';
import {
  makeEntry, normalizeEntry, normalizeHistory, migrateSnapshots, upsertMonth, oldestToDrop,
  compareMonths, welcomeSummary, bestMonth, savingsStreak, trendAlerts, goalsOverTime,
  parseBackup, makeBackup, mergeHistory, describeMonths, backupFileName, prevMonthKey, MAX_MONTHS
} from './history.js';
import { computeBudget } from './calculate.js';
import { defaultState } from '../state.js';

const budget = (values, over = {}) => ({ ...defaultState(), profile: 'single', values, ...over });
const entry = (month, values, over = {}, savedAt = `${month}-15T10:00:00.000Z`) =>
  makeEntry(budget(values, over), undefined, new Date(savedAt), month);
/** A quick month with set totals, for highlight and streak maths. */
const quick = (month, leftOver, currency = 'USD') =>
  normalizeEntry({ month, currency, savedAt: `${month}-15T00:00:00.000Z`, partial: true, totals: { income: 1000, spend: 1000 - leftOver, leftOver } });

describe('saving a month', () => {
  it('keeps every input and the results worked out at the time', () => {
    const s = budget({ income: 4000, rent: 1500, groceries: 400 }, {
      extras: [{ id: 'x1', name: 'Overtime', amount: 1200 }],
      goals: [{ id: 'g1', name: 'Car', target: 5000, saved: 300 }],
      plan: { committed: { 'grocery-plan': false }, pct: {}, sort: 'savings' }
    });
    const e = makeEntry(s, computeBudget(s), new Date('2026-10-12T09:00:00Z'), '2026-10');
    expect(e.month).toBe('2026-10');
    expect(e.country).toBe('United States');
    expect(e.inputs.values.rent).toBe(1500);
    expect(e.inputs.extras[0].amount).toBe(1200);
    expect(e.inputs.goals[0].saved).toBe(300);
    expect(e.inputs.plan.committed['grocery-plan']).toBe(false);
    expect(e.totals.income).toBe(4100); // 4000 + 1200 / 12
    expect(e.totals.spend).toBe(1900);
    expect(e.totals.leftOver).toBe(2200);
    expect(e.totals.score).toBeGreaterThan(0);
    expect(e.totals.split.savings).toBeCloseTo(2200 / 4100, 6);
    expect(e.totals.categories.housing).toBe(1500);
  });

  it('replaces the same month instead of adding a duplicate', () => {
    let months = [entry('2026-09', { income: 3000 })];
    months = upsertMonth(months, entry('2026-10', { income: 3000, rent: 1000 }));
    months = upsertMonth(months, entry('2026-10', { income: 3000, rent: 1200 }));
    expect(months.map((m) => m.month)).toEqual(['2026-09', '2026-10']);
    expect(months[1].inputs.values.rent).toBe(1200);
  });

  it('keeps months in date order', () => {
    const months = upsertMonth([entry('2026-10', { income: 1 })], entry('2026-08', { income: 1 }));
    expect(months.map((m) => m.month)).toEqual(['2026-08', '2026-10']);
  });

  it('says which month must go once 60 are saved', () => {
    const months = Array.from({ length: MAX_MONTHS }, (_, i) => quick(`${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, 10));
    expect(oldestToDrop(months, '2025-01').month).toBe('2020-01');
    expect(oldestToDrop(months, '2024-12')).toBeNull(); // already saved: replacing needs no room
    expect(oldestToDrop(months.slice(1), '2025-01')).toBeNull();
  });

  it('round-trips through storage validation unchanged', () => {
    const e = entry('2026-10', { income: 3000, fuel: 200 }, { extras: [{ id: 'x', name: 'Bonus', amount: 600 }] });
    expect(normalizeEntry(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });
});

describe('migrating old saved data', () => {
  it('turns old snapshot rows into totals-only months', () => {
    const months = migrateSnapshots([
      { id: 'h1', month: '2026-08', savedAt: '2026-08-30T10:00:00.000Z', currency: 'PKR', income: 150000, spend: 140000, optimized: 125000, savings: 15000, score: 55 },
      { id: 'h2', month: '2026-07', savedAt: '2026-07-30T10:00:00.000Z', currency: 'PKR', income: 150000, spend: 152000, optimized: 140000, savings: 12000, score: null }
    ]);
    expect(months.map((m) => m.month)).toEqual(['2026-07', '2026-08']);
    expect(months[1]).toMatchObject({ partial: true, inputs: null, currency: 'PKR', country: 'Pakistan' });
    expect(months[1].totals).toMatchObject({ income: 150000, spend: 140000, leftOver: 10000, planSavings: 15000, score: 55 });
    expect(months[0].totals.leftOver).toBe(-2000);
    expect(months[0].totals.score).toBeNull();
  });

  it('drops broken rows and keeps the newest copy of a repeated month', () => {
    const h = normalizeHistory({
      months: [
        null, { month: 'October' }, { month: '2026-13', totals: {} },
        { month: '2026-10', savedAt: '2026-10-01T00:00:00Z', partial: true, totals: { income: 1, spend: 1 } },
        { month: '2026-10', savedAt: '2026-10-20T00:00:00Z', partial: true, totals: { income: 2, spend: 1 } }
      ],
      lastBackup: 'not a date',
      meta: { persistAsked: 'yes', safariNoteSeen: true, reminderDismissed: '2026-10' }
    });
    expect(h.months).toHaveLength(1);
    expect(h.months[0].totals.income).toBe(2);
    expect(h.lastBackup).toBeNull();
    expect(h.meta).toEqual({ safariNoteSeen: true, reminderDismissed: '2026-10' });
  });

  it('treats a month with no inputs as totals-only and cleans bad inputs', () => {
    const e = normalizeEntry({ month: '2026-10', currency: 'XYZ', inputs: { values: { rent: -5, fuel: '120' }, debts: 'x' }, totals: { income: 'a' } });
    expect(e.currency).toBe('USD');
    expect(e.partial).toBe(false);
    expect(e.inputs.values).toEqual({ rent: 0, fuel: 120 });
    expect(e.inputs.debts).toEqual([]);
    expect(e.totals.income).toBe(0);
    expect(normalizeEntry({ month: '2026-10', totals: {} }).partial).toBe(true);
  });

  it('caps stored history at 60 months, keeping the newest', () => {
    const months = Array.from({ length: 70 }, (_, i) => ({ month: `${2020 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, partial: true, totals: {} }));
    const h = normalizeHistory({ months });
    expect(h.months).toHaveLength(60);
    expect(h.months[0].month).toBe('2020-11');
  });
});

describe('comparing two months', () => {
  const a = entry('2026-07', { income: 4000, rent: 1500, groceries: 400, fuel: 200 });
  const b = entry('2026-10', { income: 4000, rent: 1500, groceries: 500, fuel: 170 }, { extras: [{ id: 'x', name: 'Bonus', amount: 1200 }] });

  it('shows amounts, differences and percentages for each category and bill', () => {
    const { rows, sameCurrency } = compareMonths(a, b);
    expect(sameCurrency).toBe(true);
    const row = (k) => rows.find((r) => r.key === k);
    expect(row('groceries')).toMatchObject({ a: 400, b: 500, diff: 100, pct: 0.25, better: false, level: 1 });
    expect(row('fuel')).toMatchObject({ a: 200, b: 170, diff: -30, better: true });
    expect(row('fuel').pct).toBeCloseTo(-0.15, 10);
    expect(row('family')).toMatchObject({ a: 400, b: 500, kind: 'category' });
    expect(row('housing').better).toBeNull(); // no change
    expect(row('extras')).toMatchObject({ a: 0, b: 100, better: true });
    expect(row('income')).toMatchObject({ a: 4000, b: 4100 });
    expect(row('spend')).toMatchObject({ a: 2100, b: 2170, diff: 70, better: false });
    expect(row('leftOver')).toMatchObject({ a: 1900, b: 1930, diff: 30, better: true });
    expect(rows.some((r) => r.key === 'school')).toBe(false); // empty in both
  });

  it('refuses to compare months saved in different currencies', () => {
    const pk = entry('2026-10', { income: 150000 }, { currency: 'PKR' });
    expect(compareMonths(a, pk)).toEqual({ sameCurrency: false, partial: false, rows: [] });
    expect(welcomeSummary(a, pk)).toBeNull();
  });

  it('compares a totals-only month on totals alone', () => {
    const old = quick('2026-06', 300);
    const { rows, partial } = compareMonths(old, a);
    expect(partial).toBe(true);
    expect(rows.some((r) => r.kind === 'field')).toBe(false);
    expect(rows.find((r) => r.key === 'leftOver')).toMatchObject({ a: 300, b: 1900 });
  });

  it('summarises this month against the last one for the welcome note', () => {
    const w = welcomeSummary(a, b);
    expect(w.find((x) => x.key === 'spend')).toMatchObject({ diff: 70, better: false });
    expect(w.find((x) => x.key === 'leftOver').better).toBe(true);
  });
});

describe('highlights', () => {
  it('counts the savings streak back from the latest month', () => {
    expect(savingsStreak([quick('2026-07', 100), quick('2026-08', 200), quick('2026-09', 50), quick('2026-10', 80)])).toBe(4);
    // A month that went negative ends the streak…
    expect(savingsStreak([quick('2026-08', 200), quick('2026-09', -50), quick('2026-10', 80)])).toBe(1);
    // …unless it still improved on the month before
    expect(savingsStreak([quick('2026-08', -300), quick('2026-09', -50), quick('2026-10', 80)])).toBe(2);
    // A missing month breaks it
    expect(savingsStreak([quick('2026-07', 100), quick('2026-09', 100), quick('2026-10', 100)])).toBe(2);
    expect(savingsStreak([quick('2026-10', -10)])).toBe(0);
    expect(savingsStreak([])).toBe(0);
  });

  it('only counts "improved" within the same currency', () => {
    expect(savingsStreak([quick('2026-09', -500, 'USD'), quick('2026-10', -100, 'PKR')])).toBe(0);
  });

  it('picks the best month in the current currency', () => {
    const months = [quick('2026-07', 900, 'PKR'), quick('2026-08', 300), quick('2026-09', 500), quick('2026-10', 200)];
    expect(bestMonth(months, 'USD').month).toBe('2026-09');
    expect(bestMonth([quick('2026-10', 1)], 'USD')).toBeNull();
  });

  it('finds bills rising or falling several months in a row', () => {
    const months = [
      entry('2026-06', { income: 4000, groceries: 400, fuel: 300, dining: 200 }),
      entry('2026-07', { income: 4000, groceries: 420, fuel: 290, dining: 200 }),
      entry('2026-08', { income: 4000, groceries: 450, fuel: 260, dining: 200 }),
      entry('2026-09', { income: 4000, groceries: 480, fuel: 255, dining: 200 })
    ];
    const alerts = trendAlerts(months);
    expect(alerts[0]).toMatchObject({ key: 'groceries', tone: 'bad', text: 'Groceries have gone up 3 months in a row.' });
    expect(alerts.find((x) => x.key === 'fuel')).toMatchObject({ tone: 'good', text: 'Fuel has gone down 3 months in a row.' });
    expect(alerts.some((x) => x.key === 'dining')).toBe(false);
  });

  it('notes a big change since a few months back', () => {
    const months = [
      entry('2026-07', { income: 4000, fuel: 300 }),
      entry('2026-08', { income: 4000, fuel: 320 }),
      entry('2026-09', { income: 4000, fuel: 330 }),
      entry('2026-10', { income: 4000, fuel: 255 })
    ];
    expect(trendAlerts(months)).toEqual([{ key: 'fuel', tone: 'good', size: 0.15, text: 'Fuel is down 15% since July.' }]);
  });

  it('tracks each goal across saved months', () => {
    const g = (saved) => ({ goals: [{ id: 'g1', name: 'Car', target: 5000, saved }] });
    const goals = goalsOverTime([entry('2026-08', { income: 1 }, g(100)), entry('2026-09', { income: 1 }, g(600)), quick('2026-10', 1)]);
    expect(goals).toHaveLength(1);
    expect(goals[0].points).toEqual([{ month: '2026-08', saved: 100 }, { month: '2026-09', saved: 600 }]);
  });
});

describe('backup files', () => {
  const months = [entry('2026-08', { income: 3000 }), entry('2026-09', { income: 3100 })];

  it('names the file by month and round-trips state and months', () => {
    expect(backupFileName(new Date(2026, 9, 3))).toBe('budget-backup-2026-10.json');
    const st = budget({ income: 3200, rent: 900 }, { extras: [{ id: 'x', name: 'Overtime', amount: 500 }] });
    const parsed = parseBackup(JSON.parse(JSON.stringify(makeBackup(st, months))));
    expect(parsed.ok).toBe(true);
    expect(parsed.state.values).toEqual({ income: 3200, rent: 900 });
    expect(parsed.state.extras[0].amount).toBe(500);
    expect(parsed.months).toEqual(months);
    expect(describeMonths(parsed.months)).toEqual({ count: 2, from: '2026-08', to: '2026-09' });
  });

  it('opens older backups and moves their snapshots into history', () => {
    const old = { app: 'household-budget-optimizer', exportedAt: '2026-05-01', data: { values: { income: 100 }, snapshots: [{ month: '2026-04', income: 100, spend: 80, currency: 'USD' }] } };
    const parsed = parseBackup(old);
    expect(parsed.ok).toBe(true);
    expect(parsed.months).toHaveLength(1);
    expect(parsed.months[0]).toMatchObject({ month: '2026-04', partial: true });
    expect(parsed.state.snapshots).toEqual([]);
  });

  it('rejects files that are not backups', () => {
    expect(parseBackup(null).ok).toBe(false);
    expect(parseBackup({ hello: 'world' }).ok).toBe(false);
    expect(parseBackup([1, 2]).ok).toBe(false);
  });

  it('replaces or merges months on import', () => {
    const here = [entry('2026-08', { income: 1 }, {}, '2026-08-10T00:00:00Z'), entry('2026-09', { income: 2 }, {}, '2026-09-28T00:00:00Z')];
    const file = [entry('2026-07', { income: 3 }), entry('2026-09', { income: 4 }, {}, '2026-09-05T00:00:00Z'), entry('2026-10', { income: 5 }, {}, '2026-10-02T00:00:00Z')];
    const replaced = mergeHistory(here, file, 'replace');
    expect(replaced.months.map((m) => m.inputs.values.income)).toEqual([3, 4, 5]);
    const merged = mergeHistory(here, file, 'merge');
    expect(merged.months.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    // September here was saved later than the file's copy, so it stays
    expect(merged.months[2].inputs.values.income).toBe(2);
    expect(merged.dropped).toEqual([]);
  });

  it('keeps only the newest 60 months after a merge and reports the rest', () => {
    const many = (start, count) => Array.from({ length: count }, (_, i) => quick(`${start + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, 1));
    const { months: kept, dropped } = mergeHistory(many(2018, 30), many(2021, 40), 'merge');
    expect(kept).toHaveLength(60);
    expect(dropped.map((m) => m.month)).toEqual(['2018-01', '2018-02', '2018-03', '2018-04', '2018-05', '2018-06', '2018-07', '2018-08', '2018-09', '2018-10']);
  });
});

describe('history store', () => {
  let mem;
  beforeEach(() => {
    mem = {};
    globalThis.localStorage = {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }
    };
  });

  it('saves, replaces and reloads months', async () => {
    const store = await import('../history-store.js');
    store.loadHistory();
    store.saveMonth(entry('2026-10', { income: 100 }));
    store.saveMonth(entry('2026-10', { income: 200 }));
    expect(JSON.parse(mem['hbo:history']).months).toHaveLength(1);
    store.loadHistory();
    expect(store.getHistory().months[0].inputs.values.income).toBe(200);
    expect(store.getHistory().meta.persistAsked).toBe(true);
  });

  it('moves old snapshots in on first load only', async () => {
    const store = await import('../history-store.js');
    const snaps = [{ month: '2026-05', income: 10, spend: 5, currency: 'USD' }];
    expect(store.loadHistory(snaps)).toBe(true);
    expect(store.getHistory().months[0]).toMatchObject({ month: '2026-05', partial: true });
    expect(store.loadHistory(snaps)).toBe(false); // history exists now
  });

  it('prevMonthKey handles January', () => {
    expect(prevMonthKey('2026-01')).toBe('2025-12');
  });
});
