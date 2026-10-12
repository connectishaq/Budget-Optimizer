// Savings growth: controls, plain-language summary and the lazily loaded line
// chart. The text summary renders immediately; Chart.js loads only once the
// chart area approaches the viewport (a skeleton holds its space until then).

import { setState, RETURN_OPTIONS } from '../state.js';
import { projectGrowth } from '../engine/calculate.js';
import { moneyShort, moneyNice } from '../utils/format.js';
import { $, setText, setHTML, setAttr, isLite, motionOK } from './dom.js';

const LINE_ALT = 'If you also save the extra money';
const LINE_CUR = 'If you keep going as you are';

let chart = null;
let lastData = null;
let currency = 'USD';
const nice = (n) => moneyNice(n, currency, { friendly: true });

const palette = () => {
  const dark = document.documentElement.classList.contains('dark');
  return {
    alt: dark ? '#34d399' : '#047857',
    cur: dark ? '#94a3b8' : '#64748b',
    altFill: dark ? 'rgba(52,211,153,0.10)' : 'rgba(4,120,87,0.07)',
    grid: dark ? '#1e293b' : '#f1f5f9',
    axis: dark ? '#94a3b8' : '#64748b',
    ink: dark ? '#f8fafc' : '#0f172a',
    halo: dark ? '#0f172a' : '#ffffff'
  };
};

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

// Vertical hover guide line
const crosshair = {
  id: 'crosshair',
  afterDatasetsDraw(c) {
    const active = c.tooltip?.getActiveElements();
    if (!active?.length) return;
    const x = active[0].element.x;
    const { top, bottom } = c.chartArea;
    const ctx = c.ctx;
    ctx.save();
    ctx.strokeStyle = palette().axis;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    ctx.restore();
  }
};

// Direct end-of-line value labels (ink colour, haloed for legibility)
const endLabels = {
  id: 'endLabels',
  afterDatasetsDraw(c) {
    const p = palette();
    const pts = c.data.datasets.map((ds, i) => {
      const el = c.getDatasetMeta(i).data.at(-1);
      return el ? { x: el.x, y: el.y, v: ds.data.at(-1) } : null;
    });
    if (!pts[0] || !pts[1]) return;
    let yAlt = pts[0].y - 14;
    let yCur = pts[1].y + 18;
    if (yCur - yAlt < 20) { yAlt -= 6; yCur += 6; }
    const { ctx, chartArea } = c;
    ctx.save();
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const [pt, y] of [[pts[0], yAlt], [pts[1], yCur]]) {
      const ty = Math.max(chartArea.top + 8, Math.min(chartArea.bottom - 8, y));
      const label = moneyShort(pt.v, currency);
      ctx.lineWidth = 4; ctx.strokeStyle = p.halo; ctx.strokeText(label, pt.x - 10, ty);
      ctx.fillStyle = p.ink; ctx.fillText(label, pt.x - 10, ty);
    }
    ctx.restore();
  }
};

function chartConfig() {
  const p = palette();
  return {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: LINE_ALT, data: [], borderColor: p.alt, backgroundColor: p.altFill, fill: true, borderWidth: 2.5, tension: 0.3,
          pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 5, pointHoverBackgroundColor: p.alt, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2 },
        { label: LINE_CUR, data: [], borderColor: p.cur, borderDash: [6, 4], fill: false, borderWidth: 2, tension: 0.3,
          pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 5, pointHoverBackgroundColor: p.cur, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: isLite() || !motionOK() ? false : { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 18, right: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', padding: 12, cornerRadius: 10, usePointStyle: true, boxPadding: 4,
          titleColor: '#e2e8f0', bodyColor: '#f8fafc', footerColor: '#6ee7b7',
          callbacks: {
            title: (items) => (items[0].dataIndex === 0 ? 'Today' : `After ${items[0].dataIndex} year${items[0].dataIndex > 1 ? 's' : ''}`),
            label: (ctx) => ` ${ctx.datasetIndex === 0 ? 'Saving the extra' : 'As you are'}: ${nice(ctx.parsed.y)}`,
            footer: (items) => {
              const a = items.find((i) => i.datasetIndex === 0);
              const b = items.find((i) => i.datasetIndex === 1);
              return a && b ? `You'd have ${nice(a.parsed.y - b.parsed.y)} more` : '';
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { color: p.grid }, ticks: { color: p.axis, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: { beginAtZero: true, border: { display: false }, grid: { color: p.grid },
          ticks: { color: p.axis, maxTicksLimit: 6, callback: (v) => moneyShort(v, currency) } }
      }
    },
    plugins: [crosshair, endLabels]
  };
}

function restyle() {
  if (!chart) return;
  const p = palette();
  const [a, b] = chart.data.datasets;
  Object.assign(a, { borderColor: p.alt, backgroundColor: p.altFill, pointHoverBackgroundColor: p.alt });
  Object.assign(b, { borderColor: p.cur, pointHoverBackgroundColor: p.cur });
  chart.options.scales.x.ticks.color = p.axis;
  chart.options.scales.y.ticks.color = p.axis;
  chart.options.scales.y.grid.color = p.grid;
  chart.options.scales.x.border.color = p.grid;
  chart.update('none');
}

function draw() {
  if (!chart || !lastData) return;
  const d = lastData;
  const series = (s) => (d.showReal ? s.real : s.nominal);
  chart.data.labels = d.cur.nominal.map((_, i) => (i === 0 ? 'Now' : `Year ${i}`));
  chart.data.datasets[0].data = series(d.alt);
  chart.data.datasets[1].data = series(d.cur);
  chart.update();
}

async function loadChart() {
  if (chart) return;
  try {
    const { Chart } = await import('./chart-lib.js');
    chart = new Chart($('growthChart'), chartConfig());
    $('chartSkeleton').hidden = true;
    $('growthChart').hidden = false;
    draw();
  } catch {
    setText($('chartSkeleton'), 'The chart could not load. The summary below has the same numbers.');
  }
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

  // Accessible year-by-year table (also used when the chart can't load)
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

  window.addEventListener('themechange', restyle);

  const box = $('chartBox');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        loadChart();
      }
    }, { rootMargin: '300px 0px' });
    io.observe(box);
  } else {
    loadChart();
  }
}
