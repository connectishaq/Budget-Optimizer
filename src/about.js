// About page: the country table and source lists are written at build time in
// English (vite.config.js, countrySourcesHtml); here country names and review
// dates follow the visitor's language.

import { pageReady } from './page.js';
import { getLanguage } from './i18n/index.js';
import { countryName } from './i18n/countries.js';
import { dateLocale } from './utils/format.js';

pageReady.then(() => {
  const lang = getLanguage();
  if (lang === 'en') return;
  document.querySelectorAll('[data-country-name]').forEach((el) => {
    el.textContent = countryName(el.dataset.countryName, lang, el.textContent);
  });
  document.querySelectorAll('#numbers time[datetime]').forEach((el) => {
    const d = new Date(`${el.getAttribute('datetime')}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) el.textContent = d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  });
});
