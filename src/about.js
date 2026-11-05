// About page: the country table and source lists are written at build time in
// English (vite.config.js, countrySourcesHtml); country names follow the
// visitor's language in translateDom, review dates here.

import { pageReady } from './page.js';
import { getLanguage } from './i18n/index.js';
import { dateLocale } from './utils/format.js';

pageReady.then(() => {
  const lang = getLanguage();
  if (lang === 'en') return;
  document.querySelectorAll('#numbers time[datetime]').forEach((el) => {
    const d = new Date(`${el.getAttribute('datetime')}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) el.textContent = d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  });
});
