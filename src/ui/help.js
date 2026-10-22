// "?" help buttons next to labels. Desktop: a floating tooltip on hover/focus
// (positioned in the viewport so it is never clipped by scroll containers).
// Phones / touch: tapping opens a bottom sheet with the same text.
//
// Static HTML uses <span data-help="key" data-help-label="Label"></span>
// placeholders; JS-rendered markup calls helpBtn() directly.

import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';

// Field keys with a help text (help.text.<key> in the message files).
const HELP_KEYS = [
  'profile', 'currency', 'period', 'income', 'rent', 'maintenance', 'homeIns',
  'electricity', 'waterGas', 'internet', 'fuel', 'transit', 'carIns',
  'carLoan', 'school', 'groceries', 'dining', 'misc', 'medical',
  'homeHelp', 'familySupport', 'giving', 'other', 'extraAmount', 'yearlyCost',
  'emergencyFund', 'debtName', 'debtType', 'debtBalance', 'debtApr', 'debtPayment',
  'subName', 'subCost', 'subKind', 'subRarely', 'housingFree', 'summary',
  'spendNow', 'spendCould', 'saveMonth', 'saveYear', 'top3', 'health',
  'split', 'categories', 'payday', 'allowance', 'plan', 'cut',
  'addToPlan', 'interestAvoided', 'years', 'rate', 'inflation', 'allocation', 'customAmount',
  'goals', 'emergency', 'debtFree', 'history'
];

/** Help texts by field key, translated each time a property is read. */
export const HELP = Object.defineProperties({}, Object.fromEntries(
  HELP_KEYS.map((k) => [k, { get: () => t(`help.text.${k}`), enumerable: true }])
));

let uid = 0;
/** Reserves a help-button id now, for markup that is built later. */
export const nextHelpId = () => `hp${uid++}`;

/** Markup for a "?" button. `text` overrides the dictionary entry (used for dynamic text). */
export function helpBtn(key, label, text, id = `hp${uid++}`) {
  const body = text ?? HELP[key] ?? '';
  return `<button type="button" class="help-btn tap" data-help-title="${esc(label)}" aria-label="${esc(t('help.ariaLabel', { label }))}" aria-describedby="${id}">?</button><span id="${id}" class="sr-only" data-help-body="${esc(key)}">${esc(body)}</span>`;
}

const isTouch = () => window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)').matches;

// ---------------- Floating tooltip (desktop) ----------------
let pinned = null;
function showTip(btn) {
  const tip = $('helpTip');
  const body = document.getElementById(btn.getAttribute('aria-describedby'));
  if (!tip || !body) return;
  tip.textContent = body.textContent;
  tip.hidden = false;
  const r = btn.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const left = Math.min(window.innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2));
  const above = r.top - t.height - 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${above > 8 ? above : r.bottom + 8}px`;
}
function hideTip() {
  const tip = $('helpTip');
  if (tip) tip.hidden = true;
  pinned = null;
}

// ---------------- Bottom sheet (phones) ----------------
function openSheet(btn) {
  const body = document.getElementById(btn.getAttribute('aria-describedby'));
  $('helpSheetTitle').textContent = btn.dataset.helpTitle || t('help.sheetTitle');
  $('helpSheetBody').textContent = body ? body.textContent : '';
  $('helpSheet').showModal();
}

/** Replaces static placeholders with buttons and wires all interactions. */
export function initHelp() {
  document.querySelectorAll('[data-help]').forEach((el) => {
    el.outerHTML = helpBtn(el.dataset.help, el.dataset.helpLabel || '');
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.help-btn');
    if (!btn) {
      if (pinned && !e.target.closest('#helpTip')) hideTip();
      return;
    }
    e.preventDefault();
    if (isTouch()) { hideTip(); openSheet(btn); return; }
    if (pinned === btn) { hideTip(); return; }
    showTip(btn);
    pinned = btn;
  });
  document.addEventListener('mouseover', (e) => {
    const btn = e.target.closest?.('.help-btn');
    if (btn && !isTouch() && !pinned) showTip(btn);
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest?.('.help-btn') && !pinned) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    if (e.target.matches?.('.help-btn') && !isTouch()) showTip(e.target);
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.matches?.('.help-btn') && !pinned) hideTip();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
  window.addEventListener('scroll', () => { if (!$('helpTip')?.hidden) hideTip(); }, { passive: true });
  $('helpSheetClose')?.addEventListener('click', () => $('helpSheet').close());
  // Tap on the dimmed backdrop closes the sheet
  $('helpSheet')?.addEventListener('click', (e) => { if (e.target.id === 'helpSheet') e.target.close(); });
}
