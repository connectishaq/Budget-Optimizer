// Action plan: one keyed card per fired rule. Cards are created once and then
// updated in place, so sliders keep focus while values change around them.

import { setState } from '../state.js';
import { EFFORT_ORDER } from '../engine/rules.js';
import { duration } from '../utils/format.js';
import { $, icon, esc, setText, setHTML, setAttr } from './dom.js';

const EFFORT_STYLE = {
  Easy: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Medium: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'Requires purchase': 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
};

const cards = new Map(); // rule id -> element

function createCard(item) {
  const el = document.createElement('article');
  el.className = 'card card-lift p-4 sm:p-5';
  el.dataset.id = item.id;
  el.innerHTML = `
    <div class="flex items-start gap-3 sm:gap-4">
      <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl" data-ref="iconBox">${icon(item.icon)}</span>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">${esc(item.category)}</span>
          <span class="chip ${EFFORT_STYLE[item.effort]}">${esc(item.effort)}</span>
        </div>
        <h3 class="mt-1.5 font-bold leading-snug text-slate-900 dark:text-white" id="pt-${item.id}">${esc(item.title)}</h3>
        <p class="mt-2 hidden rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300" data-ref="flag"></p>
        <p class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="text-xl font-extrabold tabular-nums" data-ref="monthly"></span>
          <span class="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300" data-ref="annual"></span>
        </p>
        <p class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs muted">
          <span class="inline-flex items-center gap-1">${icon('tag', 'h-3.5 w-3.5')}Upfront: <strong class="font-semibold text-slate-800 dark:text-slate-200" data-ref="upfront"></strong></span>
          <span class="inline-flex items-center gap-1">${icon('clock', 'h-3.5 w-3.5')}Payback: <strong class="font-semibold text-slate-800 dark:text-slate-200" data-ref="payback"></strong></span>
        </p>
      </div>
      <div class="flex shrink-0 flex-col items-center gap-1">
        <button type="button" role="switch" class="switch tap" data-ref="switch" aria-labelledby="pl-${item.id} pt-${item.id}"></button>
        <span id="pl-${item.id}" class="text-[11px] font-semibold muted">I'll do this</span>
      </div>
    </div>

    <div class="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2 dark:border-slate-800">
      <label for="pr-${item.id}" class="shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-300">Estimate</label>
      <input id="pr-${item.id}" type="range" class="range min-w-0 flex-1" min="0" step="1" data-ref="slider" aria-describedby="ph-${item.id}">
      <output for="pr-${item.id}" class="w-12 shrink-0 rounded-lg bg-slate-100 py-0.5 text-center text-sm font-bold tabular-nums text-slate-900 dark:bg-slate-800 dark:text-white" data-ref="pctOut"></output>
      <button type="button" class="btn-icon -mr-2 shrink-0" data-ref="resetPct" aria-label="Reset estimate to default">${icon('refresh', 'icon-sm')}</button>
    </div>
    <p id="ph-${item.id}" class="-mt-1 text-xs muted" data-ref="pctHint"></p>

    <details class="group mt-1">
      <summary class="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300 [&::-webkit-details-marker]:hidden">
        Why &amp; how to do it ${icon('chevron-down', 'icon-sm chev group-open:rotate-180')}
      </summary>
      <p class="text-sm muted" data-ref="desc"></p>
      <ul class="mt-3 space-y-2" data-ref="tips"></ul>
    </details>`;

  const ref = (name) => el.querySelector(`[data-ref="${name}"]`);
  el.refs = {};
  for (const n of ['iconBox', 'flag', 'switch', 'monthly', 'annual', 'upfront', 'payback', 'pctOut', 'resetPct', 'slider', 'pctHint', 'desc', 'tips']) el.refs[n] = ref(n);

  el.refs.switch.addEventListener('click', () => {
    const on = el.refs.switch.getAttribute('aria-checked') !== 'true';
    setState((s) => { s.plan.committed[item.id] = on; });
  });
  el.refs.slider.addEventListener('input', () => {
    const v = Number(el.refs.slider.value) / 100;
    setState((s) => { s.plan.pct[item.id] = v; }, { reason: 'input' });
  });
  el.refs.resetPct.addEventListener('click', () => {
    setState((s) => { delete s.plan.pct[item.id]; });
    el.refs.slider.focus();
  });
  return el;
}

function updateCard(el, item, view) {
  const r = el.refs;
  setAttr(r.switch, 'aria-checked', String(item.committed));
  el.classList.toggle('opacity-70', !item.committed);
  r.iconBox.className = `grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.committed
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`;

  r.flag.hidden = !item.flag;
  r.flag.classList.toggle('hidden', !item.flag);
  setText(r.flag, item.flag || '');

  const other = view.f === 12 ? `${view.raw(item.monthly)}/mo` : `${view.raw(item.annual)}/yr`;
  setText(r.monthly, `${view.m(item.monthly)}${view.per}`);
  r.monthly.className = `text-xl font-extrabold tabular-nums ${item.committed ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`;
  setText(r.annual, other);
  setText(r.upfront, item.upfront > 0 ? view.raw(item.upfront) : 'None');
  setText(r.payback, item.upfront > 0 ? (Number.isFinite(item.payback) ? duration(item.payback) : 'n/a') : 'Immediate');

  const pctInt = Math.round(item.pct * 100);
  const max = Math.round(item.maxPct * 100);
  setText(r.pctOut, `${pctInt}%`);
  setAttr(r.slider, 'max', max);
  if (document.activeElement !== r.slider) r.slider.value = pctInt;
  r.slider.style.setProperty('--fill', `${max ? (pctInt / max) * 100 : 0}%`);
  setAttr(r.slider, 'aria-valuetext', `${pctInt}% of ${view.raw(item.base)} per month`);
  const isDefault = Math.abs(item.pct - item.defaultPct) < 0.005;
  r.resetPct.classList.toggle('invisible', isDefault);
  r.resetPct.tabIndex = isDefault ? -1 : 0;
  setText(r.pctHint, `${pctInt}% of ${view.m(item.base)}${view.per}${isDefault ? ' (default)' : ` · default ${Math.round(item.defaultPct * 100)}%`}`);

  setText(r.desc, item.description);
  setHTML(r.tips, item.tips.map((t) => `<li class="flex gap-2.5 text-sm text-slate-700 dark:text-slate-300">${icon('check', 'icon-sm mt-0.5 text-emerald-600 dark:text-emerald-400')}<span>${esc(t)}</span></li>`).join(''));
}

export function renderPlan(state, result, view) {
  const list = $('planList');
  const items = [...result.plan].sort((a, b) =>
    state.plan.sort === 'easy'
      ? EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] || b.monthly - a.monthly
      : b.monthly - a.monthly
  );

  // Remove cards for rules that no longer fire
  const live = new Set(items.map((i) => i.id));
  for (const [id, el] of cards) if (!live.has(id)) { el.remove(); cards.delete(id); }

  items.forEach((item, idx) => {
    let el = cards.get(item.id);
    if (!el) { el = createCard(item); cards.set(item.id, el); }
    updateCard(el, item, view);
    if (list.children[idx] !== el) list.insertBefore(el, list.children[idx] || null);
  });

  const committed = items.filter((i) => i.committed).length;
  setText($('planCount'), items.length ? `${committed} of ${items.length} actions committed` : '');
  $('planEmpty').hidden = items.length > 0;
  $('planToolbar').hidden = items.length === 0;
}

export function initPlan() {
  const sort = $('planSort');
  sort.addEventListener('change', () => setState((s) => { s.plan.sort = sort.value; }));
  $('btnCommitAll').addEventListener('click', () => setState((s) => {
    for (const id of [...cards.keys()]) s.plan.committed[id] = true;
  }));
  $('btnCommitNone').addEventListener('click', () => setState((s) => {
    for (const id of [...cards.keys()]) s.plan.committed[id] = false;
  }));
}

export function syncPlanControls(state) {
  $('planSort').value = state.plan.sort;
}
