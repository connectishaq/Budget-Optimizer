// "Month by month": auto-saving the current month, return visits (load this
// month or copy last month), editing an older month, the history panel
// (highlights, trend chart, alerts, comparison, goals, saved months, backup)
// and the notices above the results that belong to history.

import { getState, setState, replaceState, hasData } from '../state.js';
import { computeBudget, CATEGORY_DEFS } from '../engine/calculate.js';
import {
  makeEntry, monthKey, monthLabel, prevMonthKey, oldestToDrop, compareMonths, welcomeSummary,
  bestMonth, savingsStreak, trendAlerts, goalsOverTime, MAX_MONTHS
} from '../engine/history.js';
import { getHistory, loadHistory, saveMonth, deleteMonth, restoreMonth, setMeta, subscribeHistory } from '../history-store.js';
import { moneyNice, moneyShort, pct } from '../utils/format.js';
import { $, icon, esc, setText, setHTML, setAttr, toast, confirmDialog } from './dom.js';
import { createLineChart } from './svg-chart.js';
import { createBarChart } from './svg-bar-chart.js';
// Aliased: several functions here use a local `t` for totals or the trend table
import { t as tr } from '../i18n/index.js';

const SAVE_DELAY = 800;
const DAY = 86400000;

let editing = null; // month being edited, or null for the current month
let stash = null; // the budget as it was before an older month was opened
let pendingCap = null; // { month, drop } when saving needs the oldest month removed
let copiedFrom = null; // month whose numbers were copied into this month on arrival
let welcome = null; // { title, items, currency } worked out on arrival
let timer = null;
let latest = null; // { state, result, view } from the last render
let trend = null;
let cmp = { a: null, b: null };
let cmpAllBills = false; // show bills that didn't change too
let lastSavedAt = null;

const target = () => editing || monthKey();
const months = () => getHistory().months;
const find = (m) => months().find((x) => x.month === m);
const money = (n, cur, friendly = false) => moneyNice(n, cur, { friendly });

/** Puts a saved month's numbers into the form, keeping display settings. */
function loadEntry(e) {
  const st = getState();
  replaceState({
    ...st,
    ...JSON.parse(JSON.stringify(e.inputs)),
    plan: { ...e.inputs.plan, sort: st.plan.sort },
    currency: e.currency,
    profile: e.profile,
    ui: { ...st.ui, sample: false }
  }, 'replace');
}

// ---------------- Saving ----------------
function save(month, { manual = false } = {}) {
  const st = getState();
  if (st.ui.sample || !hasData(st)) {
    if (manual) toast(st.ui.sample ? tr('months.toast.sampleNotSaved') : tr('months.toast.addNumbersFirst'), { tone: 'info' });
    return false;
  }
  const drop = oldestToDrop(months(), month);
  if (drop) {
    pendingCap = { month, drop: drop.month };
    rerender();
    if (manual) $('capBanner').scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }
  pendingCap = null;
  const ok = saveMonth(makeEntry(st, computeBudget(st), new Date(), month));
  lastSavedAt = new Date();
  if (month === monthKey()) copiedFrom = null;
  if (!ok) toast(tr('months.toast.saveFailed'), { tone: 'error' });
  else if (manual) toast(tr('months.toast.saved', { month: monthLabel(month, { long: true }) }));
  return ok;
}

/** Saves any change still waiting for the auto-save timer. */
function flush() {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
  save(target());
}

/** Called for every budget change; typing and toggles save after a short pause. */
export function noteBudgetChange(reason) {
  if (reason !== 'input' && reason !== 'change') return;
  clearTimeout(timer);
  timer = setTimeout(() => { timer = null; save(target()); }, SAVE_DELAY);
}

// ---------------- Arriving ----------------
/**
 * Runs once at start-up, before the form is filled. Moves old snapshots into
 * history, then for a returning user loads this month if it's saved, or
 * copies the latest saved month into it.
 */
export function startMonths(restored) {
  const st = getState();
  if (loadHistory(st.snapshots)) setState((s) => { s.snapshots = []; }, { reason: 'ui' });
  if (!restored || !hasData(st) || st.ui.sample) return;

  const now = monthKey();
  const all = months();
  const cur = find(now);
  const before = all.filter((m) => m.month < now);
  const lastFull = [...before].reverse().find((m) => !m.partial);
  if (cur && !cur.partial) loadEntry(cur);
  else if (!cur && lastFull) {
    loadEntry(lastFull);
    copiedFrom = lastFull.month;
  }

  if (getHistory().meta.welcomeDismissed === now) return;
  const prev = before.at(-1);
  if (cur && prev) {
    welcome = buildWelcome(prev, cur, tr('months.welcome.titleCompared', { month: monthLabel(prev.month, { monthOnly: true }) }));
  } else if (!cur && before.length >= 2) {
    const [a, b] = before.slice(-2);
    welcome = buildWelcome(a, b, tr('months.welcome.titleWent', { month: monthLabel(b.month, { monthOnly: true }), prev: monthLabel(a.month, { monthOnly: true }) }));
  }
}

function buildWelcome(a, b, title) {
  const items = welcomeSummary(a, b);
  if (!items || !items.length) return null;
  const cur = b.currency;
  const text = items.map((x) => {
    const d = Math.abs(x.diff);
    if (x.better == null) {
      return { tone: 'same', text: tr(`months.welcome.same.${x.key}`) };
    }
    if (x.key === 'spend') return { tone: x.better ? 'good' : 'bad', text: tr(x.diff < 0 ? 'months.welcome.spentLess' : 'months.welcome.spentMore', { amount: money(d, cur) }) };
    if (x.key === 'leftOver') return { tone: x.better ? 'good' : 'bad', text: tr(x.diff > 0 ? 'months.welcome.leftOverMore' : 'months.welcome.leftOverLess', { amount: money(d, cur) }) };
    return { tone: x.better ? 'good' : 'look', text: tr(x.diff > 0 ? 'months.welcome.scoreUp' : 'months.welcome.scoreDown', { count: Math.round(d) }) };
  });
  return { title, items: text };
}

// ---------------- Editing an older month ----------------
export function editMonth(month) {
  const e = find(month);
  if (!e) return;
  if (e.partial) {
    toast(tr('months.toast.partialNoEdit', { month: monthLabel(month) }), { tone: 'info' });
    return;
  }
  flush();
  if (month === monthKey()) {
    editing = null;
    stash = null;
  } else {
    if (!editing) stash = JSON.parse(JSON.stringify(getState()));
    editing = month;
  }
  copiedFrom = null;
  loadEntry(e);
  setState((s) => { Object.assign(s.ui, { mode: 'wizard', step: 1, sub: 0 }); }, { reason: 'flow' });
  toast(editing ? tr('months.toast.editing', { month: monthLabel(month, { long: true }) }) : tr('months.toast.loaded', { month: monthLabel(month, { long: true }) }));
}

export function backToThisMonth() {
  if (!editing) return;
  flush();
  const done = editing;
  editing = null;
  const cur = find(monthKey());
  if (cur && !cur.partial) loadEntry(cur);
  else if (stash) replaceState(stash, 'replace');
  stash = null;
  setState((s) => { s.ui.mode = 'results'; }, { reason: 'flow' });
  toast(tr('months.toast.backTo', { done: monthLabel(done, { long: true }), month: monthLabel(monthKey(), { long: true }) }));
}

/** Loads this month's saved numbers. Returns false when there are none. */
export function loadThisMonth() {
  const cur = find(monthKey());
  if (!cur || cur.partial) return false;
  editing = null;
  stash = null;
  loadEntry(cur);
  setState((s) => { s.ui.mode = 'results'; }, { reason: 'flow' });
  toast(tr('months.toast.numbersBack', { month: monthLabel(cur.month, { long: true }) }));
  return true;
}

/** Saves any waiting change right away (before the budget is replaced). */
export const flushSave = () => flush();

/** The numbers on screen are no longer a copy of an earlier month. */
export function forgetCopied() {
  copiedFrom = null;
}

/** After "delete everything": nothing is being edited, copied or waiting. */
export function forgetSession() {
  clearTimeout(timer);
  timer = null;
  editing = null;
  stash = null;
  copiedFrom = null;
  pendingCap = null;
  welcome = null;
}

async function removeMonth(month) {
  const e = find(month);
  if (!e) return;
  const ok = await confirmDialog({
    title: tr('months.deleteDialog.title', { month: monthLabel(month, { long: true }) }),
    message: tr('months.deleteDialog.message'),
    confirmLabel: tr('months.deleteDialog.confirm'),
    danger: true
  });
  if (!ok) return;
  if (editing === month) {
    editing = null;
    if (stash) replaceState(stash, 'replace');
    stash = null;
  }
  deleteMonth(month);
  toast(tr('months.toast.deleted', { month: monthLabel(month) }), { action: { label: tr('months.toast.undo'), onClick: () => restoreMonth(e) } });
}

function viewMonth(month) {
  const list = months();
  const i = list.findIndex((m) => m.month === month);
  if (i < 0) return;
  cmp = { b: month, a: (list[i - 1] || list[i + 1] || list[i]).month };
  const row = $('compareRow');
  row.open = true;
  rerender();
  row.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// ---------------- Rendering ----------------
const TONE_TEXT = {
  good: 'text-emerald-700 dark:text-emerald-400',
  bad: 'text-rose-700 dark:text-rose-400',
  look: 'text-amber-700 dark:text-amber-400',
  same: 'muted'
};

function renderBanners(state) {
  const now = monthKey();
  const meta = getHistory().meta;
  const list = months();

  const editText = editing ? tr('months.banners.editing', { month: monthLabel(editing, { long: true }), monthOnly: monthLabel(editing, { monthOnly: true }) }) : '';
  document.querySelectorAll('[data-editing-text]').forEach((el) => setText(el, editText));
  $('editingBanner').hidden = !editing;
  $('wizEditing').hidden = !editing;

  const showWelcome = !!welcome && !editing && meta.welcomeDismissed !== now;
  $('welcomeBanner').hidden = !showWelcome;
  if (showWelcome) {
    setText($('welcomeTitle'), welcome.title);
    setHTML($('welcomeList'), welcome.items.map((x) =>
      `<li class="flex items-start gap-2 ${TONE_TEXT[x.tone]}">${icon(x.tone === 'good' ? 'check-circle' : x.tone === 'same' ? 'info' : 'alert', 'icon-sm mt-0.5 shrink-0')}<span>${esc(x.text)}</span></li>`).join(''));
  }

  const showCopied = !!copiedFrom && !editing && !find(now);
  $('copiedBanner').hidden = !showCopied;
  if (showCopied) {
    setText($('copiedText'), copiedFrom === prevMonthKey(now)
      ? tr('months.banners.copiedLast')
      : tr('months.banners.copiedFrom', { month: monthLabel(copiedFrom, { long: true }) }));
  }

  $('capBanner').hidden = !pendingCap;
  if (pendingCap) {
    setText($('capText'), tr('months.banners.cap', { count: MAX_MONTHS, month: monthLabel(pendingCap.month, { long: true }), drop: monthLabel(pendingCap.drop, { long: true }) }));
    setText($('capConfirm'), tr('months.banners.capConfirm', { month: monthLabel(pendingCap.drop) }));
  }

  const since = getHistory().lastBackup || meta.firstSaved;
  const due = list.length > 0 && since && Date.now() - Date.parse(since) > 30 * DAY;
  $('backupBanner').hidden = !(due && meta.reminderDismissed !== now && !state.ui.sample);

  $('wizStartWrap').hidden = !hasData(state);
}

function statusText(state) {
  if (state.ui.sample) return tr('months.status.sample');
  if (editing) return tr('months.status.editing', { month: monthLabel(editing, { long: true }) });
  const now = monthKey();
  const cur = find(now);
  if (cur) {
    const at = lastSavedAt || new Date(cur.savedAt);
    const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return lastSavedAt
      ? tr('months.status.saved', { month: monthLabel(now, { long: true }), time })
      : tr('months.status.savedOn', { month: monthLabel(now, { long: true }), time, date: at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
  }
  return hasData(state) ? tr('months.status.autoSave', { month: monthLabel(now, { long: true }) }) : '';
}

function stat(label, value, sub) {
  return `<div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
    <dt class="text-sm muted">${label}</dt>
    <dd class="mt-0.5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">${value}</dd>
    <dd class="mt-0.5 text-xs muted">${sub}</dd>
  </div>`;
}

function renderStats(list, cur) {
  const best = bestMonth(list, cur);
  const streak = savingsStreak(list);
  const currencies = new Set(list.map((m) => m.currency)).size;
  setHTML($('monthsStats'), [
    stat(esc(tr('months.stats.best')), best ? esc(monthLabel(best.month)) : '—',
      esc(best ? tr('months.leftOver', { amount: money(best.totals.leftOver, cur, true) }) : tr('months.stats.bestEmpty'))),
    stat(esc(tr('months.stats.streak')), esc(tr('months.monthCount', { count: streak })),
      esc(streak ? tr('months.stats.streakOn') : tr('months.stats.streakOff'))),
    stat(esc(tr('months.stats.saved')), String(list.length),
      esc(currencies > 1 ? tr('months.stats.sinceCurrencies', { month: monthLabel(list[0].month), count: currencies }) : tr('months.stats.since', { month: monthLabel(list[0].month) })))
  ].join(''));
}

const TREND = {
  // Spending zooms in on its own range (no shaded area, which would suggest a zero baseline)
  spend: { get name() { return tr('months.trend.names.spend'); }, line: 'stroke-slate-600 dark:stroke-slate-300', dot: 'fill-slate-600 dark:fill-slate-300', zero: false },
  leftOver: { get name() { return tr('months.trend.names.leftOver'); }, line: 'stroke-emerald-700 dark:stroke-emerald-400', dot: 'fill-emerald-700 dark:fill-emerald-400', area: 'fill-emerald-700/[0.07] dark:fill-emerald-400/10' },
  score: { get name() { return tr('months.trend.names.score'); }, line: 'stroke-indigo-600 dark:stroke-indigo-400', dot: 'fill-indigo-600 dark:fill-indigo-400' }
};
let trendPoints = [];
let trendKind = 'spend';
let trendCurrency = 'USD';

function renderTrend(list, cur) {
  const same = list.filter((m) => m.currency === cur);
  trendPoints = trendKind === 'score' ? same.filter((m) => m.totals.score != null) : same;
  const enough = trendPoints.length >= 2;
  // With one month there's nothing to switch between, so only the note shows
  $('trendWrap').hidden = list.length < 2;
  $('trendBox').hidden = !enough;
  $('trendNote').hidden = !enough;
  $('trendOne').hidden = enough;
  if (!enough) {
    setText($('trendOne'), trendKind === 'score' && same.length >= 2
      ? tr('months.trend.scoreNeedsIncome')
      : same.length < list.length && same.length < 2
        ? tr('months.trend.needTwoSameCurrency')
        : tr('months.trend.needTwo'));
    return;
  }
  trendCurrency = cur;
  const t = TREND[trendKind];
  const values = trendPoints.map((m) => m.totals[trendKind]);
  trend.update({ series: [{ values, width: 2.5, line: t.line, dot: t.dot, area: t.area }], max: trendKind === 'score' ? 100 : undefined, zero: t.zero });
  const other = list.length - same.length;
  setText($('trendNote'), `${tr('months.trend.note', { name: t.name, count: trendPoints.length })}${other ? ` ${tr('months.otherCurrency', { count: other })}` : ''}`);
  setAttr($('trendChart'), 'aria-label', tr('months.trend.aria', { name: t.name, items: trendPoints.map((m, i) => tr('months.trend.ariaItem', { month: monthLabel(m.month), value: trendKind === 'score' ? values[i] : money(values[i], cur) })).join(', ') }));
}

function trendTooltip(i) {
  const m = trendPoints[i];
  const v = m.totals[trendKind];
  const prev = trendPoints[i - 1]?.totals[trendKind];
  const fmt = (n) => (trendKind === 'score' ? `${Math.round(n)}` : money(n, trendCurrency));
  let change = '';
  if (prev != null && Math.abs(v - prev) >= 0.5) {
    const up = v > prev;
    const good = trendKind === 'spend' ? !up : up;
    change = `<p class="mt-1 font-semibold ${good ? 'text-emerald-300' : 'text-rose-300'}">${up ? '▲' : '▼'} ${esc(tr('months.trend.tipChange', { amount: fmt(Math.abs(v - prev)) }))}</p>`;
  }
  return `<p class="mb-1 font-semibold text-slate-300">${esc(monthLabel(m.month, { long: true }))}</p>
    <p>${esc(TREND[trendKind].name)}: <strong class="tabular-nums">${esc(fmt(v))}</strong></p>${change}`;
}

// ---------------- Bars: income vs spending, or spending by category ----------------
const BAR = {
  income: { fill: 'fill-emerald-700 dark:fill-emerald-400', swatch: 'bg-emerald-700 dark:bg-emerald-400' },
  spend: { fill: 'fill-slate-400 dark:fill-slate-500', swatch: 'bg-slate-400 dark:bg-slate-500' }
};
// One colour per spending category: [bar, legend swatch, swatch on the dark
// tooltip]. The legend carries the names too, so colour is never the only cue.
const CAT_COLOR = {
  housing: ['fill-indigo-600 dark:fill-indigo-400', 'bg-indigo-600 dark:bg-indigo-400', 'bg-indigo-400'],
  utilities: ['fill-amber-500 dark:fill-amber-400', 'bg-amber-500 dark:bg-amber-400', 'bg-amber-400'],
  transport: ['fill-sky-600 dark:fill-sky-400', 'bg-sky-600 dark:bg-sky-400', 'bg-sky-400'],
  family: ['fill-emerald-600 dark:fill-emerald-400', 'bg-emerald-600 dark:bg-emerald-400', 'bg-emerald-400'],
  care: ['fill-rose-500 dark:fill-rose-400', 'bg-rose-500 dark:bg-rose-400', 'bg-rose-400'],
  yearly: ['fill-violet-500 dark:fill-violet-400', 'bg-violet-500 dark:bg-violet-400', 'bg-violet-400'],
  debt: ['fill-slate-600 dark:fill-slate-400', 'bg-slate-600 dark:bg-slate-400', 'bg-slate-300'],
  subscriptions: ['fill-orange-400 dark:fill-orange-300', 'bg-orange-400 dark:bg-orange-300', 'bg-orange-300']
};
let bars = null;
let barKind = 'flow';
let barMonths = [];
let barCurrency = 'USD';
let barFit = { shown: 0, total: 0 };
let barNoteBase = '';

const swatch = (cls, label) => `<li class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 shrink-0 rounded-sm ${cls}"></span>${esc(label)}</li>`;

function renderBars(list, cur) {
  const same = list.filter((m) => m.currency === cur);
  barCurrency = cur;
  const flow = barKind === 'flow';
  barMonths = flow ? same : same.filter((m) => m.totals.categories);
  const skipped = same.length - barMonths.length;
  const other = list.length - same.length;
  $('barBox').hidden = !barMonths.length;
  if (flow) {
    setHTML($('barLegend'), swatch(BAR.income.swatch, tr('months.bars.income')) + swatch(BAR.spend.swatch, tr('months.bars.spending'))
      + `<li>${esc(tr('months.bars.leftOverAbove'))}</li>`);
  } else {
    const used = CATEGORY_DEFS.filter((c) => barMonths.some((m) => m.totals.categories[c.key] > 0));
    setHTML($('barLegend'), used.map((c) => swatch(CAT_COLOR[c.key][1], c.label)).join(''));
  }
  barNoteBase = [
    other ? tr('months.otherCurrency', { count: other }) : '',
    skipped ? tr('months.bars.totalsOnly', { count: skipped }) : ''
  ].filter(Boolean).join(' ');
  if (!barMonths.length) {
    barFit = { shown: 0, total: 0 };
    writeBarNote();
    return;
  }
  const groups = barMonths.map((m) => {
    const t = m.totals;
    if (flow) {
      return {
        label: monthLabel(m.month),
        bars: [{ value: t.income, cls: BAR.income.fill }, { value: t.spend, cls: BAR.spend.fill }],
        note: t.income > 0 ? { text: `${t.leftOver < 0 ? '−' : '+'}${moneyShort(Math.abs(t.leftOver), cur)}`, cls: t.leftOver < 0 ? 'fill-rose-700 dark:fill-rose-400' : 'fill-emerald-700 dark:fill-emerald-400' } : null
      };
    }
    return { label: monthLabel(m.month), bars: CATEGORY_DEFS.map((c) => ({ value: t.categories[c.key] || 0, cls: CAT_COLOR[c.key][0] })) };
  });
  bars.update({ groups, stacked: !flow });
  setAttr($('barChart'), 'aria-label', flow
    ? tr('months.bars.ariaFlow', { items: barMonths.map((m) => tr('months.bars.ariaFlowItem', { month: monthLabel(m.month), income: money(m.totals.income, cur), spend: money(m.totals.spend, cur) })).join('; ') })
    : tr('months.bars.ariaCategories', { items: barMonths.map((m) => tr('months.bars.ariaCategoriesItem', { month: monthLabel(m.month), amount: money(m.totals.spend, cur) })).join('; ') }));
  writeBarNote();
}

function writeBarNote() {
  const { shown, total } = barFit;
  const fit = shown && shown < total ? tr('months.bars.fit', { shown, count: total }) : '';
  const text = [fit, barNoteBase].filter(Boolean).join(' ') || (barMonths.length ? '' : tr('months.bars.empty'));
  setText($('barNote'), text);
  $('barNote').hidden = !text;
}

function barTooltip(i) {
  const m = barMonths[i];
  const t = m.totals;
  const cur = barCurrency;
  const row = (dot, label, v, strong = false) => `<p class="mt-0.5 flex items-center gap-2">${dot ? `<span class="inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${dot}"></span>` : ''}<span>${esc(label)}:</span><span class="ml-auto pl-3 tabular-nums ${strong ? 'font-semibold' : ''}">${esc(v)}</span></p>`;
  const head = `<p class="mb-1 font-semibold text-slate-300">${esc(monthLabel(m.month, { long: true }))}</p>`;
  if (barKind === 'flow') {
    const left = t.leftOver;
    return head + row('bg-emerald-400', tr('months.bars.income'), money(t.income, cur)) + row('bg-slate-400', tr('months.bars.spending'), money(t.spend, cur))
      + `<p class="mt-1.5 font-semibold ${left < 0 ? 'text-rose-300' : 'text-emerald-300'}">${esc(left < 0 ? tr('months.bars.shortBy', { amount: money(-left, cur) }) : tr('months.leftOver', { amount: money(left, cur) }))}</p>`;
  }
  const lines = CATEGORY_DEFS.filter((c) => t.categories[c.key] > 0)
    .sort((a, b) => t.categories[b.key] - t.categories[a.key])
    .map((c) => row(CAT_COLOR[c.key][2], c.label, money(t.categories[c.key], cur)));
  return head + lines.join('') + `<div class="mt-1.5 border-t border-white/15 pt-1">${row('', tr('months.bars.total'), money(t.spend, cur), true)}</div>`;
}

function renderAlerts(list) {
  const alerts = trendAlerts(list);
  const full = list.filter((m) => !m.partial).length;
  setText($('sumAlerts'), alerts.length ? alerts[0].text
    : full >= 2 ? tr('months.alerts.steadySummary') : tr('months.alerts.needTwoSummary'));
  setHTML($('alertList'), alerts.length
    ? alerts.map((a) => `<li class="flex items-start gap-2 text-sm ${TONE_TEXT[a.tone === 'bad' ? 'look' : 'good']}">${icon(a.tone === 'bad' ? 'alert' : 'check-circle', 'icon-sm mt-0.5 shrink-0')}<span>${esc(a.text)}</span></li>`).join('')
    : `<li class="text-sm muted">${esc(full >= 2 ? tr('months.alerts.steady') : tr('months.alerts.needTwo'))}</li>`);
}

const signed = (n, fmt) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

function renderCompare(list) {
  const keys = list.map((m) => m.month);
  if (!keys.includes(cmp.b)) cmp.b = keys.at(-1);
  if (!keys.includes(cmp.a)) {
    // Default to the latest earlier month in the same currency, so it can be compared
    const bCur = find(cmp.b).currency;
    const earlier = list.filter((m) => m.month < cmp.b);
    cmp.a = ([...earlier].reverse().find((m) => m.currency === bCur) || earlier.at(-1) || list.at(-1)).month;
  }
  const latestCur = list.at(-1).currency;
  const options = [...list].reverse().map((m) => `<option value="${m.month}">${esc(monthLabel(m.month))}${m.currency !== latestCur ? ` (${m.currency})` : ''}${m.partial ? esc(tr('months.compare.totalsOnlySuffix')) : ''}</option>`).join('');
  for (const id of ['cmpA', 'cmpB']) {
    const sel = $(id);
    if (sel.__opts !== options) { sel.innerHTML = options; sel.__opts = options; }
  }
  $('cmpA').value = cmp.a;
  $('cmpB').value = cmp.b;

  const a = find(cmp.a);
  const b = find(cmp.b);
  const la = monthLabel(a.month);
  const lb = monthLabel(b.month);
  if (a.month === b.month) {
    setHTML($('cmpBody'), `<p class="text-sm muted">${esc(tr('months.compare.pickDifferent'))}</p>`);
    setText($('sumCompare'), list.length > 1 ? tr('months.compare.pickTwo') : tr('months.compare.needTwo'));
    return;
  }
  const res = compareMonths(a, b);
  if (!res.sameCurrency) {
    setHTML($('cmpBody'), `<p class="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">${icon('alert', 'icon-sm mt-0.5 shrink-0')}<span>${esc(tr('months.compare.differentCurrencies', { a: a.currency, b: b.currency }))}</span></p>`);
    setText($('sumCompare'), tr('months.compare.differentCurrenciesSummary', { a: la, b: lb }));
    return;
  }
  const cur = b.currency;
  const fmtFor = (r) => (r.key === 'score' ? (n) => String(Math.round(n)) : (n) => money(n, cur));
  // Categories always show; a bill only when it changed, unless asked for all
  const hiddenBills = res.rows.filter((r) => r.kind === 'field' && r.better == null).length;
  const shown = cmpAllBills ? res.rows : res.rows.filter((r) => r.kind !== 'field' || r.better != null);
  const rows = shown.map((r) => {
    const fmt = fmtFor(r);
    const cell = (v) => (v == null ? '<span class="muted">—</span>' : esc(fmt(v)));
    let change;
    if (r.diff == null) change = '<span class="muted">—</span>';
    else if (r.better == null) change = `<span class="muted">${esc(tr('months.same'))}</span>`;
    else {
      const p = r.pct != null && r.key !== 'score' ? ` <span class="whitespace-nowrap">(${r.pct > 0 ? '+' : '−'}${pct(Math.abs(r.pct))})</span>` : '';
      change = `<span class="font-semibold ${r.better ? TONE_TEXT.good : TONE_TEXT.bad}"><span class="whitespace-nowrap"><span aria-hidden="true">${r.diff > 0 ? '▲' : '▼'}</span> ${esc(signed(r.diff, fmt))}</span>${p}</span>`;
    }
    const total = r.kind === 'total' || r.key === 'income';
    const head = r.level ? 'pl-4 font-normal muted' : total ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-900 dark:text-white';
    return `<tr class="${total && r.key !== 'leftOver' && r.key !== 'score' ? 'border-t border-slate-200 dark:border-slate-700' : 'border-t border-slate-100 dark:border-slate-800'}">
      <th scope="row" class="py-2 pr-2 text-left ${head}">${esc(r.label)}</th>
      <td class="px-2 py-2 text-right">${cell(r.a)}</td>
      <td class="px-2 py-2 text-right">${cell(r.b)}</td>
      <td class="py-2 pl-2 text-right">${change}</td>
    </tr>`;
  }).join('');
  const partialNote = res.partial
    ? `<p class="mb-3 text-xs muted">${esc(tr('months.compare.partialNote', { month: a.partial ? la : lb }))}</p>`
    : '';
  const toggle = hiddenBills || cmpAllBills
    ? `<label class="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" id="cmpAll" class="h-5 w-5 rounded accent-emerald-700" ${cmpAllBills ? 'checked' : ''}>${esc(tr('months.compare.showAll'))}${hiddenBills && !cmpAllBills ? ` (${hiddenBills})` : ''}</label>`
    : '';
  setHTML($('cmpBody'), `${partialNote}<div class="overflow-x-auto"><table class="w-full text-sm tabular-nums">
    <caption class="sr-only">${esc(tr('months.compare.caption', { a: la, b: lb }))}</caption>
    <thead class="text-xs muted"><tr><th scope="col" class="py-2 text-left font-medium"><span class="sr-only">${esc(tr('months.compare.item'))}</span></th><th scope="col" class="px-2 py-2 text-right font-medium">${esc(la)}</th><th scope="col" class="px-2 py-2 text-right font-medium">${esc(lb)}</th><th scope="col" class="py-2 pl-2 text-right font-medium">${esc(tr('months.compare.change'))}</th></tr></thead>
    <tbody>${rows}</tbody></table></div>${toggle}`);
  const spend = res.rows.find((r) => r.key === 'spend');
  setText($('sumCompare'), spend && spend.diff != null
    ? (spend.better == null ? tr('months.compare.summarySame', { a: la, b: lb })
      : tr(spend.diff < 0 ? 'months.compare.summaryLess' : 'months.compare.summaryMore', { a: la, b: lb, amount: money(Math.abs(spend.diff), cur) }))
    : tr('months.compare.summaryPlain', { a: la, b: lb }));
}

/** A tiny sparkline of a goal's "saved so far", one point per saved month. */
function sparkline(points, target) {
  const W = 120, H = 32, P = 3;
  const max = Math.max(target || 0, ...points.map((p) => p.saved), 1);
  const x = (i) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1);
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.saved).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="h-8 w-28 shrink-0" aria-hidden="true">
    <path d="${d}" fill="none" stroke-width="2" stroke-linejoin="round" class="stroke-emerald-700 dark:stroke-emerald-400"/>
    <circle cx="${x(points.length - 1)}" cy="${y(points.at(-1).saved)}" r="3" class="fill-emerald-700 dark:fill-emerald-400"/>
  </svg>`;
}

function renderGoalsTime(list) {
  const goals = goalsOverTime(list);
  $('goalsTimeRow').hidden = !goals.length;
  if (!goals.length) return;
  setText($('sumGoalsTime'), tr('months.goals.tracked', { count: goals.length }));
  setHTML($('goalsTime'), goals.map((g) => {
    const first = g.points[0];
    const last = g.points.at(-1);
    const gain = last.saved - first.saved;
    const progress = g.target > 0 ? Math.min(1, last.saved / g.target) : null;
    const change = g.points.length < 2 ? tr('months.goals.savedIn', { month: monthLabel(last.month) })
      : gain > 0 ? tr('months.goals.up', { amount: money(gain, g.currency), month: monthLabel(first.month) })
        : gain < 0 ? tr('months.goals.down', { amount: money(-gain, g.currency), month: monthLabel(first.month) })
          : tr('months.goals.noChange', { month: monthLabel(first.month) });
    return `<li class="flex items-center gap-4">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-slate-900 dark:text-white">${esc(g.name || tr('months.goals.defaultName'))}</p>
        <p class="text-xs muted">${esc(g.target > 0 ? tr('months.goals.progress', { saved: money(last.saved, g.currency), target: money(g.target, g.currency), pct: pct(progress) }) : money(last.saved, g.currency))} · ${esc(change)}</p>
      </div>
      ${g.points.length > 1 ? sparkline(g.points, g.target) : ''}
    </li>`;
  }).join(''));
}

function renderList(list) {
  const latestCur = list.at(-1).currency;
  setText($('sumMonthsList'), tr('months.list.summary', { count: list.length, max: MAX_MONTHS }));
  const rows = [...list].reverse().map((m, i, arr) => {
    const prev = arr[i + 1];
    const delta = prev && prev.currency === m.currency ? m.totals.spend - prev.totals.spend : null;
    const deltaTxt = delta == null ? '<span class="muted">—</span>'
      : Math.abs(delta) < 0.5 ? `<span class="muted">${esc(tr('months.same'))}</span>`
        : `<span class="${delta < 0 ? TONE_TEXT.good : TONE_TEXT.bad} font-semibold">${delta < 0 ? '▼' : '▲'} ${esc(money(Math.abs(delta), m.currency))}</span>`;
    const tags = [
      m.month === monthKey() ? `<span class="chip bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">${esc(tr('months.list.thisMonth'))}</span>` : '',
      editing === m.month ? `<span class="chip bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">${esc(tr('months.list.editing'))}</span>` : '',
      m.currency !== latestCur ? `<span class="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">${m.currency}</span>` : '',
      m.partial ? `<span class="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">${esc(tr('months.list.totalsOnly'))}</span>` : ''
    ].join(' ');
    const label = esc(monthLabel(m.month));
    return `<tr class="border-t border-slate-100 dark:border-slate-800">
      <th scope="row" class="py-2 pr-2 text-left font-semibold text-slate-900 dark:text-white"><span class="block">${label}</span>${tags.trim() ? `<span class="mt-0.5 flex flex-wrap gap-1 font-normal">${tags}</span>` : ''}</th>
      <td class="px-2 py-2 text-right tabular-nums">${esc(money(m.totals.spend, m.currency))}</td>
      <td class="px-2 py-2 text-right tabular-nums ${m.totals.leftOver < 0 ? TONE_TEXT.bad : ''}">${m.totals.leftOver < 0 ? '−' : ''}${esc(money(Math.abs(m.totals.leftOver), m.currency))}</td>
      <td class="hidden px-2 py-2 text-right tabular-nums sm:table-cell">${m.totals.score ?? '—'}</td>
      <td class="hidden px-2 py-2 text-right tabular-nums sm:table-cell">${deltaTxt}</td>
      <td class="py-1 pl-1 text-right"><span class="inline-flex">
        <button type="button" class="btn-icon h-9 w-9" data-view-month="${m.month}" aria-label="${esc(tr('months.list.compareAria', { month: monthLabel(m.month) }))}">${icon('eye', 'icon-sm')}</button>
        <button type="button" class="btn-icon h-9 w-9" data-edit-month="${m.month}" aria-label="${esc(tr('months.list.editAria', { month: monthLabel(m.month) }))}" ${m.partial ? `disabled title="${esc(tr('months.list.partialTitle'))}"` : ''}>${icon('pencil', 'icon-sm')}</button>
        <button type="button" class="btn-icon h-9 w-9 hover:text-rose-600" data-delete-month="${m.month}" aria-label="${esc(tr('months.list.deleteAria', { month: monthLabel(m.month) }))}">${icon('trash', 'icon-sm')}</button>
      </span></td>
    </tr>`;
  });
  setHTML($('snapshotRows'), rows.join(''));
}

function renderBackup(list) {
  const last = getHistory().lastBackup;
  let txt;
  if (last) {
    const days = Math.floor((Date.now() - Date.parse(last)) / DAY);
    txt = days <= 0 ? tr('months.backupStatus.today') : days === 1 ? tr('months.backupStatus.yesterday') : tr('months.backupStatus.daysAgo', { count: days });
  } else txt = list.length ? tr('months.backupStatus.none') : tr('months.backupStatus.empty');
  setText($('sumBackup'), txt);
}

const isAppleMobile = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function renderPanel(state) {
  const list = months();
  const has = list.length > 0;
  setText($('monthsStatus'), statusText(state));
  const btn = $('btnSnapshot');
  setText(btn, editing ? tr('months.saveMonth', { month: monthLabel(editing) }) : tr('months.saveThisMonth'));
  btn.disabled = state.ui.sample || !hasData(state);
  $('monthsEmpty').hidden = has;
  $('monthsBody').hidden = !has;
  document.querySelectorAll('[data-needs-months]').forEach((el) => { el.hidden = !has; });
  $('safariNote').hidden = !(has && isAppleMobile() && !getHistory().meta.safariNoteSeen);
  renderBackup(list);
  if (!has) return;
  const cur = list.at(-1).currency;
  renderStats(list, cur);
  renderTrend(list, cur);
  renderBars(list, cur);
  renderAlerts(list);
  $('alertsRow').hidden = list.length < 2;
  renderCompare(list);
  $('compareRow').hidden = list.length < 2;
  renderGoalsTime(list);
  renderList(list);
}

function rerender() {
  if (!latest) return;
  renderBanners(latest.state);
  renderPanel(latest.state);
}

export function renderMonths(state, result, view) {
  latest = { state, result, view };
  rerender();
}

export function initMonths() {
  trend = createLineChart({
    box: 'trendBox', svg: 'trendChart', tip: 'trendTip',
    yFormat: (v) => (trendKind === 'score' ? String(Math.round(v)) : moneyShort(v, trendCurrency)),
    xLabel: (i) => monthLabel(trendPoints[i].month),
    tooltip: trendTooltip
  });
  bars = createBarChart({
    box: 'barBox', svg: 'barChart', tip: 'barTip',
    yFormat: (v) => moneyShort(v, barCurrency),
    tooltip: barTooltip,
    onFit: (shown, total) => {
      if (shown === barFit.shown && total === barFit.total) return;
      barFit = { shown, total };
      writeBarNote();
    }
  });
  subscribeHistory(rerender);

  $('btnSnapshot').addEventListener('click', () => { clearTimeout(timer); timer = null; save(target(), { manual: true }); });
  $('capConfirm').addEventListener('click', () => {
    if (!pendingCap) return;
    const { month, drop } = pendingCap;
    pendingCap = null;
    deleteMonth(drop);
    if (save(month)) toast(tr('months.toast.savedAndRemoved', { month: monthLabel(month, { long: true }), drop: monthLabel(drop, { long: true }) }));
  });
  $('welcomeClose').addEventListener('click', () => { welcome = null; setMeta('welcomeDismissed', monthKey()); });
  $('backupLater').addEventListener('click', () => setMeta('reminderDismissed', monthKey()));
  $('safariClose').addEventListener('click', () => setMeta('safariNoteSeen', true));
  document.addEventListener('click', (e) => { if (e.target.closest('[data-back-to-month]')) backToThisMonth(); });

  document.querySelectorAll('input[name="trendKind"]').forEach((r) => r.addEventListener('change', () => {
    trendKind = r.value;
    rerender();
  }));
  document.querySelectorAll('input[name="barKind"]').forEach((r) => r.addEventListener('change', () => {
    barKind = r.value;
    rerender();
  }));
  $('cmpA').addEventListener('change', (e) => { cmp.a = e.target.value; rerender(); });
  $('cmpB').addEventListener('change', (e) => { cmp.b = e.target.value; rerender(); });
  $('cmpBody').addEventListener('change', (e) => {
    if (e.target.id !== 'cmpAll') return;
    cmpAllBills = e.target.checked;
    rerender();
    $('cmpAll')?.focus();
  });
  $('snapshotRows').addEventListener('click', (e) => {
    const v = e.target.closest('[data-view-month]');
    const ed = e.target.closest('[data-edit-month]');
    const del = e.target.closest('[data-delete-month]');
    if (v) viewMonth(v.dataset.viewMonth);
    else if (ed) editMonth(ed.dataset.editMonth);
    else if (del) removeMonth(del.dataset.deleteMonth);
  });

  // Don't lose the last few keystrokes when the tab closes or is hidden
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}
