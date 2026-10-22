// Form rendering, validation and the settings card (profile, period,
// sample data; starting over lives in reset.js). Group markup is built once; afterwards only the parts
// that change (subtotals, hints, dynamic rows) are touched. The wizard moves
// these same group elements into its steps, so there is one set of inputs.

import { getState, setState, replaceState } from '../state.js';
import { PROFILES, typicalRange, sampleFor, newId, benchmarkFor } from '../engine/profiles.js';
import { countryData } from '../engine/countries.js';
import { PAY_FREQUENCIES, toMonthly, fromMonthly, localFields, hiddenFields, CUSTOM_CATEGORY } from '../engine/calculate.js';
import { CURRENCIES, parseAmount, decimalSeparator, moneyNice } from '../utils/format.js';
import { $, icon, esc, setText, setAttr, toast } from './dom.js';
import { helpBtn, HELP, nextHelpId } from './help.js';
import { t, has } from '../i18n/index.js';
import { SUB_KINDS, subKind } from '../engine/subscriptions.js';
import { withSign } from '../utils/format.js';

/** A field whose label (and optional help line) is translated when read. */
function field(key, icon, extra = {}) {
  const f = { key, icon, ...extra, get label() { return t(`inputs.fields.${key}.label`); } };
  if (extra.help) Object.defineProperty(f, 'help', { get: () => t(`inputs.fields.${key}.help`), enumerable: true });
  return f;
}

/** A group whose title (and optional blurb) is translated when read. */
function group(id, icon, extra = {}) {
  const g = { id, icon, ...extra, get title() { return t(`inputs.groups.${id}.title`); } };
  if (extra.blurb) Object.defineProperty(g, 'blurb', { get: () => t(`inputs.groups.${id}.blurb`), enumerable: true });
  return g;
}

export const GROUPS = [
  group('income', 'wallet', { fields: [
    field('income', 'wallet', { help: true })
  ] }),
  group('extras', 'gift', { list: 'extras', blurb: true }),
  group('housing', 'home', { blurb: true, fields: [
    field('rent', 'key'),
    field('maintenance', 'building'),
    field('homeIns', 'umbrella')
  ] }),
  group('utilities', 'bolt', { blurb: true, fields: [
    field('electricity', 'bolt'),
    field('waterGas', 'flame'),
    field('internet', 'wifi')
  ] }),
  group('transport', 'car', { blurb: true, fields: [
    field('fuel', 'fuel'),
    field('transit', 'train'),
    field('carIns', 'umbrella'),
    field('carLoan', 'car')
  ] }),
  group('family', 'users', { blurb: true, fields: [
    field('school', 'school'),
    field('groceries', 'cart'),
    field('dining', 'utensils'),
    field('misc', 'bag')
  ] }),
  group('care', 'heart-pulse', { blurb: true, fields: [
    field('medical', 'heart-pulse'),
    field('homeHelp', 'users'),
    field('familySupport', 'wallet'),
    field('giving', 'gift'),
    field('other', 'list-check')
  ] }),
  group('yearly', 'calendar', { list: 'yearly', blurb: true }),
  group('debt', 'card', { list: 'debts', blurb: true }),
  group('subs', 'repeat', { list: 'subscriptions', blurb: true }),
  group('savings', 'shield', { blurb: true, fields: [
    field('emergencyFund', 'shield', { help: true, balance: true })
  ] })
];

const errors = new Map(); // input id -> message

/** One-tap suggestions for money that doesn't come every month (inputs.presets.extra.<key>). */
export const EXTRA_PRESET_KEYS = ['festivalBonus', 'performanceBonus', 'appreciationBonus', 'overtime', 'sideWork', 'thirteenthMonth', 'taxRefund'];
/** The suggestion names in the active language. */
export const extraPresets = () => EXTRA_PRESET_KEYS.map((k) => t(`inputs.presets.extra.${k}`));

/** One-tap suggestions for the once-a-year list (inputs.presets.yearly.<key>). */
export const YEARLY_PRESET_KEYS = ['festivals', 'weddings', 'schoolBooks', 'carService', 'insurance', 'travel', 'homeRepairs'];
/** The suggestion names in the active language. */
export const yearlyPresets = () => YEARLY_PRESET_KEYS.map((k) => t(`inputs.presets.yearly.${k}`));

/** The income box's label for a pay frequency (monthly keeps the original wording). */
const incomeLabel = (freq) => (freq === 'monthly' ? t('inputs.fields.income.label') : t(`inputs.payFrequency.fieldLabel.${freq}`));

/** Income as shown in its box: one pay, to the cent. */
const incomeShown = (s) => (s.values.income ? String(Math.round(fromMonthly(s.values.income, s.payFrequency) * 100) / 100) : '');

/** One of the country's own bills as a field: label and help in the active language. */
function localField(f, country) {
  const k = `countryFields.${country}.${f.key}`;
  return {
    key: f.key, local: true,
    label: has(`${k}.label`) ? t(`${k}.label`) : f.label,
    tip: has(`${k}.help`) ? t(`${k}.help`) : f.help || ''
  };
}

// ---------------- Markup builders ----------------
function moneyField(f) {
  const id = `f-${f.key}`;
  const pay = f.key === 'income';
  const freq = getState().payFrequency;
  const label = pay ? incomeLabel(freq) : f.label;
  // Income: the currency sign is also the currency picker.
  // The real <select> is invisible over "₹ ▾", so the open list still shows full names.
  const symbol = pay
    ? `<select id="incomeCurrency" class="peer absolute inset-y-0 start-0 z-10 w-16 cursor-pointer opacity-0" aria-label="${esc(t('page.inputs.currency'))}"></select>
      <span class="pointer-events-none absolute start-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded px-1 text-sm text-slate-500 peer-hover:text-slate-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-700 dark:text-slate-400 dark:peer-hover:text-white dark:peer-focus-visible:outline-emerald-400"><span data-symbol></span>${icon('chevron-down', 'h-3.5 w-3.5')}</span>`
    : '<span class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400" data-symbol></span>';
  const box = `
    <div class="relative${pay ? ' min-w-0 flex-1' : ''}">
      ${symbol}
      <input id="${id}" ${f.local ? `data-local="${f.key}"` : `data-field="${f.key}"`} type="text" inputmode="decimal" autocomplete="off" placeholder="0"
        class="input ${pay ? 'ps-16' : 'ps-12'} ${f.balance || pay ? '' : 'pe-16'} font-semibold" aria-describedby="${id}-msg${f.help ? ` ${id}-help` : ''}${pay ? ` ${id}-month` : ''}">
      ${f.balance || pay ? '' : `<span class="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400">${esc(t('inputs.fields.perMonth'))}</span>`}
    </div>`;
  // Pay frequency sits beside the income box, styled like the other dropdowns
  const freqSelect = pay ? `
    <div class="w-36 shrink-0">
      <select id="payFrequency" class="input select" aria-label="${esc(t('inputs.payFrequency.label'))}">
        ${Object.keys(PAY_FREQUENCIES).map((k) => `<option value="${k}" ${k === freq ? 'selected' : ''}>${esc(t(`inputs.payFrequency.options.${k}`))}</option>`).join('')}
      </select>
    </div>` : '';
  return `
  <div data-field-wrap="${f.key}">
    <div class="mb-1.5 flex items-center gap-2">
      <label for="${id}" class="label">${esc(label)}</label>
      ${helpBtn(f.key, label, f.local ? f.tip : HELP[f.key], `tip-${f.key}`)}
    </div>
    ${pay ? `<div class="flex gap-2">${box}${freqSelect}</div>` : box}
    ${f.help ? `<p id="${id}-help" class="mt-1 text-xs muted">${esc(f.help)}</p>` : ''}
    ${pay ? `<p id="${id}-month" class="mt-1 text-xs muted empty:hidden"></p>` : ''}
    <p id="${id}-msg" class="mt-1 text-xs font-medium empty:hidden" aria-live="polite"></p>
  </div>`;
}

const housingHelpId = nextHelpId(); // reserved at load so the id stays stable
const housingQuestion = () => `
  <div id="housingAsk" hidden class="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
    <p class="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white" id="housingAskQ">${esc(t('inputs.housing.question'))} ${helpBtn('housingFree', t('inputs.housing.helpLabel'), undefined, housingHelpId)}</p>
    <div class="mt-3 flex gap-2" role="group" aria-labelledby="housingAskQ">
      <button type="button" class="btn btn-secondary flex-1" data-housing="yes" aria-pressed="false">${esc(t('inputs.housing.yes'))}</button>
      <button type="button" class="btn btn-secondary flex-1" data-housing="no" aria-pressed="false">${esc(t('inputs.housing.no'))}</button>
    </div>
    <p id="housingAskMsg" class="mt-3 text-sm empty:hidden"></p>
  </div>`;

function groupCard(g, index, collapsed) {
  let body;
  if (g.list === 'debts') {
    body = `<div id="debtRows" class="space-y-3"></div>
       <div class="mt-3 flex flex-wrap gap-2">
         <button type="button" class="btn btn-ghost" data-add="card">${icon('plus', 'icon-sm')}${esc(t('inputs.debts.addCard'))}</button>
         <button type="button" class="btn btn-ghost" data-add="loan">${icon('plus', 'icon-sm')}${esc(t('inputs.debts.addLoan'))}</button>
       </div>`;
  } else if (g.list === 'yearly') {
    body = `<p class="mb-2 text-xs font-medium muted" id="yearlyChipsLabel">${esc(t('inputs.chips.tapToAdd'))}</p>
       <div id="yearlyChips" class="mb-4 flex flex-wrap gap-2" role="group" aria-labelledby="yearlyChipsLabel"></div>
       <div id="yearlyRows" class="space-y-3"></div>
       <button type="button" class="btn btn-ghost mt-3" data-add="yearly">${icon('plus', 'icon-sm')}${esc(t('inputs.chips.addOwn'))}</button>`;
  } else if (g.list === 'extras') {
    body = `<p class="mb-2 text-xs font-medium muted" id="extraChipsLabel">${esc(t('inputs.chips.tapToAdd'))}</p>
       <div id="extraChips" class="mb-4 flex flex-wrap gap-2" role="group" aria-labelledby="extraChipsLabel"></div>
       <div id="extraRows" class="space-y-3"></div>
       <button type="button" class="btn btn-ghost mt-3" data-add="extra">${icon('plus', 'icon-sm')}${esc(t('inputs.chips.addOwn'))}</button>`;
  } else if (g.list === 'subscriptions') {
    body = `<div id="subRows" class="space-y-3"></div>
         <button type="button" class="btn btn-ghost mt-3" data-add="sub">${icon('plus', 'icon-sm')}${esc(t('inputs.subs.add'))}</button>
         <div id="subSummary" hidden class="mt-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-950"></div>`;
  } else {
    // data-local-group: the country's own bills for this group, filled by renderLocalFields
    const localBox = g.id === 'income' || g.id === 'savings' ? '' : `<div class="contents" data-local-group="${g.id}"></div>`;
    body = `<div class="grid grid-cols-1 gap-4 ${g.fields.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-1' : ''}">${g.fields.map(moneyField).join('')}${localBox}</div>${g.id === 'housing' ? housingQuestion() : ''}`;
    if (g.id === CUSTOM_CATEGORY) {
      body += `<div class="mt-4">
         <div id="customRows" class="mb-3 space-y-3 empty:hidden"></div>
         <button type="button" class="btn btn-ghost" data-add="custom">${icon('plus', 'icon-sm')}${esc(t('inputs.custom.add'))}</button>
       </div>`;
    }
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
      <label for="r-${row.id}-${key}" class="text-xs font-medium muted">${esc(label)}</label>${helpBtn(helpKey, label)}
    </div>
    <input id="r-${row.id}-${key}" type="text" inputmode="decimal" autocomplete="off" placeholder="0" class="input px-2.5 font-semibold"
      data-list="${list}" data-id="${row.id}" data-key="${key}" value="${row[key] || ''}" aria-describedby="r-${row.id}-${key}-msg">
    <p id="r-${row.id}-${key}-msg" class="mt-1 text-xs font-medium empty:hidden" aria-live="polite"></p>
  </div>`;

/** Shows a row field's problem under it: an error (red) or a note (amber). */
function showRowMsg(el, text, tone) {
  const msg = $(`${el.id}-msg`);
  if (!msg) return;
  setText(msg, text || '');
  msg.className = `mt-1 text-xs font-medium empty:hidden ${tone === 'error' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`;
}

function debtRow(d) {
  return `
  <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800" data-row="${d.id}">
    <div class="flex items-end gap-2">
      <div class="min-w-0 flex-1">
        <label for="r-${d.id}-name" class="mb-1 block text-xs font-medium muted">${esc(t('inputs.debts.name'))}</label>
        <input id="r-${d.id}-name" type="text" class="input" maxlength="60" data-list="debts" data-id="${d.id}" data-key="name" value="${esc(d.name)}" placeholder="${esc(d.type === 'card' ? t('inputs.debts.placeholderCard') : t('inputs.debts.placeholderLoan'))}">
      </div>
      <div class="w-32 shrink-0">
        <label for="r-${d.id}-type" class="mb-1 block text-xs font-medium muted">${esc(t('inputs.debts.type'))}</label>
        <select id="r-${d.id}-type" class="input select" data-list="debts" data-id="${d.id}" data-key="type">
          <option value="card" ${d.type === 'card' ? 'selected' : ''}>${esc(t('inputs.debts.typeCard'))}</option>
          <option value="loan" ${d.type === 'loan' ? 'selected' : ''}>${esc(t('inputs.debts.typeLoan'))}</option>
        </select>
      </div>
      <button type="button" class="btn-icon shrink-0 hover:text-rose-600" data-remove="debts" data-id="${d.id}" aria-label="${esc(t('inputs.rows.remove', { name: d.name || t('inputs.rows.thisDebt') }))}">${icon('trash')}</button>
    </div>
    <div class="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
      ${numInput('debts', d, 'balance', t('inputs.debts.balance'), 'debtBalance')}
      ${numInput('debts', d, 'apr', t('inputs.debts.apr'), 'debtApr')}
      ${numInput('debts', d, 'payment', t('inputs.debts.payment'), 'debtPayment')}
    </div>
  </div>`;
}

function subRow(s) {
  const kind = subKind(s);
  return `
  <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800" data-row="${s.id}">
    <div class="grid grid-cols-1 gap-3 min-[420px]:grid-cols-[2fr_1fr]">
      <div class="min-w-0">
        <label for="r-${s.id}-name" class="mb-1 block text-xs font-medium muted">${esc(t('inputs.subs.service'))}</label>
        <input id="r-${s.id}-name" type="text" class="input" maxlength="60" data-list="subscriptions" data-id="${s.id}" data-key="name" value="${esc(s.name)}" placeholder="${esc(t('inputs.subs.placeholder'))}">
      </div>
      ${numInput('subscriptions', s, 'cost', t('inputs.subs.cost'), 'subCost')}
    </div>
    <div class="mt-3">
      <div class="mb-1 flex items-center gap-1.5">
        <label for="r-${s.id}-kind" class="text-xs font-medium muted">${esc(t('inputs.subs.type'))}</label>${helpBtn('subKind', t('inputs.subs.type'))}
      </div>
      <select id="r-${s.id}-kind" class="input select" data-list="subscriptions" data-id="${s.id}" data-key="kind">
        ${Object.entries(SUB_KINDS).map(([k, v]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}
      </select>
      <p class="mt-2 flex gap-1.5 text-xs muted" data-sub-tip="${s.id}">${icon('lightbulb', 'h-3.5 w-3.5 mt-px shrink-0 text-amber-600 dark:text-amber-400')}<span>${esc(SUB_KINDS[kind].tip)}</span></p>
    </div>
    <div class="mt-2 flex items-center justify-between gap-2">
      <label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <input type="checkbox" class="h-5 w-5 rounded accent-emerald-700" data-list="subscriptions" data-id="${s.id}" data-key="rarely" ${s.rarely ? 'checked' : ''}>
        ${esc(t('inputs.subs.rarely'))}
      </label>
      <span class="flex items-center gap-1">${helpBtn('subRarely', t('inputs.subs.rarely'))}
        <button type="button" class="btn-icon hover:text-rose-600" data-remove="subscriptions" data-id="${s.id}" aria-label="${esc(t('inputs.rows.remove', { name: s.name || t('inputs.rows.thisSubscription') }))}">${icon('trash')}</button></span>
    </div>
  </div>`;
}

function yearlyRow(y) {
  return `
  <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800" data-row="${y.id}">
    <div class="flex items-end gap-2">
      <div class="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[420px]:grid-cols-[2fr_1fr]">
        <div class="min-w-0">
          <label for="r-${y.id}-name" class="mb-1 block text-xs font-medium muted">${esc(t('inputs.rows.whatIsIt'))}</label>
          <input id="r-${y.id}-name" type="text" class="input" maxlength="60" data-list="yearly" data-id="${y.id}" data-key="name" value="${esc(y.name)}" placeholder="${esc(t('inputs.yearly.placeholder'))}">
        </div>
        ${numInput('yearly', y, 'cost', t('inputs.yearly.cost'), 'yearlyCost')}
      </div>
      <button type="button" class="btn-icon shrink-0 hover:text-rose-600" data-remove="yearly" data-id="${y.id}" aria-label="${esc(t('inputs.rows.remove', { name: y.name || t('inputs.rows.thisCost') }))}">${icon('trash')}</button>
    </div>
    <p class="mt-2 text-xs muted empty:hidden" data-yearly-month="${y.id}"></p>
  </div>`;
}

function extraRow(x) {
  return `
  <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800" data-row="${x.id}">
    <div class="flex items-end gap-2">
      <div class="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[420px]:grid-cols-[2fr_1fr]">
        <div class="min-w-0">
          <label for="r-${x.id}-name" class="mb-1 block text-xs font-medium muted">${esc(t('inputs.rows.whatIsIt'))}</label>
          <input id="r-${x.id}-name" type="text" class="input" maxlength="60" data-list="extras" data-id="${x.id}" data-key="name" value="${esc(x.name)}" placeholder="${esc(t('inputs.extras.placeholder'))}">
        </div>
        ${numInput('extras', x, 'amount', t('inputs.extras.amount'), 'extraAmount')}
      </div>
      <button type="button" class="btn-icon shrink-0 hover:text-rose-600" data-remove="extras" data-id="${x.id}" aria-label="${esc(t('inputs.rows.remove', { name: x.name || t('inputs.rows.thisIncome') }))}">${icon('trash')}</button>
    </div>
    <p class="mt-2 text-xs muted empty:hidden" data-extra-month="${x.id}"></p>
  </div>`;
}

function customRow(x) {
  return `
  <div class="rounded-lg border border-slate-200 p-3 dark:border-slate-800" data-row="${x.id}">
    <div class="flex items-end gap-2">
      <div class="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[420px]:grid-cols-[2fr_1fr]">
        <div class="min-w-0">
          <label for="r-${x.id}-name" class="mb-1 block text-xs font-medium muted">${esc(t('inputs.rows.whatIsIt'))}</label>
          <input id="r-${x.id}-name" type="text" class="input" maxlength="60" data-list="custom" data-id="${x.id}" data-key="name" value="${esc(x.name)}" placeholder="${esc(t('inputs.custom.placeholder'))}">
        </div>
        ${numInput('custom', x, 'amount', t('inputs.custom.amount'), 'customAmount')}
      </div>
      <button type="button" class="btn-icon shrink-0 hover:text-rose-600" data-remove="custom" data-id="${x.id}" aria-label="${esc(t('inputs.rows.remove', { name: x.name || t('inputs.rows.thisExpense') }))}">${icon('trash')}</button>
    </div>
    <div class="mt-3">
      <label for="r-${x.id}-need" class="mb-1 block text-xs font-medium muted">${esc(t('inputs.custom.type'))}</label>
      <select id="r-${x.id}-need" class="input select" data-list="custom" data-id="${x.id}" data-key="need">
        <option value="need" ${x.need !== false ? 'selected' : ''}>${esc(t('inputs.custom.need'))}</option>
        <option value="want" ${x.need === false ? 'selected' : ''}>${esc(t('inputs.custom.want'))}</option>
      </select>
    </div>
  </div>`;
}

/**
 * Puts the country's own bills into their groups. Rebuilt only when the
 * country (or its data, which may arrive later) changes.
 */
function renderLocalFields() {
  const s = getState();
  const fields = localFields(s.country);
  const sig = `${s.country}:${fields.map((f) => f.key).join('|')}`;
  document.querySelectorAll('[data-local-group]').forEach((box) => {
    if (box.__sig === sig) return;
    box.__sig = sig;
    box.innerHTML = fields.filter((f) => f.group === box.dataset.localGroup).map((f) => moneyField(localField(f, s.country))).join('');
    box.querySelectorAll('[data-local]').forEach((el) => {
      const v = s.local[el.dataset.local];
      el.value = v ? String(v) : '';
    });
  });
}

/** Tap-to-add chips for the names not on a list yet. */
function renderChips(boxId, labelId, presets, rows, list, force) {
  const have = new Set(rows.map((r) => r.name.trim().toLowerCase()));
  const chips = presets.filter((name) => !have.has(name.toLowerCase()));
  const box = $(boxId);
  const sig = chips.join('|');
  if (!force && box.__sig === sig) return;
  box.__sig = sig;
  box.innerHTML = chips.map((name) => `<button type="button" class="suggest" data-add="${list}" data-name="${esc(name)}">${icon('plus', 'icon-sm')}${esc(name)}</button>`).join('');
  box.hidden = !chips.length;
  $(labelId).hidden = !chips.length;
}

const listSignature = (arr) => arr.map((x) => x.id + (x.type || '')).join('|');

function renderRows(force = false) {
  const s = getState();
  const debtBox = $('debtRows');
  const subBox = $('subRows');
  const dSig = listSignature(s.debts);
  if (force || debtBox.__sig !== dSig) {
    debtBox.__sig = dSig;
    debtBox.innerHTML = s.debts.length ? s.debts.map(debtRow).join('') : `<p class="text-sm muted">${esc(t('inputs.debts.empty'))}</p>`;
  }
  const yearlyBox = $('yearlyRows');
  const ySig = listSignature(s.yearly);
  if (force || yearlyBox.__sig !== ySig) {
    yearlyBox.__sig = ySig;
    yearlyBox.innerHTML = s.yearly.length ? s.yearly.map(yearlyRow).join('') : `<p class="text-sm muted">${esc(t('inputs.chips.empty'))}</p>`;
  }
  renderChips('yearlyChips', 'yearlyChipsLabel', yearlyPresets(), s.yearly, 'yearly', force);
  const extraBox = $('extraRows');
  const xSig = listSignature(s.extras);
  if (force || extraBox.__sig !== xSig) {
    extraBox.__sig = xSig;
    extraBox.innerHTML = s.extras.length ? s.extras.map(extraRow).join('') : `<p class="text-sm muted">${esc(t('inputs.chips.empty'))}</p>`;
  }
  renderChips('extraChips', 'extraChipsLabel', extraPresets(), s.extras, 'extra', force);
  const customBox = $('customRows');
  const cSig = listSignature(s.custom);
  if (force || customBox.__sig !== cSig) {
    customBox.__sig = cSig;
    customBox.innerHTML = s.custom.map(customRow).join('');
  }
  const sSig = listSignature(s.subscriptions);
  if (force || subBox.__sig !== sSig) {
    subBox.__sig = sSig;
    subBox.innerHTML = s.subscriptions.length ? s.subscriptions.map(subRow).join('') : `<p class="text-sm muted">${esc(t('inputs.subs.empty'))}</p>`;
  }
}

// ---------------- Sync state -> inputs ----------------
/** Writes state values into inputs (after load, sample, import or reset). */
export function syncInputs() {
  const s = getState();
  errors.clear();
  renderLocalFields();
  document.querySelectorAll('[data-field]').forEach((el) => {
    const v = s.values[el.dataset.field];
    el.value = el.dataset.field === 'income' ? incomeShown(s) : v ? String(v) : '';
    el.removeAttribute('aria-invalid');
  });
  document.querySelectorAll('[data-local]').forEach((el) => {
    const v = s.local[el.dataset.local];
    el.value = v ? String(v) : '';
    el.removeAttribute('aria-invalid');
  });
  $('payFrequency').value = s.payFrequency;
  renderRows(true);
  $('profile').value = s.profile;
  $('incomeCurrency').value = s.currency;
  document.querySelectorAll('input[name="period"]').forEach((r) => { r.checked = r.value === s.period; });
}

// ---------------- Render (called after every recompute) ----------------
export function renderInputs(state, result, view) {
  const { values, subsTotal, debtPayments, yearly, yearlyMonthly, extras, extrasMonthly } = result.totals;
  const subtotal = (fields) => fields.reduce((a, f) => a + (values[f] || 0), 0);
  const B = benchmarkFor(state.country, state.profile, result.totals.income);
  const who = PROFILES[state.profile];
  const nice = (n) => moneyNice(n, state.currency);

  document.querySelectorAll('[data-symbol]').forEach((el) => setText(el, view.symbol));
  // The country picker or a loaded month can change it too
  if ($('incomeCurrency').value !== state.currency) $('incomeCurrency').value = state.currency;

  for (const g of GROUPS) {
    const el = document.querySelector(`[data-sub="${g.id}"]`);
    let txt;
    if (g.id === 'income') txt = values.income ? `${view.m(values.income)}${view.per}` : t('inputs.subtitle.startHere');
    else if (g.id === 'savings') txt = values.emergencyFund ? t('inputs.subtitle.saved', { amount: view.raw(values.emergencyFund) }) : t('inputs.subtitle.optional');
    else if (g.list === 'debts') txt = state.debts.length ? t('inputs.subtitle.added', { amount: `${view.m(debtPayments)}${view.per}`, count: state.debts.length }) : t('inputs.subtitle.optional');
    else if (g.list === 'extras') txt = state.extras.length ? t('inputs.subtitle.added', { amount: `${withSign('+', view.m(extrasMonthly))}${view.per}`, count: state.extras.length }) : t('inputs.subtitle.optional');
    else if (g.list === 'yearly') txt = state.yearly.length ? t('inputs.subtitle.added', { amount: `${view.m(yearlyMonthly)}${view.per}`, count: state.yearly.length }) : t('inputs.subtitle.optional');
    else if (g.list === 'subscriptions') txt = state.subscriptions.length ? t('inputs.subtitle.added', { amount: `${view.m(subsTotal)}${view.per}`, count: state.subscriptions.length }) : t('inputs.subtitle.optional');
    else {
      // The category total also holds the country's own bills (and custom expenses)
      const cat = result.totals.categories.find((c) => c.key === g.id);
      txt = `${view.m(cat ? cat.amount : subtotal(g.fields.map((f) => f.key)))}${view.per}`;
    }
    setText(el, txt);

    if (!g.fields) continue;
    for (const f of g.fields) {
      // A general box the country's own bill replaces (e.g. India's society maintenance)
      const wrap = document.querySelector(`[data-field-wrap="${f.key}"]`);
      if (wrap) wrap.hidden = hiddenFields(state.country).includes(f.key);
      if (f.balance) {
        // Totals like the emergency fund have no typical range, only errors
        const err = errors.get(`f-${f.key}`);
        const msg = $(`f-${f.key}-msg`);
        setText(msg, err || '');
        if (err) setAttr(msg, 'class', 'mt-1 text-xs font-medium text-rose-700 dark:text-rose-400');
        continue;
      }
      // Fields without benchmarks yet (maintenance) only get their help text
      const range = typicalRange(state.profile, f.key, state.country, result.totals.income);
      const rangeTxt = !range ? '' : range[1] === 0 ? t('inputs.typical.nothing') : t('inputs.typical.range', { min: nice(range[0]), max: nice(range[1]) });
      setText($(`tip-${f.key}`), range ? t('inputs.typical.tip', { help: HELP[f.key], group: who.group, range: rangeTxt, approx: B.approximate ? t('inputs.typical.approximate') : '' }) : HELP[f.key]);

      // Inline status: validation error wins, otherwise "higher than typical"
      const input = $(`f-${f.key}`);
      const msg = $(`f-${f.key}-msg`);
      const err = errors.get(input.id);
      if (err) {
        setText(msg, err);
        setAttr(msg, 'class', 'mt-1 text-xs font-medium text-rose-700 dark:text-rose-400');
      } else if (f.key !== 'income' && range && range[1] > 0 && values[f.key] > range[1]) {
        setText(msg, t('inputs.typical.higher', { group: who.group, max: nice(range[1]) }));
        setAttr(msg, 'class', 'mt-1 text-xs font-medium text-amber-700 dark:text-amber-400');
      } else {
        setText(msg, '');
      }
    }
  }

  renderLocalFields();
  // Income box: label and the monthly equivalent follow the pay frequency (the
  // dropdown beside it says how often, so the box has no "a month")
  const freq = state.payFrequency;
  setText(document.querySelector('label[for="f-income"]'), incomeLabel(freq));
  setText($('f-income-month'), freq !== 'monthly' && values.income > 0 ? t('inputs.payFrequency.perMonth', { amount: view.raw(values.income) }) : '');

  // The country's own bills: typical range in the "?" and "higher than typical"
  for (const lf of localFields(state.country)) {
    const f = localField(lf, state.country);
    const input = $(`f-${f.key}`);
    if (!input) continue;
    const range = lf.ranges?.[state.profile] || null;
    const rangeTxt = !range ? '' : range[1] === 0 ? t('inputs.typical.nothing') : t('inputs.typical.range', { min: nice(range[0]), max: nice(range[1]) });
    setText($(`tip-${f.key}`), range ? t('inputs.typical.tip', { help: f.tip, group: who.group, range: rangeTxt, approx: '' }) : f.tip);
    const msg = $(`f-${f.key}-msg`);
    const err = errors.get(input.id);
    if (err) {
      setText(msg, err);
      setAttr(msg, 'class', 'mt-1 text-xs font-medium text-rose-700 dark:text-rose-400');
    } else if (range && range[1] > 0 && values[f.key] > range[1]) {
      setText(msg, t('inputs.typical.higher', { group: who.group, max: nice(range[1]) }));
      setAttr(msg, 'class', 'mt-1 text-xs font-medium text-amber-700 dark:text-amber-400');
    } else {
      setText(msg, '');
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
      setText(msg, t('inputs.housing.freeYes'));
      setAttr(msg, 'class', 'mt-3 text-sm text-emerald-800 dark:text-emerald-300');
    } else if (state.housingFree === false) {
      setText(msg, t('inputs.housing.freeNo'));
      setAttr(msg, 'class', 'mt-3 text-sm font-medium text-amber-800 dark:text-amber-300');
    } else setText(msg, '');
  }
  renderRows();
  renderSubKinds(state, result, view);
  for (const y of yearly) {
    setText(document.querySelector(`[data-yearly-month="${y.id}"]`), y.cost > 0 ? t('inputs.yearly.perMonth', { amount: view.raw(y.cost / 12) }) : '');
  }
  for (const x of extras) {
    setText(document.querySelector(`[data-extra-month="${x.id}"]`), x.amount > 0 ? t('inputs.extras.perMonth', { amount: view.raw(x.amount / 12) }) : '');
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
  const B = benchmarkFor(state.country, state.profile, income);
  const limit = income * B.categoryShare.subscriptions;
  const rows = Object.entries(subsByKind).sort((a, b) => b[1] - a[1]).map(([k, amt]) =>
    `<li class="flex justify-between gap-3"><span class="flex items-center gap-2">${icon(SUB_KINDS[k].icon, 'icon-sm text-slate-400')}${esc(SUB_KINDS[k].label)}</span><span class="tabular-nums">${esc(view.m(amt))}</span></li>`).join('');
  const over = income > 0 && subsTotal > limit;
  const guide = income > 0
    ? `<p class="mt-3 border-t border-slate-200 pt-3 text-xs dark:border-slate-800 ${over ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'}">
        ${over
          ? esc(t('inputs.subs.summaryOver', { pct: Math.round((subsTotal / income) * 1000) / 10, guide: Math.round(B.categoryShare.subscriptions * 100), limit: `${view.m(limit)}${view.per}` }))
          : esc(t('inputs.subs.summaryWithin', { pct: Math.round((subsTotal / income) * 1000) / 10, guide: Math.round(B.categoryShare.subscriptions * 100) }))}</p>`
    : '';
  box.innerHTML = `<p class="mb-2 font-medium text-slate-900 dark:text-white">${esc(t('inputs.subs.byType'))}</p><ul class="space-y-1.5">${rows}</ul>
    <p class="mt-2 flex justify-between gap-3 font-semibold text-slate-900 dark:text-white"><span>${esc(t('inputs.subs.total'))}</span><span class="tabular-nums">${esc(view.m(subsTotal))}${view.per}</span></p>${guide}`;
}

// ---------------- Events ----------------
function onFieldInput(e) {
  const el = e.target;
  // Checkboxes and selects are handled once, on 'change'
  if (e.type === 'input' && el.matches('input[type="checkbox"], select')) return;
  if (el.dataset.field || el.dataset.local) {
    const { value, error } = parseAmount(el.value, { decimal: decimalSeparator(getState().currency) });
    error ? errors.set(el.id, error) : errors.delete(el.id);
    el.setAttribute('aria-invalid', error ? 'true' : 'false');
    setState((s) => {
      // Income is typed per pay and kept per month
      if (el.dataset.local) s.local[el.dataset.local] = value;
      else s.values[el.dataset.field] = el.dataset.field === 'income' ? toMonthly(value, s.payFrequency) : value;
      s.ui.sample = false;
    }, { reason: 'input' });
    return;
  }
  if (el.dataset.list) {
    const { list, id, key } = el.dataset;
    let v;
    if (key === 'name') v = el.value.slice(0, 60);
    else if (key === 'rarely') v = el.checked;
    else if (key === 'type') v = el.value === 'loan' ? 'loan' : 'card';
    else if (key === 'kind') v = SUB_KINDS[el.value] ? el.value : '';
    else if (key === 'need') v = el.value !== 'want';
    else {
      const r = parseAmount(el.value, { decimal: decimalSeparator(getState().currency) });
      // Rates far above what's normal in the country are almost always typos
      const aprMax = Math.max(100, countryData(getState().country).defaults.cardApr);
      const aprCapped = key === 'apr' && !r.error && r.value > aprMax;
      v = key === 'apr' ? Math.min(aprMax, r.value) : r.value;
      el.setAttribute('aria-invalid', r.error ? 'true' : 'false');
      if (r.error) showRowMsg(el, r.error, 'error');
      else if (aprCapped) showRowMsg(el, t('inputs.debts.aprCapped', { max: aprMax }), 'note');
      else showRowMsg(el, '');
    }
    const instant = key === 'rarely' || key === 'type' || key === 'kind' || key === 'need';
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
  $('incomeCurrency').innerHTML = Object.entries(CURRENCIES).map(([code, c]) => `<option value="${code}">${esc(c.label)}</option>`).join('');

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
      const LIST = { sub: 'subscriptions', yearly: 'yearly', extra: 'extras', custom: 'custom' };
      const row = kind === 'sub'
        ? { id: newId('s'), name: '', cost: 0, rarely: false, kind: '' }
        : kind === 'custom'
          ? { id: newId('c'), name: '', amount: 0, need: true }
        : kind === 'yearly'
          ? { id: newId('y'), name: add.dataset.name || '', cost: 0 }
          : kind === 'extra'
            ? { id: newId('x'), name: add.dataset.name || '', amount: 0 }
            : { id: newId('d'), type: kind, name: '', balance: 0, apr: countryData(getState().country).defaults[kind === 'card' ? 'cardApr' : 'loanApr'], payment: 0 };
      setState((st) => { st[LIST[kind] || 'debts'].push(row); });
      // A suggestion already has its name, so jump straight to the amount
      const amountKey = kind === 'extra' || kind === 'custom' ? 'amount' : 'cost';
      requestAnimationFrame(() => document.querySelector(row.name ? `#r-${row.id}-${amountKey}` : `[data-row="${row.id}"] input`)?.focus());
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      const { remove: list, id } = rm.dataset;
      const st = getState();
      const idx = st[list].findIndex((x) => x.id === id);
      const removed = st[list][idx];
      setState((x) => { x[list] = x[list].filter((r) => r.id !== id); });
      toast(t('inputs.toast.removed', { name: removed?.name || t(`inputs.toast.fallback.${list}`) }), {
        action: { label: t('inputs.toast.undo'), onClick: () => setState((x) => { x[list].splice(idx, 0, removed); }) }
      });
    }
  });

  // Changing how often pay arrives keeps the amount typed in the box (one pay)
  $('payFrequency').addEventListener('change', (e) => {
    const next = PAY_FREQUENCIES[e.target.value] ? e.target.value : 'monthly';
    setState((st) => {
      st.values.income = toMonthly(fromMonthly(st.values.income || 0, st.payFrequency), next);
      st.payFrequency = next;
      st.ui.sample = false;
    });
  });

  // Settings card
  $('profile').addEventListener('change', (e) => setState((st) => { st.profile = e.target.value; }));
  $('incomeCurrency').addEventListener('change', (e) => setState((st) => { st.currency = e.target.value; }));
  document.querySelectorAll('input[name="period"]').forEach((r) =>
    r.addEventListener('change', () => setState((st) => { st.period = r.value; }))
  );
  document.querySelectorAll('[data-action="sample"]').forEach((b) => b.addEventListener('click', loadSample));
  // "Tip: the family example shows everything you can add"
  $('sampleFull').addEventListener('click', () => {
    setState((st) => { st.profile = 'suburban'; }, { reason: 'ui' });
    loadSample();
  });

  syncInputs();
}

export function loadSample() {
  const st = getState();
  const prev = JSON.parse(JSON.stringify(st));
  const sample = sampleFor(st.profile, st.country, st.values.income);
  const inc = sample.values.income;
  const roundTo = inc >= 100000 ? 10000 : 100;
  replaceState({
    ...st,
    values: sample.values,
    debts: sample.debts,
    subscriptions: sample.subscriptions,
    yearly: sample.yearly,
    extras: sample.extras,
    local: sample.local,
    custom: [],
    housingFree: null,
    plan: { committed: {}, pct: {}, sort: st.plan.sort },
    goals: st.goals.length ? st.goals : [
      { id: newId('g'), name: t('inputs.sample.goalHoliday'), target: Math.round((inc * 0.4) / roundTo) * roundTo, saved: 0 },
      { id: newId('g'), name: t('inputs.sample.goalLaptop'), target: Math.round((inc * 0.2) / roundTo) * roundTo, saved: 0 }
    ],
    ui: { ...st.ui, sample: true, mode: 'results' }
  }, 'sample');
  toast(t('inputs.toast.sampleLoaded', { profile: PROFILES[st.profile].name }), {
    action: { label: t('inputs.toast.undo'), onClick: () => replaceState(prev) }
  });
}
