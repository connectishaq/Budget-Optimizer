// Savings growth: controls, plain-language summary and the line chart. The
// chart is plain SVG drawn at the box's real pixel size, so text stays crisp,
// colours follow the theme through CSS classes, and no chart library loads.

import { setState, RETURN_OPTIONS } from '../state.js';
import { projectGrowth } from '../engine/calculate.js';
import { moneyShort, moneyNice } from '../utils/format.js';
import { $, esc, setText, setHTML, setAttr } from './dom.js';

let lastData = null;
let geom = null; // pixel layout of the last drawing, reused while hovering
let hoverIndex = null;
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

// ---------------- SVG line chart ----------------
const PAD = { r: 12, t: 20, b: 26 };

/** A round tick step (1, 2, 2.5 or 5 x 10^n) giving about `count` gridlines. */
export function niceStep(max, count = 5) {
  if (!(max > 0)) return 1;
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
}

/** Pixel geometry for one box size, shared by drawing and hovering. */
function layout(d, w, h) {
  const pick = (s) => (d.showReal ? s.real : s.nominal);
  const alt = pick(d.alt);
  const cur = pick(d.cur);
  const n = alt.length;
  const max = Math.max(...alt, ...cur);
  const step = niceStep(max);
  const top = max > 0 ? Math.ceil(max / step) * step : 1;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  const tickText = ticks.map((v) => moneyShort(v, currency));
  // Room for the widest axis label (about 6.5px a character at 11px)
  const l = Math.min(96, 10 + Math.max(...tickText.map((t) => t.length)) * 6.5);
  const x = (i) => l + (i * (w - l - PAD.r)) / Math.max(1, n - 1);
  const y = (v) => PAD.t + (1 - v / top) * (h - PAD.t - PAD.b);
  return { alt, cur, n, ticks, tickText, l, x, y, w, h };
}

const linePath = (vals, g) => vals.map((v, i) => `${i ? 'L' : 'M'}${g.x(i).toFixed(1)},${g.y(v).toFixed(1)}`).join('');

function chartSvg(g) {
  const { alt, cur, n, w, h } = g;
  const bottom = h - PAD.b;
  const grid = g.ticks.map((v, i) => `
    <line x1="${g.l}" x2="${w - PAD.r}" y1="${g.y(v)}" y2="${g.y(v)}" class="${i ? 'stroke-slate-100 dark:stroke-slate-800' : 'stroke-slate-200 dark:stroke-slate-700'}"/>
    <text x="${g.l - 8}" y="${g.y(v)}" text-anchor="end" dominant-baseline="middle" class="fill-slate-500 dark:fill-slate-400">${esc(g.tickText[i])}</text>`).join('');
  // About one x label per 70px; the last year always shows, and a regular
  // label too close to it is skipped
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - g.l) / 70))));
  const showX = (i) => i === n - 1 || (i % every === 0 && n - 1 - i >= every / 2);
  const xLabels = alt.map((_, i) => (showX(i)
    ? `<text x="${g.x(i)}" y="${bottom + 17}" text-anchor="${i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}" class="fill-slate-500 dark:fill-slate-400">${i === 0 ? 'Now' : `Year ${i}`}</text>`
    : '')).join('');
  const area = `${linePath(alt, g)}L${g.x(n - 1).toFixed(1)},${bottom}L${g.x(0).toFixed(1)},${bottom}Z`;

  // Values at the end of each line, nudged apart when they'd overlap
  let yAlt = g.y(alt.at(-1)) - 14;
  let yCur = g.y(cur.at(-1)) + 16;
  if (yCur - yAlt < 18) { yAlt -= 6; yCur += 6; }
  const clampY = (v) => Math.max(PAD.t - 6, Math.min(bottom - 8, v));
  const endLabel = (v, yy) => `<text x="${g.x(n - 1) - 8}" y="${clampY(yy)}" text-anchor="end" dominant-baseline="middle" paint-order="stroke" stroke-width="4" stroke-linejoin="round" class="fill-slate-900 stroke-white font-bold dark:fill-slate-50 dark:stroke-slate-900" style="font-size:12px">${esc(moneyShort(v, currency))}</text>`;

  return `<g style="font-size:11px">${grid}${xLabels}</g>
    <path d="${area}" class="fill-emerald-700/[0.07] dark:fill-emerald-400/10"/>
    <path d="${linePath(cur, g)}" fill="none" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round" class="stroke-slate-500 dark:stroke-slate-400"/>
    <path d="${linePath(alt, g)}" fill="none" stroke-width="2.5" stroke-linejoin="round" class="stroke-emerald-700 dark:stroke-emerald-400"/>
    ${endLabel(alt.at(-1), yAlt)}${endLabel(cur.at(-1), yCur)}
    <g id="chartHover"></g>`;
}

/** Guide line, dots and tooltip for the year under the pointer. */
function drawHover(g) {
  const layer = $('chartHover');
  const tip = $('chartTip');
  if (!layer) return;
  if (hoverIndex == null || hoverIndex >= g.n) {
    layer.innerHTML = '';
    tip.hidden = true;
    return;
  }
  const i = hoverIndex;
  const x = g.x(i);
  const dot = (v, cls) => `<circle cx="${x}" cy="${g.y(v)}" r="5" stroke-width="2" class="stroke-white dark:stroke-slate-900 ${cls}"/>`;
  layer.innerHTML = `<line x1="${x}" x2="${x}" y1="${PAD.t}" y2="${g.h - PAD.b}" stroke-dasharray="3 3" class="stroke-slate-400 dark:stroke-slate-500"/>
    ${dot(g.cur[i], 'fill-slate-500 dark:fill-slate-400')}${dot(g.alt[i], 'fill-emerald-700 dark:fill-emerald-400')}`;

  const diff = g.alt[i] - g.cur[i];
  tip.innerHTML = `<p class="mb-1.5 font-semibold text-slate-300">${i === 0 ? 'Today' : `After ${i} year${i > 1 ? 's' : ''}`}</p>
    <p class="flex items-center gap-2"><span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400"></span>Saving the extra: <strong class="tabular-nums">${esc(nice(g.alt[i]))}</strong></p>
    <p class="mt-0.5 flex items-center gap-2"><span class="inline-block h-2.5 w-2.5 rounded-full bg-slate-400"></span>As you are: <strong class="tabular-nums">${esc(nice(g.cur[i]))}</strong></p>
    ${diff > 0.5 ? `<p class="mt-1.5 font-semibold text-emerald-300">You’d have ${esc(nice(diff))} more</p>` : ''}`;
  tip.hidden = false;
  // Keep the tooltip inside the box, on whichever side of the line has room
  const tw = tip.offsetWidth;
  tip.style.left = `${x + 14 + tw <= g.w ? x + 14 : Math.max(0, x - 14 - tw)}px`;
}

function draw() {
  const box = $('chartBox');
  if (!lastData || !box) return;
  const w = box.clientWidth;
  const h = box.clientHeight;
  if (!w || !h) return;
  geom = layout(lastData, w, h);
  const svg = $('growthChart');
  setAttr(svg, 'viewBox', `0 0 ${w} ${h}`);
  setHTML(svg, chartSvg(geom));
  drawHover(geom);
}

function initChartHover() {
  const box = $('chartBox');
  const pick = (e) => {
    if (!geom) return;
    const px = e.clientX - box.getBoundingClientRect().left;
    const span = (geom.w - geom.l - PAD.r) / Math.max(1, geom.n - 1);
    const i = Math.max(0, Math.min(geom.n - 1, Math.round((px - geom.l) / span)));
    if (i !== hoverIndex) {
      hoverIndex = i;
      drawHover(geom);
    }
  };
  box.addEventListener('pointermove', pick);
  box.addEventListener('pointerdown', pick);
  box.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return; // a tap keeps its tooltip
    hoverIndex = null;
    if (geom) drawHover(geom);
  });
  if ('ResizeObserver' in window) new ResizeObserver(draw).observe(box);
  else window.addEventListener('resize', draw);
}

export function renderProjection(state, result, view) {
  currency = state.currency;
  const d = projectionData(state, result);
  lastData = d;

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

  draw();
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
  initChartHover();
}
