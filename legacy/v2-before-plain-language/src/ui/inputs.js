// Form rendering, validation and the settings bar (profile, currency, period,
// sample data, reset). Group markup is built once; afterwards only the parts
// that change (subtotals, hints, dynamic rows) are touched.

import { getState, setState, replaceState, defaultState, clearStorage } from '../state.js';
import { PROFILES, typicalRange, sampleFor, newId } from '../engine/profiles.js';
import { CURRENCIES, parseAmount, money } from '../utils/format.js';
import { $, icon, esc, setText, setHTML, setAttr, toast, confirmDialog } from './dom.js';

export const GROUPS = [
  { id: 'income', title: 'Income', icon: 'wallet', fields: [
    { key: 'income', label: 'Monthly net income', icon: 'wallet', help: 'Take-home pay after taxes' }
  ] },
  { id: 'housing', title: 'Housing', icon: 'home', fields: [
    { key: 'rent', label: 'Rent / mortgage', icon: 'key' },
    { key: 'homeIns', label: "Home or renter's insurance", icon: 'umbrella' }
  ] },
  { id: 'utilities', title: 'Utilities', icon: 'bolt', fields: [
    { key: 'electricity', label: 'Electricity', icon: 'bolt' },
    { key: 'waterGas', label: 'Water / gas', icon: 'flame' },
    { key: 'internet', label: 'Internet / phone', icon: 'wifi' }
  ] },
  { id: 'transport', title: 'Transport', icon: 'car', fields: [
    { key: 'fuel', label: 'Fuel', icon: 'fuel' },
    { key: 'transit', label: 'Public transit / tolls', icon: 'train' },
    { key: 'carIns', label: 'Car insurance', icon: 'umbrella' },
    { key: 'carLoan', label: 'Car loan payment', icon: 'car' }
  ] },
  { id: 'family', title: 'Family & Lifestyle', icon: 'users', fields: [
    { key: 'school', label: 'School fees / childcare', icon: 'school' },
    { key: 'groceries', label: 'Groceries', icon: 'cart' },
    { key: 'dining', label: 'Dining out', icon: 'utensils' },
    { key: 'misc', label: 'Miscellaneous / impulse', icon: 'bag' }
  ] },
  { id: 'debt', title: 'Debt', icon: 'card', list: 'debts' },
  { id: 'subs', title: 'Subscriptions', icon: 'repeat', list: 'subscriptions' },
  { id: 'savings', title: 'Savings', icon: 'shield', fields: [
    { key: 'emergencyFund', label: 'Current emergency fund', icon: 'shield', help: 'Cash set aside for emergencies (a balance, not monthly)', balance: true }
  ] }
];

const errors = new Map(); // input id -> message

// ---------------- Markup builders ----------------
function moneyField(f) {
  const id = `f-${f.key}`;
  return `
  <div>
    <div class="mb-1.5 flex items-center justify-between gap-2">
      <label for="${id}" class="label flex items-center gap-2">${icon(f.icon, 'icon-sm text-slate-500 dark:text-slate-400')}${esc(f.label)}</label>
      ${f.balance ? '' : `
      <span class="tip-wrap" data-tip>
        <button type="button" class="tap grid h-6 w-6 place-items-center rounded-full text-slate-500 hover:text-indigo-600 dark:text-slate-400" aria-label="Typical range for ${esc(f.label)}" aria-describedby="tip-${f.key}">${icon('info', 'icon-sm')}</button>
        <span role="tooltip" id="tip-${f.key}" class="tip"></span>
      </span>`}
    </div>
    <div class="relative">
      <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400" data-symbol></span>
      <input id="${id}" data-field="${f.key}" type="text" inputmode="decimal" autocomplete="off" placeholder="0"
        class="input pl-12 ${f.balance ? '' : 'pr-12'} font-semibold" aria-describedby="${id}-msg ${f.help ? `${id}-help` : ''}">
      ${f.balance ? '' : '<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400">/mo</span>'}
    </div>
    ${f.help ? `<p id="${id}-help" class="mt-1 text-xs muted">${esc(f.help)}</p>` : ''}
    <p id="${id}-msg" class="mt-1 min-h-0 text-xs font-medium empty:hidden" aria-live="polite"></p>
  </div>`;
}

function groupCard(g, index, collapsed) {
  const body = g.list === 'debts'
    ? `<div id="debtRows" class="space-y-3"></div>
       <div class="mt-3 flex flex-wrap gap-2">
         <button type="button" class="btn btn-ghost" data-add="card">${icon('plus', 'icon-sm')}Add credit card</button>
         <button type="button" class="btn btn-ghost" data-add="loan">${icon('plus', 'icon-sm')}Add loan</button>
       </div>`
    : g.list === 'subscriptions'
      ? `<div id="subRows" class="space-y-3"></div>
         <button type="button" class="btn btn-ghost mt-3" data-add="sub">${icon('plus', 'icon-sm')}Add subscription</button>`
      : `<div class="grid gap-4 ${g.fields.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-1' : ''}">${g.fields.map(moneyField).join('')}</div>`;

  return `
  <details class="group-card card" data-group="${g.id}" ${collapsed ? '' : 'open'}>
    <summary>
      <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">${index + 1}</span>
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">${icon(g.icon)}</span>
      <span class="min-w-0 flex-1">
        <span class="block font-bold text-slate-900 dark:text-white">${esc(g.title)}</span>
        <span class="block text-xs muted" data-sub="${g.id}"></span>
      </span>
      ${icon('chevron-down', 'chev text-slate-500')}
    </summary>
    <div class="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5 dark:border-slate-800">${body}</div>
  </details>`;
}

const numInput = (list, row, key, label, opts = {}) => `
  <label class="block min-w-0 ${opts.cls || ''}">
    <span class="mb-1 block text-xs font-medium muted">${label}</span>
    <input type="text" inputmode="decimal" autocomplete="off" placeholder="0" class="input px-2.5 font-semibold"
      data-list="${list}" data-id="${row.id}" data-key="${key}" value="${row[key] || ''}" aria-label="${esc(label)}${row.name ? ` for ${esc(row.name)}` : ''}">
  </label>`;

function debtRow(d) {
  return `
  <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-800" data-row="${d.id}">
    <div class="flex items-end gap-2">
      <label class="block min-w-0 flex-1">
        <span class="mb-1 block text-xs font-medium muted">Name</span>
        <input type="text" class="input" maxlength="60" data-list="debts" data-id="${d.id}" data-key="name" value="${esc(d.name)}" placeholder="${d.type === 'card' ? 'Credit card' : 'Loan'}">
      </label>
      <label class="block w-32 shrink-0">
        <span class="mb-1 block text-xs font-medium muted">Type</span>
        <select class="input select" data-list="debts" data-id="${d.id}" data-key="type">
          <option value="card" ${d.type === 'card' ? 'selected' : ''}>Credit card</option>
          <option value="loan" ${d.type === 'loan' ? 'selected' : ''}>Loan</option>
        </select>
      </label>
      <button type="button" class="btn-icon shrink-0 hover:text-rose-600" data-remove="debts" data-id="${d.id}" aria-label="Remove ${esc(d.name || 'debt')}">${icon('trash')}</button>
    </div>
    <div class="mt-2 grid grid-cols-3 gap-2">
      ${numInput('debts', d, 'balance', 'Balance')}
      ${numInput('debts', d, 'apr', 'APR %')}
      ${numInput('debts', d, 'payment', 'Payment/mo')}
    </div>
  </div>`;
}

function subRow(s) {
  return `
  <div class="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-800" data-row="${s.id}">
    <label class="block min-w-0 flex-[2_1_8rem]">
      <span class="mb-1 block text-xs font-medium muted">Service</span>
      <input type="text" class="input" maxlength="60" data-list="subscriptions" data-id="${s.id}" data-key="name" value="${esc(s.name)}" placeholder="e.g. Netflix">
    </label>
    ${numInput('subscriptions', s, 'cost', 'Cost/mo', { cls: 'flex-[1_1_5rem]' })}
    <label class="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-medium text-slate-700 dark:text-slate-300">
      <input type="checkbox" class="h-5 w-5 rounded accent-indigo-600" data-list="subscriptions" data-id="${s.id}" data-key="rarely" ${s.rarely ? 'checked' : ''}>
      Rarely use
    </label>
    <button type="button" class="btn-icon hover:text-rose-600" data-remove="subscriptions" data-id="${s.id}" aria-label="Remove ${esc(s.name || 'subscription')}">${icon('trash')}</button>
  </div>`;
}

const listSignature = (arr) => arr.map((x) => x.id + (x.type || '')).join('|');

function renderRows(force = false) {
  const s = getState();
  const debtBox = $('debtRows');
  const subBox = $('subRows');
  const dSig = listSignature(s.debts);
  if (force || debtBox.__sig !== dSig) {
    debtBox.__sig = dSig;
    debtBox.innerHTML = s.debts.length ? s.debts.map(debtRow).join('') : '<p class="text-sm muted">No debts added. Add credit cards or loans to see payoff dates and interest savings.</p>';
  }
  const sSig = listSignature(s.subscriptions);
  if (force || subBox.__sig !== sSig) {
    subBox.__sig = sSig;
    subBox.innerHTML = s.subscriptions.length ? s.subscriptions.map(subRow).join('') : '<p class="text-sm muted">No subscriptions yet. List streaming, apps and memberships, and tick the ones you rarely use.</p>';
  }
}

// ---------------- Sync state -> inputs ----------------
/** Writes state values into inputs (after load, sample, import or reset). */
export function syncInputs() {
  const s = getState();
  errors.clear();
  document.querySelectorAll('[data-field]').forEach((el) => {
    const v = s.values[el.dataset.field];
    el.value = v ? String(v) : '';
    el.removeAttribute('aria-invalid');
  });
  renderRows(true);
  $('profile').value = s.profile;
  $('currency').value = s.currency;
  document.querySelectorAll('input[name="period"]').forEach((r) => { r.checked = r.value === s.period; });
}

// ---------------- Render (called after every recompute) ----------------
export function renderInputs(state, result, view) {
  const { values, subsTotal, debtPayments } = result.totals;
  const subtotal = (fields) => fields.reduce((a, f) => a + (values[f] || 0), 0);

  document.querySelectorAll('[data-symbol]').forEach((el) => setText(el, view.symbol));

  for (const g of GROUPS) {
    const el = document.querySelector(`[data-sub="${g.id}"]`);
    let txt;
    if (g.id === 'income') txt = values.income ? `${view.m(values.income)}${view.per}` : 'Start here';
    else if (g.id === 'savings') txt = values.emergencyFund ? `${view.raw(values.emergencyFund)} saved` : 'Optional';
    else if (g.list === 'debts') txt = state.debts.length ? `${view.m(debtPayments)}${view.per} · ${state.debts.length} account${state.debts.length > 1 ? 's' : ''}` : 'None added';
    else if (g.list === 'subscriptions') txt = state.subscriptions.length ? `${view.m(subsTotal)}${view.per} · ${state.subscriptions.length} service${state.subscriptions.length > 1 ? 's' : ''}` : 'None added';
    else txt = `${view.m(subtotal(g.fields.map((f) => f.key)))}${view.per}`;
    setText(el, txt);

    if (!g.fields) continue;
    for (const f of g.fields) {
      if (f.balance) continue;
      const range = typicalRange(state.profile, f.key, state.currency);
      const tip = $(`tip-${f.key}`);
      const rangeTxt = range[1] === 0 ? 'Usually none' : `${money(range[0], view.cur)}–${money(range[1], view.cur)}/mo`;
      setText(tip, `Typical for a ${PROFILES[state.profile].name}: ${rangeTxt}`);

      // Inline status: validation error wins, otherwise "above typical"
      const input = $(`f-${f.key}`);
      const msg = $(`f-${f.key}-msg`);
      const err = errors.get(input.id);
      if (err) {
        setText(msg, err);
        setAttr(msg, 'class', 'mt-1 text-xs font-medium text-rose-700 dark:text-rose-400');
      } else if (f.key !== 'income' && range[1] > 0 && values[f.key] > range[1]) {
        setText(msg, `Above typical (${money(range[1], view.cur)})`);
        setAttr(msg, 'class', 'mt-1 text-xs font-medium text-amber-700 dark:text-amber-400');
      } else {
        setText(msg, '');
      }
    }
  }
  renderRows();
}

// ---------------- Events ----------------
function onFieldInput(e) {
  const el = e.target;
  // Checkboxes and selects are handled once, on 'change'
  if (e.type === 'input' && el.matches('input[type="checkbox"], select')) return;
  if (el.dataset.field) {
    const { value, error } = parseAmount(el.value);
    error ? errors.set(el.id, error) : errors.delete(el.id);
    el.setAttribute('aria-invalid', error ? 'true' : 'false');
    setState((s) => { s.values[el.dataset.field] = value; s.ui.sample = false; }, { reason: 'input' });
    return;
  }
  if (el.dataset.list) {
    const { list, id, key } = el.dataset;
    let v;
    if (key === 'name') v = el.value.slice(0, 60);
    else if (key === 'rarely') v = el.checked;
    else if (key === 'type') v = el.value === 'loan' ? 'loan' : 'card';
    else {
      const r = parseAmount(el.value);
      v = key === 'apr' ? Math.min(100, r.value) : r.value;
      el.setAttribute('aria-invalid', r.error ? 'true' : 'false');
      el.title = r.error || '';
    }
    const instant = key === 'rarely' || key === 'type';
    setState((s) => {
      const row = s[list].find((x) => x.id === id);
      if (row) row[key] = v;
      s.ui.sample = false;
    }, { reason: instant ? 'change' : 'input' });
  }
}

export function initInputs() {
  const s = getState();
  // On phones, start with only the first groups open (unless the user has chosen) so results are reachable sooner
  const firstVisit = Object.keys(s.ui.collapsed).length === 0;
  const narrow = window.matchMedia('(max-width: 1023px)').matches;
  const isCollapsed = (g, i) => (firstVisit && narrow ? i > 1 : !!s.ui.collapsed[g.id]);
  $('inputGroups').innerHTML = GROUPS.map((g, i) => groupCard(g, i, isCollapsed(g, i))).join('');
  $('currency').innerHTML = Object.entries(CURRENCIES).map(([code, c]) => `<option value="${code}">${esc(c.label)}</option>`).join('');

  const form = $('budgetForm');
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', onFieldInput);
  form.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"], select[data-list]')) onFieldInput(e);
  });

  // Remember which groups are collapsed
  form.addEventListener('toggle', (e) => {
    const g = e.target.closest?.('details[data-group]');
    if (g) setState((st) => { st.ui.collapsed[g.dataset.group] = !g.open; }, { reason: 'ui' });
  }, true);

  // Add / remove dynamic rows
  form.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const kind = add.dataset.add;
      const row = kind === 'sub'
        ? { id: newId('s'), name: '', cost: 0, rarely: false }
        : { id: newId('d'), type: kind, name: '', balance: 0, apr: kind === 'card' ? 22 : 8, payment: 0 };
      setState((st) => { (kind === 'sub' ? st.subscriptions : st.debts).push(row); });
      requestAnimationFrame(() => document.querySelector(`[data-row="${row.id}"] input`)?.focus());
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const { remove: list, id } = rm.dataset;
      const st = getState();
      const idx = st[list].findIndex((x) => x.id === id);
      const removed = st[list][idx];
      setState((x) => { x[list] = x[list].filter((r) => r.id !== id); });
      toast(`${removed?.name || (list === 'debts' ? 'Debt' : 'Subscription')} removed`, {
        action: { label: 'Undo', onClick: () => setState((x) => { x[list].splice(idx, 0, removed); }) }
      });
      return;
    }
    // Tap-to-open tooltips on touch devices
    const tipBtn = e.target.closest('[data-tip] button');
    document.querySelectorAll('[data-tip].open').forEach((t) => { if (!tipBtn || t !== tipBtn.parentElement) t.classList.remove('open'); });
    if (tipBtn) tipBtn.parentElement.classList.toggle('open');
  });

  // Settings bar
  $('profile').addEventListener('change', (e) => setState((st) => { st.profile = e.target.value; }));
  $('currency').addEventListener('change', (e) => setState((st) => { st.currency = e.target.value; }));
  document.querySelectorAll('input[name="period"]').forEach((r) =>
    r.addEventListener('change', () => setState((st) => { st.period = r.value; }))
  );
  document.querySelectorAll('[data-action="sample"]').forEach((b) => b.addEventListener('click', loadSample));
  $('btnReset').addEventListener('click', resetAll);

  syncInputs();
}

export function loadSample() {
  const st = getState();
  const prev = JSON.parse(JSON.stringify(st));
  const sample = sampleFor(st.profile, st.currency);
  replaceState({
    ...st,
    values: sample.values,
    debts: sample.debts,
    subscriptions: sample.subscriptions,
    plan: { committed: {}, pct: {}, sort: st.plan.sort },
    ui: { ...st.ui, sample: true },
    goals: st.goals.length ? st.goals : [
      { id: newId('g'), name: 'Family vacation', target: Math.round(3000 * (sample.values.income / 7200) / 100) * 100, saved: 0 },
      { id: newId('g'), name: 'New laptop', target: Math.round(1500 * (sample.values.income / 7200) / 100) * 100, saved: 0 }
    ]
  }, 'sample');
  syncInputs();
  toast(`Sample loaded for ${PROFILES[st.profile].name}`, {
    action: { label: 'Undo', onClick: () => { replaceState(prev); syncInputs(); } }
  });
}

async function resetAll() {
  const ok = await confirmDialog({
    title: 'Reset all data?',
    message: 'This erases every value, action, goal and saved snapshot stored on this device. This cannot be undone.',
    confirmLabel: 'Reset everything',
    danger: true
  });
  if (!ok) return;
  const keep = getState();
  clearStorage();
  replaceState({ ...defaultState(), profile: keep.profile, currency: keep.currency }, 'reset');
  syncInputs();
  toast('All data cleared from this device', { tone: 'info' });
  $('f-income')?.focus();
}
