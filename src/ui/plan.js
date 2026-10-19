// "Ways to spend less": each idea is one short row (switch, bill, saving).
// "Details" opens the before/after, the "how did we get this" sum, tips and
// the slider. Rows are keyed and updated in place, so sliders keep focus.
// The three biggest savings (easiest first) form "Top 3 things to do first";
// everything else sits under "More ideas".

import { setState } from '../state.js';
import { EFFORT_ORDER } from '../engine/rules.js';
import { duration, pctWords } from '../utils/format.js';
import { $, icon, esc, setText, setHTML, setAttr } from './dom.js';
import { helpBtn } from './help.js';
import { t, getLanguage } from '../i18n/index.js';

const rows = new Map(); // rule id -> element
const EFFORT_PILL = {
  Easy: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Medium: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'Requires purchase': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
};
// Display keys for the effort values stored on each rule (the values stay English for logic)
const EFFORT_KEY = { Easy: 'easy', Medium: 'medium', 'Requires purchase': 'purchase' };
let rowsLang = null; // language the rows were built in; rebuilt when it changes
const open = new Set(); // ids whose details are expanded
const MORE_VISIBLE = 4; // "More ideas" rows shown before "Show N more"
let showAllMore = false;

/** The "How did we get this?" paragraph, in plain words with the real sums. */
export function explain(item, view) {
  const P = Math.round(item.pct * 100);
  const D = Math.round(item.defaultPct * 100);
  const words = pctWords(item.defaultPct);
  if (item.kind === 'interest') {
    return t(P !== D ? 'plan.explain.interestChosen' : 'plan.explain.interest', { base: view.m(item.base), evidence: item.evidence, words, pct: P, monthly: view.s(item.monthly) });
  }
  const start = t('plan.explain.start', { amount: view.m(item.rawBase), noun: item.noun });
  const stacked = item.stacked ? ` ${t('plan.explain.stacked', { amount: view.m(item.base) })}` : '';
  const evidence = t(D === 100 ? 'plan.explain.evidence' : 'plan.explain.evidenceOfThis', { evidence: item.evidence, words });
  const chosen = P !== D ? ` ${t('plan.explain.chosen', { pct: P })}` : '';
  return `${start}${stacked} ${evidence}${chosen} ${t('plan.explain.sum', { pct: P, base: view.m(item.base), monthly: view.s(item.monthly) })}`;
}

function createRow(item) {
  const el = document.createElement('article');
  el.className = 'py-4';
  el.dataset.id = item.id;
  el.id = `plan-${item.id}`;
  el.innerHTML = `
    <div class="flex items-start gap-3">
      <button type="button" role="switch" class="switch-btn -mt-2.5 flex-col items-center gap-0" data-ref="switch">
        <span class="switch" aria-hidden="true"></span>
        <span class="text-[11px] font-medium" data-ref="switchText"></span>
      </button>
      <div class="min-w-0 flex-1">
        <h5 class="flex items-center gap-2 font-semibold text-slate-900 dark:text-white" id="pl-${item.id}">${icon(item.icon, 'icon-sm text-slate-400')}${esc(item.label)}</h5>
        <p class="text-sm text-slate-700 dark:text-slate-300">${esc(item.title)}</p>
        <p class="mt-1.5 flex flex-wrap items-center gap-2 text-xs" data-ref="meta"></p>
      </div>
      <div class="shrink-0 text-right">
        <p class="whitespace-nowrap font-semibold tabular-nums" data-ref="headline"></p>
        <button type="button" class="-mr-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm link" data-ref="toggle" aria-expanded="false" aria-controls="pd-${item.id}">
          ${t('plan.details')} ${icon('chevron-down', 'icon-sm chev')}
        </button>
      </div>
    </div>

    <div id="pd-${item.id}" hidden class="mt-3 space-y-4 rounded-xl bg-slate-50 p-4 text-sm sm:ml-14 dark:bg-slate-800/50" data-ref="panel">
      <p class="muted" data-ref="why"></p>
      <p class="hidden font-medium text-rose-700 dark:text-rose-400" data-ref="flag"></p>

      <dl class="divide-y divide-slate-100 border-y border-slate-100 dark:divide-slate-800 dark:border-slate-800">
        <div class="flex justify-between gap-3 py-2"><dt class="muted" data-ref="nowLabel">${t('plan.youSpend')}</dt><dd class="tabular-nums" data-ref="now"></dd></div>
        <div class="flex justify-between gap-3 py-2"><dt class="muted" data-ref="afterLabel">${t('plan.youCouldSpend')}</dt><dd class="tabular-nums" data-ref="after"></dd></div>
        <div class="flex flex-wrap justify-between gap-x-3 py-2"><dt class="font-medium text-slate-900 dark:text-white" data-ref="saveLabel">${t('plan.youSave')}</dt>
          <dd class="tabular-nums"><span class="font-semibold" data-ref="save"></span> <span class="muted" data-ref="saveYear"></span></dd></div>
      </dl>
      <p class="hidden muted" data-ref="interestNote"></p>
      <p class="text-slate-700 dark:text-slate-300" data-ref="cost"></p>

      <div>
        <p class="font-medium text-slate-900 dark:text-white">${t('plan.whatToDo')}</p>
        <ul class="mt-1 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300" data-ref="tips"></ul>
      </div>

      <div>
        <p class="font-medium text-slate-900 dark:text-white">${t('plan.howDidWeGetThis')}</p>
        <p class="mt-1 leading-relaxed text-slate-700 dark:text-slate-300" data-ref="how"></p>
      </div>

      <div>
        <div class="flex items-center gap-2">
          <label for="pr-${item.id}" class="font-medium text-slate-900 dark:text-white">${t('plan.howMuchCut')}</label>
          ${helpBtn('cut', t('plan.howMuchCut'))}
        </div>
        <div class="flex items-center gap-3">
          <input id="pr-${item.id}" type="range" class="range min-w-0 flex-1" min="0" step="1" data-ref="slider" aria-describedby="ph-${item.id}">
          <output for="pr-${item.id}" class="w-12 shrink-0 text-right font-semibold tabular-nums text-slate-900 dark:text-white" data-ref="pctOut"></output>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p id="ph-${item.id}" class="text-xs muted" data-ref="pctHint">${t('plan.keepSuggestion')}</p>
          <button type="button" class="min-h-11 text-xs link" data-ref="resetPct">${t('plan.useSuggestion')}</button>
        </div>
      </div>
    </div>`;

  const refs = {};
  el.querySelectorAll('[data-ref]').forEach((n) => { refs[n.dataset.ref] = n; });
  el.refs = refs;

  refs.switch.addEventListener('click', () => {
    const on = refs.switch.getAttribute('aria-checked') !== 'true';
    setState((s) => { s.plan.committed[item.id] = on; });
  });
  refs.toggle.addEventListener('click', () => {
    open.has(item.id) ? open.delete(item.id) : open.add(item.id);
    setOpen(el, open.has(item.id));
  });
  refs.slider.addEventListener('input', () => {
    const v = Number(refs.slider.value) / 100;
    setState((s) => { s.plan.pct[item.id] = v; }, { reason: 'input' });
  });
  refs.resetPct.addEventListener('click', () => {
    setState((s) => { delete s.plan.pct[item.id]; });
    refs.slider.focus();
  });
  return el;
}

function setOpen(el, isOpen) {
  el.refs.panel.hidden = !isOpen;
  setAttr(el.refs.toggle, 'aria-expanded', String(isOpen));
}

function updateRow(el, item, view) {
  const r = el.refs;
  const on = item.committed;
  const interest = item.kind === 'interest';

  setAttr(r.switch, 'aria-checked', String(on));
  setAttr(r.switch, 'aria-label', t('plan.addToPlan', { label: item.label }));
  setText(r.switchText, on ? t('plan.added') : t('plan.notAdded'));
  r.switchText.className = `text-[11px] font-medium ${on ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`;

  const costShort = item.upfront > 0 ? t('plan.costsOnce', { amount: view.raw(item.upfront) }) : t('plan.noCost');
  setHTML(r.meta, `<span class="rounded-full px-2 py-0.5 font-medium ${EFFORT_PILL[item.effort]}">${esc(t(`plan.effort.${EFFORT_KEY[item.effort]}`))}</span><span class="muted">${esc(costShort)}</span>`);

  // Headline amount: green when it counts towards savings, grey when it doesn't
  setHTML(r.headline, `${interest ? `<span class="text-xs font-normal muted">${t('plan.avoid')} </span>` : ''}${view.tag(view.s(item.monthly), item.monthly * view.f)}<span class="text-xs font-normal muted">${view.per}</span>`);
  r.headline.className = `whitespace-nowrap font-semibold tabular-nums ${on && !interest ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`;

  setOpen(el, open.has(item.id));
  setText(r.why, item.why);
  r.flag.classList.toggle('hidden', !item.flag);
  setText(r.flag, item.flag || '');

  setText(r.nowLabel, interest ? t('plan.interestNow') : t('plan.youSpend'));
  setText(r.afterLabel, interest ? t('plan.interestAfter') : t('plan.youCouldSpend'));
  setText(r.saveLabel, interest ? t('plan.interestAvoid') : t('plan.youSave'));
  setHTML(r.now, `${view.tag(view.m(item.rawBase), item.rawBase * view.f)}${view.per}`);
  setHTML(r.after, `${view.tag(view.s(item.rawBase - item.monthly), (item.rawBase - item.monthly) * view.f)}${view.per}`);
  setHTML(r.save, `${view.tag(view.s(item.monthly), item.monthly * view.f)}${view.per}`);
  setText(r.saveYear, view.f === 12 ? t('plan.perMonthParen', { amount: view.rawS(item.monthly) }) : t('plan.perYearParen', { amount: view.rawS(item.annual) }));
  r.interestNote.classList.toggle('hidden', !interest);
  setText(r.interestNote, interest ? t('plan.interestNote') : '');

  setText(r.cost, item.upfront > 0
    ? t('plan.costPayback', { amount: view.raw(item.upfront), time: Number.isFinite(item.payback) ? duration(item.payback) : t('plan.longTime') })
    : t('plan.noCostRightAway'));

  setHTML(r.tips, item.tips.map((t) => `<li>${esc(t)}</li>`).join(''));
  setText(r.how, explain(item, view));

  const pctInt = Math.round(item.pct * 100);
  const max = Math.round(item.maxPct * 100);
  setText(r.pctOut, `${pctInt}%`);
  setAttr(r.slider, 'max', max);
  if (document.activeElement !== r.slider) r.slider.value = pctInt;
  r.slider.style.setProperty('--fill', `${max ? (pctInt / max) * 100 : 0}%`);
  setAttr(r.slider, 'aria-valuetext', t('plan.sliderValue', { pct: pctInt, amount: view.s(item.monthly), per: view.per }));
  const isDefault = Math.abs(item.pct - item.defaultPct) < 0.005;
  r.resetPct.hidden = isDefault;
  setText(r.pctHint, isDefault ? t('plan.keepSuggestion') : t('plan.ourSuggestion', { pct: Math.round(item.defaultPct * 100) }));
}

/** Biggest three cash savings, with the easiest of those first. */
export function topThree(plan) {
  return [...plan].filter((p) => p.kind === 'cash' && p.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly).slice(0, 3)
    .sort((a, b) => EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] || b.monthly - a.monthly);
}

function place(container, items) {
  items.forEach((item, idx) => {
    const el = rows.get(item.id);
    if (container.children[idx] !== el) container.insertBefore(el, container.children[idx] || null);
  });
}

export function renderPlan(state, result, view) {
  // Rows keep their static text, so build them again after a language change
  if (rowsLang !== getLanguage()) {
    for (const el of rows.values()) el.remove();
    rows.clear();
    rowsLang = getLanguage();
  }
  const live = new Set(result.plan.map((i) => i.id));
  for (const [id, el] of rows) if (!live.has(id)) { el.remove(); rows.delete(id); open.delete(id); }

  for (const item of result.plan) {
    let el = rows.get(item.id);
    if (!el) { el = createRow(item); rows.set(item.id, el); }
    updateRow(el, item, view);
  }

  const top = topThree(result.plan);
  const topIds = new Set(top.map((t) => t.id));
  const rest = result.plan.filter((p) => !topIds.has(p.id)).sort((a, b) =>
    state.plan.sort === 'easy'
      ? EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] || b.monthly - a.monthly
      : b.monthly - a.monthly);

  place($('planTop'), top);
  place($('planList'), rest);
  // Keep the list short: only the first few "More ideas" until asked
  rest.forEach((item, i) => { rows.get(item.id).hidden = !showAllMore && i >= MORE_VISIBLE; });
  const hiddenCount = Math.max(0, rest.length - MORE_VISIBLE);
  const more = $('planShowMore');
  more.hidden = hiddenCount === 0;
  setText(more, showAllMore ? t('plan.showFewer') : t('plan.showMore', { count: hiddenCount }));
  setAttr(more, 'aria-expanded', String(showAllMore));
  for (const item of top) rows.get(item.id).hidden = false;

  const committed = result.plan.filter((i) => i.committed).length;
  setText($('planCount'), result.plan.length ? t('plan.count', { done: committed, total: result.plan.length }) : '');
  $('planEmpty').hidden = result.plan.length > 0;
  $('planTop').hidden = top.length === 0;
  $('planTop').previousElementSibling.hidden = top.length === 0;
  $('planMoreWrap').hidden = rest.length === 0;
}

export function initPlan() {
  const sort = $('planSort');
  sort.addEventListener('change', () => setState((s) => { s.plan.sort = sort.value; }));
  $('planShowMore').addEventListener('click', () => {
    showAllMore = !showAllMore;
    setState(() => {}, { reason: 'change', persist: false });
  });
}

export function syncPlanControls(state) {
  $('planSort').value = state.plan.sort;
}
