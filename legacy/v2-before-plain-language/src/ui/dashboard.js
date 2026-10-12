// Results dashboard: summary counters, Budget Health gauge, 50/30/20 donut,
// spending-by-category bars, warning banners and the mobile summary bar.
// Gauge and donut are hand-built SVG, so they need no chart library.

import { hasData } from '../state.js';
import { PROFILES } from '../engine/profiles.js';
import { pct } from '../utils/format.js';
import { $, icon, esc, setText, setHTML, setAttr, animateNumber } from './dom.js';

const SPLIT_COLORS = { needs: '#4f46e5', wants: '#d97706', savings: '#059669' };
const GAUGE_C = 2 * Math.PI * 52;

function renderSummary(result, view) {
  const { totals, savings, optimized } = result;
  animateNumber($('sumCurrent'), totals.spend * view.f, (n) => view.raw(n));
  animateNumber($('sumOptimized'), optimized * view.f, (n) => view.raw(n));
  animateNumber($('sumMonthly'), savings, (n) => view.raw(n));
  animateNumber($('sumAnnual'), savings * 12, (n) => view.raw(n));
  document.querySelectorAll('[data-per-label]').forEach((el) => setText(el, view.f === 12 ? 'per year' : 'per month'));
  const lean = totals.spend > 0 ? savings / totals.spend : 0;
  setText($('sumOptimizedSub'), totals.spend > 0 ? `${pct(lean, 1)} leaner than today` : 'Add your bills to compare');
  $('leanBar').style.width = `${Math.min(100, lean * 300)}%`;
}

function renderBanners(state, result, view) {
  const { income, spend } = result.totals;
  const over = income > 0 && spend > income;
  $('overBanner').hidden = !over;
  if (over) {
    const gap = spend - income;
    const after = income - result.optimized;
    setHTML($('overText'), `Your expenses exceed your income by <strong>${view.m(gap)}${view.per}</strong>. ${
      after >= 0
        ? `Your committed actions close the gap and leave <strong>${view.m(after)}${view.per}</strong>.`
        : `Your committed actions reduce the shortfall to <strong>${view.m(-after)}${view.per}</strong>. Commit to more actions or revisit housing and debt costs.`}`);
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
  const arc = $('gaugeArc');
  if (!h) {
    setText($('healthScore'), '–');
    setText($('healthLabel'), 'Add income');
    setText($('healthTip'), 'Enter your monthly net income to calculate your Budget Health Score.');
    arc.style.strokeDasharray = `0 ${GAUGE_C}`;
    setHTML($('healthParts'), '');
    return;
  }
  const color = h.score >= 70 ? '#059669' : h.score >= 40 ? '#d97706' : '#e11d48';
  arc.style.stroke = color;
  arc.style.strokeDasharray = `${(h.score / 100) * GAUGE_C} ${GAUGE_C}`;
  animateNumber($('healthScore'), h.score, (n) => String(Math.round(n)));
  setText($('healthLabel'), h.label);
  setText($('healthTip'), h.tip);
  setAttr($('gauge'), 'aria-label', `Budget Health Score ${h.score} out of 100, ${h.label}`);
  setHTML($('healthParts'), h.parts.map((p) => {
    const ratio = p.earned / p.max;
    const bar = ratio >= 0.7 ? 'bg-emerald-500' : ratio >= 0.4 ? 'bg-amber-500' : 'bg-rose-500';
    return `<li>
      <div class="flex justify-between text-xs"><span class="muted">${esc(p.label)}</span><span class="font-semibold tabular-nums text-slate-900 dark:text-white">${Math.round(p.earned)}/${p.max}</span></div>
      <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full ${bar}" style="width:${ratio * 100}%"></div></div>
    </li>`;
  }).join(''));
}

function renderSplit(result, view) {
  const s = result.split;
  const box = $('donutSegments');
  if (!s) {
    setHTML(box, `<circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" stroke-width="16" class="text-slate-200 dark:text-slate-800"/>`);
    setHTML($('splitLegend'), '');
    setText($('splitMsg'), 'Add your income to compare your budget with the 50/30/20 guideline.');
    return;
  }
  const keys = ['needs', 'wants', 'savings'];
  const total = keys.reduce((a, k) => a + s.actual[k], 0) || 1;
  const C = 2 * Math.PI * 44;
  let offset = 0;
  const segs = keys.map((k) => {
    const len = (s.actual[k] / total) * C;
    const gap = len > 4 ? 2 : 0; // 2px surface gap between fills
    const seg = `<circle cx="60" cy="60" r="44" fill="none" stroke="${SPLIT_COLORS[k]}" stroke-width="16"
      stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"><title>${k}: ${pct(s.share[k])}</title></circle>`;
    offset += len;
    return seg;
  });
  setHTML(box, segs.join(''));

  const LABELS = { needs: ['Needs', 50], wants: ['Wants', 30], savings: ['Savings', 20] };
  setHTML($('splitLegend'), keys.map((k) => {
    const [label, target] = LABELS[k];
    const off = k === 'savings' ? s.share[k] < 0.2 : s.share[k] > target / 100;
    return `<li class="flex items-center gap-3">
      <span class="h-3 w-3 shrink-0 rounded-sm" style="background:${SPLIT_COLORS[k]}"></span>
      <span class="flex-1 text-sm text-slate-700 dark:text-slate-300">${label}</span>
      <span class="text-sm font-bold tabular-nums text-slate-900 dark:text-white">${pct(s.share[k])}</span>
      <span class="whitespace-nowrap text-right text-xs tabular-nums ${off ? 'font-semibold text-amber-700 dark:text-amber-400' : 'muted'}">target ${target}%</span>
    </li>`;
  }).join(''));

  const msgs = [];
  if (s.diffs.wants > 0) msgs.push(`You're ${view.m(s.diffs.wants)}${view.per} over on wants.`);
  if (s.diffs.needs > 0) msgs.push(`Needs are ${view.m(s.diffs.needs)}${view.per} above the 50% guideline.`);
  if (s.diffs.savings > 0) msgs.push(`You're ${view.m(s.diffs.savings)}${view.per} short of saving 20%.`);
  setText($('splitMsg'), msgs.length ? msgs.join(' ') : 'Nice work: your budget fits the 50/30/20 guideline.');
  setAttr($('donut'), 'aria-label', `Needs ${pct(s.share.needs)}, wants ${pct(s.share.wants)}, savings ${pct(s.share.savings)} of income`);
}

function renderCategories(result, view) {
  const { categories, income, spend } = result.totals;
  const denom = income > 0 ? income : spend || 1;
  const maxShare = Math.max(...categories.map((c) => Math.max(c.amount / denom, income > 0 ? c.benchmark : 0)), 0.01);
  setText($('categoryBasis'), income > 0 ? '% of income · marker = benchmark for your profile' : '% of total spending (add income to compare with benchmarks)');
  setHTML($('categoryBars'), categories.map((c) => {
    const share = c.amount / denom;
    const over = income > 0 && c.over;
    return `<li>
      <div class="flex items-baseline justify-between gap-3">
        <span class="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">${esc(c.label)}
          ${over ? `<span class="chip bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">${icon('alert', 'h-3 w-3')}<span class="hidden sm:inline">Above benchmark</span><span class="sr-only sm:hidden">Above benchmark</span></span>` : ''}</span>
        <span class="text-sm tabular-nums"><strong class="text-slate-900 dark:text-white">${view.m(c.amount)}</strong> <span class="muted">${pct(share)}</span></span>
      </div>
      <div class="relative mt-1.5 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
        <div class="h-full rounded-full ${over ? 'bg-amber-500' : 'bg-indigo-500'}" style="width:${Math.min(100, (share / maxShare) * 100)}%"></div>
        ${income > 0 ? `<span class="absolute -top-1 h-4.5 w-0.5 rounded bg-slate-500 dark:bg-slate-300" style="left:${Math.min(100, (c.benchmark / maxShare) * 100)}%" title="Benchmark ${pct(c.benchmark)}"></span>` : ''}
      </div>
    </li>`;
  }).join(''));
}

function renderMobileBar(result, view) {
  const bar = $('mobileBar');
  const show = result.savings > 0;
  bar.classList.toggle('translate-y-[150%]', !show);
  bar.setAttribute('aria-hidden', String(!show));
  bar.querySelectorAll('a').forEach((a) => (a.tabIndex = show ? 0 : -1));
  setText($('mbAmount'), view.m(result.savings));
  setText($('mbPer'), view.per);
}

export function renderDashboard(state, result, view) {
  renderBanners(state, result, view);
  renderSummary(result, view);
  renderHealth(result);
  renderSplit(result, view);
  renderCategories(result, view);
  renderMobileBar(result, view);
}
