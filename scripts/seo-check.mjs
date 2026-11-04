// npm run seo:check   (after npm run build)
// Checks every built page in dist/: exactly one H1, headings that don't skip
// a level, a title and meta description that no other page uses, a title that
// isn't just the H1, readable text on every link, and alt text on every
// image. Exit code 1 on errors.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (!fs.existsSync(dist)) {
  console.error('dist/ not found: run npm run build first.');
  process.exit(1);
}

function pages(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'assets') pages(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const errors = [];
const seen = { title: new Map(), description: new Map() };
const files = pages(dist);
for (const f of files) {
  const rel = `/${path.relative(dist, f).replace(/\\/g, '/').replace(/index\.html$/, '')}`;
  const doc = parse(fs.readFileSync(f, 'utf8'));
  const noindex = /noindex/.test(doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '');

  const h1 = doc.querySelectorAll('h1');
  if (h1.length !== 1) errors.push(`${rel}: ${h1.length} H1 headings (need exactly one)`);

  let last = 0;
  for (const h of doc.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const level = Number(h.tagName[1]);
    if (last && level > last + 1) errors.push(`${rel}: <${h.tagName.toLowerCase()}> "${h.text.trim().slice(0, 50)}" skips a level after <h${last}>`);
    last = level;
  }

  // A {placeholder} left in visible text means a message wasn't filled in
  const body = doc.querySelector('body');
  body.querySelectorAll('script, style, template').forEach((el) => el.remove());
  const left = body.text.match(/\{[a-zA-Z]\w*\}/g);
  if (left) errors.push(`${rel}: unfilled placeholder(s) in the page text: ${[...new Set(left)].join(', ')}`);

  // Every link needs readable text: its own text, an aria-label or an image's alt text
  for (const a of doc.querySelectorAll('a[href]')) {
    const text = a.text.replace(/\s+/g, ' ').trim();
    const alt = a.querySelectorAll('img').map((i) => i.getAttribute('alt') || '').join('').trim();
    if (!text && !(a.getAttribute('aria-label') || '').trim()) errors.push(`${rel}: link to ${a.getAttribute('href')} has no text or aria-label${alt ? ` (only image alt "${alt}")` : ''}`);
  }

  for (const img of doc.querySelectorAll('img')) {
    if (!img.hasAttribute('alt')) errors.push(`${rel}: <img src="${img.getAttribute('src')}"> has no alt attribute`);
  }

  if (noindex) continue; // not shown in search results (404 page)
  const title = doc.querySelector('title')?.text.trim();
  // The title and the H1 should say the same thing in slightly different words
  const plain = (s) => (s || '').replace(/&amp;/g, '&').replace(/\s*\|\s*SpendMath\s*$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (h1.length === 1 && plain(title) === plain(h1[0].text)) errors.push(`${rel}: <title> is the same as the H1 ("${h1[0].text.trim()}")`);
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
  for (const [kind, value] of [['title', title], ['description', description]]) {
    if (!value) { errors.push(`${rel}: no ${kind}`); continue; }
    if (seen[kind].has(value)) errors.push(`${rel}: same ${kind} as ${seen[kind].get(value)}`);
    else seen[kind].set(value, rel);
  }
}

console.log(`SEO check: ${files.length} pages`);
if (errors.length) {
  console.log(`\nErrors:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('No errors.');
