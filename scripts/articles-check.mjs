// npm run articles:check   (also checks the money guides: scripts/guides-check.mjs)
// Checks the per-country articles in src/i18n/articles/<page>.json against the
// English article (page.guide in en.json): same keys, the same markup in
// "_html" messages (number badges, no new tags), a sensible length, and a
// page title and description that fit search results. Exit code 1 on errors.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALE_PAGES } from '../src/i18n/locale-pages.js';
import { checkGuides } from './guides-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src/i18n/articles');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v && typeof v === 'object') flatten(v, key, out);
  }
  return out;
}
const ALLOWED = /^<\/?(strong|em|span|a)(\s+(class|href)="[^"]*")*\s*>$/;
const tags = (s) => s.match(/<[^>]+>/g) || [];
const badge = (s) => (s.match(/<span class="num-badge">\d<\/span>/g) || []).join();
const words = (s) => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

const ref = flatten(en.page.guide);
const errors = [];
const report = [];
for (const page of LOCALE_PAGES.filter((p) => p.path !== 'en-us')) {
  const file = path.join(dir, `${page.path}.json`);
  if (!fs.existsSync(file)) { errors.push(`${page.path}: missing ${path.relative(root, file)}`); continue; }
  let a;
  try { a = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { errors.push(`${page.path}: invalid JSON (${e.message})`); continue; }
  const g = flatten(a.guide || {});
  for (const k of Object.keys(ref)) if (typeof g[k] !== 'string' || !g[k].trim()) errors.push(`${page.path}: guide.${k} missing`);
  for (const k of Object.keys(g)) if (!(k in ref)) errors.push(`${page.path}: guide.${k} is not in the English article`);
  for (const [k, v] of Object.entries(g)) {
    if (!k.endsWith('_html') && /<[a-z/]/i.test(v)) errors.push(`${page.path}: guide.${k} has markup but isn't an _html key`);
    for (const tg of tags(v)) if (!ALLOWED.test(tg)) errors.push(`${page.path}: guide.${k} has a tag not allowed: ${tg}`);
    if (ref[k] && badge(ref[k]) !== badge(v)) errors.push(`${page.path}: guide.${k} must keep its number badge exactly`);
  }
  const t = a.seo?.title || '';
  const d = a.seo?.description || '';
  if (!t || t.length > 70) errors.push(`${page.path}: seo.title must be 1–70 characters (is ${t.length})`);
  if (!d || d.length > 170) errors.push(`${page.path}: seo.description must be 1–170 characters (is ${d.length})`);
  const n = words(Object.values(g).join(' '));
  if (n < 700) errors.push(`${page.path}: article has ${n} words; aim for about 800 or more`);
  report.push(`  ${page.path}: ${n} words`);
}

console.log(`articles check (English reference: ${words(Object.values(ref).join(' '))} words)\n${report.join('\n')}`);
// The money guides (src/i18n/guides) are checked here too
const guides = checkGuides(root);
errors.push(...guides.errors);
console.log(`\nguides check\n${guides.report.join('\n')}`);

if (errors.length) {
  console.log(`\nErrors:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('\nNo errors.');
