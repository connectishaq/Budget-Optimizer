// "?" help buttons next to labels. Desktop: a floating tooltip on hover/focus
// (positioned in the viewport so it is never clipped by scroll containers).
// Phones / touch: tapping opens a bottom sheet with the same text.
//
// Static HTML uses <span data-help="key" data-help-label="Label"></span>
// placeholders; JS-rendered markup calls helpBtn() directly.

import { $, esc } from './dom.js';

export const HELP = {
  // Settings
  profile: 'Pick the household most like yours. We compare your bills with similar homes, so the tips fit your life.',
  currency: 'Changes the money symbol and the “typical” amounts we compare your bills with.',
  period: 'Show every amount per month or per year. Your numbers stay the same; only the display changes.',
  // Bills
  income: 'The money that reaches your bank account each month after tax. Use your take-home pay, not your salary before tax.',
  rent: 'What you pay each month to rent your home, or your mortgage payment if you’re buying it.',
  homeIns: 'Insurance that pays out if your home or belongings are damaged or stolen. Leave empty if you don’t have it.',
  electricity: 'Your average monthly electricity bill. If it changes with the seasons, use a rough average.',
  waterGas: 'Your monthly water and gas bills added together.',
  internet: 'Home internet plus mobile phone bills, added together.',
  fuel: 'Petrol or diesel for all your vehicles in a month.',
  transit: 'Bus, train, ride-hailing fares and road tolls in a month.',
  carIns: 'Car insurance per month. If you pay once a year, divide the yearly cost by 12.',
  carLoan: 'Your monthly car loan or lease payment.',
  school: 'School fees, tuition, day care or babysitting per month.',
  groceries: 'Food and household items you buy at shops and markets.',
  dining: 'Restaurants, cafés, takeaways and food delivery.',
  misc: 'Shopping you didn’t plan: clothes, gadgets, gifts, online orders and treats.',
  medical: 'Doctor visits, tests and medicine in a typical month. If it changes a lot, use a rough average.',
  homeHelp: 'Wages for a maid, cook, driver, guard or babysitter who helps at home.',
  familySupport: 'Money you regularly send to parents or other family members.',
  giving: 'Donations to charity and religious giving, such as zakat, tithes or offerings at your mosque, church or temple, as a monthly amount.',
  other: 'Any regular monthly cost that doesn’t fit the boxes above, like pet food, a committee payment or tuition classes.',
  extraAmount: 'The total you expect for the whole year, after tax. We divide it by 12 and add it to your monthly income. For overtime that changes, use a rough yearly total.',
  yearlyCost: 'The total for the whole year. We divide it by 12 to show what to put aside each month.',
  emergencyFund: 'Money you’ve already put aside for surprises, like losing your job or a big repair. This is a total, not a monthly amount.',
  debtName: 'A name to recognise this card or loan, like “Bank card”.',
  debtType: 'Credit cards usually charge much more interest than loans.',
  debtBalance: 'How much you still owe on this card or loan today.',
  debtApr: 'The yearly interest rate (APR): the extra the lender charges each year for borrowing, as a percentage. You’ll find it on your statement. Lower is better.',
  debtPayment: 'How much you pay towards this card or loan each month.',
  subName: 'The service, like Netflix or a gym.',
  subCost: 'What it costs each month. If you pay yearly, divide by 12.',
  subKind: 'What kind of subscription this is. We guess it from the name; change it if we got it wrong. Work tools count as a must-pay bill, the rest as nice-to-haves.',
  subRarely: 'Tick this if you used it fewer than twice last month. We’ll suggest cancelling it.',
  housingFree: 'Some people own their home outright or live with family for free. If that’s you, we won’t count housing against you.',
  // Results
  summary: 'A one-line overview of your money, based on the numbers you entered.',
  spendNow: 'All the monthly bills you entered, added up.',
  spendCould: 'Your bills after the changes you added to your plan.',
  saveMonth: 'The money freed up each month by the changes in your plan. Interest you avoid on debt isn’t counted here.',
  saveYear: 'Your monthly savings × 12.',
  top3: 'The three biggest savings we found, with the easiest one at the top. A good place to start.',
  health: 'A score from 0 to 100 that checks five things: saving, housing, debt, emergency fund and nice-to-haves. Higher is better.',
  split: 'Compares your spending with a common guideline: about half on must-pay bills, a third on nice-to-haves and a fifth saved.',
  categories: 'Each bar shows how much of your income goes to that area. The thin line shows what’s typical for households like yours.',
  payday: 'A short checklist for the day your pay arrives: put money aside for yearly costs, save first, and keep a weekly limit for spending. Tick each step off every month.',
  allowance: 'Your eating out and shopping budget after the ideas in your plan, split into weeks. Spending a fixed amount each week is easier to stick to than a monthly total.',
  plan: 'Ideas to spend less, based on your bills. Add the ones you’ll really do to your plan; only those count.',
  cut: 'Move the slider to the share you really think you can cut. Not sure? Keep our suggestion.',
  addToPlan: 'Only changes you add count towards your savings, charts and goal dates.',
  interestAvoided: 'Interest is the extra money a lender charges you. Avoiding it doesn’t put cash in your pocket today, but your debt gets paid off sooner.',
  years: 'How long you keep saving. More years give your money more time to grow.',
  rate: 'How much your savings grow each year on average. Safe accounts grow slowly; investing can grow faster but goes up and down.',
  inflation: 'Prices rise over time, so the same money buys less in future. This shows future amounts in today’s money.',
  allocation: 'This is the money left each month after your bills and your plan. Choose how to share it between your emergency fund, your debt and your goals.',
  goals: 'Things you’re saving for. We work out when you’ll reach each one using the share of savings you give to goals.',
  emergency: 'Money kept aside for surprises like losing your job or a car repair. Aim for 3 to 6 months of essential bills.',
  debtFree: 'When your loans would be fully paid off: now, and if you put your debt share of savings towards them.',
  history: 'Save a snapshot each month to see whether your spending is going down over time.'
};

let uid = 0;
/** Markup for a "?" button. `text` overrides the dictionary entry (used for dynamic text). */
export function helpBtn(key, label, text, id = `hp${uid++}`) {
  const body = text ?? HELP[key] ?? '';
  return `<button type="button" class="help-btn tap" data-help-title="${esc(label)}" aria-label="What does “${esc(label)}” mean?" aria-describedby="${id}">?</button><span id="${id}" class="sr-only" data-help-body="${esc(key)}">${esc(body)}</span>`;
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
  $('helpSheetTitle').textContent = btn.dataset.helpTitle || 'Help';
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
