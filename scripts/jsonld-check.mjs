// npm run jsonld:check   (runs at the end of npm run build)
// Validates the JSON-LD on every built page in dist/ against what Google's
// Rich Results Test and schema.org expect:
// - every block is valid JSON with "@context": "https://schema.org" and known types;
// - Article/BlogPosting: headline (max 110 characters), description, image,
//   datePublished, dateModified (not before published, and the same day as
//   the visible "Last updated" <time> in the article header), author (Person
//   with a name), publisher (Organization with a name and logo);
// - FAQPage: questions with an accepted answer; BreadcrumbList: positions 1…n,
//   every item named and linked, the last one being the page itself;
// - WebApplication: name, category, operating system, offer with price and currency;
//   home pages also need WebSite (name, url, inLanguage) and Organization (name,
//   url, logo, email; founder = the About page Person);
// - AboutPage/ContactPage/WebPage/CollectionPage: name, description, url, and
//   dateModified on the same day as a visible #pageUpdated <time>;
// - with SITE_URL: every url/item/image/logo is an absolute https URL on the
//   site, the page's own url equals its canonical, and site files (logo, share
//   image) exist in dist/; inLanguage matches <html lang>;
// - no empty strings or unfilled placeholders (__SITE_URL__, {name}).
// Exit code 1 on errors.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { htmlPages } from './lib/dist-pages.mjs';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const KNOWN = new Set([
  'WebApplication', 'SoftwareApplication', 'Organization', 'Person', 'Offer', 'ImageObject', 'FAQPage', 'Question', 'Answer',
  'Article', 'BlogPosting', 'BreadcrumbList', 'ListItem', 'WebPage', 'WebSite', 'AboutPage', 'ContactPage', 'ContactPoint', 'CollectionPage'
]);
const PAGE_TYPES = new Set(['AboutPage', 'ContactPage', 'WebPage', 'CollectionPage']);
const DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

const errors = [];
let blocks = 0;

// A Person or Organization with an @id must be described the same way on every page
const entities = new Map(); // @id -> { rel, type, name, jobTitle }
function collectIds(v, rel) {
  if (Array.isArray(v)) { v.forEach((x) => collectIds(x, rel)); return; }
  if (!v || typeof v !== 'object') return;
  if (v['@id'] && v['@type']) {
    const me = { rel, type: v['@type'], name: v.name, jobTitle: v.jobTitle };
    const seen = entities.get(v['@id']);
    if (!seen) entities.set(v['@id'], me);
    else {
      for (const k of ['type', 'name', 'jobTitle']) {
        if (seen[k] && me[k] && seen[k] !== me[k]) errors.push(`${rel}: ${v['@id']} has ${k} "${me[k]}", but "${seen[k]}" on ${seen.rel}`);
      }
    }
  }
  Object.values(v).forEach((x) => collectIds(x, rel));
}
const pages = htmlPages(dist);
const siteUrl = pages.map((p) => parse(p.html).querySelector('link[rel="canonical"]')?.getAttribute('href')).find(Boolean)?.replace(/^(https?:\/\/[^/]+).*$/, '$1') || '';

for (const { rel, html } of pages) {
  const doc = parse(html);
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  const htmlLang = doc.querySelector('html')?.getAttribute('lang') || '';
  const err = (msg) => errors.push(`${rel}: ${msg}`);

  const types = new Set();
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    blocks++;
    let data;
    try { data = JSON.parse(script.text); } catch (e) { err(`invalid JSON-LD (${e.message})`); continue; }
    if (data['@context'] !== 'https://schema.org') err(`"@context" is ${JSON.stringify(data['@context'])}, expected "https://schema.org"`);
    const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];

    // Every value: no empty strings, placeholders or relative/foreign URLs
    const walk = (v, where) => {
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
      else if (v && typeof v === 'object') {
        if ('@type' in v && !KNOWN.has(v['@type'])) err(`${where}: unknown @type "${v['@type']}"`);
        for (const [k, x] of Object.entries(v)) {
          walk(x, `${where}.${k}`);
          if (siteUrl && ['url', 'item', 'image', '@id', 'mainEntityOfPage'].includes(k) && typeof x === 'string' && !x.startsWith(`${siteUrl}/`) && !(k === 'url' && /^https:\/\//.test(x) && where.includes('sameAs'))) {
            err(`${where}.${k} must be an absolute URL on ${siteUrl} (is "${x}")`);
          }
        }
      } else if (typeof v === 'string') {
        if (!v.trim()) err(`${where} is empty`);
        if (/__[A-Z_]+__|\{[a-zA-Z]\w*\}/.test(v)) err(`${where} has an unfilled placeholder: "${v.slice(0, 60)}"`);
      }
    };
    walk(data, '');
    collectIds(data, rel);

    for (const n of nodes) {
      const type = n['@type'];
      types.add(type);
      const at = `${type}`;
      const need = (k) => { if (n[k] == null || n[k] === '') err(`${at}: "${k}" is required`); return n[k]; };
      if (n.inLanguage && htmlLang && n.inLanguage.toLowerCase() !== htmlLang.toLowerCase()) err(`${at}: inLanguage "${n.inLanguage}" but <html lang="${htmlLang}">`);

      if (type === 'Article' || type === 'BlogPosting') {
        const headline = need('headline');
        if (headline && headline.length > 110) err(`${at}: headline is ${headline.length} characters (max 110)`);
        need('description');
        need('image');
        const pub = need('datePublished');
        const mod = need('dateModified');
        for (const [k, d] of [['datePublished', pub], ['dateModified', mod]]) if (d && !DATE.test(d)) err(`${at}: ${k} "${d}" isn't an ISO 8601 date`);
        if (pub && mod && mod < pub) err(`${at}: dateModified is before datePublished`);
        // The "Last updated" date shown under the H1 must be the same day
        const shown = doc.querySelector('article header time[datetime]')?.getAttribute('datetime');
        if (mod && shown !== mod.slice(0, 10)) err(`${at}: dateModified ${mod} but the page shows "Last updated" ${shown ? `<time datetime="${shown}">` : '(none)'}`);
        const a = need('author');
        if (a && (a['@type'] !== 'Person' || !a.name)) err(`${at}: author must be a Person with a name`);
        if (a && siteUrl && a['@id'] !== `${siteUrl}/about/#person`) err(`${at}: author must be the About page's Person (@id ${siteUrl}/about/#person)`);
        const p = need('publisher');
        if (p && (p['@type'] !== 'Organization' || !p.name || !p.logo?.url)) err(`${at}: publisher must be an Organization with a name and logo`);
        if (canonical && n.url !== canonical) err(`${at}: url "${n.url}" isn't the canonical ${canonical}`);
      }
      if (type === 'FAQPage') {
        const qs = need('mainEntity');
        if (!Array.isArray(qs) || !qs.length) err(`${at}: mainEntity needs at least one Question`);
        else qs.forEach((q, i) => {
          if (q['@type'] !== 'Question' || !q.name?.trim()) err(`${at}: mainEntity[${i}] must be a Question with a name`);
          if (q.acceptedAnswer?.['@type'] !== 'Answer' || !q.acceptedAnswer.text?.trim()) err(`${at}: mainEntity[${i}] needs an acceptedAnswer with text`);
        });
      }
      if (type === 'BreadcrumbList') {
        const items = need('itemListElement') || [];
        items.forEach((it, i) => {
          if (it['@type'] !== 'ListItem' || it.position !== i + 1 || !it.name?.trim()) err(`${at}: item ${i + 1} must be a ListItem with position ${i + 1} and a name`);
          if (siteUrl && !it.item) err(`${at}: item ${i + 1} ("${it.name}") has no URL`);
        });
        if (canonical && items.length && items[items.length - 1].item !== canonical) err(`${at}: the last item should be this page (${canonical})`);
      }
      if (type === 'WebApplication' || type === 'SoftwareApplication') {
        need('name'); need('applicationCategory'); need('operatingSystem');
        const o = need('offers');
        if (o && (o['@type'] !== 'Offer' || o.price == null || !o.priceCurrency)) err(`${at}: offers must be an Offer with price and priceCurrency`);
        if (canonical && n.url !== canonical) err(`${at}: url "${n.url}" isn't the canonical ${canonical}`);
      }
      if (PAGE_TYPES.has(type)) {
        need('name'); need('description');
        // A page with a visible "Last updated" (About, Methodology) needs dateModified on the same day
        const shown = doc.querySelector('#pageUpdated time[datetime]')?.getAttribute('datetime');
        if (shown && n.dateModified?.slice(0, 10) !== shown) err(`${at}: the page shows "Last updated" ${shown} but dateModified is ${n.dateModified || '(none)'}`);
        if (n.dateModified && !DATE.test(n.dateModified)) err(`${at}: dateModified "${n.dateModified}" isn't an ISO 8601 date`);
        if (canonical && n.url !== canonical) err(`${at}: url "${n.url}" isn't the canonical ${canonical}`);
      }
      if (type === 'WebSite') {
        need('name'); need('inLanguage');
        if (siteUrl) { if (n.url !== `${siteUrl}/`) err(`${at}: url must be the home page ${siteUrl}/`); need('@id'); }
      }
      if (type === 'Organization') {
        need('name'); need('email');
        if (siteUrl) { need('url'); need('logo'); }
        if (n.founder && siteUrl && n.founder['@id'] !== `${siteUrl}/about/#person`) err(`${at}: founder must be the About page's Person (@id ${siteUrl}/about/#person)`);
      }
      // Organization logos: a URL (or ImageObject with one)
      for (const org of [n.publisher, type === 'Organization' ? n : null].filter(Boolean)) {
        if (org.logo && !(typeof org.logo === 'string' || org.logo.url)) err(`${at}: publisher logo needs a url`);
      }
    }

    // Site files referenced from the JSON-LD must exist
    if (siteUrl) {
      for (const m of JSON.stringify(data).matchAll(/"(https?:\/\/[^"]+\.(?:png|svg|jpg|webp))"/g)) {
        if (m[1].startsWith(siteUrl) && !fs.existsSync(path.join(dist, m[1].slice(siteUrl.length)))) err(`${m[1]} is referenced in JSON-LD but isn't in dist/`);
      }
    }
  }
  // Home pages (the calculator, in every language) describe the site and who runs it
  if (types.has('WebApplication')) for (const t of ['WebSite', 'Organization']) if (!types.has(t)) err(`home page needs a ${t} node`);
}

console.log(`JSON-LD check: ${blocks} blocks on ${pages.length} pages${siteUrl ? '' : ' (no SITE_URL: URL checks skipped)'}`);
if (errors.length) {
  console.log(`\nErrors:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('No errors.');
