// Savings growth: controls, plain-language summary and the line chart
// (the shared SVG chart in svg-chart.js; no chart library loads).

import { setState, RETURN_OPTIONS } from '../state.js';
import { projectGrowth } from '../engine/calculate.js';
import { moneyShort, moneyNice } from '../utils/format.js';
import { $, esc, setText, setHTML, setAttr } from './dom.js';
import { createLineChart } from './svg-chart.js';
import { t, getLanguage } from '../i18n/index.js';

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
  return `<p class="mb-1.5 font-semibold text-slate-300">${i === 0 ? t('charts.tip.today') : t('charts.tip.after', { count: i })}</p>
    <p class="flex items-center gap-2"><span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400"></span>${t('charts.tip.alt_html', { amount: esc(nice(alt)) })}</p>
    <p class="mt-0.5 flex items-center gap-2"><span class="inline-block h-2.5 w-2.5 rounded-full bg-slate-400"></span>${t('charts.tip.cur_html', { amount: esc(nice(cur)) })}</p>
    ${diff > 0.5 ? `<p class="mt-1.5 font-semibold text-emerald-300">${t('charts.tip.more', { amount: esc(nice(diff)) })}</p>` : ''}`;
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

  if ($('rate').__lang !== getLanguage()) fillRates();
  const yrs = $('years');
  if (document.activeElement !== yrs) yrs.value = d.years;
  yrs.style.setProperty('--fill', `${((d.years - 1) / 19) * 100}%`);
  setAttr(yrs, 'aria-valuetext', t('charts.yearsValueText', { years: d.years }));
  setText($('yearsOut'), t('charts.years', { count: d.years }));
  $('rate').value = String(d.rate);
  setText($('rateHint'), RETURN_OPTIONS.find((o) => o.value === d.rate)?.hint || '');
  setAttr($('inflationSwitch'), 'aria-checked', String(d.inflationOn));
  setText($('inflationState'), d.inflationOn ? t('charts.on') : t('charts.off'));
  if (document.activeElement !== $('inflationRate')) $('inflationRate').value = d.inflation;
  setText($('chartMode'), d.inflationOn
    ? t('charts.mode.real', { pct: d.inflation })
    : t('charts.mode.nominal'));

  const pick = (s) => (d.showReal ? s.real : s.nominal);
  const fvAlt = pick(d.alt).at(-1);
  const fvCur = pick(d.cur).at(-1);
  const tag = (n) => view.tag(view.rawS(n), n);
  setHTML($('fvAlt'), tag(fvAlt));
  setHTML($('fvCur'), tag(fvCur));
  setHTML($('fvDiff'), `+${tag(fvAlt - fvCur)}`);
  setText($('fvYears'), t('charts.afterYears', { count: d.years }));

  const yearsTxt = t('charts.years', { count: d.years });
  const nominalAlt = d.alt.nominal.at(-1);
  const realAlt = d.alt.real.at(-1);
  let summary;
  if (d.altMonthly <= 0) {
    summary = t('charts.summary.empty');
  } else {
    summary = t('charts.summary.main', { monthly: view.rawS(d.altMonthly), years: yearsTxt, rate: Math.round(d.rate * 100), nominal: view.rawS(nominalAlt), real: view.rawS(realAlt) });
    if (nominalAlt - d.cur.nominal.at(-1) > 0.5) summary += ` ${t('charts.summary.asYouAre', { amount: view.rawS(d.cur.nominal.at(-1)) })}`;
  }
  setText($('projectionSummary'), summary);
  setAttr($('growthChart'), 'aria-label', t('charts.ariaLabel', { summary }));

  // Accessible year-by-year table
  setHTML($('projectionTable'), pick(d.cur).map((c, i) => i === 0 ? '' : `<tr><th scope="row" class="px-3 py-1.5 text-left font-medium">${t('charts.year', { n: i })}</th><td class="px-3 py-1.5 text-right">${view.rawS(c)}</td><td class="px-3 py-1.5 text-right">${view.rawS(pick(d.alt)[i])}</td></tr>`).join(''));

  draw(d);
}

/** The growth-rate options, filled again when the language changes. */
function fillRates() {
  const sel = $('rate');
  sel.__lang = getLanguage();
  sel.innerHTML = RETURN_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
}

export function initCharts() {
  fillRates();
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
    xLabel: (i) => (i === 0 ? t('charts.now') : t('charts.year', { n: i })),
    tooltip
  });
}
