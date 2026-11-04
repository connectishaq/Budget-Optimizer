// npm run hreflang:check   (runs at the end of npm run build)
// Checks the canonical and hreflang links of every built page in dist/:
// - the canonical is the page's own address (same trailing slash);
// - a page with hreflang links lists itself, with the same URL as its canonical;
// - every hreflang URL is a page that exists, is indexable and is its own canonical;
// - every version of a page has exactly the same hreflang set (reciprocal);
// - no language is listed twice, and there is an x-default;
// - sitemap.xml lists the same alternates as the page itself.
// Skipped when the build has no SITE_URL (then there are no canonical/hreflang links).
// Exit code 1 on errors.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { htmlPages } from './lib/dist-pages.mjs';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const errors = [];
const pages = new Map(); // "/about/" -> { canonical, set: Map(hreflang -> url), noindex, lang }
let siteUrl = '';

for (const { rel, html } of htmlPages(dist)) {
  const doc = parse(html);
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  const noindex = /noindex/.test(doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '');
  const set = new Map();
  for (const l of doc.querySelectorAll('link[rel="alternate"][hreflang]')) {
    const code = l.getAttribute('hreflang');
    if (set.has(code)) errors.push(`${rel}: hreflang "${code}" listed twice`);
    set.set(code, l.getAttribute('href'));
  }
  if (canonical && !siteUrl) siteUrl = canonical.replace(/^(https?:\/\/[^/]+).*$/, '$1');
  pages.set(rel, { canonical, set, noindex, lang: doc.querySelector('html')?.getAttribute('lang') });
}

if (!siteUrl) {
  console.log('Hreflang check: skipped (no canonical links: SITE_URL is not set for this build).');
  process.exit(0);
}

const pathOf = (url) => (url.startsWith(siteUrl) ? url.slice(siteUrl.length) || '/' : null);
const key = (set) => [...set].map(([c, u]) => `${c} ${u}`).sort().join('\n');

for (const [rel, p] of pages) {
  if (p.noindex) continue;
  if (p.canonical !== `${siteUrl}${rel}`) errors.push(`${rel}: canonical is ${p.canonical || '(none)'}, expected ${siteUrl}${rel}`);
  if (!p.set.size) continue;
  const self = [...p.set].filter(([c, u]) => u === p.canonical && c !== 'x-default');
  if (!self.length) errors.push(`${rel}: its hreflang set doesn't list the page itself (${p.canonical})`);
  else if (self.some(([c]) => c.toLowerCase() !== (p.lang || '').toLowerCase())) {
    errors.push(`${rel}: lists itself as hreflang "${self.map(([c]) => c).join('", "')}" but <html lang="${p.lang}">`);
  }
  if (!p.set.has('x-default')) errors.push(`${rel}: no hreflang x-default`);
  for (const [code, url] of p.set) {
    const target = pathOf(url);
    const other = target && pages.get(target);
    if (!other) { errors.push(`${rel}: hreflang "${code}" points to ${url}, which isn't a page on this site`); continue; }
    if (other.noindex) errors.push(`${rel}: hreflang "${code}" points to ${url}, which is noindex`);
    if (other.canonical !== url) errors.push(`${rel}: hreflang "${code}" points to ${url}, whose canonical is ${other.canonical || '(none)'}`);
    if (key(other.set) !== key(p.set)) errors.push(`${rel}: hreflang set differs from the set on ${target} (links must be identical and reciprocal)`);
  }
}

// The sitemap's alternates must match the pages' own hreflang links
const sitemapFile = path.join(dist, 'sitemap.xml');
if (fs.existsSync(sitemapFile)) {
  for (const [, u] of fs.readFileSync(sitemapFile, 'utf8').matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = u.match(/<loc>([^<]*)<\/loc>/)?.[1].trim();
    const rel = pathOf(loc);
    const p = pages.get(rel);
    if (!p) { errors.push(`sitemap.xml: ${loc} isn't a page on this site`); continue; }
    if (p.noindex) errors.push(`sitemap.xml: ${loc} is noindex`);
    if (p.canonical !== loc) errors.push(`sitemap.xml: ${loc} isn't its page's canonical (${p.canonical})`);
    const set = new Map([...u.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));
    if (key(set) !== key(p.set)) errors.push(`sitemap.xml: alternates for ${loc} differ from the page's hreflang links`);
  }
}

console.log(`Hreflang check: ${pages.size} pages`);
if (errors.length) {
  console.log(`\nErrors:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('No errors.');
