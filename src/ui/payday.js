// "Your payday plan": up to three steps for the day pay arrives (put aside
// yearly costs, save first, keep a weekly spending limit), ticked off each
// month, plus a downloadable monthly calendar reminder.

import { getState, setState } from '../state.js';
import { paydayIcs } from '../utils/ics.js';
import { $, esc, icon, setHTML, setText, toast } from './dom.js';
import { helpBtn } from './help.js';

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthName = () => new Date().toLocaleDateString('en-US', { month: 'long' });

/** "A, B and 2 more" */
function listNames(names, fallback = 'your yearly costs') {
  if (!names.length) return fallback;
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/** The steps to show, each with plain text for the calendar reminder. */
function buildSteps(p, view) {
  const amt = (n) => `<strong class="font-semibold tabular-nums">${esc(view.raw(n))}</strong>`;
  const steps = [];

  if (p.yearlyMonthly > 0) {
    steps.push({
      key: 'yearly', icon: 'calendar',
      title: `Put ${amt(p.yearlyMonthly)} aside for once-a-year costs`,
      text: `Keep it in a separate account, so the money is ready for ${esc(listNames(p.yearlyNames))} (${esc(view.raw(p.yearlyTotal))} a year).`,
      plain: `Put ${view.raw(p.yearlyMonthly)} aside for once-a-year costs`
    });
  } else {
    steps.push({
      key: 'yearly-add', icon: 'calendar', nudge: true,
      title: 'Any big costs that come once a year?',
      text: 'Festivals, school books or car repairs can wreck a month. Add them and we’ll show what to put aside each month.',
      action: `<button type="button" class="btn btn-secondary" data-edit-step="2.5">${icon('plus', 'icon-sm')}Add yearly costs</button>`
    });
  }

  if (p.toSave > 0) {
    steps.push({
      key: 'save', icon: 'save',
      title: `Move ${amt(p.toSave)} to savings first`,
      text: 'Do it the day your pay arrives, before any spending, so it can’t get used by accident. An automatic transfer makes it effortless.',
      action: '<a href="#goals" class="text-sm link">Choose where it goes</a>',
      plain: `Move ${view.raw(p.toSave)} to savings first`
    });
  } else {
    steps.push({
      key: 'save-short', icon: 'alert', nudge: true, warn: true,
      title: p.short > 0 ? `Your costs are ${amt(p.short)} more than your income` : 'Nothing is left over to save yet',
      text: 'Switch on more ideas to spend less, so there’s something to save on payday.',
      action: '<a href="#plan" class="text-sm link">See ideas to spend less</a>'
    });
  }

  if (p.funMonthly > 0) {
    steps.push({
      key: 'allowance', icon: 'wallet', help: true,
      title: `Spend up to ${amt(p.funWeekly)} a week on eating out and shopping`,
      text: `That’s ${esc(view.raw(p.funMonthly))} a month, after the ideas in your plan. Move it to a separate card or take it as cash each week. When it’s gone, wait for next week.`,
      plain: `Spend up to ${view.raw(p.funWeekly)} a week on eating out and shopping`
    });
  }
  // Not a monthly tick-box, so it goes after the numbered steps
  if (p.extrasMonthly > 0) {
    steps.push({
      key: 'bonus', icon: 'gift', nudge: true,
      title: 'When a bonus comes in, save it first',
      text: `${p.extrasNames.length > 1 ? `${esc(listNames(p.extrasNames))} add` : `${esc(p.extrasNames[0] || 'Your extra income')} adds`} about ${esc(view.raw(p.extrasMonthly))} a month on average, but it doesn’t come every month. Put each payment straight into savings or towards your yearly costs, so everyday bills never depend on it.`
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
      <label for="${id}" class="block cursor-pointer font-semibold text-slate-900 dark:text-white"><span class="sr-only">Step ${i + 1}: </span>${s.title}</label>
      <p class="mt-1 text-sm muted">${s.text}${s.help ? ` ${helpBtn('allowance', 'Weekly spending limit', undefined, 'hp-allowance')}` : ''}</p>
      ${s.action ? `<div class="mt-2">${s.action}</div>` : ''}
    </div>
  </li>`;
}

let latest = null;

export function renderPayday(state, result, view) {
  const p = result.payday;
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
    : all ? `All done for ${monthName()}. Nice work!` : `${doneCount} of ${checkable.length} done for ${monthName()}`);
  $('paydayProgress').className = `text-sm ${all ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'muted'}`;
  $('paydayDay').value = String(state.payday.day);
  $('btnReminder').disabled = !checkable.length;
}

function downloadReminder() {
  const { day } = getState().payday;
  const lines = (latest?.steps || []).filter((s) => s.plain).map((s, i) => `${i + 1}. ${s.plain}`);
  const ics = paydayIcs({
    day,
    title: 'Payday: follow your money plan',
    lines: [...lines, '', 'Amounts are from the day you saved this reminder. Open the budget tool to see the latest.']
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'payday-reminder.ics';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Reminder downloaded. Open it to add it to your calendar.');
}

export function initPayday() {
  const sel = $('paydayDay');
  sel.innerHTML = Array.from({ length: 28 }, (_, i) => {
    const d = i + 1;
    const suffix = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
    return `<option value="${d}">${d}${suffix} of the month</option>`;
  }).join('') + '<option value="last">Last day of the month</option>';
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
