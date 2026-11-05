// "Last updated: <time>" on the About and Methodology pages (#pageUpdated):
// written in English in the HTML; here it follows the visitor's language.

import { t, getLanguage } from '../i18n/index.js';
import { dateLocale } from '../utils/format.js';

export function localizePageUpdated() {
  if (getLanguage() === 'en') return;
  const updated = document.getElementById('pageUpdated');
  const time = updated?.querySelector('time[datetime]');
  if (!time) return;
  const d = new Date(`${time.getAttribute('datetime')}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return;
  time.textContent = d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const [before, after = ''] = t('about.updated').split('{date}');
  updated.replaceChildren(before, time, after);
}
