// npm run lang-url:check   (runs at the end of npm run build)
// Keeps ?lang= duplicates out of search engines. Google indexed addresses
// such as /contact/?lang=ur because the language/country pages linked to
// them; links now carry the language in the fragment (#lang=ur), which
// crawlers ignore. This check fails the build if a ?lang= address comes back:
// - no link (<a href>, <link href>) in any built page has lang= in its query string;
// - every canonical and hreflang URL is clean (no query string or fragment);
// - sitemap.xml lists only clean URLs;
// - no script in dist/assets builds a ?lang= / &lang= link.
// Exit code 1 on errors.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { htmlPages } from './lib/dist-pages.mjs';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const errors = [];
const langQuery = (href) => /^[^#]*\?([^#]*&)?lang=/.test(href);
const clean = (url) => !/[?#]/.test(url);

for (const { rel, html } of htmlPages(dist)) {
  const doc = parse(html);
  for (const el of doc.querySelectorAll('a[href], link[href], area[href]')) {
    const href = el.getAttribute('href');
    if (langQuery(href)) errors.push(`${rel}: links to "${href}" (use #lang=xx, not ?lang=xx)`);
  }
  for (const el of doc.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]')) {
    const href = el.getAttribute('href') || '';
    if (!clean(href)) errors.push(`${rel}: ${el.getAttribute('rel')} URL "${href}" has a query string or fragment`);
  }
  // Pages that read ?lang= / #lang= must say which address is the real one
  const canonical = doc.querySelector('link[rel="canonical"]');
  const noindex = /noindex/.test(doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '');
  if (/lang=\(\[a-z\]\{2\}\)/.test(html) && !canonical && !noindex && fs.existsSync(path.join(dist, 'sitemap.xml'))) {
    errors.push(`${rel}: reads the language from the URL but has no canonical link`);
  }
}

const sitemap = path.join(dist, 'sitemap.xml');
if (fs.existsSync(sitemap)) {
  const xml = fs.readFileSync(sitemap, 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]*)<\/loc>|<xhtml:link[^>]*href="([^"]*)"/g)].map((m) => m[1] ?? m[2]);
  if (!urls.length) errors.push('sitemap.xml: no URLs found');
  for (const u of urls) if (!clean(u)) errors.push(`sitemap.xml: "${u}" has a query string or fragment`);
}

const assets = path.join(dist, 'assets');
if (fs.existsSync(assets)) {
  for (const f of fs.readdirSync(assets).filter((n) => n.endsWith('.js'))) {
    const js = fs.readFileSync(path.join(assets, f), 'utf8');
    if (/[?&]lang=/.test(js.replace(/\[\?&\]lang=/g, ''))) errors.push(`assets/${f}: builds a ?lang= / &lang= link (use #lang=xx)`);
  }
}

if (errors.length) {
  console.error(`✗ lang-url:check: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('✓ lang-url:check: no ?lang= links, clean canonical/hreflang URLs, clean sitemap');
