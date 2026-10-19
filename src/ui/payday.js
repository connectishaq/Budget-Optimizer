// "Your payday plan": up to three steps for the day pay arrives (put aside
// yearly costs, save first, keep a weekly spending limit), ticked off each
// month, plus a downloadable monthly calendar reminder.

import { getState, setState } from '../state.js';
import { paydayIcs } from '../utils/ics.js';
import { $, esc, icon, setHTML, setText, toast } from './dom.js';
import { helpBtn } from './help.js';
import { t, getLanguage } from '../i18n/index.js';
import { dateLocale } from '../utils/format.js';

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthName = () => new Date().toLocaleDateString(dateLocale(), { month: 'long' });

/** "A, B and 2 more" */
function listNames(names, fallback = t('payday.list.fallback')) {
  if (!names.length) return fallback;
  if (names.length === 1) return names[0];
  if (names.length === 2) return t('payday.list.two', { a: names[0], b: names[1] });
  return t('payday.list.more', { a: names[0], b: names[1], count: names.length - 2 });
}

/** The steps to show, each with plain text for the calendar reminder. */
function buildSteps(p, view) {
  const amt = (n) => `<strong class="font-semibold tabular-nums">${esc(view.raw(n))}</strong>`;
  const steps = [];

  if (p.yearlyMonthly > 0) {
    steps.push({
      key: 'yearly', icon: 'calendar',
      title: t('payday.steps.yearly.title', { amount: amt(p.yearlyMonthly) }),
      text: t('payday.steps.yearly.text', { names: esc(listNames(p.yearlyNames)), total: esc(view.raw(p.yearlyTotal)) }),
      plain: t('payday.steps.yearly.title', { amount: view.raw(p.yearlyMonthly) })
    });
  } else {
    steps.push({
      key: 'yearly-add', icon: 'calendar', nudge: true,
      title: t('payday.steps.yearlyAdd.title'),
      text: t('payday.steps.yearlyAdd.text'),
      action: `<button type="button" class="btn btn-secondary" data-edit-step="2.5">${icon('plus', 'icon-sm')}${t('payday.steps.yearlyAdd.action')}</button>`
    });
  }

  if (p.toSave > 0) {
    steps.push({
      key: 'save', icon: 'save',
      title: t('payday.steps.save.title', { amount: amt(p.toSave) }),
      text: t('payday.steps.save.text'),
      action: `<a href="#goals" class="text-sm link">${t('payday.steps.save.action')}</a>`,
      plain: t('payday.steps.save.title', { amount: view.raw(p.toSave) })
    });
  } else {
    steps.push({
      key: 'save-short', icon: 'alert', nudge: true, warn: true,
      title: p.short > 0 ? t('payday.steps.short.titleShort', { amount: amt(p.short) }) : t('payday.steps.short.titleNothing'),
      text: t('payday.steps.short.text'),
      action: `<a href="#plan" class="text-sm link">${t('payday.steps.short.action')}</a>`
    });
  }

  if (p.funMonthly > 0) {
    steps.push({
      key: 'allowance', icon: 'wallet', help: true,
      title: t('payday.steps.allowance.title', { amount: amt(p.funWeekly) }),
      text: t('payday.steps.allowance.text', { amount: esc(view.raw(p.funMonthly)) }),
      plain: t('payday.steps.allowance.title', { amount: view.raw(p.funWeekly) })
    });
  }
  // Not a monthly tick-box, so it goes after the numbered steps
  if (p.extrasMonthly > 0) {
    steps.push({
      key: 'bonus', icon: 'gift', nudge: true,
      title: t('payday.steps.bonus.title'),
      text: p.extrasNames.length > 1
        ? t('payday.steps.bonus.textMany', { names: esc(listNames(p.extrasNames)), amount: esc(view.raw(p.extrasMonthly)) })
        : t('payday.steps.bonus.textOne', { name: esc(p.extrasNames[0] || t('payday.steps.bonus.fallbackName')), amount: esc(view.raw(p.extrasMonthly)) })
    });
  }
  return steps;
}

function stepMarkup(s, i, done) {
  if (s.nudge) {
    const tone = s.warn
      ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/40'
      : 'border-dashed border-slate-300 dark:border-slate-700';
    return `<li class="flex gap-4 rounded-xl border p-4 ${tone}">
      <span class="grid h-6 w-6 shrink-0 place-items-center ${s.warn ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'}">${icon(s.icon, 'icon-sm')}</span>
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-slate-900 dark:text-white">${s.title}</p>
        <p class="mt-1 text-sm muted">${s.text}</p>
        ${s.action ? `<div class="mt-3">${s.action}</div>` : ''}
      </div>
    </li>`;
  }
  const id = `pd-${s.key}`;
  return `<li class="pd-step">
    <input type="checkbox" id="${id}" class="sr-only" data-payday="${s.key}" ${done ? 'checked' : ''}>
    <label for="${id}" class="pd-check cursor-pointer" aria-hidden="true">${icon('check', 'h-3.5 w-3.5')}</label>
    <div class="min-w-0 flex-1">
      <label for="${id}" class="block cursor-pointer font-semibold text-slate-900 dark:text-white"><span class="sr-only">${t('payday.stepNumber', { n: i + 1 })} </span>${s.title}</label>
      <p class="mt-1 text-sm muted">${s.text}${s.help ? ` ${helpBtn('allowance', t('payday.weeklyLimit'), undefined, 'hp-allowance')}` : ''}</p>
      ${s.action ? `<div class="mt-2">${s.action}</div>` : ''}
    </div>
  </li>`;
}

let latest = null;

export function renderPayday(state, result, view) {
  const p = result.payday;
  if ($('paydayDay').__lang !== getLanguage()) {
    fillDays($('paydayDay'));
    $('paydayDay').value = String(state.payday.day);
  }
  $('paydayEmpty').hidden = !!p;
  $('paydayBody').hidden = !p;
  if (!p) return;
  const steps = buildSteps(p, view);
  latest = { steps };
  const thisMonth = state.payday.month === monthKey();
  const isDone = (k) => thisMonth && !!state.payday.done[k];
  // Ticking a step re-renders the list; keep keyboard focus on that checkbox
  const focused = $('paydaySteps').contains(document.activeElement) ? document.activeElement.id : null;
  setHTML($('paydaySteps'), steps.map((s, i) => stepMarkup(s, i, isDone(s.key))).join(''));
  if (focused) document.getElementById(focused)?.focus({ preventScroll: true });

  const checkable = steps.filter((s) => !s.nudge);
  const doneCount = checkable.filter((s) => isDone(s.key)).length;
  const all = checkable.length > 0 && doneCount === checkable.length;
  setText($('paydayProgress'), !checkable.length
    ? ''
    : all ? t('payday.progress.all', { month: monthName() }) : t('payday.progress.some', { done: doneCount, total: checkable.length, month: monthName() }));
  $('paydayProgress').className = `text-sm ${all ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'muted'}`;
  $('paydayDay').value = String(state.payday.day);
  $('btnReminder').disabled = !checkable.length;
}

function downloadReminder() {
  const { day } = getState().payday;
  const lines = (latest?.steps || []).filter((s) => s.plain).map((s, i) => `${i + 1}. ${s.plain}`);
  const ics = paydayIcs({
    day,
    title: t('ics.title'),
    lines: [...lines, '', t('ics.note')]
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'payday-reminder.ics';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(t('payday.reminderDownloaded'));
}

/** The payday options, filled again when the language changes. */
function fillDays(sel) {
  sel.__lang = getLanguage();
  sel.innerHTML = Array.from({ length: 28 }, (_, i) => {
    const d = i + 1;
    const suffix = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
    return `<option value="${d}">${t('payday.dayOfMonth', { day: d, suffix: t(`payday.ordinal.${suffix}`) })}</option>`;
  }).join('') + `<option value="last">${t('payday.lastDay')}</option>`;
}

export function initPayday() {
  const sel = $('paydayDay');
  fillDays(sel);
  sel.addEventListener('change', () => setState((s) => { s.payday.day = sel.value === 'last' ? 'last' : Number(sel.value); }));

  $('paydaySteps').addEventListener('change', (e) => {
    const box = e.target.closest('[data-payday]');
    if (!box) return;
    const key = box.dataset.payday;
    const now = monthKey();
    setState((s) => {
      // Ticks from an earlier month don't carry over
      if (s.payday.month !== now) { s.payday.month = now; s.payday.done = {}; }
      s.payday.done[key] = box.checked;
    });
  });
  $('btnReminder').addEventListener('click', downloadReminder);
}
