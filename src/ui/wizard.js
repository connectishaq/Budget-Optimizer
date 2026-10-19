// Guided step-by-step flow for new users, the results view, and the
// "Show all inputs" layout for advanced users. The input groups are real DOM
// nodes that get moved between the wizard and the sidebar, so values,
// listeners and validation are shared.

import { getState, setState } from '../state.js';
import { GROUPS } from './inputs.js';
import { $, setText, setAttr } from './dom.js';
import { t } from '../i18n/index.js';

// Names, titles and subtitles live in wizard.billPages.<group> (title/sub only where set).
const BILL_PAGES = [
  { group: 'housing' },
  { group: 'utilities' },
  { group: 'transport' },
  { group: 'family' },
  { group: 'care' },
  { group: 'yearly', custom: true }
];

// Titles and subtitles live in wizard.steps.<n>.
const STEPS = {
  1: { groups: ['income', 'extras'], settings: true },
  2: {},
  3: { groups: ['debt', 'subs', 'savings'] }
};

let placed = ''; // signature of the current layout, so DOM moves happen only on change

/** Puts every group back in the sidebar form, in order, with normal behaviour. */
function restoreGroups() {
  const s = getState();
  const box = $('inputGroups');
  $('settingsSlot').append($('settingsCard'));
  $('settingsCard').classList.remove('in-wizard-settings');
  for (const g of GROUPS) {
    const el = document.querySelector(`details[data-group="${g.id}"]`);
    el.classList.remove('in-wizard');
    el.open = !s.ui.collapsed[g.id];
    el.querySelector('summary').removeAttribute('tabindex');
    box.append(el);
  }
}

function placeWizard(step, sub) {
  restoreGroups();
  const body = $('wizBody');
  const ids = step === 2 ? [BILL_PAGES[sub].group] : STEPS[step].groups;
  for (const id of ids) {
    const el = document.querySelector(`details[data-group="${id}"]`);
    el.classList.add('in-wizard');
    el.open = true;
    el.querySelector('summary').setAttribute('tabindex', '-1');
    body.append(el);
  }
  if (STEPS[step].settings) {
    $('settingsCard').classList.add('in-wizard-settings');
    body.append($('settingsCard'));
  }
}

/** Progress through the four steps; step 2 fills in as each bill page is done. */
function progress(step, sub) {
  if (step === 1) return 0.25;
  if (step === 2) return 0.25 + 0.25 * ((sub + 1) / BILL_PAGES.length);
  return 0.75;
}

export function renderFlow(state) {
  const { mode, step, sub, showAll } = state.ui;
  const sig = `${mode}|${step}|${sub}|${showAll}`;
  const wizard = mode === 'wizard';
  $('wizard').hidden = !wizard;
  $('resultsView').hidden = wizard;
  if (sig === placed) return;
  const first = placed === '';
  placed = sig;

  if (wizard) {
    placeWizard(step, sub);
    setText($('wizStepLabel'), t('wizard.stepOf', { step, total: 4 }));
    setText($('wizSubStep'), step === 2 ? t('wizard.billsProgress', { name: t(`wizard.billPages.${BILL_PAGES[sub].group}.name`), n: sub + 1, total: BILL_PAGES.length }) : '');
    const page = step === 2 ? BILL_PAGES[sub] : {};
    const base = page.custom ? `wizard.billPages.${page.group}` : `wizard.steps.${step}`;
    setText($('wizTitle'), t(`${base}.title`));
    setText($('wizSub'), t(`${base}.sub`));
    const p = progress(step, sub);
    $('wizBar').style.width = `${p * 100}%`;
    setAttr($('wizProgress'), 'aria-valuenow', String(Math.round(p * 100)));
    setAttr($('wizProgress'), 'aria-valuetext', t('wizard.stepOf', { step, total: 4 }));
    document.querySelectorAll('#wizSteps [data-step]').forEach((li) => {
      const n = Number(li.dataset.step);
      li.dataset.state = n < step ? 'done' : n === step ? 'current' : 'todo';
      if (n === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      li.querySelector('.dot').textContent = n < step ? '✓' : String(n);
    });
    $('wizBack').hidden = step === 1;
    setText($('wizNext'), step === 3 ? t('wizard.seeResults') : t('wizard.next'));
    $('wizNote').hidden = true;
    if (!first) {
      $('wizard').scrollIntoView({ block: 'start', behavior: 'smooth' });
      $('wizTitle').focus({ preventScroll: true });
    }
  } else {
    restoreGroups();
    $('inputs').hidden = !showAll;
    setAttr($('btnShowAll'), 'aria-pressed', String(showAll));
    setText($('btnShowAllText'), showAll ? t('wizard.hideInputs') : t('wizard.showAllInputs'));
    $('resultsLayout').dataset.inputs = showAll ? 'on' : 'off';
    if (!first && !showAll) $('resultsView').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

const go = (patch) => setState((s) => { Object.assign(s.ui, patch); }, { reason: 'flow' });

function next() {
  const { step, sub } = getState().ui;
  if (step === 1 && !(getState().values.income > 0) && $('wizNote').hidden) {
    // Gentle nudge once; pressing Next again continues without income.
    $('wizNote').hidden = false;
    return;
  }
  if (step === 1) go({ step: 2, sub: 0 });
  else if (step === 2 && sub < BILL_PAGES.length - 1) go({ sub: sub + 1 });
  else if (step === 2) go({ step: 3 });
  else go({ mode: 'results' });
}

function back() {
  const { step, sub } = getState().ui;
  if (step === 2 && sub > 0) go({ sub: sub - 1 });
  else if (step === 2) go({ step: 1 });
  else if (step === 3) go({ step: 2, sub: BILL_PAGES.length - 1 });
}

/** Highlights the results section currently on screen in the sticky section bar. */
function initSectionNav() {
  const links = [...document.querySelectorAll('#sectionNav a')];
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const mark = (id) => links.forEach((a) => a.setAttribute('aria-current', String(a === byId.get(id))));
  mark('summary');
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!hit) return;
    mark(hit.target.id);
    // Keep the active chip in view on narrow screens without moving the page
    const link = byId.get(hit.target.id);
    const bar = link?.closest('ul');
    if (bar) bar.scrollTo({ left: link.offsetLeft - 16, behavior: 'smooth' });
  }, { rootMargin: '-35% 0px -55% 0px' });
  for (const id of byId.keys()) { const el = document.getElementById(id); if (el) io.observe(el); }
}

export function initWizard() {
  initSectionNav();
  $('wizNext').addEventListener('click', next);
  $('wizBack').addEventListener('click', back);
  $('wizSkip').addEventListener('click', () => go({ mode: 'results' }));
  $('btnEdit').addEventListener('click', () => go({ mode: 'wizard', step: 1, sub: 0 }));
  $('btnShowAll').addEventListener('click', () => go({ showAll: !getState().ui.showAll }));
  // Links like "Add your income" jump into the right wizard step
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit-step]');
    if (!b) return;
    e.preventDefault();
    const [step, sub] = b.dataset.editStep.split('.').map(Number);
    go({ mode: 'wizard', step, sub: sub || 0 });
  });
}
