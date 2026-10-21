// Results: the plain summary sentence and three numbers, budget health,
// how the money is split, spending by category, banners and the phone bar.
// Everything is plain HTML bars, so no chart library is needed here.

import { hasData } from '../state.js';
import { PROFILES, benchmarkFor } from '../engine/profiles.js';
import { pct } from '../utils/format.js';
import { $, esc, icon, setText, setHTML, setAttr, setMoney, animateNumber } from './dom.js';
import { t, has, getLanguage } from '../i18n/index.js';
import { withSign } from '../utils/format.js';
import { canSave } from '../engine/calculate.js';

// Validated categorical palette (needs / wants / savings); legend text carries identity too
const SPLIT_COLORS = { needs: '#475569', wants: '#d97706', savings: '#047857' };
const TONE = {
  good: { bar: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-400', pill: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  look: { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', pill: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  bad: { bar: 'bg-rose-600', text: 'text-rose-700 dark:text-rose-400', pill: 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300' }
};
const CATEGORY_ICON = { housing: 'home', utilities: 'bolt', transport: 'car', family: 'cart', care: 'heart-pulse', yearly: 'calendar', debt: 'card', subscriptions: 'repeat' };
// Same cut-offs as the score labels: 60+ Good/Excellent, 40–59 Okay, under 40 Needs attention
const toneFor = (ratio) => (ratio >= 0.6 ? TONE.good : ratio >= 0.4 ? TONE.look : TONE.bad);

/** "You earn X and spend Y. By following 2 easy tips, you could save an extra Z every month." */
export function plainSummary(result, view) {
  const { income, spend } = result.totals;
  const committed = result.plan.filter((p) => p.committed && p.kind === 'cash' && p.monthly > 0);
  const n = committed.length;
  const allEasy = n > 0 && committed.every((p) => p.effort === 'Easy');
  const tips = t(allEasy ? 'dashboard.summary.easyTips' : 'dashboard.summary.tips', { count: n });
  const per = view.f === 12 ? 'year' : 'month';
  // With no ideas switched on, the big number is 0, so say what is already left over
  const save = n
    ? t(`dashboard.summary.save.${per}`, { tips, amount: view.s(result.savings) })
    : income > spend ? t('dashboard.summary.noTipsLeft', { left: view.m(income - spend) }) : t('dashboard.summary.noTips');
  if (!(income > 0)) return `${t(`dashboard.summary.spendOnly.${per}`, { spend: view.m(spend) })} ${save}`;
  if (spend > income) return `${t(`dashboard.summary.overspend.${per}`, { income: view.m(income), spend: view.m(spend), gap: view.m(spend - income) })} ${save}`;
  return `${t(`dashboard.summary.earnSpend.${per}`, { income: view.m(income), spend: view.m(spend) })} ${save}`;
}

/** The headline label: money you could save, extra from ideas (no income yet), or how much you're short. */
function canSaveLabel(result) {
  const amount = canSave(result);
  if (!(result.totals.income > 0)) return t('dashboard.headline.extra');
  return amount < 0 ? t('dashboard.headline.short') : t('dashboard.headline.save');
}

function renderSummary(result, view) {
  const { totals, savings, optimized } = result;
  // The headline is what's left after bills plus the ideas' savings (the receipt's
  // "Left with your plan"), so a budget that already works never shows a bare 0
  const headline = Math.abs(canSave(result));
  setText($('sumLabel'), canSaveLabel(result));
  animateNumber($('sumCurrent'), totals.spend * view.f, (n) => view.raw(n));
  animateNumber($('sumOptimized'), optimized * view.f, (n) => view.rawS(n));
  animateNumber($('sumMonthly'), headline, (n) => view.raw(n));
  setAttr($('sumCurrent'), 'title', view.full(totals.spend * view.f));
  setAttr($('sumOptimized'), 'title', view.full(optimized * view.f));
  setAttr($('sumMonthly'), 'title', view.full(headline));
  setMoney($('sumAnnual'), view.raw(headline * 12), view.full(headline * 12));
  const per = view.f === 12 ? 'year' : 'month';
  setText($('sumOptimizedSub'), totals.spend > 0 && savings > 0 ? t(`dashboard.optimizedSub.less.${per}`, { pct: pct(savings / totals.spend, 1) }) : t(`dashboard.optimizedSub.plain.${per}`));
  $('optBar').style.width = `${totals.spend > 0 ? Math.max(2, (optimized / totals.spend) * 100) : 100}%`;
  renderReceipt(result, view);
  $('interestNote').hidden = !(result.interestAvoided > 0);
  if (result.interestAvoided > 0) setHTML($('interestAmount'), `${view.tag(view.s(result.interestAvoided), result.interestAvoided * view.f)}${view.per}`);
  setText($('plainSummary'), plainSummary(result, view));
}

/** The till receipt: income − bills = left over, + plan savings = left with your plan. */
function renderReceipt(result, view) {
  const { income, spend, pay, extrasMonthly } = result.totals;
  document.querySelectorAll('[data-period-word]').forEach((el) => setText(el, view.periodWord));
  const put = (id, text, exact) => setMoney($(id), text, exact);
  const left = income - spend;
  // With bonuses, show take-home pay and the bonuses' monthly share separately
  const split = extrasMonthly > 0;
  setText($('rcIncomeLabel'), split ? t('dashboard.receipt.takeHome') : t('dashboard.receipt.income'));
  const first = split ? pay : income;
  put('rcIncome', first > 0 ? view.m(first) : split ? view.m(0) : t('dashboard.receipt.notAdded'), first > 0 ? view.full(first * view.f) : '');
  $('rcExtrasRow').hidden = !split;
  if (split) put('rcExtras', withSign('+', view.m(extrasMonthly)), withSign('+', view.full(extrasMonthly * view.f)));
  put('rcBills', withSign('−', view.m(spend)), withSign('−', view.full(spend * view.f)));
  setText($('rcLeftLabel'), left < 0 && income > 0 ? t('dashboard.receipt.shortBy') : t('dashboard.receipt.leftOver'));
  put('rcLeft', income > 0 ? view.m(Math.abs(left)) : '–', income > 0 ? view.full(Math.abs(left) * view.f) : '');
  $('rcLeft').className = `tabular-nums ${left < 0 && income > 0 ? 'font-semibold text-rose-700 dark:text-rose-400' : ''}`;
  put('rcPlan', withSign('+', view.s(result.savings)), withSign('+', view.full(result.savings * view.f)));
  const total = left + result.savings;
  put('rcTotal', income > 0 ? withSign(total < 0 ? '−' : '', view.m(Math.abs(total))) : '–', income > 0 ? view.full(total * view.f) : '');
  setText($('rcNote'), income > 0
    ? (total >= 0 ? t('dashboard.receipt.noteLeft') : t('dashboard.receipt.noteShort'))
    : t('dashboard.receipt.noteNoIncome'));
}

function renderBanners(state, result, view) {
  const { income, spend } = result.totals;
  const over = income > 0 && spend > income;
  $('overBanner').hidden = !over;
  if (over) {
    const gap = spend - income;
    const after = income - result.optimized;
    setHTML($('overText'), after >= 0
      ? t('dashboard.over.fixed_html', { gap: esc(view.m(gap)), left: esc(view.s(after)), per: view.per })
      : t('dashboard.over.stillShort_html', { gap: esc(view.m(gap)), left: esc(view.s(-after)), per: view.per }));
  }
  $('incomeBanner').hidden = !(hasData(state) && !(income > 0));
  $('sampleBanner').hidden = !state.ui.sample;
  setText($('sampleProfile'), PROFILES[state.profile].name);
  // Only the family example fills in everything; point people to it from the others
  $('sampleTip').hidden = !state.ui.sample || state.profile === 'suburban';
  const empty = !hasData(state);
  $('emptyState').hidden = !empty;
  $('dashboard').hidden = empty;
}

/** Label + value on top, a bar (with an optional target marker) and one plain note below. */
function meterRow({ lead, value, fill, fillColor = '', fillClass = '', marker = null, markerTitle = '', note = '', noteClass = 'muted' }) {
  return `<div class="flex items-baseline justify-between gap-3 text-sm">
      <span class="flex min-w-0 items-center gap-2 font-medium text-slate-900 dark:text-white">${lead}</span>
      <span class="shrink-0 whitespace-nowrap tabular-nums">${value}</span>
    </div>
    <div class="relative mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
      <div class="h-full rounded-full ${fillClass}" style="width:${Math.max(0, Math.min(100, fill))}%${fillColor ? `;background:${fillColor}` : ''}"></div>
      ${marker == null ? '' : `<span class="absolute -top-1 h-4 w-0.5 rounded-full bg-slate-900 dark:bg-white" style="inset-inline-start:${Math.min(100, marker)}%" title="${esc(markerTitle)}"></span>`}
    </div>
    ${note ? `<p class="mt-1.5 text-xs ${noteClass}">${note}</p>` : ''}`;
}

function renderHealth(result) {
  const h = result.health;
  $('healthEmpty').hidden = !!h;
  $('healthBody').hidden = !h;
  if (!h) return;
  const tone = toneFor(h.score / 100);
  animateNumber($('healthScore'), h.score, (n) => String(Math.round(n)));
  setText($('healthLabel'), h.label);
  $('healthLabel').className = `ms-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${tone.pill}`;
  // The one thing to do next, as a callout rather than another line of body text
  const perfect = h.parts.every((p) => p.earned >= p.max);
  setHTML($('healthTip'), `${icon(perfect ? 'check-circle' : 'lightbulb', 'icon-sm mt-0.5 shrink-0')}<span>${esc(h.tip)}</span>`);
  $('healthTip').className = `mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${perfect
    ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
    : 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'}`;
  setHTML($('healthParts'), h.parts.map((p) => {
    const ratio = p.earned / p.max;
    const t = toneFor(ratio);
    return `<li class="py-3 first:pt-0 last:pb-0">${meterRow({
      lead: `${icon(ratio >= 0.6 ? 'check-circle' : 'alert', `icon-sm shrink-0 ${t.text}`)}${esc(p.label)}`,
      value: `<span class="font-semibold ${t.text}">${Math.round(p.earned)}</span><span class="muted"> / ${p.max}</span>`,
      fill: ratio * 100, fillClass: t.bar, note: esc(p.text)
    })}</li>`;
  }).join(''));
}

function renderSplit(result, view) {
  const s = result.split;
  $('splitEmpty').hidden = !!s;
  $('splitBody').hidden = !s;
  if (!s) return;
  const ROWS = [
    { key: 'needs', label: t('dashboard.split.needs'), target: 50 },
    { key: 'wants', label: t('dashboard.split.wants'), target: 30 },
    { key: 'savings', label: t('dashboard.split.savings'), target: 20 }
  ];
  setHTML($('splitRows'), ROWS.map(({ key, label, target }) => {
    const gap = s.diffs[key]; // > 0 means over the guideline (or, for savings, short of it)
    const off = gap > 0;
    const note = !off
      ? t('dashboard.split.within', { icon: icon('check', 'icon-sm -mt-0.5 inline'), target })
      : key === 'savings'
        ? t('dashboard.split.short', { amount: esc(view.s(gap)), per: view.per, target })
        : t('dashboard.split.over', { amount: esc(view.s(gap)), per: view.per, target });
    return `<li>${meterRow({
      lead: `<span class="h-2.5 w-2.5 shrink-0 rounded-sm" style="background:${SPLIT_COLORS[key]}"></span>${label}`,
      value: t('dashboard.split.ofIncome_html', { pct: pct(s.share[key]) }),
      fill: s.share[key] * 100, fillColor: SPLIT_COLORS[key],
      marker: target, markerTitle: t('dashboard.split.guideline', { target }),
      note, noteClass: off ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
    })}</li>`;
  }).join(''));
}

function renderCategories(state, result, view) {
  const { categories, income, spend } = result.totals;
  const denom = income > 0 ? income : spend || 1;
  const B = benchmarkFor(state.country, state.profile, income);
  $('categoryLegend').hidden = !(income > 0);
  setText($('categoryBasis'), income > 0
    ? t(B.approximate ? 'dashboard.categories.basisIncomeApprox' : 'dashboard.categories.basisIncome', { profile: PROFILES[state.profile].name })
    : t('dashboard.categories.basisSpend'));
  // Biggest first; empty categories go in one line at the end instead of a row each
  const used = categories.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const unused = categories.filter((c) => !(c.amount > 0));
  const maxShare = Math.max(...used.map((c) => Math.max(c.amount / denom, income > 0 ? c.benchmark : 0)), 0.01);
  setHTML($('categoryBars'), used.map((c) => {
    const share = c.amount / denom;
    const over = income > 0 && c.over;
    return `<li>${meterRow({
      lead: `${icon(CATEGORY_ICON[c.key], 'icon-sm shrink-0 text-slate-400')}<span class="truncate">${esc(c.label)}</span>`,
      value: `<span class="font-semibold text-slate-900 dark:text-white">${view.tag(view.m(c.amount), c.amount * view.f)}</span> <span class="muted">· ${pct(share)}</span>`,
      fill: (share / maxShare) * 100, fillClass: over ? 'bg-amber-500' : 'bg-slate-500 dark:bg-slate-400',
      marker: income > 0 ? (c.benchmark / maxShare) * 100 : null, markerTitle: t('dashboard.categories.typical', { pct: pct(c.benchmark) }),
      note: over ? t('dashboard.categories.higher', { pct: pct(c.benchmark) }) : '', noteClass: 'text-amber-700 dark:text-amber-400'
    })}</li>`;
  }).join(''));
  $('categoryEmpty').hidden = !unused.length;
  setText($('categoryEmpty'), unused.length ? t('dashboard.categories.nothingFor', { list: unused.map((c) => c.label).join(', ') }) : '');
}

/** A line's name: an input field, the country's own bill, subscriptions or a custom expense. */
function balanceLabel(line, state) {
  if (line.field) return t(`inputs.fields.${line.field}.label`);
  if (line.local) {
    const k = `countryFields.${state.country}.${line.local}.label`;
    return has(k) ? t(k) : line.localLabel;
  }
  if (line.id === 'subscriptions') return t('calc.categories.subscriptions');
  return line.customName || t('calc.otherCosts');
}

/** Why this bill is in the plan, from the household's own numbers. */
function balanceReason(l, state, view, income) {
  const group = PROFILES[state.profile].group;
  if (l.reason === 'big') return t('dashboard.balance.reason.big', { pct: Math.round((l.now / income) * 100) });
  if (l.times != null) {
    const range = `${view.m(l.range[0])}–${view.m(l.range[1])}`;
    const text = l.times >= 2
      ? t('dashboard.balance.reason.times', { times: Math.round(l.times * 10) / 10, group, range })
      : t('dashboard.balance.reason.over', { group, range });
    return l.check ? `${text} ${t('dashboard.balance.reason.check')}` : text;
  }
  return t(`dashboard.balance.reason.${l.reason === 'want' ? 'want' : 'trim'}`);
}

/** Names of the bills the plan leaves alone: field labels or category names. */
function keptLabel(k) {
  if (k.field) return t(`inputs.fields.${k.field}.label`);
  if (k.id === 'debt') return t('calc.categories.debt');
  if (k.id === 'yearly') return t('calc.categories.yearly');
  return t('subs.kinds.tools.label');
}

/** "A plan that fits your income": a spending limit for each bill, when spending leaves under 10% to save. */
function renderBalance(state, result, view) {
  const b = result.balance;
  $('balance').hidden = !b;
  if (!b) return;
  const { income } = result.totals;
  // Now → aim for, pointing the way the text reads
  const arrow = document.dir === 'rtl' ? '←' : '→';
  setText($('balanceIntro'), b.spend > income
    ? t('dashboard.balance.intro.over', { spend: view.m(b.spend), gap: view.m(b.spend - income), per: view.per, pct: 10 })
    : t('dashboard.balance.intro.low', { spend: view.m(b.spend), income: view.m(income), per: view.per, pct: 10 }));
  setHTML($('balanceRows'), b.lines.map((l) => `<li class="py-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0"><p class="font-medium text-slate-900 dark:text-white">${esc(balanceLabel(l, state))}</p><p class="mt-0.5 text-xs ${l.check ? 'text-amber-700 dark:text-amber-400' : 'muted'}">${esc(balanceReason(l, state, view, income))}</p></div>
        <div class="shrink-0 text-end tabular-nums"><p><span class="muted">${esc(view.m(l.now))}</span> ${arrow} <strong class="font-semibold text-slate-900 dark:text-white">${esc(view.s(l.aim))}</strong></p><p class="text-xs text-emerald-700 dark:text-emerald-400">${esc(withSign('−', view.s(l.cut)))}</p></div>
      </div>
      <p class="mt-2 text-sm text-slate-700 dark:text-slate-300"><span class="font-semibold">${esc(t('dashboard.balance.how'))}</span> ${esc(t(`dashboard.balance.tips.${l.tip}`))}</p>
    </li>`).join(''));
  setText($('balanceTotal'), `${view.m(b.spend)} ${arrow} ${view.s(b.newSpend)}`);
  const vars = { spend: view.s(b.newSpend), save: view.s(Math.max(0, b.toSave)), short: view.s(Math.max(0, -b.toSave)), per: view.per };
  setText($('balanceResult'), t(`dashboard.balance.result.${b.outcome}`, vars));
  $('balanceResult').className = `mt-4 rounded-xl px-4 py-3 text-sm ${b.outcome === 'reached'
    ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
    : 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'}`;
  // Bigger changes, only for what this household has
  $('balanceBigger').hidden = !b.bigger.length;
  setHTML($('balanceBiggerList'), b.bigger.map((c) => `<li class="flex gap-2"><span class="text-slate-400" aria-hidden="true">•</span><span>${esc(t(`dashboard.balance.bigger.${c.key}`, {
    amount: view.s(c.amount), per: view.per, pct: c.share != null ? Math.round(c.share * 100) : ''
  }))}</span></li>`).join(''));
  const kept = b.kept.map(keptLabel);
  const list = kept.length ? new Intl.ListFormat(getLanguage(), { type: 'conjunction' }).format(kept) : '';
  setText($('balanceNote'), [kept.length ? t('dashboard.balance.kept', { list }) : '', t('dashboard.balance.startingPoint')].filter(Boolean).join(' '));
}

function renderMobileBar(state, result, view) {
  const bar = $('mobileBar');
  const amount = canSave(result);
  const show = amount > 0 && state.ui.mode === 'results';
  bar.classList.toggle('translate-y-[150%]', !show);
  bar.setAttribute('aria-hidden', String(!show));
  bar.querySelectorAll('a').forEach((a) => (a.tabIndex = show ? 0 : -1));
  setMoney($('mbAmount'), view.m(amount), view.full(amount * view.f));
  setText($('mbPer'), view.per);
  setText($('mbLabel'), view.f === 12 ? t('dashboard.mobile.saveYear') : t('dashboard.mobile.saveMonth'));
}

export function renderDashboard(state, result, view) {
  renderBanners(state, result, view);
  renderSummary(result, view);
  renderHealth(result);
  renderSplit(result, view);
  renderCategories(state, result, view);
  renderBalance(state, result, view);
  renderMobileBar(state, result, view);
}
