// Language + country picker in the header. On wide screens the two dropdowns
// sit in the header; on narrow ones a compact globe button opens a small card
// holding the same two dropdowns. A choice is saved and the page reloads, so
// every part of the page (including text built at start-up) uses it at once.

import { t, dirOf, LANGUAGES, isLive, getLanguage, storeLanguage, setLanguage, translateDom, detectLanguage, getStoredLanguage } from './index.js';
import { ALL_COUNTRIES, GLOBAL, flagOf, flagsDrawn, countryName, storeCountry, initialCountry } from './countries.js';
import { hrefFor } from './locale-pages.js';
import { GUIDE_BASES } from './guide-langs.js';

const SCROLL_KEY = 'hbo:scroll';

/** The language a language/country page (/de-de/) was built in, or null on the home page. */
export const pageLanguage = () => {
  const l = document.documentElement.getAttribute('data-page-lang');
  return isLive(l) ? l : null;
};

/** ?lang=xx on links from a language/country page (to the privacy policy…), or null. */
export const urlLanguage = (search = location.search) => {
  const l = new URLSearchParams(search).get('lang');
  return isLive(l) ? l : null;
};

/**
 * Language for this page view: a language/country page's own language, else
 * ?lang= for this visit, else the saved choice, else the browser's (saved on
 * first visit).
 */
export function chooseLanguage() {
  const page = pageLanguage() || urlLanguage();
  if (page) return page;
  const stored = getStoredLanguage();
  if (stored) return stored;
  const detected = detectLanguage();
  storeLanguage(detected);
  return detected;
}

/**
 * Loads and applies the language before anything renders. Pages call this
 * first, then build their dynamic parts, so start-up text is translated too.
 */
export async function startI18n() {
  const lang = chooseLanguage();
  try {
    await setLanguage(lang);
    // Arabic-script font, only for right-to-left languages
    if (dirOf(lang) === 'rtl') await import('../fonts/arabic.css');
    if (lang !== 'en') translateDom(document);
    // Guide links go to the guides in this language when it has them (Urdu: /ur-pk/guides/)
    const guides = lang !== 'en' && GUIDE_BASES[lang];
    if (guides) document.querySelectorAll('a[href^="/guides/"]').forEach((el) => el.setAttribute('href', `${guides}${el.getAttribute('href').slice('/guides/'.length)}`));
  } finally {
    // The inline head script hides the page while a non-English page is translated
    document.documentElement.classList.remove('i18n-pending');
  }
  return lang;
}

function fillLanguages(select) {
  const cur = getLanguage();
  select.innerHTML = '';
  // Only languages that are switched on (src/i18n/enabled.js)
  for (const [code, { name }] of Object.entries(LANGUAGES).filter(([c]) => isLive(c))) {
    const o = new Option(name, code, false, code === cur);
    o.lang = code; // each name is shown in its own script
    select.add(o);
  }
}

function fillCountries(select, current) {
  const lang = getLanguage();
  const other = t('layout.locale.otherCountry');
  const coll = new Intl.Collator(lang);
  const rows = ALL_COUNTRIES.filter((c) => c !== GLOBAL)
    .map((c) => ({ c, name: countryName(c, lang, other) }))
    .sort((a, b) => coll.compare(a.name, b.name));
  rows.push({ c: GLOBAL, name: other }); // "Other country" always last
  select.innerHTML = '';
  // Flags only where the device draws them (not on Windows, where they'd show as letters)
  const flags = flagsDrawn();
  for (const { c, name } of rows) select.add(new Option(flags ? `${flagOf(c)} ${name}` : name, c, false, c === current));
}

/** Reloads keeping the scroll position, so a language/country switch feels in place. */
function reloadInPlace() {
  try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch { /* ignore */ }
  // A ?lang= from the link would override the new choice, so drop it
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang');
    location.replace(url.href);
  } else location.reload();
}

/** Puts the page back where it was before a language/country reload. True when it did. */
export function restoreScroll() {
  let y = null;
  try { y = sessionStorage.getItem(SCROLL_KEY); sessionStorage.removeItem(SCROLL_KEY); } catch { /* ignore */ }
  if (y != null) requestAnimationFrame(() => window.scrollTo(0, Number(y) || 0));
  return y != null;
}

/**
 * Wires the picker. `country` is the current country; `onCountry(code)` lets
 * the calculator apply a new country (defaults to saving it and reloading).
 */
export function initLocalePicker({ country = initialCountry(), onCountry } = {}) {
  const root = document.querySelector('[data-locale-picker]');
  if (!root) return;
  const toggle = root.querySelector('[data-locale-toggle]');
  const panel = root.querySelector('[data-locale-panel]');
  const langSel = root.querySelector('#langSelect');
  const countrySel = root.querySelector('#countrySelect');

  fillLanguages(langSel);
  fillCountries(countrySel, country);
  const code = root.querySelector('[data-locale-code]');
  if (code) code.textContent = getLanguage().toUpperCase();
  toggle.setAttribute('aria-label', t('layout.locale.toggle', { language: LANGUAGES[getLanguage()].name, country: countryName(country, getLanguage(), t('layout.locale.otherCountry')) }));

  const setOpen = (open) => {
    panel.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) langSel.focus();
  };
  toggle.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target) && toggle.getAttribute('aria-expanded') === 'true') setOpen(false);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
  });

  langSel.addEventListener('change', () => {
    storeLanguage(langSel.value);
    // On a language/country page, go to the page for the new language (the
    // same country where there is one; see hrefFor)
    if (pageLanguage()) {
      // A guide goes to the same guide in that language when there is one
      const alts = JSON.parse(document.documentElement.getAttribute('data-alternates') || '{}');
      location.href = alts[langSel.value] || hrefFor(langSel.value, document.documentElement.getAttribute('data-page-country'));
      return;
    }
    reloadInPlace();
  });
  countrySel.addEventListener('change', () => {
    const next = countrySel.value;
    if (onCountry) onCountry(next);
    else { storeCountry(next); reloadInPlace(); }
  });
}
