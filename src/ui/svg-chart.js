// Small SVG line chart shared by the growth chart and the history trends.
// Drawn at the box's real pixel size so text stays crisp; colours come from
// Tailwind classes on each series, so light and dark mode need no redraw.

import { $, esc, setHTML, setAttr } from './dom.js';

const PAD = { r: 12, t: 20, b: 26 };

/** A round tick step (1, 2, 2.5 or 5 x 10^n) giving about `count` gridlines. */
export function niceStep(span, count = 5) {
  if (!(span > 0)) return 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
}

/**
 * Axis range and gridlines covering every value. By default the axis starts
 * at zero; with { zero: false } it zooms in on the values so small changes
 * month to month stay visible.
 */
export function niceScale(values, { min, max, zero = true } = {}) {
  if (!zero && values.length) {
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.25, Math.abs(hi) * 0.02, 1);
    lo -= pad;
    hi += pad;
    const step = niceStep(hi - lo, 4);
    const bottom = Math.floor(lo / step) * step;
    const top = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { bottom, top, ticks };
  }
  const lo = Math.min(0, ...values, min ?? 0);
  const hi = Math.max(0, ...values);
  const top0 = max ?? hi;
  const step = niceStep(top0 - lo);
  const top = max ?? (hi > 0 ? Math.ceil(hi / step) * step : lo < 0 ? 0 : 1);
  const bottom = lo < 0 ? Math.floor(lo / step) * step : 0;
  const ticks = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { bottom, top, ticks };
}

/**
 * series: [{ values, line, dot, area?, dashed?, width? }] where line/dot/area
 * are class lists. The first series' end value is labelled above its line,
 * the second's below.
 */
export function createLineChart({ box: boxId, svg: svgId, tip: tipId, yFormat, xLabel, tooltip, label = yFormat }) {
  let data = null;
  let geom = null;
  let hover = null;
  const hoverId = `${svgId}-hover`;

  function layout(w, h) {
    const all = data.series.flatMap((s) => s.values);
    const { bottom, top, ticks } = niceScale(all, { min: data.min, max: data.max, zero: data.zero !== false });
    const n = data.series[0].values.length;
    const tickText = ticks.map(yFormat);
    // Room for the widest axis label (about 6.5px a character at 11px)
    const l = Math.min(96, 10 + Math.max(...tickText.map((t) => t.length)) * 6.5);
    const x = (i) => l + (i * (w - l - PAD.r)) / Math.max(1, n - 1);
    const y = (v) => PAD.t + (1 - (v - bottom) / (top - bottom || 1)) * (h - PAD.t - PAD.b);
    return { n, ticks, tickText, l, x, y, w, h, zero: y(Math.max(bottom, Math.min(top, 0))) };
  }

  const linePath = (vals, g) => vals.map((v, i) => `${i ? 'L' : 'M'}${g.x(i).toFixed(1)},${g.y(v).toFixed(1)}`).join('');

  function markup(g) {
    const { n, w, h } = g;
    const bottomY = h - PAD.b;
    const grid = g.ticks.map((v, i) => `
      <line x1="${g.l}" x2="${w - PAD.r}" y1="${g.y(v)}" y2="${g.y(v)}" class="${v === 0 ? 'stroke-slate-200 dark:stroke-slate-700' : 'stroke-slate-100 dark:stroke-slate-800'}"/>
      <text x="${g.l - 8}" y="${g.y(v)}" text-anchor="end" dominant-baseline="middle" class="fill-slate-500 dark:fill-slate-400">${esc(g.tickText[i])}</text>`).join('');
    // About one x label per 70px; the last point always shows, and a regular
    // label too close to it is skipped
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - g.l) / 70))));
    const showX = (i) => i === n - 1 || (i % every === 0 && n - 1 - i >= every);
    const xLabels = Array.from({ length: n }, (_, i) => (showX(i)
      ? `<text x="${g.x(i)}" y="${bottomY + 17}" text-anchor="${i === n - 1 && n > 1 ? 'end' : i === 0 ? 'start' : 'middle'}" class="fill-slate-500 dark:fill-slate-400">${esc(xLabel(i))}</text>`
      : '')).join('');

    const lines = data.series.map((s) => {
      const area = s.area
        ? `<path d="${linePath(s.values, g)}L${g.x(n - 1).toFixed(1)},${g.zero}L${g.x(0).toFixed(1)},${g.zero}Z" class="${s.area}"/>`
        : '';
      return `${area}<path d="${linePath(s.values, g)}" fill="none" stroke-width="${s.width || 2}" ${s.dashed ? 'stroke-dasharray="6 4"' : ''} stroke-linejoin="round" class="${s.line}"/>`;
    });
    // Draw the first series last so it sits on top
    const drawn = [...lines.slice(1).reverse(), lines[0]].join('');

    // Values at the end of each line, nudged apart when they'd overlap
    const ends = data.series.slice(0, 2).map((s) => s.values.at(-1));
    let y0 = g.y(ends[0]) - 14;
    let y1 = ends.length > 1 ? g.y(ends[1]) + 16 : null;
    if (y1 != null && y1 - y0 < 18) { y0 -= 6; y1 += 6; }
    const clampY = (v) => Math.max(PAD.t - 6, Math.min(bottomY - 8, v));
    const endLabel = (v, yy) => `<text x="${g.x(n - 1) - 8}" y="${clampY(yy)}" text-anchor="end" dominant-baseline="middle" paint-order="stroke" stroke-width="4" stroke-linejoin="round" class="fill-slate-900 stroke-white font-bold dark:fill-slate-50 dark:stroke-slate-900" style="font-size:12px">${esc(label(v))}</text>`;

    return `<g style="font-size:11px">${grid}${xLabels}</g>${drawn}
      ${n > 1 ? endLabel(ends[0], y0) : ''}${n > 1 && y1 != null ? endLabel(ends[1], y1) : ''}
      <g id="${hoverId}"></g>`;
  }

  function drawHover() {
    const layer = document.getElementById(hoverId);
    const tip = $(tipId);
    if (!layer || !geom) return;
    if (hover == null || hover >= geom.n) {
      layer.innerHTML = '';
      tip.hidden = true;
      return;
    }
    const x = geom.x(hover);
    const dots = [...data.series].reverse().map((s) =>
      `<circle cx="${x}" cy="${geom.y(s.values[hover])}" r="5" stroke-width="2" class="stroke-white dark:stroke-slate-900 ${s.dot}"/>`).join('');
    layer.innerHTML = `<line x1="${x}" x2="${x}" y1="${PAD.t}" y2="${geom.h - PAD.b}" stroke-dasharray="3 3" class="stroke-slate-400 dark:stroke-slate-500"/>${dots}`;
    tip.innerHTML = tooltip(hover);
    tip.hidden = false;
    // Keep the tooltip inside the box, on whichever side of the line has room
    const tw = tip.offsetWidth;
    tip.style.left = `${x + 14 + tw <= geom.w ? x + 14 : Math.max(0, x - 14 - tw)}px`;
  }

  function draw() {
    const box = $(boxId);
    if (!data || !box) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    geom = layout(w, h);
    const svg = $(svgId);
    setAttr(svg, 'viewBox', `0 0 ${w} ${h}`);
    setHTML(svg, markup(geom));
    drawHover();
  }

  const box = $(boxId);
  const pick = (e) => {
    if (!geom) return;
    const px = e.clientX - box.getBoundingClientRect().left;
    const span = (geom.w - geom.l - PAD.r) / Math.max(1, geom.n - 1);
    const i = Math.max(0, Math.min(geom.n - 1, Math.round((px - geom.l) / span)));
    if (i !== hover) {
      hover = i;
      drawHover();
    }
  };
  box.addEventListener('pointermove', pick);
  box.addEventListener('pointerdown', pick);
  box.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return; // a tap keeps its tooltip
    hover = null;
    drawHover();
  });
  if ('ResizeObserver' in window) new ResizeObserver(draw).observe(box);
  else window.addEventListener('resize', draw);

  return {
    update(next) {
      data = next;
      if (hover != null && hover >= next.series[0].values.length) hover = null;
      draw();
    }
  };
}
