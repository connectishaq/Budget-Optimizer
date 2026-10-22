// Goals & safety nets: "Where should your savings go?" split, goal planner,
// emergency fund check and debt-free date. Each timeline uses only its own
// share of the monthly savings, so the three always add up.

import { getState, setState } from '../state.js';
import { goalTimeline, emergencyFundStatus, debtFreeComparison, ALLOCATION_PRESETS, BUCKETS, rebalanceAllocation } from '../engine/calculate.js';
import { parseAmount, decimalSeparator, duration, monthsFromNow, pct, oneDecimal } from '../utils/format.js';
import { newId } from '../engine/profiles.js';
import { $, icon, esc, setText, setHTML, setAttr, toast, announce } from './dom.js';
import { t, getLanguage } from '../i18n/index.js';

// Translated where they're read (keys: goals.bucket.* and goals.why.*)
const BUCKET_LABEL = (k) => t(`goals.bucket.${k}`);
const BUCKET_WHY = (k) => t(`goals.why.${k}`);

// ---------------- Savings split ----------------
function renderAllocation(state, result, view) {
  const a = state.allocation;
  const { shares, amounts, inactive, unassigned, monthly } = result.allocation;
  document.querySelectorAll('[data-preset]').forEach((b) => {
    const on = a.preset === b.dataset.preset;
    setText(b, ALLOCATION_PRESETS[b.dataset.preset]?.label ?? b.textContent);
    setAttr(b, 'aria-pressed', String(on));
    b.className = `btn px-3 ${on ? 'btn-primary' : 'btn-secondary'}`;
  });
  for (const k of BUCKETS) {
    const slider = $(`alloc-${k}`);
    if (document.activeElement !== slider) slider.value = a[k];
    slider.style.setProperty('--fill', `${a[k]}%`);
    setText(document.querySelector(`label[for="alloc-${k}"]`), BUCKET_LABEL(k));
    setAttr(slider, 'aria-valuetext', t('goals.alloc.valueText', { pct: a[k], amount: view.rawS(amounts[k]) }));
    setText($(`alloc-${k}-pct`), `${a[k]}%`);
    setText($(`alloc-${k}-amt`), monthly > 0 ? t('goals.alloc.perMonth', { amount: view.rawS(amounts[k]) }) : '—');
  }
  let note;
  if (result.payday?.short > 0) note = t('goals.alloc.noteShort', { amount: view.rawS(result.payday.short) });
  else if (!(monthly > 0)) note = t('goals.alloc.noteNoMoney');
  else if (unassigned) note = t('goals.alloc.noteUnassigned');
  else if (inactive.length) note = t('goals.alloc.noteInactive', { reasons: inactive.map(BUCKET_WHY).reduce((x, y) => t('goals.alloc.and', { a: x, b: y })) });
  else note = t(result.savings > 0 ? 'goals.alloc.noteAfterPlan' : 'goals.alloc.noteAfterBills', { amount: view.rawS(monthly) });
  setText($('allocNote'), note);
  // Hide amount when a bucket is inactive to avoid confusion
  for (const k of BUCKETS) $(`alloc-${k}-amt`).classList.toggle('line-through', inactive.includes(k) && shares[k] === 0);
}

// ---------------- Goal planner ----------------
const goalSig = (goals) => goals.map((g) => g.id).join('|');

/** One-tap goal suggestions (goals.presets.<key>), hidden once a goal has that name. */
export const GOAL_PRESET_KEYS = ['holiday', 'homeDeposit', 'car', 'wedding', 'education', 'gadget'];

function renderGoalChips(state) {
  const have = new Set(state.goals.map((g) => g.name.trim().toLowerCase()));
  const names = GOAL_PRESET_KEYS.map((k) => t(`goals.presets.${k}`)).filter((n) => !have.has(n.toLowerCase()));
  const box = $('goalChips');
  const sig = `${getLanguage()}:${names.join('|')}`;
  if (box.__sig === sig) return;
  box.__sig = sig;
  box.innerHTML = names.map((name) => `<button type="button" class="suggest" data-goal-preset="${esc(name)}">${icon('plus', 'icon-sm')}${esc(name)}</button>`).join('');
  box.hidden = !names.length;
  $('goalChipsLabel').hidden = !names.length;
}

/** Adds a goal and puts the cursor where the next thing to type is. */
function addGoal(name = '') {
  const g = { id: newId('g'), name, target: 0, saved: 0 };
  setState((s) => { s.goals.push(g); });
  requestAnimationFrame(() => document.querySelector(`#g-${g.id}-${name ? 'target' : 'name'}`)?.focus());
}

function goalRow(g, i, all) {
  const name = esc(g.name || t('goals.untitled'));
  return `
  <li class="rounded-xl border border-slate-200 p-3 dark:border-slate-800" data-goal="${g.id}">
    <div class="flex items-center gap-2">
      <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200" aria-hidden="true">${i + 1}</span>
      <label for="g-${g.id}-name" class="min-w-0 flex-1 text-xs font-medium muted">${t('goals.row.name')}</label>
      ${all.length > 1 ? `<button type="button" class="btn-icon shrink-0 cursor-grab touch-none active:cursor-grabbing" data-drag-goal="${g.id}" aria-label="${t('goals.row.drag', { name })}" aria-describedby="goalOrderHint">${icon('grip')}</button>` : ''}
      <button type="button" class="btn-icon shrink-0 hover:text-rose-600" data-remove-goal="${g.id}" aria-label="${t('goals.row.remove', { name: esc(g.name) })}">${icon('trash')}</button>
    </div>
    <input id="g-${g.id}-name" type="text" class="input mt-1" maxlength="60" data-goal-id="${g.id}" data-key="name" value="${esc(g.name)}" placeholder="${t('goals.row.namePlaceholder')}">
    <div class="mt-2 grid grid-cols-2 gap-2">
      <div><label for="g-${g.id}-target" class="mb-1 block text-xs font-medium muted">${t('goals.row.target')}</label>
        <input id="g-${g.id}-target" type="text" inputmode="decimal" class="input font-semibold" data-goal-id="${g.id}" data-key="target" value="${g.target || ''}" placeholder="0" aria-describedby="g-${g.id}-target-msg">
        <p id="g-${g.id}-target-msg" class="mt-1 text-xs font-medium text-rose-700 empty:hidden dark:text-rose-400" aria-live="polite"></p></div>
      <div><label for="g-${g.id}-saved" class="mb-1 block text-xs font-medium muted">${t('goals.row.saved')}</label>
        <input id="g-${g.id}-saved" type="text" inputmode="decimal" class="input font-semibold" data-goal-id="${g.id}" data-key="saved" value="${g.saved || ''}" placeholder="0" aria-describedby="g-${g.id}-saved-msg">
        <p id="g-${g.id}-saved-msg" class="mt-1 text-xs font-medium text-rose-700 empty:hidden dark:text-rose-400" aria-live="polite"></p></div>
    </div>
    <div class="mt-3">
      <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-emerald-500 transition-all" data-goal-bar style="width:0%"></div></div>
      <p class="mt-1.5 text-xs muted" data-goal-status></p>
    </div>
  </li>`;
}

function renderGoalPlanner(state, result, view) {
  const list = $('goalList');
  // The language is part of the signature so the rows' labels follow it
  const sig = `${getLanguage()}:${goalSig(state.goals)}`;
  if (list.__sig !== sig) {
    list.__sig = sig;
    list.innerHTML = state.goals.map(goalRow).join('');
  }
  $('goalOrderHint').hidden = state.goals.length < 2;
  setText($('goalOrderHint'), t('goals.row.orderHint'));
  $('goalEmpty').hidden = state.goals.length > 0;
  renderGoalChips(state);
  const monthly = result.allocation.amounts.goals;
  const timeline = goalTimeline(state.goals, monthly);
  for (const g of timeline) {
    const row = list.querySelector(`[data-goal="${g.id}"]`);
    if (!row) continue;
    row.querySelector('[data-goal-bar]').style.width = `${Math.round(g.progress * 100)}%`;
    let status;
    if (!(g.target > 0)) status = t('goals.status.needTarget');
    else if (g.remaining === 0) status = t('goals.status.done');
    else if (!g.reachable) status = t('goals.status.unreachable', { pct: pct(g.progress) });
    else status = t('goals.status.progress', { pct: pct(g.progress), remaining: view.raw(g.remaining), time: duration(g.months), date: monthsFromNow(g.months) });
    setText(row.querySelector('[data-goal-status]'), status);
  }
  const open = timeline.filter((g) => g.target > 0 && g.remaining > 0);
  setText($('goalBasis'), monthly > 0
    ? t('goals.basis.putting', { amount: view.rawS(monthly) })
    : !state.goals.length || open.length ? t('goals.basis.giveShare')
      : state.goals.some((g) => !(g.target > 0)) ? t('goals.basis.typeEach')
        : t('goals.basis.allSaved'));
}

// ---------------- Emergency fund ----------------
function renderEmergency(state, result, view) {
  const monthly = result.allocation.amounts.emergency;
  const e = emergencyFundStatus(result.totals.needs, result.totals.values.emergencyFund, monthly);
  if (!(e.essentials > 0)) {
    setHTML($('emergencyBody'), `<p class="text-sm muted">${t('goals.emergency.needBills')}</p>`);
    return;
  }
  const bar = (target, label) => {
    const ratio = Math.min(1, e.fund / target);
    const gap = Math.max(0, target - e.fund);
    const time = gap === 0 ? t('goals.emergency.done') : monthly > 0 ? t('goals.emergency.toGoAbout', { amount: view.raw(gap), time: duration(gap / monthly) }) : t('goals.emergency.toGo', { amount: view.raw(gap) });
    return `<div>
      <div class="flex flex-wrap justify-between gap-x-3 text-sm"><span class="font-semibold text-slate-800 dark:text-slate-200">${label}</span><span class="tabular-nums ${gap === 0 ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'muted'}">${time}</span></div>
      <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full ${gap === 0 ? 'bg-emerald-500' : 'bg-amber-500'}" style="width:${ratio * 100}%"></div></div>
    </div>`;
  };
  const cover = e.fund > 0
    ? t('goals.emergency.cover_html', { fund: view.raw(e.fund), months: oneDecimal(e.coverage), essentials: view.raw(e.essentials) })
    : t('goals.emergency.none', { amount: view.raw(e.essentials) });
  setHTML($('emergencyBody'), `
    <p class="text-sm muted">${cover}</p>
    <div class="mt-4 space-y-4">${bar(e.target3, t('goals.emergency.first3', { amount: view.raw(e.target3) }))}${bar(e.target6, t('goals.emergency.safe6', { amount: view.raw(e.target6) }))}</div>
    <p class="mt-3 text-xs muted">${monthly > 0 ? t('goals.emergency.using', { amount: view.rawS(monthly) }) : t('goals.emergency.giveShare')}</p>`);
}

// ---------------- Debt-free date ----------------
function renderDebt(state, result, view) {
  const debts = result.totals.debts.filter((d) => d.balance > 0);
  if (!debts.length) {
    setHTML($('debtBody'), `<p class="text-sm muted">${t('goals.debt.none_html')}</p>`);
    return;
  }
  const extra = result.allocation.amounts.debt;
  const cmp = debtFreeComparison(debts, extra);
  const total = debts.reduce((a, d) => a + d.balance, 0);
  const cur = cmp.current;
  const acc = cmp.accelerated;
  const interestOf = (d) => (d.balance * d.apr) / 1200;
  const debtName = (d) => esc(d.name || (d.type === 'loan' ? t('goals.debt.yourLoan') : t('goals.debt.yourCard')));
  const growing = debts.filter((d) => d.payment <= interestOf(d));
  const curTxt = cur.feasible ? monthsFromNow(cur.months) : t('goals.debt.never');
  setHTML($('debtBody'), `
    <p class="text-sm muted">${t('goals.debt.owe_html', { total: view.raw(total) })}</p>
    <dl class="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
      <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <dt class="text-xs muted">${t('goals.debt.keepPaying')}</dt>
        <dd class="font-extrabold text-slate-900 dark:text-white">${curTxt}</dd>
        <dd class="text-xs muted">${cur.feasible ? t('goals.debt.durationInterest', { time: duration(cur.months), interest: view.raw(cur.interest) }) : t('goals.debt.paymentSmaller')}</dd>
      </div>
      <div class="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/60">
        <dt class="text-xs text-emerald-800 dark:text-emerald-300">${extra > 0 ? t('goals.debt.ifAddAmount', { amount: view.rawS(extra) }) : t('goals.debt.ifAddShare')}</dt>
        <dd class="font-extrabold text-emerald-800 dark:text-emerald-300">${extra > 0 && acc.feasible ? monthsFromNow(acc.months) : '—'}</dd>
        <dd class="text-xs text-emerald-800/90 dark:text-emerald-300/90">${extra > 0 && acc.feasible ? t('goals.debt.durationInterest', { time: duration(acc.months), interest: view.raw(acc.interest) }) : t('goals.debt.giveShare')}</dd>
      </div>
    </dl>
    ${extra > 0 && cmp.interestSaved != null
      ? `<p class="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">${icon('trending-up', 'icon-sm me-1 align-[-3px]')}${t('goals.debt.sooner_html', { amount: view.rawS(extra), time: duration(cmp.monthsSaved), saved: view.rawS(cmp.interestSaved) })}</p>`
      : ''}
    ${!cur.feasible ? `<p class="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-300">${t('goals.debt.neverAll')} ${growing.map((d) => (interestOf(d) > 0 ? t('goals.debt.payMore', { amount: view.raw(interestOf(d)), name: debtName(d) }) : t('goals.debt.addPayment', { name: debtName(d) }))).join(' ')}</p>` : ''}`);
}

/** The one line shown on each collapsed "Plan ahead" row. */
function renderRowSummaries(state, result, view) {
  const { amounts } = result.allocation;
  const preset = ALLOCATION_PRESETS[state.allocation.preset];
  setText($('sumAlloc'), result.allocation.monthly > 0
    ? t('goals.summary.alloc', { preset: preset ? preset.label : t('goals.summary.ownSplit'), emergency: view.rawS(amounts.emergency), debt: view.rawS(amounts.debt), goals: view.rawS(amounts.goals) })
    : result.payday?.short > 0 ? t('goals.summary.allocShort')
      : t('goals.summary.allocNoIncome'));

  const e = emergencyFundStatus(result.totals.needs, result.totals.values.emergencyFund, amounts.emergency);
  setText($('sumEmergency'), !(e.essentials > 0) ? t('goals.summary.emergencyNoBills')
    : e.gap3 === 0 ? t(e.gap6 === 0 ? 'goals.summary.emergencyFull' : 'goals.summary.emergencyStart', { months: oneDecimal(e.coverage) })
      // "Nothing saved yet" reads better than "0.0 months saved"
      : e.monthsTo3 != null ? t(e.fund > 0 ? 'goals.summary.emergencyIn' : 'goals.summary.emergencyNoneIn', { months: oneDecimal(e.coverage), time: duration(e.monthsTo3) })
        : t(e.fund > 0 ? 'goals.summary.emergencyNeedsShare' : 'goals.summary.emergencyNoneNeedsShare', { months: oneDecimal(e.coverage) }));

  const debts = result.totals.debts.filter((d) => d.balance > 0);
  if (!debts.length) setText($('sumDebt'), t('goals.summary.debtNone'));
  else {
    const cmp = debtFreeComparison(debts, amounts.debt);
    setText($('sumDebt'), !cmp.current.feasible && !(amounts.debt > 0) ? t('goals.summary.debtNever')
      : amounts.debt > 0 && cmp.accelerated.feasible
        ? (cmp.monthsSaved
          ? t('goals.summary.debtFreeSooner', { date: monthsFromNow(cmp.accelerated.months), time: duration(cmp.monthsSaved) })
          : t('goals.summary.debtFreeBy', { date: monthsFromNow(cmp.accelerated.months) }))
        : t('goals.summary.debtFreeNow', { date: monthsFromNow(cmp.current.months) }));
  }

  const goals = goalTimeline(state.goals, amounts.goals);
  const open = goals.filter((g) => g.target > 0 && g.remaining > 0);
  setText($('sumGoals'), !state.goals.length ? t('goals.summary.goalsNone')
    : !open.length ? (state.goals.some((g) => !(g.target > 0)) ? t('goals.summary.goalsTypeEach') : t('goals.summary.goalsCovered'))
      : open[0].reachable ? t('goals.summary.goalReady', { name: open[0].name || t('goals.summary.firstGoal'), date: monthsFromNow(open[0].months) }) : t('goals.summary.goalsNeedShare', { count: open.length }));
}

export function renderGoals(state, result, view) {
  renderRowSummaries(state, result, view);
  renderAllocation(state, result, view);
  renderGoalPlanner(state, result, view);
  renderEmergency(state, result, view);
  renderDebt(state, result, view);
}

/** Saves a new order of goal ids, tells screen readers and keeps focus on the moved goal's handle. */
function saveOrder(box, ids, movedId) {
  const st = getState();
  if (ids.join('|') === st.goals.map((g) => g.id).join('|')) return;
  setState((s) => { s.goals = ids.map((id) => s.goals.find((g) => g.id === id)).filter(Boolean); });
  const n = getState().goals.findIndex((g) => g.id === movedId);
  const g = getState().goals[n];
  announce(t('goals.row.moved', { name: g.name || t('goals.untitled'), n: n + 1 }));
  box.querySelector(`[data-drag-goal="${movedId}"]`)?.focus();
}

/**
 * Drag a goal by its handle (mouse, finger or pen) to change the order; the
 * others move out of the way as it passes their middle. The handle also takes
 * the up and down arrow keys.
 */
function initGoalDrag(box) {
  let drag = null;
  const pageY = (e) => e.clientY + window.scrollY;
  let raf = 0;

  const follow = (y) => {
    const { li } = drag;
    // Pass the middle of a neighbour and the two swap places
    const prev = li.previousElementSibling;
    const next = li.nextElementSibling;
    const mid = (el) => { const r = el.getBoundingClientRect(); return r.top + window.scrollY + r.height / 2; };
    const top = drag.startTop + (y - drag.startY);
    if (prev && top < mid(prev)) box.insertBefore(li, prev);
    else if (next && top + li.offsetHeight > mid(next)) box.insertBefore(next, li);
    // Shift it from where it now sits in the list, so it stays under the pointer
    const natural = li.getBoundingClientRect().top + window.scrollY - drag.shift;
    drag.shift = top - natural;
    li.style.transform = `translateY(${drag.shift}px)`;
  };

  // Near the top or bottom of the screen, scroll so long lists can be reordered on phones
  const autoScroll = () => {
    if (!drag) return;
    const edge = 70;
    const dy = drag.clientY < edge ? -12 : drag.clientY > window.innerHeight - edge ? 12 : 0;
    if (dy) {
      window.scrollBy(0, dy);
      follow(drag.clientY + window.scrollY);
    }
    raf = requestAnimationFrame(autoScroll);
  };

  box.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-drag-goal]');
    if (!h || e.button > 0) return;
    e.preventDefault();
    const li = h.closest('[data-goal]');
    h.setPointerCapture(e.pointerId);
    const y = pageY(e);
    drag = { h, li, id: h.dataset.dragGoal, startY: y, clientY: e.clientY, startTop: li.getBoundingClientRect().top + window.scrollY, shift: 0 };
    li.classList.add('dragging');
    document.body.classList.add('goal-dragging');
    raf = requestAnimationFrame(autoScroll);
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.clientY = e.clientY;
    follow(pageY(e));
  });
  const end = () => {
    if (!drag) return;
    cancelAnimationFrame(raf);
    const { li, id } = drag;
    drag = null;
    li.style.transform = '';
    li.classList.remove('dragging');
    document.body.classList.remove('goal-dragging');
    saveOrder(box, [...box.children].map((x) => x.dataset.goal), id);
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);

  box.addEventListener('keydown', (e) => {
    const h = e.target.closest('[data-drag-goal]');
    if (!h || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const ids = getState().goals.map((g) => g.id);
    const from = ids.indexOf(h.dataset.dragGoal);
    const to = from + (e.key === 'ArrowUp' ? -1 : 1);
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    saveOrder(box, ids, h.dataset.dragGoal);
  });
}

export function initGoals() {
  setHTML($('allocPresets'), Object.entries(ALLOCATION_PRESETS).map(([key, p]) =>
    `<button type="button" class="btn btn-secondary px-3" data-preset="${key}" aria-pressed="false">${esc(p.label)}</button>`).join(''));
  setHTML($('allocSliders'), BUCKETS.map((k) => `
    <div>
      <div class="flex items-baseline justify-between gap-2 text-sm">
        <label for="alloc-${k}" class="font-semibold text-slate-800 dark:text-slate-200">${BUCKET_LABEL(k)}</label>
        <span class="tabular-nums"><span class="font-bold text-slate-900 dark:text-white" id="alloc-${k}-pct"></span> <span class="text-xs muted" id="alloc-${k}-amt"></span></span>
      </div>
      <input id="alloc-${k}" type="range" min="0" max="100" step="1" class="range" data-bucket="${k}">
    </div>`).join(''));

  $('allocPresets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    const p = ALLOCATION_PRESETS[b.dataset.preset];
    setState((s) => { s.allocation = { preset: b.dataset.preset, emergency: p.emergency, debt: p.debt, goals: p.goals }; });
  });
  $('allocSliders').addEventListener('input', (e) => {
    const k = e.target.dataset.bucket;
    if (!k) return;
    setState((s) => { s.allocation = rebalanceAllocation(s.allocation, k, e.target.value); }, { reason: 'input' });
  });

  const box = $('goalList');
  box.addEventListener('input', (e) => {
    const el = e.target;
    const id = el.dataset.goalId;
    if (!id) return;
    const key = el.dataset.key;
    let v = el.value.slice(0, 60);
    if (key !== 'name') {
      const r = parseAmount(el.value, { decimal: decimalSeparator(getState().currency) });
      v = r.value;
      el.setAttribute('aria-invalid', r.error ? 'true' : 'false');
      setText($(`${el.id}-msg`), r.error || '');
    }
    setState((s) => { const g = s.goals.find((x) => x.id === id); if (g) g[key] = v; }, { reason: 'input' });
  });
  box.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove-goal]');
    if (!rm) return;
    const st = getState();
    const idx = st.goals.findIndex((g) => g.id === rm.dataset.removeGoal);
    const removed = st.goals[idx];
    setState((s) => { s.goals.splice(idx, 1); });
    toast(t('goals.removed', { name: removed.name || t('goals.untitled') }), { action: { label: t('common.undo'), onClick: () => setState((s) => { s.goals.splice(idx, 0, removed); }) } });
  });
  initGoalDrag(box);
  $('addGoal').addEventListener('click', () => addGoal());
  $('goalChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-goal-preset]');
    if (b) addGoal(b.dataset.goalPreset);
  });
}
