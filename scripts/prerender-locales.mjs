// Builds one static page per language + country (/en-gb/, /ar-ae/…) from the
// built home page, so search engines and visitors get each page already in its
// language with the same design. Called by vite.config.js after the build.
//
// Per page: words from src/i18n/locales/<lang>.json (English fills any gap),
// the country's article from src/i18n/articles/<page>.json, translated title,
// description, Open Graph tags and JSON-LD, and (when SITE_URL is set) the
// canonical URL plus the full hreflang set with x-default = the home page.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'node-html-parser';
import { LOCALE_PAGES, bcp47 } from '../src/i18n/locale-pages.js';

const RTL = new Set(['ar', 'ur']);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const isPlural = (v) => v && typeof v === 'object' && typeof v.other === 'string';
function lookup(obj, key) {
  let cur = obj;
  for (const part of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return isPlural(cur) ? cur.other : cur;
}

/** hreflang links for every page, plus x-default (the home page). */
export function alternateLinks(siteUrl) {
  if (!siteUrl) return '';
  return [
    ...LOCALE_PAGES.map((p) => `<link rel="alternate" hreflang="${bcp47(p.path)}" href="${siteUrl}/${p.path}/">`),
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}/">`
  ].join('\n  ');
}

/** The sitemap: the home page and every locale page, each listing all alternates. */
export function sitemapXml(siteUrl, today, extraPages = []) {
  const alts = [
    ...LOCALE_PAGES.map((p) => `    <xhtml:link rel="alternate" hreflang="${bcp47(p.path)}" href="${siteUrl}/${p.path}/"/>`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/"/>`
  ].join('\n');
  const url = (loc, priority, changefreq, withAlts) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${withAlts ? `\n${alts}` : ''}
  </url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[
    url(`${siteUrl}/`, '1.0', 'monthly', true),
    ...LOCALE_PAGES.map((p) => url(`${siteUrl}/${p.path}/`, '0.9', 'monthly', true)),
    ...extraPages.map((x) => url(`${siteUrl}/${x.path}/`, x.priority, 'yearly', false))
  ].join('\n')}
</urlset>
`;
}

function jsonLd(t, page, currency, pageUrl) {
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('seo.app.name'),
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    inLanguage: bcp47(page.path),
    offers: { '@type': 'Offer', price: '0', priceCurrency: currency },
    description: t('seo.app.description'),
    featureList: t('seo.app.featureList'),
    ...(pageUrl ? { url: pageUrl } : {})
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: bcp47(page.path),
    mainEntity: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
      '@type': 'Question',
      name: t(`seo.faq.q${i}`),
      acceptedAnswer: { '@type': 'Answer', text: t(`seo.faq.a${i}`) }
    }))
  };
  // "<" can't appear inside the script tag
  const block = (o) => `<script type="application/ld+json">\n  ${JSON.stringify(o, null, 2).replace(/</g, '\\u003c').replace(/\n/g, '\n  ')}\n  </script>`;
  return `${block(app)}\n  ${block(faq)}`;
}

/**
 * Writes <outDir>/<page>/index.html for every locale page. Returns the list
 * of pages written.
 */
export function prerenderLocales({ root, outDir, siteUrl }) {
  const home = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const en = readJson(path.join(root, 'src/i18n/locales/en.json'));
  const written = [];

  for (const page of LOCALE_PAGES) {
    const messages = page.lang === 'en' ? en : readJson(path.join(root, 'src/i18n/locales', `${page.lang}.json`));
    const articleFile = path.join(root, 'src/i18n/articles', `${page.path}.json`);
    const article = fs.existsSync(articleFile) ? readJson(articleFile) : null;
    if (!article && page.path !== 'en-us') throw new Error(`Missing article for /${page.path}/ (${articleFile})`);
    const t = (key) => {
      const v = lookup(messages, key) ?? lookup(en, key);
      if (v == null) throw new Error(`/${page.path}/: no message for ${key}`);
      return v;
    };
    const country = readJson(path.join(root, 'src/data/countries', `${page.country}.json`));
    const pageUrl = siteUrl ? `${siteUrl}/${page.path}/` : '';
    const doc = parse(home, { comment: true });

    // ---- Words: the same keys the browser would translate
    for (const el of doc.querySelectorAll('[data-i18n]')) el.set_content(esc(t(el.getAttribute('data-i18n'))));
    for (const el of doc.querySelectorAll('[data-i18n-html]')) el.set_content(t(el.getAttribute('data-i18n-html')));
    for (const el of doc.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
        const [a, key] = pair.split(':').map((s) => s.trim());
        if (a && key) el.setAttribute(a, t(key));
      }
    }

    // ---- The country's article. Its elements lose their data-i18n keys so the
    // browser doesn't swap them back to the general article.
    if (article) {
      for (const name of ['data-i18n', 'data-i18n-html']) {
        for (const el of doc.querySelectorAll(`#guide [${name}^="page.guide."]`)) {
          const key = el.getAttribute(name).slice('page.guide.'.length);
          const v = lookup(article.guide, key);
          if (typeof v !== 'string') throw new Error(`/${page.path}/: article has no guide.${key}`);
          el.set_content(name === 'data-i18n' ? esc(v) : v);
          el.removeAttribute(name);
        }
      }
    }

    // ---- The page's language, direction and country (read by the inline head script and main.js)
    const html = doc.querySelector('html');
    html.setAttribute('lang', bcp47(page.path));
    if (RTL.has(page.lang)) html.setAttribute('dir', 'rtl');
    html.setAttribute('data-page-lang', page.lang);
    html.setAttribute('data-page-country', page.country);
    html.setAttribute('data-page-path', page.path);

    // ---- Head
    const head = doc.querySelector('head');
    const set = (sel, value) => { const el = head.querySelector(sel); if (el) el.setAttribute('content', value); };
    const title = article?.seo?.title || t('seo.title');
    const description = article?.seo?.description || t('seo.description');
    head.querySelector('title').set_content(esc(title));
    set('meta[name="description"]', description);
    set('meta[property="og:site_name"]', t('seo.app.name'));
    set('meta[property="og:title"]', article?.seo?.title || t('seo.ogTitle'));
    set('meta[property="og:description"]', article?.seo?.description || t('seo.ogDescription'));
    set('meta[property="og:locale"]', bcp47(page.path).replace('-', '_'));
    set('meta[name="twitter:title"]', article?.seo?.title || t('seo.twitterTitle'));
    set('meta[name="twitter:description"]', article?.seo?.description || t('seo.twitterDescription'));
    set('meta[property="og:image:alt"]', t('seo.ogImageAlt'));
    for (const el of head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang], meta[property="og:url"], script[type="application/ld+json"]')) el.remove();
    const tags = [];
    if (pageUrl) tags.push(`<link rel="canonical" href="${pageUrl}">`, `<meta property="og:url" content="${pageUrl}">`, alternateLinks(siteUrl));
    tags.push(jsonLd(t, page, country.currency, pageUrl));
    head.insertAdjacentHTML('beforeend', `  ${tags.join('\n  ')}\n`);

    const dir = path.join(outDir, page.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), doc.toString());
    written.push(page.path);
  }
  return written;
}
