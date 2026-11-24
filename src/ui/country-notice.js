// "Showing Pakistan figures in PKR · Change" above the calculator on the home
// page, after the starting country was guessed from the browser's time zone
// and languages (startCountry in src/i18n/countries.js). It stays until the
// visitor closes it or the country changes any other way. It only shows text
// and opens the country list; it never changes the page address.

import { t, getLanguage } from '../i18n/index.js';
import { countryName, getAutoCountry } from '../i18n/countries.js';
import { openCountryPicker } from '../i18n/picker.js';
import { $ } from './dom.js';

const CLOSED_KEY = 'hbo:countryNoticeClosed';

function isClosed() {
  try { return localStorage.getItem(CLOSED_KEY) === '1'; } catch { return false; }
}

/** Shown only while the current country is the one the site guessed, and not closed. */
export function noticeVisible(country, auto = getAutoCountry(), closed = isClosed()) {
  return !closed && Boolean(auto) && auto === country;
}

export function initCountryNotice() {
  const box = $('countryNotice');
  if (!box) return;
  $('countryNoticeChange').addEventListener('click', (e) => {
    // The picker closes on clicks outside it; this click opened it
    e.stopPropagation();
    openCountryPicker();
  });
  $('countryNoticeClose').addEventListener('click', () => {
    box.hidden = true;
    try { localStorage.setItem(CLOSED_KEY, '1'); } catch { /* storage unavailable */ }
  });
}

export function renderCountryNotice(state) {
  const box = $('countryNotice');
  if (!box) return;
  const show = noticeVisible(state.country);
  box.hidden = !show;
  if (!show) return;
  $('countryNoticeText').textContent = t('app.countryNotice.text', {
    country: countryName(state.country, getLanguage(), state.country),
    currency: state.currency
  });
  $('countryNoticeChange').textContent = t('app.countryNotice.change');
  $('countryNoticeClose').setAttribute('aria-label', t('app.countryNotice.close'));
}
