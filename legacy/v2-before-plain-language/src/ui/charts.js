// Investment projection: controls, text summary and the lazily loaded line chart.
// The text summary renders immediately; Chart.js loads only once the chart
// area approaches the viewport (a skeleton holds its space until then).

import { setState, RETURN_OPTIONS } from '../state.js';
import { projectGrowth } from '../engine/calculate.js';
import { moneyShort, money } from '../utils/format.js';
import { $, setText, setHTML, setAttr, isLite, motionOK } from './dom.js';

let chart = null;
let lastData = null;
let currency = 'USD';

const palette = () => {
  const dark = document.documentElement.classList.contains('dark');
  return {
    alt: dark ? '#34d399' : '#059669',
    cur: dark ? '#818cf8' : '#6366f1',
    altFill: dark ? 'rgba(52,211,153,0.12)' : 'rgba(5,150,105,0.10)',
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
  // Current path invests today's surplus; the alternative also invests committed savings.
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

function chartConfig(Chart) {
  const p = palette();
  return {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Investing Your Savings', data: [], borderColor: p.alt, backgroundColor: p.altFill, fill: true, borderWidth: 2.5, tension: 0.3,
          pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 5, pointHoverBackgroundColor: p.alt, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2 },
        { label: 'Staying on Current Path', data: [], borderColor: p.cur, borderDash: [6, 4], fill: false, borderWidth: 2, tension: 0.3,
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
            label: (ctx) => ` ${ctx.datasetIndex === 0 ? 'Investing savings' : 'Current path'}: ${money(ctx.parsed.y, currency)}`,
            footer: (items) => {
              const a = items.find((i) => i.datasetIndex === 0);
              const b = items.find((i) => i.datasetIndex === 1);
              return a && b ? `Difference: +${money(a.parsed.y - b.parsed.y, currency)}` : '';
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
  chart.data.labels = d.cur.nominal.map((_, i) => (i === 0 ? 'Now' : `Yr ${i}`));
  chart.data.datasets[0].data = series(d.alt);
  chart.data.datasets[1].data = series(d.cur);
  chart.update();
}

async function loadChart() {
  if (chart) return;
  try {
    const { Chart } = await import('./chart-lib.js');
    chart = new Chart($('growthChart'), chartConfig(Chart));
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
  setText($('yearsOut'), `${d.years} yr${d.years > 1 ? 's' : ''}`);
  $('rate').value = String(d.rate);
  setAttr($('inflationSwitch'), 'aria-checked', String(d.inflationOn));
  if (document.activeElement !== $('inflationRate')) $('inflationRate').value = d.inflation;
  setText($('chartMode'), d.inflationOn ? `Values in today's money (${d.inflation}% inflation)` : 'Nominal values (not adjusted for inflation)');

  const fvAlt = d.alt.nominal.at(-1);
  const fvCur = d.cur.nominal.at(-1);
  const realAlt = d.alt.real.at(-1);
  const diff = fvAlt - fvCur;
  setText($('fvAlt'), view.raw(d.showReal ? realAlt : fvAlt));
  setText($('fvCur'), view.raw(d.showReal ? d.cur.real.at(-1) : fvCur));
  setText($('fvDiff'), `+${view.raw(d.showReal ? realAlt - d.cur.real.at(-1) : diff)}`);

  const yearsTxt = `${d.years} year${d.years > 1 ? 's' : ''}`;
  let summary;
  if (d.altMonthly <= 0) {
    summary = 'Commit to at least one action in your plan (or add your income) to see how your savings could grow.';
  } else {
    summary = `In ${yearsTxt}, investing ${view.raw(d.altMonthly)}/mo at ${Math.round(d.rate * 100)}% could grow to ${view.raw(fvAlt)}, worth about ${view.raw(realAlt)} in today's money at ${d.inflation}% inflation.`;
    if (diff > 0.5) summary += ` That's ${view.raw(diff)} more than staying on your current path (${view.raw(fvCur)}).`;
  }
  setText($('projectionSummary'), summary);
  setAttr($('growthChart'), 'aria-label', `Line chart. ${summary}`);

  // Accessible year-by-year table (also used when the chart can't load)
  const pick = (s) => (d.showReal ? s.real : s.nominal);
  setHTML($('projectionTable'), pick(d.cur).map((c, i) => i === 0 ? '' : `<tr><th scope="row" class="px-3 py-1.5 text-left font-medium">Year ${i}</th><td class="px-3 py-1.5 text-right">${view.raw(c)}</td><td class="px-3 py-1.5 text-right">${view.raw(pick(d.alt)[i])}</td></tr>`).join(''));

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
