// "Ways to spend less": each idea is one short row (switch, bill, saving).
// "Details" opens the before/after, the "how did we get this" sum, tips and
// the slider. Rows are keyed and updated in place, so sliders keep focus.
// The three biggest savings (easiest first) form "Top 3 things to do first";
// everything else sits under "More ideas".
//
// When the switched-on ideas still leave less than 10% of income to save, the
// rows become bills instead: each bill's ideas and its spending limit (worked
// out on what the ideas leave) as one saving, biggest first. A bar at the top
// shows how close the whole plan gets to fitting the income.

import { setState } from '../state.js';
import { EFFORT_ORDER } from '../engine/rules.js';
import { SAVE_TARGET, limitKey } from '../engine/balance.js';
import { PROFILES } from '../engine/profiles.js';
import { duration, pctWords, withSign } from '../utils/format.js';
import { $, icon, esc, setText, setHTML, setAttr } from './dom.js';
import { helpBtn } from './help.js';
import { t, has, getLanguage } from '../i18n/index.js';
import { GROUPS } from './inputs.js';
import { localFields } from '../engine/calculate.js';

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
      <div class="shrink-0 text-end">
        <p class="whitespace-nowrap font-semibold tabular-nums" data-ref="headline"></p>
        <button type="button" class="-me-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm link" data-ref="toggle" aria-expanded="false" aria-controls="pd-${item.id}">
          ${t('plan.details')} ${icon('chevron-down', 'icon-sm chev')}
        </button>
      </div>
    </div>

    <div id="pd-${item.id}" hidden class="mt-3 space-y-4 rounded-xl bg-slate-50 p-4 text-sm sm:ms-14 dark:bg-slate-800/50" data-ref="panel">
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
        <ul class="mt-1 list-disc space-y-1 ps-5 text-slate-700 dark:text-slate-300" data-ref="tips"></ul>
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
          <output for="pr-${item.id}" class="w-12 shrink-0 text-end font-semibold tabular-nums text-slate-900 dark:text-white" data-ref="pctOut"></output>
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

/** Puts exactly these elements in the container, in this order. */
function place(container, els) {
  els.forEach((el, idx) => {
    if (container.children[idx] !== el) container.insertBefore(el, container.children[idx] || null);
  });
  while (container.children.length > els.length) container.lastElementChild.remove();
}

// ---------------- Fitting the income ----------------
/** Goal bar: spend at most 90% of income; how much of the cut that needs the plan covers. */
function renderFit(result, view) {
  const { income, spend } = result.totals;
  const target = income * (1 - SAVE_TARGET);
  const box = $('planFit');
  box.hidden = !(income > 0 && spend > target);
  if (box.hidden) return;
  const needed = spend - target;
  const done = Math.min(needed, result.savings);
  const reached = result.optimized <= target + 0.5;
  const pct = Math.round(SAVE_TARGET * 100);
  setText($('planFitTitle'), t('plan.fit.title', { amount: view.m(target), per: view.per }));
  setText($('planFitText'), t('plan.fit.text', { income: view.m(income), pct, done: view.s(done), needed: view.m(needed) }));
  setText($('planFitStatus'), reached ? t('plan.fit.reached') : t('plan.fit.toGo', { amount: view.s(result.optimized - target), per: view.per }));
  setText($('planFitSteps'), t('plan.fit.steps', { now: view.m(spend), plan: view.s(result.optimized), per: view.per }));
  $('planFitStatus').className = `text-sm font-semibold tabular-nums ${reached ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`;
  box.className = `mt-5 rounded-xl border px-4 py-4 ${reached
    ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40'
    : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/40'}`;
  $('planFitBar').style.width = `${Math.max(2, (done / needed) * 100)}%`;
  $('planFitBar').className = `h-full rounded-full transition-all duration-300 ${reached ? 'bg-emerald-600' : 'bg-amber-500'}`;
}

/** A limit's name: an input field, the country's own bill, subscriptions or a custom expense. */
export function limitLabel(line, country) {
  if (line.field) return t(`inputs.fields.${line.field}.label`);
  if (line.local) {
    const k = `countryFields.${country}.${line.local}.label`;
    return has(k) ? t(k) : line.localLabel;
  }
  if (line.id === 'subscriptions') return t('calc.categories.subscriptions');
  return line.customName || t('calc.otherCosts');
}

/** Why this bill has a limit, from the household's own numbers. */
function limitReason(l, state, view, income) {
  const group = PROFILES[state.profile].group;
  if (l.reason === 'big') return t('plan.limits.reason.big', { pct: Math.round((l.entered / income) * 100) });
  if (l.times != null) {
    const range = `${view.m(l.range[0])}–${view.m(l.range[1])}`;
    const text = l.times >= 2
      ? t('plan.limits.reason.times', { times: Math.round(l.times * 10) / 10, group, range })
      : t('plan.limits.reason.over', { group, range });
    return l.check ? `${text} ${t('plan.limits.reason.check')}` : text;
  }
  return t(`plan.limits.reason.${l.reason === 'want' ? 'want' : 'trim'}`);
}

/** Names of the bills the limits leave alone: field labels or category names. */
function keptLabel(k) {
  if (k.field) return t(`inputs.fields.${k.field}.label`);
  if (k.id === 'debt') return t('calc.categories.debt');
  if (k.id === 'yearly') return t('calc.categories.yearly');
  return t('subs.kinds.tools.label');
}

// ---------------- Bill by bill ----------------
// When the ideas alone don't fit the income, each row is one bill: the ideas
// that work on it and its spending limit, as one number. Details shows why,
// what to do, and each part with its own switch.

const billEls = new Map(); // row id -> element
let lastBills = [];

const FIELD_ICON = Object.fromEntries(GROUPS.flatMap((g) => (g.fields || []).map((f) => [f.key, f.icon])));

function billLabel(row, state) {
  if (row.line) return limitLabel(row.line, state.country);
  if (row.key === 'subscriptions') return t('calc.categories.subscriptions');
  if (has(`inputs.fields.${row.key}.label`)) return t(`inputs.fields.${row.key}.label`);
  const local = localFields(state.country).find((f) => f.key === row.key);
  const k = `countryFields.${state.country}.${row.key}.label`;
  return has(k) ? t(k) : local?.label || row.key;
}

const switchHtml = (attrs, on, label, withText) => `
  <button type="button" role="switch" class="switch-btn ${withText ? '-mt-2.5 flex-col items-center gap-0' : 'shrink-0'}" ${attrs} aria-checked="${on}" aria-label="${esc(label)}">
    <span class="switch" aria-hidden="true"></span>
    ${withText ? `<span class="text-[11px] font-medium ${on ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}">${esc(on ? t('plan.added') : t('plan.notAdded'))}</span>` : ''}
  </button>`;

function billHtml(row, state, view, income) {
  const label = billLabel(row, state);
  const on = row.committed;
  const isOpen = open.has(row.id);
  const amount = on ? row.monthly : row.potential;
  const arrow = document.dir === 'rtl' ? '←' : '→';
  const l = row.line;
  // Under the name: why this bill (its limit's reason, or the main idea); the
  // now → after line below already says how far
  const sub = l ? limitReason(l, state, view, income) : row.ideas[0]?.title || '';
  const why = row.ideas.find((p) => p.committed)?.why || row.ideas[0]?.why || '';
  const tips = [...new Set([...(l ? [t(`plan.limits.tips.${l.tip}`)] : []), ...row.ideas.flatMap((p) => p.tips.slice(0, 2))])].slice(0, 5);
  const parts = [
    ...row.ideas.map((p) => ({ attrs: `data-part="idea" data-id="${esc(p.id)}"`, on: p.committed, name: `${p.label}: ${p.title}`, amount: p.monthly })),
    ...(l ? [{ attrs: `data-part="limit" data-id="${esc(row.key)}"`, on: l.committed, name: t('plan.bills.limitPart', { amount: view.s(l.aim), per: view.per }), amount: l.cut }] : [])
  ];
  const after = on ? row.after : row.entered - row.potential;
  return `
    <div class="flex items-start gap-3">
      ${switchHtml(`data-bill-switch="${esc(row.key)}"`, on, t('plan.addToPlan', { label }), true)}
      <div class="min-w-0 flex-1">
        <h5 class="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">${icon(FIELD_ICON[row.key] || (row.key === 'subscriptions' ? 'repeat' : 'list-check'), 'icon-sm text-slate-400')}${esc(label)}</h5>
        <p class="text-sm ${l?.check ? 'font-medium text-amber-800 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'}">${esc(sub)}</p>
        <p class="mt-1.5 text-xs tabular-nums muted">${esc(view.m(row.entered))} ${arrow} <strong class="font-semibold text-slate-900 dark:text-white">${esc(view.s(after))}</strong>${view.per}</p>
      </div>
      <div class="shrink-0 text-end">
        <p class="whitespace-nowrap font-semibold tabular-nums ${on ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}">${view.tag(view.s(amount), amount * view.f)}<span class="text-xs font-normal muted">${view.per}</span></p>
        <button type="button" class="-me-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm link" data-bill-toggle="${esc(row.key)}" aria-expanded="${isOpen}" aria-controls="bd-${esc(row.key)}">
          ${t('plan.details')} ${icon('chevron-down', 'icon-sm chev')}
        </button>
      </div>
    </div>
    <div id="bd-${esc(row.key)}" ${isOpen ? '' : 'hidden'} class="mt-3 space-y-4 rounded-xl bg-slate-50 p-4 text-sm sm:ms-14 dark:bg-slate-800/50">
      ${why ? `<p class="muted">${esc(why)}</p>` : ''}
      <dl class="divide-y divide-slate-100 border-y border-slate-100 dark:divide-slate-800 dark:border-slate-800">
        <div class="flex justify-between gap-3 py-2"><dt class="muted">${t('plan.youSpend')}</dt><dd class="tabular-nums">${view.tag(view.m(row.entered), row.entered * view.f)}${view.per}</dd></div>
        <div class="flex justify-between gap-3 py-2"><dt class="muted">${t('plan.youCouldSpend')}</dt><dd class="tabular-nums">${view.tag(view.s(after), after * view.f)}${view.per}</dd></div>
        <div class="flex flex-wrap justify-between gap-x-3 py-2"><dt class="font-medium text-slate-900 dark:text-white">${t('plan.youSave')}</dt>
          <dd class="tabular-nums"><span class="font-semibold">${view.tag(view.s(amount), amount * view.f)}${view.per}</span> <span class="muted">${esc(view.f === 12 ? t('plan.perMonthParen', { amount: view.rawS(amount) }) : t('plan.perYearParen', { amount: view.rawS(amount * 12) }))}</span></dd></div>
      </dl>
      ${tips.length ? `<div>
        <p class="font-medium text-slate-900 dark:text-white">${t('plan.whatToDo')}</p>
        <ul class="mt-1 list-disc space-y-1 ps-5 text-slate-700 dark:text-slate-300">${tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>` : ''}
      <div>
        <p class="font-medium text-slate-900 dark:text-white">${t('plan.bills.parts')}</p>
        <ul class="mt-2 space-y-2">${parts.map((p) => `
          <li class="flex items-center gap-3">
            ${switchHtml(p.attrs, p.on, p.name, false)}
            <span class="min-w-0 flex-1 text-slate-700 dark:text-slate-300">${esc(p.name)}</span>
            <span class="shrink-0 tabular-nums ${p.on ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'muted'}">${esc(withSign('−', view.s(p.amount)))}${view.per}</span>
          </li>`).join('')}</ul>
      </div>
    </div>`;
}

/** The focused control inside the plan rows, so it can get focus back after a rebuild. */
function focusedControl() {
  const a = document.activeElement;
  if (!a?.closest?.('#plan')) return null;
  for (const k of ['billSwitch', 'billToggle', 'part']) if (a.dataset?.[k] != null) return `[data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${CSS.escape(a.dataset[k])}"]${k === 'part' ? `[data-id="${CSS.escape(a.dataset.id)}"]` : ''}`;
  return null;
}

/** One element per bill row, rebuilt in place (so its position and the open state stay). */
function billElements(bills, state, view, income) {
  const live = new Set(bills.map((b) => b.id));
  for (const [id, el] of billEls) if (!live.has(id)) { el.remove(); billEls.delete(id); }
  return bills.map((row) => {
    let el = billEls.get(row.id);
    if (!el) {
      el = document.createElement('article');
      el.className = 'py-4';
      el.id = `plan-${row.id.replace(':', '-')}`;
      billEls.set(row.id, el);
    }
    el.innerHTML = billHtml(row, state, view, income);
    return el;
  });
}

/** Where the plan leaves the month, bigger changes and what's left alone (bill-by-bill mode). */
function renderLimits(result, view) {
  const b = result.balance;
  $('planLimits').hidden = !b;
  if (!b) return;
  const pct = Math.round(SAVE_TARGET * 100);
  const anyOn = (result.bills || []).some((r) => r.committed);
  const res = { spend: view.s(b.newSpend), save: view.s(Math.max(0, b.toSave)), short: view.s(Math.max(0, -b.toSave)), per: view.per, pct };
  setText($('limitsResult'), anyOn ? t(`plan.limits.result.${b.outcome}`, res) : t('plan.limits.result.none'));
  $('limitsResult').className = `rounded-xl px-4 py-3 text-sm ${b.outcome === 'reached'
    ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
    : 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'}`;
  // Bigger changes, only for what this household has
  $('limitsBigger').hidden = !b.bigger.length;
  setHTML($('limitsBiggerList'), b.bigger.map((c) => `<li class="flex gap-2"><span class="text-slate-400" aria-hidden="true">•</span><span>${esc(t(`plan.limits.bigger.${c.key}`, {
    amount: view.s(c.amount), per: view.per, pct: c.share != null ? Math.round(c.share * 100) : ''
  }))}</span></li>`).join(''));
  const kept = b.kept.map(keptLabel);
  const list = kept.length ? new Intl.ListFormat(getLanguage(), { type: 'conjunction' }).format(kept) : '';
  setText($('limitsNote'), [kept.length ? t('plan.limits.kept', { list }) : '', t('plan.limits.startingPoint')].filter(Boolean).join(' '));
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

  const bills = result.bills;
  lastBills = bills || [];
  const focus = focusedControl();
  let top;
  let rest;
  let count;
  if (bills) {
    // Bill by bill, biggest saving first; ideas that save interest keep their own rows
    const others = result.plan.filter((p) => p.kind !== 'cash');
    const els = billElements(bills, state, view, result.totals.income);
    const all = [
      ...bills.map((b, i) => ({ el: els[i], amount: b.potential })),
      ...others.map((p) => ({ el: rows.get(p.id), amount: p.monthly }))
    ].sort((a, b) => b.amount - a.amount).map((x) => x.el);
    top = all.slice(0, 3);
    rest = all.slice(3);
    count = { done: bills.filter((b) => b.committed).length + others.filter((p) => p.committed).length, total: bills.length + others.length };
  } else {
    for (const el of billEls.values()) el.remove();
    billEls.clear();
    const topItems = topThree(result.plan);
    const topIds = new Set(topItems.map((x) => x.id));
    top = topItems.map((p) => rows.get(p.id));
    rest = result.plan.filter((p) => !topIds.has(p.id)).sort((a, b) =>
      state.plan.sort === 'easy'
        ? EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] || b.monthly - a.monthly
        : b.monthly - a.monthly).map((p) => rows.get(p.id));
    count = { done: result.plan.filter((i) => i.committed).length, total: result.plan.length };
  }

  place($('planTop'), top);
  place($('planList'), rest);
  if (focus) document.querySelector(`#plan ${focus}`)?.focus();
  // Keep the list short: only the first few "More ideas" until asked
  rest.forEach((el, i) => { el.hidden = !showAllMore && i >= MORE_VISIBLE; });
  top.forEach((el) => { el.hidden = false; });
  const hiddenCount = Math.max(0, rest.length - MORE_VISIBLE);
  const more = $('planShowMore');
  more.hidden = hiddenCount === 0;
  const words = bills ? 'plan.bills' : 'plan';
  setText(more, showAllMore ? t(`${words}.showFewer`) : t(`${words}.showMore`, { count: hiddenCount }));
  setAttr(more, 'aria-expanded', String(showAllMore));

  // The page's own text (in the HTML) for ideas; the bill-by-bill text beside it
  $('planIntro').hidden = !!bills;
  $('planBillsIntro').hidden = !bills;
  setText($('planBillsIntro'), t('plan.bills.intro'));
  $('planMoreTitle').hidden = !!bills;
  $('planMoreBills').hidden = !bills;
  setText($('planMoreBills'), t('plan.bills.more'));
  $('planSortWrap').hidden = !!bills;
  setText($('planCount'), count.total ? t('plan.count', count) : '');
  $('planEmpty').hidden = count.total > 0;
  $('planTop').hidden = top.length === 0;
  $('planTop').previousElementSibling.hidden = top.length === 0;
  $('planMoreWrap').hidden = rest.length === 0;

  renderFit(result, view);
  renderLimits(result, view);
}

export function initPlan() {
  const sort = $('planSort');
  sort.addEventListener('change', () => setState((s) => { s.plan.sort = sort.value; }));
  // Bill rows: the row's switch turns all its parts on or off together
  $('plan').addEventListener('click', (e) => {
    const sw = e.target.closest('[data-bill-switch]');
    const part = e.target.closest('[data-part]');
    const tog = e.target.closest('[data-bill-toggle]');
    if (sw) {
      const row = lastBills.find((b) => b.key === sw.dataset.billSwitch);
      if (!row) return;
      const on = !row.committed;
      setState((s) => {
        for (const p of row.ideas) s.plan.committed[p.id] = on;
        if (row.line) s.plan.committed[limitKey(row.line)] = on;
      });
    } else if (part) {
      const on = part.getAttribute('aria-checked') !== 'true';
      const key = part.dataset.part === 'limit' ? limitKey({ id: part.dataset.id }) : part.dataset.id;
      setState((s) => { s.plan.committed[key] = on; });
    } else if (tog) {
      const id = `bill:${tog.dataset.billToggle}`;
      open.has(id) ? open.delete(id) : open.add(id);
      const isOpen = open.has(id);
      setAttr(tog, 'aria-expanded', String(isOpen));
      $(`bd-${tog.dataset.billToggle}`).hidden = !isOpen;
    }
  });
  $('planShowMore').addEventListener('click', () => {
    showAllMore = !showAllMore;
    setState(() => {}, { reason: 'change', persist: false });
  });
}

export function syncPlanControls(state) {
  $('planSort').value = state.plan.sort;
}
