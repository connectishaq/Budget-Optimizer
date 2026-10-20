// npm run i18n:check
// Reports, for the translation files in src/i18n/locales:
//   - keys used in code/HTML but missing from en.json            (error)
//   - inline English in HTML that no longer matches en.json       (error)
//   - placeholders that differ between a translation and English  (error)
//   - keys missing from each other language                       (warning; error with --strict)
//   - keys in a language that English doesn't have                (warning)
//   - keys in en.json that nothing uses                           (warning)
// Exit code 1 when there is an error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(root, 'src/i18n/locales');
const strict = process.argv.includes('--strict');

const read = (f) => fs.readFileSync(f, 'utf8');
const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const isPlural = (v) => !!v && typeof v === 'object' && typeof v.other === 'string'
  && Object.keys(v).every((k) => PLURAL_CATEGORIES.has(k));

/** { "a.b.c": "text" | {one, other} } */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || isPlural(v)) out[key] = v;
    else if (v && typeof v === 'object') flatten(v, key, out);
  }
  return out;
}

const placeholders = (v) => {
  const text = typeof v === 'string' ? v : Object.values(v).join(' ');
  return [...new Set(text.match(/\{\w+\}/g) || [])].sort().join(',');
};

function walk(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x)) && !e.name.endsWith('.test.js')) out.push(p);
  }
  return out;
}

// Parsers serialise empty attributes differently (data-x vs data-x=""), so ignore that
const norm = (s) => s.replace(/=""/g, '').replace(/\s+/g, ' ').trim();
const decode = (s) => parse(`<p>${s}</p>`).querySelector('p').text;

// ---------------- Load messages ----------------
const en = flatten(JSON.parse(read(path.join(localesDir, 'en.json'))));
const langs = fs.readdirSync(localesDir).filter((f) => f.endsWith('.json') && f !== 'en.json')
  .map((f) => ({ code: path.basename(f, '.json'), keys: flatten(JSON.parse(read(path.join(localesDir, f)))) }));

const errors = [];
const warnings = [];

// ---------------- Keys used in code ----------------
const used = new Set();
const namespaces = new Set(Object.keys(en).map((k) => k.split('.')[0]));
const dynamicPrefixes = new Set();
// vite.config.js and the guide builder make some markup too (About table, guide pages)
const jsFiles = [...walk(path.join(root, 'src'), ['.js']), path.join(root, 'vite.config.js'), path.join(root, 'scripts', 'build-guides.mjs')];
for (const f of jsFiles) {
  const src = read(f);
  for (const m of src.matchAll(/\bt\(\s*(['"])([\w.-]+)\1/g)) used.add(m[2]);
  // t(`rules.${id}.title`) -> everything under "rules." counts as used
  for (const m of src.matchAll(/\bt\(\s*`([\w.-]*)\$\{/g)) if (m[1]) dynamicPrefixes.add(m[1]);
  // Any template string that starts with a known namespace, e.g. `wizard.steps.${n}`
  for (const m of src.matchAll(/`((?:[a-z]\w*\.)+)\$\{/gi)) if (namespaces.has(m[1].split('.')[0])) dynamicPrefixes.add(m[1]);
  // t() imported under another name, e.g. { t as tr }
  for (const m of src.matchAll(/\btr\(\s*(['"])([\w.-]+)\1/g)) used.add(m[2]);
  // Keys stored in tables and translated later, e.g. { labelKey: 'inputs.fields.rent' }
  for (const m of src.matchAll(/(['"`])((?:[a-z][\w-]*\.)+[\w-]+)\1/gi)) if (en[m[2]]) used.add(m[2]);
}

const htmlFiles = [
  path.join(root, 'index.html'),
  path.join(root, '404.html'),
  path.join(root, 'about', 'index.html'),
  ...['privacy-policy', 'terms-of-use', 'contact'].map((p) => path.join(root, p, 'index.html')),
  ...walk(path.join(root, 'src/partials'), ['.html'])
].filter((f) => fs.existsSync(f));

for (const f of htmlFiles) {
  const doc = parse(read(f), { comment: false });
  const rel = path.relative(root, f);
  for (const el of doc.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    used.add(key);
    // data-i18n-vars='{"step":1}' fills the message's placeholders, as the page does
    const vars = el.getAttribute('data-i18n-vars');
    const msg = typeof en[key] === 'string' && vars ? en[key].replace(/\{(\w+)\}/g, (m, n) => JSON.parse(vars)[n] ?? m) : en[key];
    if (typeof msg === 'string' && norm(el.text) !== norm(decode(msg)) && !/__\w+__/.test(el.text)) {
      errors.push(`${rel}: inline text of [data-i18n="${key}"] differs from en.json\n    html: ${norm(el.text).slice(0, 120)}\n    json: ${norm(decode(msg)).slice(0, 120)}`);
    }
  }
  for (const el of doc.querySelectorAll('[data-i18n-html]')) {
    const key = el.getAttribute('data-i18n-html');
    used.add(key);
    if (!key.endsWith('_html')) errors.push(`${rel}: data-i18n-html key "${key}" must end in _html`);
    if (typeof en[key] === 'string' && norm(el.innerHTML) !== norm(en[key]) && !/__\w+__/.test(el.innerHTML)) {
      errors.push(`${rel}: inline HTML of [data-i18n-html="${key}"] differs from en.json\n    html: ${norm(el.innerHTML).slice(0, 120)}\n    json: ${norm(en[key]).slice(0, 120)}`);
    }
  }
  for (const el of doc.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (!attr || !key) continue;
      used.add(key);
      const inline = el.getAttribute(attr);
      if (typeof en[key] === 'string' && inline != null && norm(inline) !== norm(en[key])) {
        errors.push(`${rel}: ${attr} of [data-i18n-attr ${key}] differs from en.json`);
      }
    }
  }
}

// Head/SEO keys are read by the build (Phase 8), not by page code
const buildPrefixes = ['seo.', 'privacy.seo.', 'terms.seo.', 'contact.seo.', 'about.seo.'];
const isUsed = (k) => used.has(k) || buildPrefixes.some((p) => k.startsWith(p)) || [...dynamicPrefixes].some((p) => k.startsWith(p));

for (const k of used) if (!(k in en)) errors.push(`missing in en.json: ${k}`);
const unused = Object.keys(en).filter((k) => !isUsed(k));
if (unused.length) warnings.push(`${unused.length} unused key(s) in en.json:\n    ${unused.slice(0, 40).join('\n    ')}${unused.length > 40 ? '\n    …' : ''}`);

// ---------------- Other languages ----------------
const enCount = Object.keys(en).length;
const summary = [];
for (const { code, keys } of langs) {
  const missing = Object.keys(en).filter((k) => !(k in keys));
  const extra = Object.keys(keys).filter((k) => !(k in en));
  for (const k of Object.keys(keys)) {
    if (k in en && placeholders(keys[k]) !== placeholders(en[k])) {
      errors.push(`${code}.json: placeholders differ for "${k}" (en: ${placeholders(en[k]) || 'none'}, ${code}: ${placeholders(keys[k]) || 'none'})`);
    }
    if (isPlural(en[k]) !== isPlural(keys[k]) && k in en) errors.push(`${code}.json: "${k}" must be ${isPlural(en[k]) ? 'a plural object' : 'a string'}`);
  }
  summary.push(`  ${code}: ${enCount - missing.length}/${enCount} translated${missing.length ? `, ${missing.length} missing` : ''}${extra.length ? `, ${extra.length} extra` : ''}`);
  if (missing.length) (strict ? errors : warnings).push(`${code}.json is missing ${missing.length} key(s), e.g.\n    ${missing.slice(0, 10).join('\n    ')}`);
  if (extra.length) warnings.push(`${code}.json has ${extra.length} key(s) English doesn't, e.g.\n    ${extra.slice(0, 10).join('\n    ')}`);
}

console.log(`i18n check: ${enCount} English keys, ${used.size} referenced in code/HTML`);
console.log(summary.join('\n'));
if (warnings.length) console.log(`\nWarnings:\n- ${warnings.join('\n- ')}`);
if (errors.length) {
  console.log(`\nErrors (${errors.length}):\n- ${errors.slice(0, 60).join('\n- ')}${errors.length > 60 ? '\n- …' : ''}`);
  process.exit(1);
}
console.log('\nNo errors.');
