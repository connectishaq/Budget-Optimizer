// App bootstrap: load state, wire modules, and run one compute → render pass
// per change. Typing is debounced (150 ms); clicks and toggles render at once.

import './styles.css';
import { loadState, getState, subscribe, onSaved, storeTheme, replaceState, defaultState } from './state.js';
import { computeBudget } from './engine/calculate.js';
import { sampleFor } from './engine/profiles.js';
import { initInputs, renderInputs, syncInputs } from './ui/inputs.js';
import { initPlan, renderPlan, syncPlanControls } from './ui/plan.js';
import { renderDashboard } from './ui/dashboard.js';
import { initCharts, renderProjection } from './ui/charts.js';
import { initGoals, renderGoals } from './ui/goals.js';
import { initHistory, renderHistory } from './ui/history.js';
import { $, makeView, debounce, announce, setText } from './ui/dom.js';
import { initAds } from './ads.js';

let lastSavings = null;

function render() {
  const state = getState();
  const view = makeView(state);
  const result = computeBudget(state, view.raw);
  renderInputs(state, result, view);
  renderDashboard(state, result, view);
  renderPlan(state, result, view);
  renderProjection(state, result, view);
  renderGoals(state, result, view);
  renderHistory(state, result, view);

  if (lastSavings !== null && Math.round(result.savings) !== Math.round(lastSavings)) {
    announce(`Monthly savings now ${view.raw(result.savings)}. Optimized spend ${view.m(result.optimized)} per ${view.periodWord}.`);
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
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    meta?.setAttribute('content', dark ? '#020617' : '#0f172a');
    window.dispatchEvent(new Event('themechange'));
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
    setText($('savedText'), ok ? 'Saved on this device' : 'Not saved (storage blocked)');
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  });
}

function boot() {
  const restored = loadState();
  // First visit: show a realistic example right away (clearly labelled as sample data)
  if (!restored) {
    const st = defaultState();
    const sample = sampleFor(st.profile, st.currency);
    replaceState({ ...st, values: sample.values, debts: sample.debts, subscriptions: sample.subscriptions, ui: { collapsed: {}, sample: true } }, 'boot');
  }

  initTheme();
  initSavedIndicator();
  initInputs();
  initPlan();
  initCharts();
  initGoals();
  initHistory();
  syncPlanControls(getState());

  subscribe((reason) => {
    if (reason === 'replace' || reason === 'import' || reason === 'sample' || reason === 'reset') {
      syncInputs();
      syncPlanControls(getState());
    }
    if (reason === 'ui') return;
    reason === 'input' ? renderSoon() : render();
  });

  $('clearSample').addEventListener('click', () => {
    const st = getState();
    replaceState({ ...defaultState(), profile: st.profile, currency: st.currency, period: st.period, snapshots: st.snapshots }, 'reset');
    $('f-income').focus();
  });

  setText($('year'), String(new Date().getFullYear()));
  render();
  initAds();
}

boot();
