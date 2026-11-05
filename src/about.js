// About page: "Last updated" is the build date, written in English at build
// time (vite.config.js, <!--BUILD_DATE-->); here it follows the visitor's language.

import { pageReady } from './page.js';
import { t, getLanguage } from './i18n/index.js';
import { dateLocale } from './utils/format.js';

pageReady.then(() => {
  if (getLanguage() === 'en') return;
  const updated = document.getElementById('aboutUpdated');
  const time = updated?.querySelector('time[datetime]');
  if (!time) return;
  const d = new Date(`${time.getAttribute('datetime')}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return;
  time.textContent = d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const [before, after = ''] = t('about.updated').split('{date}');
  updated.replaceChildren(before, time, after);
});
