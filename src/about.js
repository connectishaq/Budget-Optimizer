// About page: "Last updated" is a fixed date in about/index.html (change it only
// when the About text changes); here it follows the visitor's language.

import { pageReady } from './page.js';
import { localizePageUpdated } from './ui/page-updated.js';

pageReady.then(localizePageUpdated);
