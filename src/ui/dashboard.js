// Results: the plain summary sentence and three numbers, budget health,
// how the money is split, spending by category, banners and the phone bar.
// Everything is plain HTML bars, so no chart library is needed here.

import { hasData } from '../state.js';
import { PROFILES, benchmarkFor } from '../engine/profiles.js';
import { pct } from '../utils/format.js';
import { $, esc, icon, setText, setHTML, setAttr, setMoney, animateNumber } from './dom.js';

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
  const tips = `${n} ${allEasy ? 'easy ' : ''}tip${n === 1 ? '' : 's'}`;
  const every = view.f === 12 ? 'every year' : 'every month';
  const save = n
    ? `By following ${tips}, you could save an extra ${view.s(result.savings)} ${every}.`
    : 'Switch on a few ideas below to see how much you could save.';
  if (!(income > 0)) return `You spend ${view.m(spend)} a ${view.periodWord} on the bills you entered. ${save}`;
  if (spend > income) return `You earn ${view.m(income)} but spend ${view.m(spend)} a ${view.periodWord}, which is ${view.m(spend - income)} more than you earn. ${save}`;
  return `You earn ${view.m(income)} and spend ${view.m(spend)} a ${view.periodWord}. ${save}`;
}

function renderSummary(result, view) {
  const { totals, savings, optimized } = result;
  animateNumber($('sumCurrent'), totals.spend * view.f, (n) => view.raw(n));
  animateNumber($('sumOptimized'), optimized * view.f, (n) => view.rawS(n));
  animateNumber($('sumMonthly'), savings, (n) => view.rawS(n));
  setAttr($('sumCurrent'), 'title', view.full(totals.spend * view.f));
  setAttr($('sumOptimized'), 'title', view.full(optimized * view.f));
  setAttr($('sumMonthly'), 'title', view.full(savings));
  setMoney($('sumAnnual'), view.rawS(savings * 12), view.full(savings * 12));
  setText($('sumOptimizedSub'), totals.spend > 0 && savings > 0 ? `${pct(savings / totals.spend, 1)} less than now, per ${view.periodWord}` : `per ${view.periodWord}`);
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
  setText($('rcIncomeLabel'), split ? 'Take-home pay' : 'Income');
  const first = split ? pay : income;
  put('rcIncome', first > 0 ? view.m(first) : split ? view.m(0) : 'not added', first > 0 ? view.full(first * view.f) : '');
  $('rcExtrasRow').hidden = !split;
  if (split) put('rcExtras', `+${view.m(extrasMonthly)}`, `+${view.full(extrasMonthly * view.f)}`);
  put('rcBills', `−${view.m(spend)}`, `−${view.full(spend * view.f)}`);
  setText($('rcLeftLabel'), left < 0 && income > 0 ? 'Short by' : 'Left over');
  put('rcLeft', income > 0 ? view.m(Math.abs(left)) : '–', income > 0 ? view.full(Math.abs(left) * view.f) : '');
  $('rcLeft').className = `tabular-nums ${left < 0 && income > 0 ? 'font-semibold text-rose-700 dark:text-rose-400' : ''}`;
  put('rcPlan', `+${view.s(result.savings)}`, `+${view.full(result.savings * view.f)}`);
  const total = left + result.savings;
  put('rcTotal', income > 0 ? `${total < 0 ? '−' : ''}${view.s(Math.abs(total))}` : '–', income > 0 ? view.full(total * view.f) : '');
  setText($('rcNote'), income > 0
    ? (total >= 0 ? 'Money you could put into savings, an emergency fund or paying off debt.' : 'Your bills are still higher than your income. Switch on more ideas, or look at your biggest bills.')
    : 'Add your income to see what’s left over.');
}

function renderBanners(state, result, view) {
  const { income, spend } = result.totals;
  const over = income > 0 && spend > income;
  $('overBanner').hidden = !over;
  if (over) {
    const gap = spend - income;
    const after = income - result.optimized;
    setHTML($('overText'), `<strong class="font-semibold">You spend more than you earn</strong>, by ${esc(view.m(gap))}${view.per}. ${
      after >= 0
        ? `The ideas in your plan would fix this and leave ${esc(view.s(after))}${view.per}.`
        : `The ideas in your plan bring the gap down to ${esc(view.s(-after))}${view.per}. Switch on more ideas, or look at housing and loans.`}`);
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
      ${marker == null ? '' : `<span class="absolute -top-1 h-4 w-0.5 rounded-full bg-slate-900 dark:bg-white" style="left:${Math.min(100, marker)}%" title="${esc(markerTitle)}"></span>`}
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
  $('healthLabel').className = `ml-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${tone.pill}`;
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
    { key: 'needs', label: 'Must-pay bills', target: 50 },
    { key: 'wants', label: 'Nice-to-haves', target: 30 },
    { key: 'savings', label: 'Left to save', target: 20 }
  ];
  setHTML($('splitRows'), ROWS.map(({ key, label, target }) => {
    const gap = s.diffs[key]; // > 0 means over the guideline (or, for savings, short of it)
    const off = gap > 0;
    const note = !off
      ? `${icon('check', 'icon-sm -mt-0.5 inline')} Within the ${target}% guideline`
      : key === 'savings'
        ? `${esc(view.s(gap))}${view.per} short of the ${target}% guideline`
        : `${esc(view.s(gap))}${view.per} over the ${target}% guideline`;
    return `<li>${meterRow({
      lead: `<span class="h-2.5 w-2.5 shrink-0 rounded-sm" style="background:${SPLIT_COLORS[key]}"></span>${label}`,
      value: `<span class="font-semibold text-slate-900 dark:text-white">${pct(s.share[key])}</span><span class="muted"> of income</span>`,
      fill: s.share[key] * 100, fillColor: SPLIT_COLORS[key],
      marker: target, markerTitle: `Guideline: ${target}%`,
      note, noteClass: off ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
    })}</li>`;
  }).join(''));
}

function renderCategories(state, result, view) {
  const { categories, income, spend } = result.totals;
  const denom = income > 0 ? income : spend || 1;
  const B = benchmarkFor(state.currency, state.profile);
  $('categoryLegend').hidden = !(income > 0);
  setText($('categoryBasis'), income > 0
    ? `Share of your income, compared with a typical ${PROFILES[state.profile].name}${B.approximate ? ' (a rough guide for this currency)' : ''}.`
    : 'Share of your total spending. Add your income to compare with typical households.');
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
      marker: income > 0 ? (c.benchmark / maxShare) * 100 : null, markerTitle: `Typical: ${pct(c.benchmark)} of income`,
      note: over ? `Higher than typical (about ${pct(c.benchmark)})` : '', noteClass: 'text-amber-700 dark:text-amber-400'
    })}</li>`;
  }).join(''));
  $('categoryEmpty').hidden = !unused.length;
  setText($('categoryEmpty'), unused.length ? `Nothing entered for: ${unused.map((c) => c.label).join(', ')}.` : '');
}

function renderMobileBar(state, result, view) {
  const bar = $('mobileBar');
  const show = result.savings > 0 && state.ui.mode === 'results';
  bar.classList.toggle('translate-y-[150%]', !show);
  bar.setAttribute('aria-hidden', String(!show));
  bar.querySelectorAll('a').forEach((a) => (a.tabIndex = show ? 0 : -1));
  setMoney($('mbAmount'), view.s(result.savings), view.full(result.savings * view.f));
  setText($('mbPer'), view.per);
  setText($('mbLabel'), view.f === 12 ? 'You could save each year' : 'You could save each month');
}

export function renderDashboard(state, result, view) {
  renderBanners(state, result, view);
  renderSummary(result, view);
  renderHealth(result);
  renderSplit(result, view);
  renderCategories(state, result, view);
  renderMobileBar(state, result, view);
}
