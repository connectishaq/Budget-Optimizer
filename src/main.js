// App bootstrap: load state, wire modules, and run one compute → render pass
// per change. Typing is debounced (150 ms); clicks and toggles render at once.

import './styles.css';
import { loadState, getState, subscribe, onSaved, storeTheme, replaceState, defaultState, hasData } from './state.js';
import { computeBudget } from './engine/calculate.js';
import { initInputs, renderInputs, syncInputs } from './ui/inputs.js';
import { initPlan, renderPlan, syncPlanControls } from './ui/plan.js';
import { renderDashboard } from './ui/dashboard.js';
import { initCharts, renderProjection } from './ui/charts.js';
import { initGoals, renderGoals } from './ui/goals.js';
import { initHistory, renderHistory } from './ui/history.js';
import { initWizard, renderFlow } from './ui/wizard.js';
import { initPayday, renderPayday } from './ui/payday.js';
import { initHelp } from './ui/help.js';
import { startMonths, initMonths, renderMonths, noteBudgetChange, loadThisMonth } from './ui/months.js';
import { initReset } from './ui/reset.js';
import { $, makeView, debounce, announce, setText } from './ui/dom.js';
import { initAds } from './ads.js';
import { t } from './i18n/index.js';
import { startI18n, initLocalePicker, restoreScroll } from './i18n/picker.js';
import { initialCountry } from './i18n/countries.js';

let lastSavings = null;

function render() {
  const state = getState();
  const view = makeView(state);
  // Sentences inside the engine use the same friendly money format as the page
  const result = computeBudget(state, (n) => view.raw(n));
  renderFlow(state);
  renderInputs(state, result, view);
  renderDashboard(state, result, view);
  renderPlan(state, result, view);
  renderPayday(state, result, view);
  renderProjection(state, result, view);
  renderGoals(state, result, view);
  renderHistory(state, result, view);
  renderMonths(state, result, view);

  if (lastSavings !== null && Math.round(result.savings) !== Math.round(lastSavings)) {
    announce(t('app.announceSavings', { amount: view.rawS(result.savings) }));
  }
  lastSavings = result.savings;
}

const renderSoon = debounce(render, 150);

function initTheme() {
  const btn = $('themeToggle');
  const meta = document.querySelector('meta[name="theme-color"]');
  const apply = (dark) => {
    document.documentElement.classList.toggle('dark', dark);
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? t('app.theme.toLight') : t('app.theme.toDark'));
    meta?.setAttribute('content', dark ? '#020617' : '#0f172a');
  };
  apply(document.documentElement.classList.contains('dark'));
  btn.addEventListener('click', () => {
    const dark = !document.documentElement.classList.contains('dark');
    storeTheme(dark ? 'dark' : 'light');
    apply(dark);
  });
}

function initSavedIndicator() {
  const el = $('savedIndicator');
  onSaved((ok) => {
    setText($('savedText'), ok ? t('app.saved') : t('app.notSaved'));
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  });
}

async function boot() {
  // Words first: everything below builds text with the active language
  await startI18n();
  const restored = loadState();
  // Returning users with saved numbers go straight to their results;
  // everyone else starts the guided steps.
  if (restored && hasData()) getState().ui.mode = 'results';
  if (!restored) replaceState(defaultState(), 'boot');
  // History: load this month, or copy last month's numbers, before the form fills
  startMonths(restored);

  initTheme();
  initLocalePicker({ country: initialCountry(getState().currency) });
  initSavedIndicator();
  initInputs();
  initHelp();
  initWizard();
  initPlan();
  initPayday();
  initCharts();
  initGoals();
  initHistory();
  initMonths();
  initReset();
  syncPlanControls(getState());

  subscribe((reason) => {
    if (reason === 'replace' || reason === 'import' || reason === 'sample' || reason === 'reset') {
      syncInputs();
      syncPlanControls(getState());
    }
    if (reason === 'ui') return;
    noteBudgetChange(reason);
    reason === 'input' ? renderSoon() : render();
  });

  $('clearSample').addEventListener('click', () => {
    // Back to this month's saved numbers if there are any, otherwise a blank form
    if (loadThisMonth()) return;
    const st = getState();
    replaceState({ ...defaultState(), profile: st.profile, currency: st.currency, period: st.period }, 'reset');
  });

  setText($('year'), String(new Date().getFullYear()));
  render();
  // JS now controls which view is shown
  document.documentElement.classList.remove('returning');
  initAds();
  restoreScroll();
}

boot();

