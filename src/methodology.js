// Methodology page: the country table and source lists are written at build
// time in English (vite.config.js, countrySourcesHtml), as is "Last updated"
// (the most recent country review); country names follow the visitor's
// language in translateDom, the dates here.

import { pageReady } from './page.js';
import { getLanguage } from './i18n/index.js';
import { dateLocale } from './utils/format.js';
import { localizePageUpdated } from './ui/page-updated.js';

pageReady.then(() => {
  localizePageUpdated();
  if (getLanguage() === 'en') return;
  document.querySelectorAll('#numbers time[datetime]').forEach((el) => {
    const d = new Date(`${el.getAttribute('datetime')}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) el.textContent = d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  });
});
