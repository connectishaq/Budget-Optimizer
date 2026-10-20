// npm run i18n:missing -- <lang>
// Prints every English message the language file doesn't have yet, as nested
// JSON ready to translate and merge into src/i18n/locales/<lang>.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');
const lang = process.argv[2];
if (!lang || !fs.existsSync(path.join(localesDir, `${lang}.json`))) {
  console.error('Usage: npm run i18n:missing -- <lang>   (e.g. de)');
  process.exit(1);
}

const read = (l) => JSON.parse(fs.readFileSync(path.join(localesDir, `${l}.json`), 'utf8'));
const PLURAL = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const isLeaf = (v) => typeof v === 'string' || (v && typeof v === 'object' && typeof v.other === 'string' && Object.keys(v).every((k) => PLURAL.has(k)));

/** The parts of `en` that `other` lacks, keeping the nesting. */
function missing(en, other) {
  const out = {};
  for (const [k, v] of Object.entries(en)) {
    if (isLeaf(v)) {
      if (other?.[k] == null) out[k] = v;
    } else if (v && typeof v === 'object') {
      const sub = missing(v, other?.[k]);
      if (Object.keys(sub).length) out[k] = sub;
    }
  }
  return out;
}

console.log(JSON.stringify(missing(read('en'), read(lang)), null, 2));
