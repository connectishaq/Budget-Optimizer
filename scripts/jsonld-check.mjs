// npm run jsonld:check   (runs at the end of npm run build)
// Validates the JSON-LD on every built page in dist/ against what Google's
// Rich Results Test and schema.org expect:
// - every block is valid JSON with "@context": "https://schema.org" and known types;
// - Article/BlogPosting: headline (max 110 characters), description, image,
//   datePublished, dateModified (not before published), author (Person with a
//   name), publisher (Organization with a name and logo);
// - FAQPage: questions with an accepted answer; BreadcrumbList: positions 1…n,
//   every item named and linked, the last one being the page itself;
// - WebApplication: name, category, operating system, offer with price and currency;
// - AboutPage/ContactPage/WebPage/CollectionPage: name, description, url;
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
const pages = htmlPages(dist);
const siteUrl = pages.map((p) => parse(p.html).querySelector('link[rel="canonical"]')?.getAttribute('href')).find(Boolean)?.replace(/^(https?:\/\/[^/]+).*$/, '$1') || '';

for (const { rel, html } of pages) {
  const doc = parse(html);
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  const htmlLang = doc.querySelector('html')?.getAttribute('lang') || '';
  const err = (msg) => errors.push(`${rel}: ${msg}`);

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

    for (const n of nodes) {
      const type = n['@type'];
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
        const a = need('author');
        if (a && (a['@type'] !== 'Person' || !a.name)) err(`${at}: author must be a Person with a name`);
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
        if (canonical && n.url !== canonical) err(`${at}: url "${n.url}" isn't the canonical ${canonical}`);
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
}

console.log(`JSON-LD check: ${blocks} blocks on ${pages.length} pages${siteUrl ? '' : ' (no SITE_URL: URL checks skipped)'}`);
if (errors.length) {
  console.log(`\nErrors:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('No errors.');
