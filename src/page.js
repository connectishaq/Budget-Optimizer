// Shared script for the standalone pages (privacy, terms, contact): styles and
// the light/dark switch. The calculator itself boots from main.js.

import './styles.css';

const THEME_KEY = 'hbo:theme';

function initTheme() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  const apply = (dark) => {
    document.documentElement.classList.toggle('dark', dark);
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    meta?.setAttribute('content', dark ? '#020617' : '#0f172a');
  };
  apply(document.documentElement.classList.contains('dark'));
  btn.addEventListener('click', () => {
    const dark = !document.documentElement.classList.contains('dark');
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* storage unavailable */ }
    apply(dark);
  });
}

initTheme();
