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
const CATEGORY_ICON = { housing: 'home', utilities: 'bolt', transport: 'car', family: 'cart', debt: 'card', subscriptions: 'repeat' };
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
  const { income, spend } = result.totals;
  document.querySelectorAll('[data-period-word]').forEach((el) => setText(el, view.periodWord));
  const put = (id, text, exact) => setMoney($(id), text, exact);
  const left = income - spend;
  put('rcIncome', income > 0 ? view.m(income) : 'not added', income > 0 ? view.full(income * view.f) : '');
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
  const empty = !hasData(state);
  $('emptyState').hidden = !empty;
  $('dashboard').hidden = empty;
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
  // One segment per scoring part, sized by its points; the fill shows what you earned
  setHTML($('healthSegments'), h.parts.map((p) => {
    const t = toneFor(p.earned / p.max);
    return `<div class="min-w-0" style="flex:${p.max} 1 0%">
      <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full ${t.bar}" style="width:${(p.earned / p.max) * 100}%"></div></div>
      <p class="mt-1 hidden truncate text-[11px] muted sm:block">${esc(p.label)}</p>
    </div>`;
  }).join(''));
  setText($('healthTip'), h.tip);
  setHTML($('healthParts'), h.parts.map((p) => {
    const t = toneFor(p.earned / p.max);
    return `<li>
      <div class="flex justify-between gap-3 text-sm"><span class="font-medium text-slate-900 dark:text-white">${esc(p.label)}</span><span class="tabular-nums ${t.text}">${Math.round(p.earned)} of ${p.max}</span></div>
      <p class="mt-0.5 text-sm muted">${esc(p.text)}</p>
    </li>`;
  }).join(''));
}

function renderSplit(result, view) {
  const s = result.split;
  $('splitEmpty').hidden = !!s;
  $('splitBody').hidden = !s;
  if (!s) return;
  const keys = ['needs', 'wants', 'savings'];
  const total = keys.reduce((a, k) => a + s.actual[k], 0) || 1;
  const LABELS = { needs: ['Must-pay bills', 'Needs', 50], wants: ['Nice-to-haves', 'Wants', 30], savings: ['Money left to save', 'Savings', 20] };
  setHTML($('splitBar'), keys.filter((k) => s.actual[k] > 0).map((k) =>
    `<div class="h-full" style="width:${(s.actual[k] / total) * 100}%;background:${SPLIT_COLORS[k]}" title="${LABELS[k][0]}: ${pct(s.share[k])}"></div>`).join(''));
  setHTML($('splitLegend'), keys.map((k) => {
    const [label, tag, target] = LABELS[k];
    const off = k === 'savings' ? s.share[k] < 0.2 : s.share[k] > target / 100;
    return `<li class="flex items-start gap-2">
      <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style="background:${SPLIT_COLORS[k]}"></span>
      <span>${label} <span class="muted">(${tag})</span><br>
        <strong class="font-semibold tabular-nums text-slate-900 dark:text-white">${pct(s.share[k])}</strong>
        <span class="${off ? 'text-amber-700 dark:text-amber-400' : 'muted'}"> · guideline ${target}%</span></span>
    </li>`;
  }).join(''));

  const msgs = [];
  if (s.diffs.needs > 0) msgs.push(`Your must-pay bills are ${view.s(s.diffs.needs)}${view.per} above the guideline.`);
  if (s.diffs.wants > 0) msgs.push(`You spend ${view.s(s.diffs.wants)}${view.per} more than the guideline on nice-to-haves.`);
  if (s.diffs.savings > 0) msgs.push(`To save a fifth of your income, you’d need ${view.s(s.diffs.savings)}${view.per} more left over.`);
  setText($('splitMsg'), msgs.length ? msgs.join(' ') : 'Your money is split the way the guideline suggests.');
  $('splitMsg').className = `mt-3 text-sm ${msgs.length ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'}`;
  setAttr($('splitBar'), 'aria-label', `Must-pay bills ${pct(s.share.needs)}, nice-to-haves ${pct(s.share.wants)}, money left to save ${pct(s.share.savings)} of income`);
}

function renderCategories(state, result, view) {
  const { categories, income, spend } = result.totals;
  const denom = income > 0 ? income : spend || 1;
  const maxShare = Math.max(...categories.map((c) => Math.max(c.amount / denom, income > 0 ? c.benchmark : 0)), 0.01);
  const B = benchmarkFor(state.currency, state.profile);
  setText($('categoryBasis'), income > 0
    ? `Bars show the share of your income. The line shows what’s typical for a ${PROFILES[state.profile].name}${B.approximate ? ' (a rough guide for this currency)' : ''}.`
    : 'Bars show the share of your total spending. Add your income to compare with typical households.');
  setHTML($('categoryBars'), categories.map((c) => {
    const share = c.amount / denom;
    const over = income > 0 && c.over;
    return `<li>
      <div class="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span class="flex flex-wrap items-center gap-x-2 text-slate-900 dark:text-white">${icon(CATEGORY_ICON[c.key], 'icon-sm text-slate-400')}${esc(c.label)}${over ? ' <span class="text-amber-700 dark:text-amber-400">· Higher than typical</span>' : ''}</span>
        <span class="tabular-nums"><span class="text-slate-900 dark:text-white">${view.tag(view.m(c.amount), c.amount * view.f)}</span> <span class="muted">${pct(share)}</span></span>
      </div>
      <div class="relative mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
        <div class="h-full rounded-full ${over ? 'bg-amber-500' : 'bg-slate-500 dark:bg-slate-400'}" style="width:${Math.min(100, (share / maxShare) * 100)}%"></div>
        ${income > 0 ? `<span class="absolute -top-1 h-4 w-0.5 bg-slate-900 dark:bg-white" style="left:${Math.min(100, (c.benchmark / maxShare) * 100)}%" title="Typical: ${pct(c.benchmark)} of income"></span>` : ''}
      </div>
    </li>`;
  }).join(''));
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
