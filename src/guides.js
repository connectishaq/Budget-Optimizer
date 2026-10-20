// Money guides (/guides/ and /ur-pk/guides/): the shared page script (theme,
// language picker) plus the in-article ad slot, shown only when an AdSense ID
// is set. The pages themselves are built by scripts/build-guides.mjs.

import { pageReady } from './page.js';
import { initAds } from './ads.js';

pageReady.then(initAds);
