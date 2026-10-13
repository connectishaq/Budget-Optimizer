// Form rendering, validation and the settings card (profile, currency, period,
// sample data, reset). Group markup is built once; afterwards only the parts
// that change (subtotals, hints, dynamic rows) are touched. The wizard moves
// these same group elements into its steps, so there is one set of inputs.

import { getState, setState, replaceState, defaultState, clearStorage } from '../state.js';
import { PROFILES, typicalRange, sampleFor, newId, benchmarkFor } from '../engine/profiles.js';
import { CURRENCIES, parseAmount, moneyNice } from '../utils/format.js';
import { $, icon, esc, setText, setAttr, toast, confirmDialog } from './dom.js';
import { helpBtn, HELP } from './help.js';
import { SUB_KINDS, subKind } from '../engine/subscriptions.js';

export const GROUPS = [
  { id: 'income', title: 'Income', icon: 'wallet', fields: [
    { key: 'income', label: 'Monthly take-home pay', icon: 'wallet', help: 'After tax. The amount that reaches your bank account.' }
  ] },
  { id: 'housing', title: 'Housing', icon: 'home', blurb: 'Rent or mortgage, and home insurance.', fields: [
    { key: 'rent', label: 'Rent or mortgage', icon: 'key' },
    { key: 'homeIns', label: "Home or renter's insurance", icon: 'umbrella' }
  ] },
  { id: 'utilities', title: 'Bills & utilities', icon: 'bolt', blurb: 'Power, water, gas, internet and phone.', fields: [
    { key: 'electricity', label: 'Electricity', icon: 'bolt' },
    { key: 'waterGas', label: 'Water and gas', icon: 'flame' },
    { key: 'internet', label: 'Internet and phone', icon: 'wifi' }
  ] },
  { id: 'transport', title: 'Getting around', icon: 'car', blurb: 'Fuel, fares, car insurance and car loan.', fields: [
    { key: 'fuel', label: 'Fuel', icon: 'fuel' },
    { key: 'transit', label: 'Bus, train, taxi fares and tolls', icon: 'train' },
    { key: 'carIns', label: 'Car insurance', icon: 'umbrella' },
    { key: 'carLoan', label: 'Car loan payment', icon: 'car' }
  ] },
  { id: 'family', title: 'Food, family & fun', icon: 'users', blurb: 'School, groceries, eating out and shopping.', fields: [
    { key: 'school', label: 'School fees or childcare', icon: 'school' },
    { key: 'groceries', label: 'Groceries', icon: 'cart' },
    { key: 'dining', label: 'Eating out and takeaways', icon: 'utensils' },
    { key: 'misc', label: 'Impulse shopping and extras', icon: 'bag' }
  ] },
  { id: 'care', title: 'Health, help & giving', icon: 'heart-pulse', blurb: 'Medicine, household help, money for family and charity. Skip what doesn’t apply.', fields: [
    { key: 'medical', label: 'Doctor visits and medicine', icon: 'heart-pulse' },
    { key: 'homeHelp', label: 'Household help (maid, cook, driver)', icon: 'users' },
    { key: 'familySupport', label: 'Money you send to family', icon: 'wallet' },
    { key: 'giving', label: 'Charity and religious giving', icon: 'gift' },
    { key: 'other', label: 'Anything else you pay each month', icon: 'list-check' }
  ] },
  { id: 'yearly', title: 'Once-a-year costs', icon: 'calendar', list: 'yearly', blurb: 'Big costs that don’t come every month. Enter the total for the whole year and we’ll work out what to put aside each month.' },
  { id: 'debt', title: 'Loans and credit cards', icon: 'card', list: 'debts', blurb: 'Optional. Skip if you have none.' },
  { id: 'subs', title: 'Subscriptions', icon: 'repeat', list: 'subscriptions', blurb: 'Optional. Streaming, AI and work tools, gym, apps and memberships.' },
  { id: 'savings', title: 'Emergency savings', icon: 'shield', blurb: 'Optional. Money already set aside.', fields: [
    { key: 'emergencyFund', label: 'Money saved for emergencies', icon: 'shield', help: 'A total amount, not monthly.', balance: true }
  ] }
];

const errors = new Map(); // input id -> message

/** One-tap suggestions for the once-a-year list. */
export const YEARLY_PRESETS = ['Festivals (Eid, Diwali, Christmas…)', 'Weddings and gifts', 'School books, uniforms and admission', 'Car service and repairs', 'Yearly insurance', 'Travel and trips home', 'Home repairs'];

// ---------------- Markup builders ----------------
function moneyField(f) {
  const id = `f-${f.key}`;
  return `
  <div>
    <div class="mb-1.5 flex items-center gap-2">
      <label for="${id}" class="label">${esc(f.label)}</label>
      ${helpBtn(f.key, f.label, HELP[f.key], `tip-${f.key}`)}
    </div>
    <div class="relative">
      <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400" data-symbol></span>
      <input id="${id}" data-field="${f.key}" type="text" inputmode="decimal" autocomplete="off" placeholder="0"
        class="input pl-12 ${f.balance ? '' : 'pr-16'} font-semibold" aria-describedby="${id}-msg${f.help ? ` ${id}-help` : ''}">
      ${f.balance ? '' : '<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400">a month</span>'}
    </div>
    ${f.help ? `<p id="${id}-help" class="mt-1 text-xs muted">${esc(f.help)}</p>` : ''}
    <p id="${id}-msg" class="mt-1 text-xs font-medium empty:hidden" aria-live="polite"></p>
  </div>`;
}

const housingQuestion = `
  <div id="housingAsk" hidden class="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
    <p class="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white" id="housingAskQ">Do you own your home or live rent-free? ${helpBtn('housingFree', 'Own your home or live rent-free')}</p>
    <div class="mt-3 flex gap-2" role="group" aria-labelledby="housingAskQ">
      <button type="button" class="btn btn-secondary flex-1" data-housing="yes" aria-pressed="false">Yes</button>
      <button type="button" class="btn btn-secondary flex-1" data-housing="no" aria-pressed="false">No, I pay for housing</button>
    </div>
    <p id="housingAskMsg" class="mt-3 text-sm empty:hidden"></p>
  </div>`;

function groupCard(g, index, collapsed) {
  let body;
  if (g.list === 'debts') {
    body = `<div id="debtRows" class="space-y-3"></div>
       <div class="mt-3 flex flex-wrap gap-2">
         <button type="button" class="btn btn-ghost" data-add="card">${icon('plus', 'icon-sm')}Add a credit card</button>
         <button type="button" class="btn btn-ghost" data-add="loan">${icon('plus', 'icon-sm')}Add a loan</button>
       </div>`;
  } else if (g.list === 'yearly') {
    body = `<p class="mb-2 text-xs font-medium muted" id="yearlyChipsLabel">Tap to add</p>
       <div id="yearlyChips" class="mb-4 flex flex-wrap gap-2" role="group" aria-labelledby="yearlyChipsLabel"></div>
       <div id="yearlyRows" class="space-y-3"></div>
       <button type="button" class="btn btn-ghost mt-3" data-add="yearly">${icon('plus', 'icon-sm')}Add your own</button>`;
  } else if (g.list === 'subscriptions') {
    body = `<div id="subRows" class="space-y-3"></div>
         <button type="button" class="btn btn-ghost mt-3" data-add="sub">${icon('plus', 'icon-sm')}Add a subscription</button>
         <div id="subSummary" hidden class="mt-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-950"></div>`;
  } else {
    body = `<div class="grid grid-cols-1 gap-4 ${g.fields.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-1' : ''}">${g.fields.map(moneyField).join('')}</div>${g.id === 'housing' ? housingQuestion : ''}`;
  }

  return `
  <details class="group-card card" data-group="${g.id}" ${collapsed ? '' : 'open'}>
    <summary>
      <span class="grp-num w-5 shrink-0 text-sm tabular-nums text-slate-400">${index + 1}</span>
      <span class="min-w-0 flex-1 font-semibold text-slate-900 dark:text-white">${esc(g.title)}</span>
      <span class="text-sm tabular-nums muted" data-sub="${g.id}"></span>
      ${icon('chevron-down', 'chev text-slate-500')}
    </summary>
    <div class="border-t border-slate-100 px-4 pb-5 pt-4 dark:border-slate-800">
      ${g.blurb ? `<p class="mb-4 text-sm muted group-blurb">${esc(g.blurb)}</p>` : ''}
      ${body}
    </div>
  </details>`;
}

const numInput = (list, row, key, label, helpKey) => `
  <div class="min-w-0">
    <div class="mb-1 flex items-center gap-1.5">
      <label for="r-${row.id}-${key}" class="text-xs font-medium muted">${label}</label>${helpBtn(helpKey, label)}
    </div>
    <input id="r-${row.id}-${key}" type="text" inputmode="decimal" autocomplete="off" placeholder="0" class="input px-2.5 font-semibold"
      data-list="${list}" data-id="${row.id}" data-key="${key}" value="${row[key] || ''}">
  </div>`;

function debtRow(d) {
  return `
  <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800" data-row="${d.id}">
    <div class="flex items-end gap-2">
      <div class="min-w-0 flex-1">
        <label for="r-${d.id}-name" class="mb-1 block text-xs font-medium muted">Name</label>
        <input id="r-${d.id}-name" type="text" class="input" maxlength="60" data-list="debts" data-id="${d.id}" data-key="name" value="${esc(d.name)}" placeholder="${d.type === 'card' ? 'e.g. Bank credit card' : 'e.g. Personal loan'}">
      </div>
      <div class="w-32 shrink-0">
        <label for="r-${d.id}-type" class="mb-1 block text-xs font-medium muted">Type</label>
        <select id="r-${d.id}-type" class="input select" data-list="debts" data-id="${d.id}" data-key="type">
          <option value="card" ${d.type === 'card' ? 'selected' : ''}>Credit card</option>
          <option value="loan" ${d.type === 'loan' ? 'selected' : ''}>Loan</option>
        </select>
      </div>
      <button type="button" class="btn-icon shrink-0 hover:text-rose-600" data-remove="debts" data-id="${d.id}" aria-label="Remove ${esc(d.name || 'this debt')}">${icon('trash')}</button>
    </div>
    <div class="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
      ${numInput('debts', d, 'balance', 'Amount owed', 'debtBalance')}
      ${numInput('debts', d, 'apr', 'Yearly interest rate (APR) %', 'debtApr')}
      ${numInput('debts', d, 'payment', 'Monthly payment', 'debtPayment')}
    </div>
  </div>`;
}

function subRow(s) {
  const kind = subKind(s);
  return `
  <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800" data-row="${s.id}">
    <div class="grid grid-cols-1 gap-3 min-[420px]:grid-cols-[2fr_1fr]">
      <div class="min-w-0">
        <label for="r-${s.id}-name" class="mb-1 block text-xs font-medium muted">Service</label>
        <input id="r-${s.id}-name" type="text" class="input" maxlength="60" data-list="subscriptions" data-id="${s.id}" data-key="name" value="${esc(s.name)}" placeholder="e.g. Netflix or Claude">
      </div>
      ${numInput('subscriptions', s, 'cost', 'Cost per month', 'subCost')}
    </div>
    <div class="mt-3">
      <div class="mb-1 flex items-center gap-1.5">
        <label for="r-${s.id}-kind" class="text-xs font-medium muted">Type</label>${helpBtn('subKind', 'Type')}
      </div>
      <select id="r-${s.id}-kind" class="input select" data-list="subscriptions" data-id="${s.id}" data-key="kind">
        ${Object.entries(SUB_KINDS).map(([k, v]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}
      </select>
      <p class="mt-2 flex gap-1.5 text-xs muted" data-sub-tip="${s.id}">${icon('lightbulb', 'h-3.5 w-3.5 mt-px shrink-0 text-amber-600 dark:text-amber-400')}<span>${esc(SUB_KINDS[kind].tip)}</span></p>
    </div>
    <div class="mt-2 flex items-center justify-between gap-2">
      <label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <input type="checkbox" class="h-5 w-5 rounded accent-emerald-700" data-list="subscriptions" data-id="${s.id}" data-key="rarely" ${s.rarely ? 'checked' : ''}>
        I rarely use this
      </label>
      <span class="flex items-center gap-1">${helpBtn('subRarely', 'I rarely use this')}
        <button type="button" class="btn-icon hover:text-rose-600" data-remove="subscriptions" data-id="${s.id}" aria-label="Remove ${esc(s.name || 'this subscription')}">${icon('trash')}</button></span>
    </div>
  </div>`;
}

function yearlyRow(y) {
  return `
  <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800" data-row="${y.id}">
    <div class="flex items-end gap-2">
      <div class="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[420px]:grid-cols-[2fr_1fr]">
        <div class="min-w-0">
          <label for="r-${y.id}-name" class="mb-1 block text-xs font-medium muted">What is it?</label>
          <input id="r-${y.id}-name" type="text" class="input" maxlength="60" data-list="yearly" data-id="${y.id}" data-key="name" value="${esc(y.name)}" placeholder="e.g. Birthday gifts">
        </div>
        ${numInput('yearly', y, 'cost', 'Cost for the whole year', 'yearlyCost')}
      </div>
      <button type="button" class="btn-icon shrink-0 hover:text-rose-600" data-remove="yearly" data-id="${y.id}" aria-label="Remove ${esc(y.name || 'this cost')}">${icon('trash')}</button>
    </div>
    <p class="mt-2 text-xs muted empty:hidden" data-yearly-month="${y.id}"></p>
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
    debtBox.innerHTML = s.debts.length ? s.debts.map(debtRow).join('') : '<p class="text-sm muted">No loans or cards added. That’s fine. Skip this if you don’t have any.</p>';
  }
  const yearlyBox = $('yearlyRows');
  const ySig = listSignature(s.yearly);
  if (force || yearlyBox.__sig !== ySig) {
    yearlyBox.__sig = ySig;
    yearlyBox.innerHTML = s.yearly.length ? s.yearly.map(yearlyRow).join('') : '<p class="text-sm muted">Nothing added yet. Tap a suggestion above, or add your own.</p>';
  }
  // Suggestions that aren't on the list yet
  const have = new Set(s.yearly.map((y) => y.name.trim().toLowerCase()));
  const chips = YEARLY_PRESETS.filter((name) => !have.has(name.toLowerCase()));
  const chipBox = $('yearlyChips');
  const cSig = chips.join('|');
  if (force || chipBox.__sig !== cSig) {
    chipBox.__sig = cSig;
    chipBox.innerHTML = chips.map((name) => `<button type="button" class="suggest" data-add="yearly" data-name="${esc(name)}">${icon('plus', 'icon-sm')}${esc(name)}</button>`).join('');
    chipBox.hidden = !chips.length;
    $('yearlyChipsLabel').hidden = !chips.length;
  }
  const sSig = listSignature(s.subscriptions);
  if (force || subBox.__sig !== sSig) {
    subBox.__sig = sSig;
    subBox.innerHTML = s.subscriptions.length ? s.subscriptions.map(subRow).join('') : '<p class="text-sm muted">No subscriptions yet. Add streaming, apps or a gym, and tick the ones you rarely use.</p>';
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
  const { values, subsTotal, debtPayments, yearly, yearlyMonthly } = result.totals;
  const subtotal = (fields) => fields.reduce((a, f) => a + (values[f] || 0), 0);
  const B = benchmarkFor(state.currency, state.profile);
  const who = PROFILES[state.profile];
  const nice = (n) => moneyNice(n, state.currency);

  document.querySelectorAll('[data-symbol]').forEach((el) => setText(el, view.symbol));

  for (const g of GROUPS) {
    const el = document.querySelector(`[data-sub="${g.id}"]`);
    let txt;
    if (g.id === 'income') txt = values.income ? `${view.m(values.income)}${view.per}` : 'Start here';
    else if (g.id === 'savings') txt = values.emergencyFund ? `${view.raw(values.emergencyFund)} saved` : 'Optional';
    else if (g.list === 'debts') txt = state.debts.length ? `${view.m(debtPayments)}${view.per} · ${state.debts.length} added` : 'Optional';
    else if (g.list === 'yearly') txt = state.yearly.length ? `${view.m(yearlyMonthly)}${view.per} · ${state.yearly.length} added` : 'Optional';
    else if (g.list === 'subscriptions') txt = state.subscriptions.length ? `${view.m(subsTotal)}${view.per} · ${state.subscriptions.length} added` : 'Optional';
    else txt = `${view.m(subtotal(g.fields.map((f) => f.key)))}${view.per}`;
    setText(el, txt);

    if (!g.fields) continue;
    for (const f of g.fields) {
      if (f.balance) continue;
      const range = typicalRange(state.profile, f.key, state.currency);
      const rangeTxt = range[1] === 0 ? 'usually nothing' : `usually ${nice(range[0])} to ${nice(range[1])} a month`;
      setText($(`tip-${f.key}`), `${HELP[f.key]} For ${who.group}, this is ${rangeTxt}${B.approximate ? ' (a rough guide for this currency)' : ''}.`);

      // Inline status: validation error wins, otherwise "higher than typical"
      const input = $(`f-${f.key}`);
      const msg = $(`f-${f.key}-msg`);
      const err = errors.get(input.id);
      if (err) {
        setText(msg, err);
        setAttr(msg, 'class', 'mt-1 text-xs font-medium text-rose-700 dark:text-rose-400');
      } else if (f.key !== 'income' && range[1] > 0 && values[f.key] > range[1]) {
        setText(msg, `Higher than typical for ${who.group} (usually up to ${nice(range[1])})`);
        setAttr(msg, 'class', 'mt-1 text-xs font-medium text-amber-700 dark:text-amber-400');
      } else {
        setText(msg, '');
      }
    }
  }

  // Housing question appears only while rent/mortgage is empty
  const ask = $('housingAsk');
  ask.hidden = values.rent > 0;
  if (!ask.hidden) {
    ask.querySelectorAll('[data-housing]').forEach((b) => {
      const on = (b.dataset.housing === 'yes' && state.housingFree === true) || (b.dataset.housing === 'no' && state.housingFree === false);
      setAttr(b, 'aria-pressed', String(on));
      b.className = `btn flex-1 ${on ? 'btn-primary' : 'btn-secondary'}`;
    });
    const msg = $('housingAskMsg');
    if (state.housingFree === true) {
      setText(msg, 'Got it. We won’t count housing as a cost.');
      setAttr(msg, 'class', 'mt-3 text-sm text-emerald-800 dark:text-emerald-300');
    } else if (state.housingFree === false) {
      setText(msg, 'Please add your rent or mortgage above so your results are accurate.');
      setAttr(msg, 'class', 'mt-3 text-sm font-medium text-amber-800 dark:text-amber-300');
    } else setText(msg, '');
  }
  renderRows();
  renderSubKinds(state, result, view);
  for (const y of yearly) {
    setText(document.querySelector(`[data-yearly-month="${y.id}"]`), y.cost > 0 ? `That’s ${view.raw(y.cost / 12)} to put aside each month.` : '');
  }
}

/** Keeps each row's type and tip in step with its name, and the by-type summary. */
function renderSubKinds(state, result, view) {
  for (const s of state.subscriptions) {
    const kind = subKind(s);
    const sel = $(`r-${s.id}-kind`);
    // Until the user picks a type, it follows the name as they type it
    if (sel && sel.value !== kind && document.activeElement !== sel) sel.value = kind;
    const tip = document.querySelector(`[data-sub-tip="${s.id}"] span`);
    setText(tip, SUB_KINDS[kind].tip);
  }
  const { subsByKind, subsTotal, income } = result.totals;
  const box = $('subSummary');
  box.hidden = !(subsTotal > 0);
  if (box.hidden) return;
  const B = benchmarkFor(state.currency, state.profile);
  const limit = income * B.categoryShare.subscriptions;
  const rows = Object.entries(subsByKind).sort((a, b) => b[1] - a[1]).map(([k, amt]) =>
    `<li class="flex justify-between gap-3"><span class="flex items-center gap-2">${icon(SUB_KINDS[k].icon, 'icon-sm text-slate-400')}${esc(SUB_KINDS[k].label)}</span><span class="tabular-nums">${esc(view.m(amt))}</span></li>`).join('');
  const over = income > 0 && subsTotal > limit;
  const guide = income > 0
    ? `<p class="mt-3 border-t border-slate-200 pt-3 text-xs dark:border-slate-800 ${over ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'}">
        ${over
          ? `That’s ${Math.round((subsTotal / income) * 1000) / 10}% of your income. A good guide is under ${Math.round(B.categoryShare.subscriptions * 100)}% (${esc(view.m(limit))}${view.per}). Start with the ones you rarely use.`
          : `That’s ${Math.round((subsTotal / income) * 1000) / 10}% of your income, within the guide of under ${Math.round(B.categoryShare.subscriptions * 100)}%.`}</p>`
    : '';
  box.innerHTML = `<p class="mb-2 font-medium text-slate-900 dark:text-white">By type</p><ul class="space-y-1.5">${rows}</ul>
    <p class="mt-2 flex justify-between gap-3 font-semibold text-slate-900 dark:text-white"><span>Total</span><span class="tabular-nums">${esc(view.m(subsTotal))}${view.per}</span></p>${guide}`;
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
    else if (key === 'kind') v = SUB_KINDS[el.value] ? el.value : '';
    else {
      const r = parseAmount(el.value);
      v = key === 'apr' ? Math.min(100, r.value) : r.value;
      el.setAttribute('aria-invalid', r.error ? 'true' : 'false');
      el.title = r.error || '';
    }
    const instant = key === 'rarely' || key === 'type' || key === 'kind';
    setState((s) => {
      const row = s[list].find((x) => x.id === id);
      if (row) row[key] = v;
      s.ui.sample = false;
    }, { reason: instant ? 'change' : 'input' });
  }
}

export function initInputs() {
  const s = getState();
  $('inputGroups').innerHTML = GROUPS.map((g, i) => groupCard(g, i, s.ui.collapsed[g.id])).join('');
  $('currency').innerHTML = Object.entries(CURRENCIES).map(([code, c]) => `<option value="${code}">${esc(c.label)}</option>`).join('');

  $('budgetForm').addEventListener('submit', (e) => e.preventDefault());
  // Inputs may live inside the wizard or the sidebar; listen on the document.
  document.addEventListener('input', (e) => { if (e.target.closest('[data-group]')) onFieldInput(e); });
  document.addEventListener('change', (e) => {
    if (e.target.closest('[data-group]') && e.target.matches('input[type="checkbox"], select[data-list]')) onFieldInput(e);
  });

  // Remember which groups are collapsed (sidebar view only)
  document.addEventListener('toggle', (e) => {
    const g = e.target.closest?.('details[data-group]');
    if (g && !g.classList.contains('in-wizard')) setState((st) => { st.ui.collapsed[g.dataset.group] = !g.open; }, { reason: 'ui' });
  }, true);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-group]')) return;
    const hb = e.target.closest('[data-housing]');
    if (hb) {
      const yes = hb.dataset.housing === 'yes';
      setState((st) => { st.housingFree = st.housingFree === yes ? null : yes; });
      if (!yes) requestAnimationFrame(() => $('f-rent')?.focus());
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      const kind = add.dataset.add;
      const LIST = { sub: 'subscriptions', yearly: 'yearly' };
      const row = kind === 'sub'
        ? { id: newId('s'), name: '', cost: 0, rarely: false, kind: '' }
        : kind === 'yearly'
          ? { id: newId('y'), name: add.dataset.name || '', cost: 0 }
          : { id: newId('d'), type: kind, name: '', balance: 0, apr: kind === 'card' ? (getState().currency === 'PKR' ? 38 : 22) : 8, payment: 0 };
      setState((st) => { st[LIST[kind] || 'debts'].push(row); });
      // A suggestion already has its name, so jump straight to the amount
      requestAnimationFrame(() => document.querySelector(row.name ? `#r-${row.id}-cost` : `[data-row="${row.id}"] input`)?.focus());
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const { remove: list, id } = rm.dataset;
      const st = getState();
      const idx = st[list].findIndex((x) => x.id === id);
      const removed = st[list][idx];
      setState((x) => { x[list] = x[list].filter((r) => r.id !== id); });
      toast(`${removed?.name || { debts: 'Loan', subscriptions: 'Subscription', yearly: 'Cost' }[list]} removed`, {
        action: { label: 'Undo', onClick: () => setState((x) => { x[list].splice(idx, 0, removed); }) }
      });
    }
  });

  // Settings card
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
  const inc = sample.values.income;
  const roundTo = inc >= 100000 ? 10000 : 100;
  replaceState({
    ...st,
    values: sample.values,
    debts: sample.debts,
    subscriptions: sample.subscriptions,
    yearly: sample.yearly,
    housingFree: null,
    plan: { committed: {}, pct: {}, sort: st.plan.sort },
    goals: st.goals.length ? st.goals : [
      { id: newId('g'), name: 'Family holiday', target: Math.round((inc * 0.4) / roundTo) * roundTo, saved: 0 },
      { id: newId('g'), name: 'New laptop', target: Math.round((inc * 0.2) / roundTo) * roundTo, saved: 0 }
    ],
    ui: { ...st.ui, sample: true, mode: 'results' }
  }, 'sample');
  toast(`Example budget loaded for a ${PROFILES[st.profile].name}`, {
    action: { label: 'Undo', onClick: () => replaceState(prev) }
  });
}

async function resetAll() {
  const ok = await confirmDialog({
    title: 'Delete all your numbers?',
    message: 'This removes every amount, plan choice, goal and saved month from this device. You can’t undo this.',
    confirmLabel: 'Yes, delete everything',
    danger: true
  });
  if (!ok) return;
  const keep = getState();
  clearStorage();
  replaceState({ ...defaultState(), profile: keep.profile, currency: keep.currency }, 'reset');
  toast('All your numbers were deleted from this device', { tone: 'info' });
}
