// App bootstrap: load state, wire modules, and run one compute → render pass
// per change. Typing is debounced (150 ms); clicks and toggles render at once.

import './styles.css';
import { loadState, getState, setState, subscribe, onSaved, storeTheme, replaceState, defaultState, hasData, returnOptions } from './state.js';
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
import { setFormatRegion } from './utils/format.js';
import { initAds } from './ads.js';
import { t } from './i18n/index.js';
import { startI18n, initLocalePicker, restoreScroll } from './i18n/picker.js';
import { initLanguageSuggestion } from './i18n/suggest.js';
import { initialCountry, storeCountry, GLOBAL } from './i18n/countries.js';
import { loadCountry, isCountryLoaded } from './engine/countries.js';

let lastSavings = null;

function render() {
  const state = getState();
  // A share link or backup can bring a country that isn't loaded yet
  if (!isCountryLoaded(state.country)) loadCountry(state.country).then(render);
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
  const cs = $('countrySelect');
  if (cs && cs.value !== state.country) cs.value = state.country;

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

/**
 * Makes `code` the household's country. With `defaults`, its currency,
 * inflation and growth rates replace the current ones (the user can still
 * change them); the growth choice keeps its position (e.g. "long-term").
 */
async function applyCountry(code, { defaults = true } = {}) {
  const C = await loadCountry(code);
  setFormatRegion(code);
  setState((s) => {
    const pick = returnOptions(s.country).findIndex((o) => o.value === s.projection.rate);
    s.country = code;
    if (defaults) {
      if (C.currency) s.currency = C.currency;
      // Income stays the same per month; the box then shows it per local pay
      if (C.payFrequency) s.payFrequency = C.payFrequency;
      if (C.inflation != null) s.projection.inflation = C.inflation;
      s.projection.rate = returnOptions(code)[pick >= 0 ? pick : 2].value;
    }
  }, { reason: 'country' });
  storeCountry(code);
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
  const returning = restored && hasData();
  if (returning) getState().ui.mode = 'results';
  if (!restored) replaceState(defaultState(), 'boot');
  // Country: a saved budget keeps its own; a new one starts from the saved
  // choice or the browser's region, with that country's defaults.
  if (restored && getState().country !== GLOBAL) {
    await loadCountry(getState().country);
    storeCountry(getState().country);
    setFormatRegion(getState().country);
  } else {
    await applyCountry(initialCountry(), { defaults: !restored });
  }
  // History: load this month, or copy last month's numbers, before the form fills
  startMonths(restored);

  initTheme();
  initLocalePicker({ country: getState().country, onCountry: (c) => applyCountry(c) });
  initLanguageSuggestion();
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

  let shownCountry = getState().country;
  subscribe((reason) => {
    // A loaded month, backup or share link can bring another country
    if (getState().country !== shownCountry) {
      shownCountry = getState().country;
      setFormatRegion(shownCountry);
      storeCountry(shownCountry);
    }
    if (reason === 'replace' || reason === 'import' || reason === 'sample' || reason === 'reset' || reason === 'country') {
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
    replaceState({ ...defaultState(), profile: st.profile, country: st.country, currency: st.currency, period: st.period, payFrequency: st.payFrequency }, 'reset');
  });

  setText($('year'), String(new Date().getFullYear()));
  render();
  // JS now controls which view is shown
  document.documentElement.classList.remove('returning');
  initAds();
  // Returning visitors start at their results (the intro is still above), unless
  // a link pointed somewhere (#guide…) or a language switch is keeping its place
  if (!restoreScroll() && returning && !location.hash) requestAnimationFrame(() => $('resultsView').scrollIntoView({ block: 'start' }));
}

boot();

