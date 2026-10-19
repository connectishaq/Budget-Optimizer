// Shared script for the standalone pages (privacy, terms, contact): styles and
// the light/dark switch. The calculator itself boots from main.js.

import './styles.css';
import { t } from './i18n/index.js';
import { startI18n, initLocalePicker, restoreScroll } from './i18n/picker.js';

const THEME_KEY = 'hbo:theme';

function initTheme() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  const apply = (dark) => {
    document.documentElement.classList.toggle('dark', dark);
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', t(dark ? 'layout.theme.toLight' : 'layout.theme.toDark'));
    meta?.setAttribute('content', dark ? '#020617' : '#0f172a');
  };
  apply(document.documentElement.classList.contains('dark'));
  btn.addEventListener('click', () => {
    const dark = !document.documentElement.classList.contains('dark');
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* storage unavailable */ }
    apply(dark);
  });
}

/** Resolves once the page is translated and the header is wired; page scripts wait for it. */
export const pageReady = startI18n().then(() => {
  initTheme();
  initLocalePicker();
  restoreScroll();
});
