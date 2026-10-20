// Where the money guides live in each language that has them. Content files:
// src/i18n/guides/<lang>/<slug>.json. A language is listed only while it's
// switched on (src/i18n/enabled.js); other languages link to the English guides.

import { isEnabledLanguage } from './enabled.js';

const BASES = { en: '/guides/', ur: '/ur-pk/guides/' };

/** The guides' base path per live language, e.g. { en: '/guides/', ur: '/ur-pk/guides/' }. */
export const GUIDE_BASES = Object.fromEntries(Object.entries(BASES).filter(([lang]) => isEnabledLanguage(lang)));

/** The order guides are listed in. */
export const GUIDE_SLUGS = [
  'emergency-fund',
  '50-30-20-rule',
  'first-salary-budget',
  'student-budget',
  'cut-electricity-bill',
  'stop-impulse-spending',
  'subscription-audit',
  'pay-off-credit-card-debt',
  'family-grocery-budget',
  'irregular-income'
];
