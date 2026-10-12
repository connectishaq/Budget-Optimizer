// Goals: goal planner, emergency fund check and debt-free date.
// All three use committed monthly savings from the action plan.

import { getState, setState } from '../state.js';
import { goalTimeline, emergencyFundStatus, debtFreeComparison } from '../engine/calculate.js';
import { parseAmount, duration, monthsFromNow, pct } from '../utils/format.js';
import { newId } from '../engine/profiles.js';
import { $, icon, esc, setText, setHTML, toast } from './dom.js';

const goalSig = (goals) => goals.map((g) => g.id).join('|');

function goalRow(g) {
  return `
  <li class="rounded-xl border border-slate-200 p-3 dark:border-slate-800" data-goal="${g.id}">
    <div class="flex items-end gap-2">
      <label class="block min-w-0 flex-1">
        <span class="mb-1 block text-xs font-medium muted">Goal</span>
        <input type="text" class="input" maxlength="60" data-goal-id="${g.id}" data-key="name" value="${esc(g.name)}" placeholder="e.g. Holiday fund">
      </label>
      <button type="button" class="btn-icon shrink-0 hover:text-rose-600" data-remove-goal="${g.id}" aria-label="Remove goal ${esc(g.name)}">${icon('trash')}</button>
    </div>
    <div class="mt-2 grid grid-cols-2 gap-2">
      <label class="block"><span class="mb-1 block text-xs font-medium muted">Target</span>
        <input type="text" inputmode="decimal" class="input font-semibold" data-goal-id="${g.id}" data-key="target" value="${g.target || ''}" placeholder="0"></label>
      <label class="block"><span class="mb-1 block text-xs font-medium muted">Saved so far</span>
        <input type="text" inputmode="decimal" class="input font-semibold" data-goal-id="${g.id}" data-key="saved" value="${g.saved || ''}" placeholder="0"></label>
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
  const timeline = goalTimeline(state.goals, result.savings);
  for (const g of timeline) {
    const row = list.querySelector(`[data-goal="${g.id}"]`);
    if (!row) continue;
    row.querySelector('[data-goal-bar]').style.width = `${Math.round(g.progress * 100)}%`;
    let status;
    if (!(g.target > 0)) status = 'Enter a target amount.';
    else if (g.remaining === 0) status = 'Fully funded!';
    else if (!g.reachable) status = `${pct(g.progress)} funded · commit to actions in your plan to set a date.`;
    else status = `${pct(g.progress)} funded · ${view.raw(g.remaining)} to go · reached in ${duration(g.months)} (${monthsFromNow(g.months)})`;
    setText(row.querySelector('[data-goal-status]'), status);
  }
  setText($('goalBasis'), result.savings > 0
    ? `Using your committed savings of ${view.raw(result.savings)}/mo, funding goals top to bottom.`
    : 'Commit to actions in your savings plan to see when each goal is reached.');
}

function renderEmergency(state, result, view) {
  const e = emergencyFundStatus(result.totals.needs, result.totals.values.emergencyFund, result.savings);
  if (!(e.essentials > 0)) {
    setHTML($('emergencyBody'), '<p class="text-sm muted">Add your essential bills (housing, utilities, groceries, transport) to size your emergency fund.</p>');
    return;
  }
  const bar = (target, label) => {
    const ratio = Math.min(1, e.fund / target);
    const gap = Math.max(0, target - e.fund);
    const time = gap === 0 ? 'Covered' : result.savings > 0 ? `${view.raw(gap)} gap · ${duration(gap / result.savings)} to close` : `${view.raw(gap)} gap`;
    return `<div>
      <div class="flex justify-between text-sm"><span class="font-semibold text-slate-800 dark:text-slate-200">${label} · ${view.raw(target)}</span><span class="tabular-nums ${gap === 0 ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'muted'}">${time}</span></div>
      <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full ${gap === 0 ? 'bg-emerald-500' : 'bg-amber-500'}" style="width:${ratio * 100}%"></div></div>
    </div>`;
  };
  setHTML($('emergencyBody'), `
    <p class="text-sm muted">Your fund of <strong class="text-slate-900 dark:text-white">${view.raw(e.fund)}</strong> covers
      <strong class="text-slate-900 dark:text-white">${e.coverage.toFixed(1)} months</strong> of essential expenses (${view.raw(e.essentials)}/mo).</p>
    <div class="mt-4 space-y-4">${bar(e.target3, '3 months')}${bar(e.target6, '6 months')}</div>`);
}

function renderDebt(state, result, view) {
  const debts = result.totals.debts.filter((d) => d.balance > 0);
  if (!debts.length) {
    setHTML($('debtBody'), '<p class="text-sm muted">No debt balances entered. Add credit cards or loans in the <strong>Debt</strong> section to see your debt-free date.</p>');
    return;
  }
  const cmp = debtFreeComparison(debts, result.savings);
  const total = debts.reduce((a, d) => a + d.balance, 0);
  const cur = cmp.current;
  const acc = cmp.accelerated;
  const curTxt = cur.feasible ? monthsFromNow(cur.months) : 'Never at current payments';
  const accTxt = acc.feasible ? monthsFromNow(acc.months) : 'Not reachable';
  setHTML($('debtBody'), `
    <p class="text-sm muted">Total balance <strong class="text-slate-900 dark:text-white">${view.raw(total)}</strong> across ${debts.length} account${debts.length > 1 ? 's' : ''}.</p>
    <dl class="mt-4 grid grid-cols-2 gap-3">
      <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <dt class="text-xs muted">Current path</dt>
        <dd class="font-extrabold text-slate-900 dark:text-white">${curTxt}</dd>
        <dd class="text-xs muted">${cur.feasible ? `${duration(cur.months)} · ${view.raw(cur.interest)} interest` : 'Payments don’t cover interest'}</dd>
      </div>
      <div class="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/60">
        <dt class="text-xs text-emerald-800 dark:text-emerald-300">Redirecting savings</dt>
        <dd class="font-extrabold text-emerald-800 dark:text-emerald-300">${result.savings > 0 ? accTxt : '—'}</dd>
        <dd class="text-xs text-emerald-800/80 dark:text-emerald-300/80">${result.savings > 0 && acc.feasible ? `${duration(acc.months)} · ${view.raw(acc.interest)} interest` : 'Commit to actions to see this'}</dd>
      </div>
    </dl>
    ${result.savings > 0 && cmp.interestSaved != null
      ? `<p class="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">${icon('trending-up', 'icon-sm mr-1 align-[-3px]')}Putting ${view.raw(result.savings)}/mo toward debt (highest APR first) makes you debt-free <strong>${duration(cmp.monthsSaved)} sooner</strong> and saves <strong>${view.raw(cmp.interestSaved)}</strong> in interest.</p>`
      : ''}
    ${!cur.feasible ? `<p class="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-300">At least one payment is lower than the monthly interest, so that balance keeps growing. Raise the payment above ${view.raw(Math.max(...debts.map((d) => (d.balance * d.apr) / 1200)))}/mo.</p>` : ''}`);
}

export function renderGoals(state, result, view) {
  renderGoalPlanner(state, result, view);
  renderEmergency(state, result, view);
  renderDebt(state, result, view);
}

export function initGoals() {
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
