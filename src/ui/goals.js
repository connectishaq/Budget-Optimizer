// Goals & safety nets: "Where should your savings go?" split, goal planner,
// emergency fund check and debt-free date. Each timeline uses only its own
// share of the monthly savings, so the three always add up.

import { getState, setState } from '../state.js';
import { goalTimeline, emergencyFundStatus, debtFreeComparison, ALLOCATION_PRESETS, BUCKETS, rebalanceAllocation } from '../engine/calculate.js';
import { parseAmount, duration, monthsFromNow, pct } from '../utils/format.js';
import { newId } from '../engine/profiles.js';
import { $, icon, esc, setText, setHTML, setAttr, toast } from './dom.js';

const BUCKET_LABEL = { emergency: 'Emergency fund', debt: 'Paying off debt', goals: 'Your goals' };
const BUCKET_WHY = { emergency: 'your emergency fund is already at 6 months', debt: 'you have no loans', goals: 'you have no goals yet' };

// ---------------- Savings split ----------------
function renderAllocation(state, result, view) {
  const a = state.allocation;
  const { shares, amounts, inactive, unassigned, monthly } = result.allocation;
  document.querySelectorAll('[data-preset]').forEach((b) => {
    const on = a.preset === b.dataset.preset;
    setAttr(b, 'aria-pressed', String(on));
    b.className = `btn px-3 ${on ? 'btn-primary' : 'btn-secondary'}`;
  });
  for (const k of BUCKETS) {
    const slider = $(`alloc-${k}`);
    if (document.activeElement !== slider) slider.value = a[k];
    slider.style.setProperty('--fill', `${a[k]}%`);
    setAttr(slider, 'aria-valuetext', `${a[k]}%, ${view.rawS(amounts[k])} a month`);
    setText($(`alloc-${k}-pct`), `${a[k]}%`);
    setText($(`alloc-${k}-amt`), monthly > 0 ? `${view.rawS(amounts[k])}/month` : '—');
  }
  let note;
  if (result.payday?.short > 0) note = `Your bills cost ${view.rawS(result.payday.short)} a month more than you earn, so there’s nothing to share out yet. Add more ideas to your plan to close the gap.`;
  else if (!(monthly > 0)) note = 'Add your income and some ideas to your plan first. Then you can choose where the money goes.';
  else if (unassigned) note = 'You have nothing to save towards yet. Add a goal, a loan or an emergency fund target.';
  else if (inactive.length) note = `Because ${inactive.map((k) => BUCKET_WHY[k]).join(' and ')}, that share goes to your other priorities.`;
  else note = `After your bills${result.savings > 0 ? ' and your plan' : ''}, you have ${view.rawS(monthly)} a month left to save. The three amounts above add up to that.`;
  setText($('allocNote'), note);
  // Hide amount when a bucket is inactive to avoid confusion
  for (const k of BUCKETS) $(`alloc-${k}-amt`).classList.toggle('line-through', inactive.includes(k) && shares[k] === 0);
}

// ---------------- Goal planner ----------------
const goalSig = (goals) => goals.map((g) => g.id).join('|');

function goalRow(g) {
  return `
  <li class="rounded-xl border border-slate-200 p-3 dark:border-slate-800" data-goal="${g.id}">
    <div class="flex items-end gap-2">
      <div class="min-w-0 flex-1">
        <label for="g-${g.id}-name" class="mb-1 block text-xs font-medium muted">What are you saving for?</label>
        <input id="g-${g.id}-name" type="text" class="input" maxlength="60" data-goal-id="${g.id}" data-key="name" value="${esc(g.name)}" placeholder="e.g. Holiday">
      </div>
      <button type="button" class="btn-icon shrink-0 hover:text-rose-600" data-remove-goal="${g.id}" aria-label="Remove goal ${esc(g.name)}">${icon('trash')}</button>
    </div>
    <div class="mt-2 grid grid-cols-2 gap-2">
      <div><label for="g-${g.id}-target" class="mb-1 block text-xs font-medium muted">How much you need</label>
        <input id="g-${g.id}-target" type="text" inputmode="decimal" class="input font-semibold" data-goal-id="${g.id}" data-key="target" value="${g.target || ''}" placeholder="0" aria-describedby="g-${g.id}-target-msg">
        <p id="g-${g.id}-target-msg" class="mt-1 text-xs font-medium text-rose-700 empty:hidden dark:text-rose-400" aria-live="polite"></p></div>
      <div><label for="g-${g.id}-saved" class="mb-1 block text-xs font-medium muted">Saved so far</label>
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
  const sig = goalSig(state.goals);
  if (list.__sig !== sig) {
    list.__sig = sig;
    list.innerHTML = state.goals.map(goalRow).join('');
  }
  $('goalEmpty').hidden = state.goals.length > 0;
  const monthly = result.allocation.amounts.goals;
  const timeline = goalTimeline(state.goals, monthly);
  for (const g of timeline) {
    const row = list.querySelector(`[data-goal="${g.id}"]`);
    if (!row) continue;
    row.querySelector('[data-goal-bar]').style.width = `${Math.round(g.progress * 100)}%`;
    let status;
    if (!(g.target > 0)) status = 'Type how much you need.';
    else if (g.remaining === 0) status = 'Done! You have enough for this.';
    else if (!g.reachable) status = `${pct(g.progress)} saved. Give goals a share of your savings above to see a date.`;
    else status = `${pct(g.progress)} saved · ${view.raw(g.remaining)} to go · ready in ${duration(g.months)} (${monthsFromNow(g.months)})`;
    setText(row.querySelector('[data-goal-status]'), status);
  }
  const open = timeline.filter((g) => g.target > 0 && g.remaining > 0);
  setText($('goalBasis'), monthly > 0
    ? `You’re putting ${view.rawS(monthly)} a month towards goals, finishing them one at a time from the top.`
    : !state.goals.length || open.length ? 'Give goals a share of your savings above to see when you’ll reach them.'
      : state.goals.some((g) => !(g.target > 0)) ? 'Type how much you need for each goal to see when you’ll reach it.'
        : 'Every goal already has enough saved, so your goals share goes to your other priorities.');
}

// ---------------- Emergency fund ----------------
function renderEmergency(state, result, view) {
  const monthly = result.allocation.amounts.emergency;
  const e = emergencyFundStatus(result.totals.needs, result.totals.values.emergencyFund, monthly);
  if (!(e.essentials > 0)) {
    setHTML($('emergencyBody'), '<p class="text-sm muted">Add your must-pay bills (housing, bills, groceries, transport) so we can work out how much to keep aside.</p>');
    return;
  }
  const bar = (target, label) => {
    const ratio = Math.min(1, e.fund / target);
    const gap = Math.max(0, target - e.fund);
    const time = gap === 0 ? 'Done' : monthly > 0 ? `${view.raw(gap)} to go · about ${duration(gap / monthly)}` : `${view.raw(gap)} to go`;
    return `<div>
      <div class="flex flex-wrap justify-between gap-x-3 text-sm"><span class="font-semibold text-slate-800 dark:text-slate-200">${label}: ${view.raw(target)}</span><span class="tabular-nums ${gap === 0 ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'muted'}">${time}</span></div>
      <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full ${gap === 0 ? 'bg-emerald-500' : 'bg-amber-500'}" style="width:${ratio * 100}%"></div></div>
    </div>`;
  };
  const cover = e.fund > 0
    ? `Your savings of <strong class="text-slate-900 dark:text-white">${view.raw(e.fund)}</strong> would cover <strong class="text-slate-900 dark:text-white">${e.coverage.toFixed(1)} months</strong> of must-pay bills (${view.raw(e.essentials)} a month).`
    : `You have no emergency savings yet. Your must-pay bills are ${view.raw(e.essentials)} a month.`;
  setHTML($('emergencyBody'), `
    <p class="text-sm muted">${cover}</p>
    <div class="mt-4 space-y-4">${bar(e.target3, 'First goal, 3 months')}${bar(e.target6, 'Safe level, 6 months')}</div>
    <p class="mt-3 text-xs muted">${monthly > 0 ? `Using ${view.rawS(monthly)} a month from your savings.` : 'Give the emergency fund a share of your savings above to see how long this takes.'}</p>`);
}

// ---------------- Debt-free date ----------------
function renderDebt(state, result, view) {
  const debts = result.totals.debts.filter((d) => d.balance > 0);
  if (!debts.length) {
    setHTML($('debtBody'), '<p class="text-sm muted">No loans or credit cards added. If you have any, add them in step 3 (<button type="button" class="font-semibold text-indigo-700 underline dark:text-indigo-300" data-edit-step="3">add loans</button>) to see when you’ll be debt-free.</p>');
    return;
  }
  const extra = result.allocation.amounts.debt;
  const cmp = debtFreeComparison(debts, extra);
  const total = debts.reduce((a, d) => a + d.balance, 0);
  const cur = cmp.current;
  const acc = cmp.accelerated;
  const interestOf = (d) => (d.balance * d.apr) / 1200;
  const debtName = (d) => esc(d.name || (d.type === 'loan' ? 'your loan' : 'your credit card'));
  const growing = debts.filter((d) => d.payment <= interestOf(d));
  const curTxt = cur.feasible ? monthsFromNow(cur.months) : 'Never, at today’s payments';
  setHTML($('debtBody'), `
    <p class="text-sm muted">You owe <strong class="text-slate-900 dark:text-white">${view.raw(total)}</strong> in total.</p>
    <dl class="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
      <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <dt class="text-xs muted">If you keep paying as now</dt>
        <dd class="font-extrabold text-slate-900 dark:text-white">${curTxt}</dd>
        <dd class="text-xs muted">${cur.feasible ? `${duration(cur.months)} · ${view.raw(cur.interest)} in interest` : 'Your payment is smaller than the interest'}</dd>
      </div>
      <div class="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/60">
        <dt class="text-xs text-emerald-800 dark:text-emerald-300">If you add ${extra > 0 ? `${view.rawS(extra)}/month` : 'your debt share'}</dt>
        <dd class="font-extrabold text-emerald-800 dark:text-emerald-300">${extra > 0 && acc.feasible ? monthsFromNow(acc.months) : '—'}</dd>
        <dd class="text-xs text-emerald-800/90 dark:text-emerald-300/90">${extra > 0 && acc.feasible ? `${duration(acc.months)} · ${view.raw(acc.interest)} in interest` : 'Give debt a share of your savings above'}</dd>
      </div>
    </dl>
    ${extra > 0 && cmp.interestSaved != null
      ? `<p class="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">${icon('trending-up', 'icon-sm mr-1 align-[-3px]')}Pay the highest-interest loan first with the extra ${view.rawS(extra)} a month, and you’re debt-free <strong>${duration(cmp.monthsSaved)} sooner</strong> and pay <strong>${view.rawS(cmp.interestSaved)} less</strong> in interest.</p>`
      : ''}
    ${!cur.feasible ? `<p class="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-300">At least one debt will never be paid off at today’s payments. ${growing.map((d) => (interestOf(d) > 0 ? `Pay more than ${view.raw(interestOf(d))} a month on ${debtName(d)}.` : `Add a monthly payment for ${debtName(d)}.`)).join(' ')}</p>` : ''}`);
}

/** The one line shown on each collapsed "Plan ahead" row. */
function renderRowSummaries(state, result, view) {
  const { amounts } = result.allocation;
  const preset = ALLOCATION_PRESETS[state.allocation.preset];
  setText($('sumAlloc'), result.allocation.monthly > 0
    ? `${preset ? preset.label : 'Your own split'}: ${view.rawS(amounts.emergency)} emergency · ${view.rawS(amounts.debt)} debt · ${view.rawS(amounts.goals)} goals a month`
    : result.payday?.short > 0 ? 'Your bills cost more than you earn, so nothing is left to share out yet.'
      : 'Add your income and some ideas first, then choose where the money goes.');

  const e = emergencyFundStatus(result.totals.needs, result.totals.values.emergencyFund, amounts.emergency);
  setText($('sumEmergency'), !(e.essentials > 0) ? 'Add your bills to check this.'
    : e.gap3 === 0 ? `${e.coverage.toFixed(1)} months of bills saved. ${e.gap6 === 0 ? 'Fully covered.' : 'Good start.'}`
      : `${e.coverage.toFixed(1)} months saved. 3 months ${e.monthsTo3 != null ? `in about ${duration(e.monthsTo3)}` : 'needs a share of your savings'}.`);

  const debts = result.totals.debts.filter((d) => d.balance > 0);
  if (!debts.length) setText($('sumDebt'), 'No loans or cards added.');
  else {
    const cmp = debtFreeComparison(debts, amounts.debt);
    setText($('sumDebt'), !cmp.current.feasible && !(amounts.debt > 0) ? 'Never at today’s payments. Open to see why.'
      : amounts.debt > 0 && cmp.accelerated.feasible
        ? `Debt-free by ${monthsFromNow(cmp.accelerated.months)}${cmp.monthsSaved ? `, ${duration(cmp.monthsSaved)} sooner` : ''}.`
        : `Debt-free by ${monthsFromNow(cmp.current.months)} at today’s payments.`);
  }

  const goals = goalTimeline(state.goals, amounts.goals);
  const open = goals.filter((g) => g.target > 0 && g.remaining > 0);
  setText($('sumGoals'), !state.goals.length ? 'No goals yet.'
    : !open.length ? (state.goals.some((g) => !(g.target > 0)) ? 'Type how much you need for each goal.' : 'All your goals are covered.')
      : open[0].reachable ? `${open[0].name || 'First goal'} ready by ${monthsFromNow(open[0].months)}.` : `${open.length} goal${open.length > 1 ? 's' : ''}. Give goals a share of your savings to see dates.`);
}

export function renderGoals(state, result, view) {
  renderRowSummaries(state, result, view);
  renderAllocation(state, result, view);
  renderGoalPlanner(state, result, view);
  renderEmergency(state, result, view);
  renderDebt(state, result, view);
}

export function initGoals() {
  setHTML($('allocPresets'), Object.entries(ALLOCATION_PRESETS).map(([key, p]) =>
    `<button type="button" class="btn btn-secondary px-3" data-preset="${key}" aria-pressed="false">${esc(p.label)}</button>`).join(''));
  setHTML($('allocSliders'), BUCKETS.map((k) => `
    <div>
      <div class="flex items-baseline justify-between gap-2 text-sm">
        <label for="alloc-${k}" class="font-semibold text-slate-800 dark:text-slate-200">${BUCKET_LABEL[k]}</label>
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
      const r = parseAmount(el.value);
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
    toast(`Goal "${removed.name || 'Untitled'}" removed`, { action: { label: 'Undo', onClick: () => setState((s) => { s.goals.splice(idx, 0, removed); }) } });
  });
  $('addGoal').addEventListener('click', () => {
    const g = { id: newId('g'), name: '', target: 0, saved: 0 };
    setState((s) => { s.goals.push(g); });
    requestAnimationFrame(() => document.querySelector(`[data-goal="${g.id}"] input`)?.focus());
  });
}
