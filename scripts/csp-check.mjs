// npm run csp:check   (runs at the end of npm run build)
// Checks the Content-Security-Policy in dist/_headers (from public/_headers)
// against the built pages:
// - every inline script (not JSON-LD) has its sha256 hash in script-src;
// - hashes no page uses any more are reported, to be removed;
// - no inline event handlers (onclick="…"), which a hash can't allow;
// - every external script, stylesheet and image is on the site itself;
// - the contact form endpoint (VITE_CONTACT_FORM_ENDPOINT) is in connect-src;
// - frame-ancestors 'none', object-src 'none' and base-uri 'self' are set.
// Exit code 1 on errors.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { loadEnv } from 'vite';
import { htmlPages } from './lib/dist-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const errors = [];

const headers = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
const csp = headers.match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1];
if (!csp) {
  console.log('CSP check: no Content-Security-Policy in dist/_headers');
  process.exit(1);
}
const directives = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));
for (const [k, v] of [['frame-ancestors', "'none'"], ['object-src', "'none'"], ['base-uri', "'self'"]]) {
  if (!directives[k]?.includes(v)) errors.push(`CSP needs ${k} ${v}`);
}

const allowed = new Set((directives['script-src'] || []).filter((s) => s.startsWith("'sha256-")).map((s) => s.slice(1, -1)));
const used = new Map();
const pages = htmlPages(dist);
for (const { rel, html } of pages) {
  const doc = parse(html, { comment: false });
  for (const s of doc.querySelectorAll('script')) {
    const src = s.getAttribute('src');
    if (src) {
      if (/^(https?:)?\/\//.test(src)) errors.push(`${rel}: external script ${src} isn't allowed by script-src`);
      continue;
    }
    if ((s.getAttribute('type') || '').includes('json')) continue; // JSON-LD doesn't run
    // The browser hashes the script exactly as written in the file
    const body = html.slice(s.range[0], s.range[1]).replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    const hash = `sha256-${crypto.createHash('sha256').update(body).digest('base64')}`;
    if (!used.has(hash)) used.set(hash, rel);
    if (!allowed.has(hash)) errors.push(`${rel}: inline script isn't allowed; add '${hash}' to script-src in public/_headers`);
  }
  for (const el of doc.querySelectorAll('*')) {
    const handler = Object.keys(el.attributes).find((a) => /^on[a-z]+$/i.test(a));
    if (handler) errors.push(`${rel}: <${el.tagName.toLowerCase()} ${handler}="…"> is blocked by the CSP; use addEventListener`);
  }
  for (const [sel, attr] of [['link[rel="stylesheet"]', 'href'], ['img', 'src']]) {
    for (const el of doc.querySelectorAll(sel)) {
      const url = el.getAttribute(attr) || '';
      if (/^(https?:)?\/\//.test(url)) errors.push(`${rel}: ${url} is on another site and would be blocked`);
    }
  }
}
for (const hash of allowed) if (!used.has(hash)) errors.push(`'${hash}' in script-src isn't used by any page; remove it from public/_headers`);

// The contact form posts to its service from the page
const env = { ...loadEnv('production', root, 'VITE_'), ...process.env };
const endpoint = (env.VITE_CONTACT_FORM_ENDPOINT || '').trim();
if (endpoint) {
  const origin = new URL(endpoint).origin;
  if (!directives['connect-src']?.includes(origin)) errors.push(`the contact form posts to ${origin}, which isn't in connect-src`);
}

console.log(`CSP check: ${pages.length} pages, ${used.size} inline script(s)${endpoint ? '' : ' (no VITE_CONTACT_FORM_ENDPOINT: form check skipped)'}`);
if (errors.length) {
  console.log(`\nErrors:\n${[...new Set(errors)].map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('No errors.');
