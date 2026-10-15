// Savings growth: controls, plain-language summary and the line chart
// (the shared SVG chart in svg-chart.js; no chart library loads).

import { setState, RETURN_OPTIONS } from '../state.js';
import { projectGrowth } from '../engine/calculate.js';
import { moneyShort, moneyNice } from '../utils/format.js';
import { $, esc, setText, setHTML, setAttr } from './dom.js';
import { createLineChart } from './svg-chart.js';

let currency = 'USD';
const nice = (n) => moneyNice(n, currency, { friendly: true });

/** Projection series + summary numbers (pure apart from reading state). */
export function projectionData(state, result) {
  const { income, spend } = result.totals;
  const { years, rate, inflationOn, inflation } = state.projection;
  // "As you are" saves today's leftover money; the other line adds the plan's savings.
  const curMonthly = income > 0 ? Math.max(0, income - spend) : 0;
  const altMonthly = income > 0 ? Math.max(0, income - result.optimized) : result.savings;
  const infl = inflation / 100;
  const cur = projectGrowth({ monthly: curMonthly, annualRate: rate, years, inflation: infl });
  const alt = projectGrowth({ monthly: altMonthly, annualRate: rate, years, inflation: infl });
  return { years, rate, inflationOn, inflation, curMonthly, altMonthly, cur, alt, showReal: inflationOn };
}

// ---------------- Chart ----------------
let growth = null;

function tooltip(i) {
  const alt = series.alt[i];
  const cur = series.cur[i];
  const diff = alt - cur;
  return `<p class="mb-1.5 font-semibold text-slate-300">${i === 0 ? 'Today' : `After ${i} year${i > 1 ? 's' : ''}`}</p>
    <p class="flex items-center gap-2"><span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400"></span>Saving the extra: <strong class="tabular-nums">${esc(nice(alt))}</strong></p>
    <p class="mt-0.5 flex items-center gap-2"><span class="inline-block h-2.5 w-2.5 rounded-full bg-slate-400"></span>As you are: <strong class="tabular-nums">${esc(nice(cur))}</strong></p>
    ${diff > 0.5 ? `<p class="mt-1.5 font-semibold text-emerald-300">You’d have ${esc(nice(diff))} more</p>` : ''}`;
}

let series = { alt: [], cur: [] };
function draw(d) {
  const pick = (s) => (d.showReal ? s.real : s.nominal);
  series = { alt: pick(d.alt), cur: pick(d.cur) };
  growth.update({
    series: [
      { values: series.alt, width: 2.5, line: 'stroke-emerald-700 dark:stroke-emerald-400', dot: 'fill-emerald-700 dark:fill-emerald-400', area: 'fill-emerald-700/[0.07] dark:fill-emerald-400/10' },
      { values: series.cur, dashed: true, line: 'stroke-slate-500 dark:stroke-slate-400', dot: 'fill-slate-500 dark:fill-slate-400' }
    ]
  });
}

export function renderProjection(state, result, view) {
  currency = state.currency;
  const d = projectionData(state, result);

  const yrs = $('years');
  if (document.activeElement !== yrs) yrs.value = d.years;
  yrs.style.setProperty('--fill', `${((d.years - 1) / 19) * 100}%`);
  setAttr(yrs, 'aria-valuetext', `${d.years} years`);
  setText($('yearsOut'), `${d.years} year${d.years > 1 ? 's' : ''}`);
  $('rate').value = String(d.rate);
  setText($('rateHint'), RETURN_OPTIONS.find((o) => o.value === d.rate)?.hint || '');
  setAttr($('inflationSwitch'), 'aria-checked', String(d.inflationOn));
  setText($('inflationState'), d.inflationOn ? 'On' : 'Off');
  if (document.activeElement !== $('inflationRate')) $('inflationRate').value = d.inflation;
  setText($('chartMode'), d.inflationOn
    ? `Shown in today’s money (assuming prices rise ${d.inflation}% a year).`
    : 'Shown in future money (not adjusted for rising prices).');

  const pick = (s) => (d.showReal ? s.real : s.nominal);
  const fvAlt = pick(d.alt).at(-1);
  const fvCur = pick(d.cur).at(-1);
  const tag = (n) => view.tag(view.rawS(n), n);
  setHTML($('fvAlt'), tag(fvAlt));
  setHTML($('fvCur'), tag(fvCur));
  setHTML($('fvDiff'), `+${tag(fvAlt - fvCur)}`);
  setText($('fvYears'), `after ${d.years} year${d.years > 1 ? 's' : ''}`);

  const yearsTxt = `${d.years} year${d.years > 1 ? 's' : ''}`;
  const nominalAlt = d.alt.nominal.at(-1);
  const realAlt = d.alt.real.at(-1);
  let summary;
  if (d.altMonthly <= 0) {
    summary = 'Add ideas to your plan (and your income) to see how your savings could grow.';
  } else {
    summary = `If you put ${view.rawS(d.altMonthly)} into savings every month for ${yearsTxt} and it grows ${Math.round(d.rate * 100)}% a year, you could have about ${view.rawS(nominalAlt)}. Because prices rise, that would feel like about ${view.rawS(realAlt)} does today.`;
    if (nominalAlt - d.cur.nominal.at(-1) > 0.5) summary += ` If you keep going as you are, you’d have about ${view.rawS(d.cur.nominal.at(-1))}.`;
  }
  setText($('projectionSummary'), summary);
  setAttr($('growthChart'), 'aria-label', `Line chart. ${summary}`);

  // Accessible year-by-year table
  setHTML($('projectionTable'), pick(d.cur).map((c, i) => i === 0 ? '' : `<tr><th scope="row" class="px-3 py-1.5 text-left font-medium">Year ${i}</th><td class="px-3 py-1.5 text-right">${view.rawS(c)}</td><td class="px-3 py-1.5 text-right">${view.rawS(pick(d.alt)[i])}</td></tr>`).join(''));

  draw(d);
}

export function initCharts() {
  $('rate').innerHTML = RETURN_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  $('years').addEventListener('input', (e) => setState((s) => { s.projection.years = Number(e.target.value); }, { reason: 'input' }));
  $('rate').addEventListener('change', (e) => setState((s) => { s.projection.rate = Number(e.target.value); }));
  $('inflationSwitch').addEventListener('click', () => setState((s) => { s.projection.inflationOn = !s.projection.inflationOn; }));
  $('inflationRate').addEventListener('input', (e) => {
    const v = Math.min(20, Math.max(0, Number(e.target.value) || 0));
    setState((s) => { s.projection.inflation = v; }, { reason: 'input' });
  });
  growth = createLineChart({
    box: 'chartBox', svg: 'growthChart', tip: 'chartTip',
    yFormat: (v) => moneyShort(v, currency),
    xLabel: (i) => (i === 0 ? 'Now' : `Year ${i}`),
    tooltip
  });
}
