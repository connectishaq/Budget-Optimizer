// Shared script for the standalone pages (privacy, terms, contact): styles and
// the light/dark switch. The calculator itself boots from main.js.

import './styles.css';
import { t, getLanguage } from './i18n/index.js';
import { startI18n, initLocalePicker, restoreScroll } from './i18n/picker.js';
import { getStoredCountry } from './i18n/countries.js';
import { setFormatRegion } from './utils/format.js';
import { initNavMenu } from './nav-menu.js';

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
setFormatRegion(getStoredCountry());
export const pageReady = startI18n().then(() => {
  // Privacy and Terms: "the English version applies" note, only on translations
  // (changing language reloads the page, so this runs once per language)
  if (getLanguage() !== 'en') document.querySelectorAll('[data-translation-note]').forEach((el) => { el.hidden = false; });
  initTheme();
  initNavMenu();
  initLocalePicker();
  restoreScroll();
});
