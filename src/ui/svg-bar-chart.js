// SVG bar chart for the month-by-month view: grouped bars (side by side) or
// stacked bars, one group per month. Same look as svg-chart.js: drawn at the
// box's real size, colours from Tailwind classes, a tooltip on hover or tap.
// When the box is too narrow for every month, the latest ones that fit show.

import { $, esc, setHTML, setAttr } from './dom.js';
import { niceScale } from './svg-chart.js';

const PAD = { r: 8, t: 22, b: 26 };

/**
 * groups: [{ label, bars: [{ value, cls }], note?: { text, cls } }]
 * stacked: true draws each group's bars on top of each other.
 * onFit(shown, total) reports how many groups fitted.
 */
export function createBarChart({ box: boxId, svg: svgId, tip: tipId, yFormat, tooltip, onFit = () => {} }) {
  let data = null;
  let geom = null;
  let hover = null;
  const hoverId = `${svgId}-hover`;

  function layout(w, h) {
    const minGroup = data.stacked ? 26 : 34;
    const all = data.groups;
    // Leave room for the axis labels first, then fit as many months as possible
    const probe = niceScale(all.flatMap((g) => (data.stacked ? [g.bars.reduce((a, b) => a + b.value, 0)] : g.bars.map((b) => b.value))));
    const l = Math.min(96, 10 + Math.max(...probe.ticks.map((t) => yFormat(t).length)) * 6.5);
    const fit = Math.max(2, Math.floor((w - l - PAD.r) / minGroup));
    const groups = all.slice(-fit);
    const values = groups.flatMap((g) => (data.stacked ? [g.bars.reduce((a, b) => a + b.value, 0)] : g.bars.map((b) => b.value)));
    const { bottom, top, ticks } = niceScale(values);
    const slot = (w - l - PAD.r) / groups.length;
    const y = (v) => PAD.t + (1 - (v - bottom) / (top - bottom || 1)) * (h - PAD.t - PAD.b);
    return { groups, offset: all.length - groups.length, ticks, l, slot, y, w, h };
  }

  function markup(g) {
    const bottomY = g.h - PAD.b;
    const grid = g.ticks.map((v) => `
      <line x1="${g.l}" x2="${g.w - PAD.r}" y1="${g.y(v)}" y2="${g.y(v)}" class="${v === 0 ? 'stroke-slate-300 dark:stroke-slate-600' : 'stroke-slate-100 dark:stroke-slate-800'}"/>
      <text x="${g.l - 8}" y="${g.y(v)}" text-anchor="end" dominant-baseline="middle" class="fill-slate-500 dark:fill-slate-400">${esc(yFormat(v))}</text>`).join('');
    // Thin out month labels so they never overlap (about 56px each)
    const every = Math.max(1, Math.ceil(56 / g.slot));
    const n = g.groups.length;
    const bars = g.groups.map((grp, i) => {
      const x0 = g.l + i * g.slot;
      // Keep bars a sensible width when only a few months are saved
      const inner = Math.min(g.slot * 0.72, data.stacked ? 56 : 30 * grp.bars.length);
      const start = x0 + (g.slot - inner) / 2;
      let rects = '';
      if (data.stacked) {
        let acc = 0;
        for (const b of grp.bars) {
          if (!(b.value > 0)) continue;
          const y1 = g.y(acc + b.value);
          const y2 = g.y(acc);
          rects += `<rect x="${start.toFixed(1)}" y="${y1.toFixed(1)}" width="${inner.toFixed(1)}" height="${Math.max(0, y2 - y1).toFixed(1)}" class="${b.cls}"/>`;
          acc += b.value;
        }
      } else {
        const bw = inner / grp.bars.length;
        grp.bars.forEach((b, j) => {
          const y1 = g.y(Math.max(0, b.value));
          const y2 = g.y(Math.min(0, b.value));
          rects += `<rect x="${(start + j * bw + 1).toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${Math.max(0, y2 - y1).toFixed(1)}" rx="2" class="${b.cls}"/>`;
        });
      }
      const cx = x0 + g.slot / 2;
      const showLabel = i === n - 1 || ((n - 1 - i) % every === 0);
      const label = showLabel ? `<text x="${cx}" y="${bottomY + 17}" text-anchor="middle" class="fill-slate-500 dark:fill-slate-400">${esc(grp.label)}</text>` : '';
      // A small value above each group (e.g. money left over), when there's room
      const topY = data.stacked ? g.y(grp.bars.reduce((a, b) => a + b.value, 0)) : g.y(Math.max(0, ...grp.bars.map((b) => b.value)));
      const note = grp.note && g.slot >= 44
        ? `<text x="${cx}" y="${topY - 6}" text-anchor="middle" class="font-semibold ${grp.note.cls}" style="font-size:10.5px">${esc(grp.note.text)}</text>`
        : '';
      return `${rects}${label}${note}`;
    }).join('');
    return `<g id="${hoverId}"></g><g style="font-size:11px">${grid}${bars}</g>`;
  }

  function drawHover() {
    const layer = document.getElementById(hoverId);
    const tip = $(tipId);
    if (!layer || !geom) return;
    if (hover == null || hover >= geom.groups.length) {
      layer.innerHTML = '';
      tip.hidden = true;
      return;
    }
    const x0 = geom.l + hover * geom.slot;
    layer.innerHTML = `<rect x="${x0}" y="${PAD.t - 8}" width="${geom.slot}" height="${geom.h - PAD.t - PAD.b + 8}" rx="6" class="fill-slate-100 dark:fill-slate-800/70"/>`;
    tip.innerHTML = tooltip(geom.offset + hover);
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const right = x0 + geom.slot + 8;
    tip.style.left = `${right + tw <= geom.w ? right : Math.max(0, x0 - 8 - tw)}px`;
  }

  function draw() {
    const box = $(boxId);
    if (!data || !box) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    geom = layout(w, h);
    onFit(geom.groups.length, data.groups.length);
    setAttr($(svgId), 'viewBox', `0 0 ${w} ${h}`);
    setHTML($(svgId), markup(geom));
    drawHover();
  }

  const box = $(boxId);
  const pick = (e) => {
    if (!geom) return;
    const px = e.clientX - box.getBoundingClientRect().left;
    const i = Math.floor((px - geom.l) / geom.slot);
    const next = i >= 0 && i < geom.groups.length ? i : null;
    if (next !== hover) {
      hover = next;
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
      hover = null;
      draw();
    }
  };
}
