// Builds the money guides from src/i18n/guides/<lang>/<slug>.json, in the
// site's article style, using the built /guides/ page as the template (header,
// footer, styles and scripts). Called by vite.config.js after the build, and by
// the dev server for each guide address.
//
// English: /guides/ and /guides/<slug>/. Other live languages listed in
// src/i18n/guide-langs.js (Urdu: /ur-pk/guides/…) get the same pages, built
// only for guides that have a translation, with the header and footer in that
// language. Each guide page has Article, FAQPage and breadcrumb JSON-LD, and
// (when SITE_URL is set) canonical, og:url and hreflang links to its other
// language versions.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'node-html-parser';
import { GUIDE_BASES, GUIDE_SLUGS } from '../src/i18n/guide-langs.js';
import { makeT, applyMessages, localizeLinks } from './prerender-locales.mjs';

const RTL = new Set(['ar', 'ur']);
const HREFLANG = { en: 'en', ur: 'ur-PK' };
const HOME = { en: '/', ur: '/ur-pk/' };
// The country of a language's guides (Urdu: Pakistan), so the picker shows it to new visitors
const COUNTRY = { ur: 'PK' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const plural = (msg, count) => (typeof msg === 'object' ? msg.other : msg).replace('{count}', String(count));

/** The guides a language has, in list order, keyed by slug. */
export function loadGuides(root, lang) {
  const dir = path.join(root, 'src/i18n/guides', lang);
  const out = new Map();
  for (const slug of GUIDE_SLUGS) {
    const f = path.join(dir, `${slug}.json`);
    if (fs.existsSync(f)) out.set(slug, readJson(f));
  }
  return out;
}

/** The languages that have a given guide: { en: '/guides/x/', ur: '/ur-pk/guides/x/' }. */
function versions(all, slug) {
  return Object.fromEntries(Object.keys(GUIDE_BASES).filter((l) => all[l].has(slug)).map((l) => [l, `${GUIDE_BASES[l]}${slug}/`]));
}

// Body HTML from the content files, with the site's list and heading styles
function styleBody(html) {
  const doc = parse(`<div>${html}</div>`);
  for (const el of doc.querySelectorAll('h3')) el.setAttribute('class', 'mt-8 mb-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-white');
  for (const el of doc.querySelectorAll('ul')) el.setAttribute('class', 'mb-4 list-disc space-y-1.5 ps-5');
  for (const el of doc.querySelectorAll('ol')) el.setAttribute('class', 'mb-4 list-decimal space-y-1.5 ps-5');
  for (const el of doc.querySelectorAll('a')) {
    el.setAttribute('class', 'link');
    if (/^https?:/.test(el.getAttribute('href') || '')) el.setAttribute('rel', 'noopener nofollow');
  }
  return doc.querySelector('div').innerHTML;
}

const TOC_LINK = 'flex min-h-11 items-center gap-2 rounded-lg px-2 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white';
const H2 = 'mt-12 mb-3 text-xl font-semibold tracking-tight text-slate-900 dark:text-white';

function breadcrumb(t, lang, items) {
  const parts = items.map((it) => (it.href ? `<a href="${it.href}" class="hover:text-slate-900 dark:hover:text-white">${esc(it.name)}</a>` : `<span aria-current="page">${esc(it.name)}</span>`));
  return `<nav aria-label="${esc(t('about.breadcrumb.label'))}" class="text-sm muted">${parts.join(' <span aria-hidden="true">/</span> ')}</nav>`;
}

function indexMain(t, lang, guides) {
  const base = GUIDE_BASES[lang];
  const cards = [...guides.values()].map((g) => `
        <li class="card p-5">
          <p class="eyebrow mb-2">${esc(plural(t('guides.readTime'), g.readMinutes))}</p>
          <h2 class="text-lg font-semibold leading-snug text-slate-900 dark:text-white"><a href="${base}${g.slug}/" class="hover:underline">${esc(g.h1)}</a></h2>
          <p class="mt-2 text-sm muted">${esc(g.summary)}</p>
          <a href="${base}${g.slug}/" class="link mt-3 inline-block text-sm font-medium" aria-hidden="true" tabindex="-1">${esc(t('guides.readGuide'))}</a>
        </li>`).join('');
  return `${breadcrumb(t, lang, [{ name: t('about.breadcrumb.home'), href: HOME[lang] }, { name: t('guides.index.breadcrumb') }])}
    <div class="mt-4 max-w-2xl">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">${esc(t('guides.index.title'))}</h1>
      <p class="mt-3 text-lg leading-relaxed muted">${esc(t('guides.index.lead'))}</p>
    </div>
    <ul class="mt-8 grid gap-4 sm:grid-cols-2">${cards}
    </ul>`;
}

function articleMain(t, lang, g, guides) {
  const base = GUIDE_BASES[lang];
  const home = HOME[lang];
  const sections = g.sections.map((s, i) => `
        <section id="s${i + 1}" aria-labelledby="s${i + 1}-title">
          <h2 id="s${i + 1}-title" class="${H2}">${esc(s.h2)}</h2>
          ${styleBody(s.body_html)}
        </section>${i === 1 ? `\n        <div class="ad-slot my-8 min-h-[200px]" data-ad="inarticle" aria-label="${esc(t('page.adLabel'))}"></div>` : ''}`).join('');
  const toc = [...g.sections.map((s, i) => `<li><a href="#s${i + 1}" class="${TOC_LINK}">${esc(s.h2)}</a></li>`), `<li><a href="#faq" class="${TOC_LINK}">${esc(t('guides.faqTitle'))}</a></li>`].join('');
  const faq = g.faq.map((f) => `<details class="faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n            ');
  const related = g.related.filter((s) => guides.has(s)).map((s) => `<li><a href="${base}${s}/" class="link">${esc(guides.get(s).h1)}</a></li>`).join('');
  const sources = (g.sources || []).map((s) => `<li><a href="${esc(s.url)}" class="link" rel="noopener nofollow" target="_blank">${esc(s.title)}</a></li>`).join('');
  return `${breadcrumb(t, lang, [{ name: t('about.breadcrumb.home'), href: home }, { name: t('guides.index.breadcrumb'), href: base }, { name: g.h1 }])}
    <div class="mt-4 grid gap-10 lg:grid-cols-12">
      <aside class="hidden lg:col-span-3 lg:block">
        <nav class="lg:sticky lg:top-20" aria-labelledby="tocTitle">
          <p id="tocTitle" class="text-sm font-semibold text-slate-900 dark:text-white">${esc(t('guides.onThisPage'))}</p>
          <ol class="mt-3 space-y-0.5 text-sm">${toc}</ol>
          <a href="${home}#app" class="btn btn-secondary mt-4 w-full">${esc(t('guides.cta.button'))}</a>
        </nav>
      </aside>

      <article class="prose-guide min-w-0 max-w-3xl lg:col-span-9">
        <header class="mb-8">
          <p class="eyebrow mb-2">${esc(plural(t('guides.readTime'), g.readMinutes))}</p>
          <h1 class="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl dark:text-white">${esc(g.h1)}</h1>
        </header>
        <div class="text-lg">${styleBody(g.intro_html)}</div>
        ${sections}

        <aside class="mt-12 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6 dark:border-emerald-900 dark:bg-emerald-950/40" aria-labelledby="ctaTitle">
          <p id="ctaTitle" class="text-lg font-semibold text-slate-900 dark:text-white">${esc(t('guides.cta.title'))}</p>
          <p>${esc(t('guides.cta.text'))}</p>
          <a href="${home}#app" class="btn btn-primary px-5">${esc(t('guides.cta.button'))}</a>
        </aside>

        <section id="faq" aria-labelledby="faqTitle">
          <h2 id="faqTitle" class="${H2}">${esc(t('guides.faqTitle'))}</h2>
          <div class="space-y-3">
            ${faq}
          </div>
        </section>
${related ? `
        <section aria-labelledby="relatedTitle">
          <h2 id="relatedTitle" class="${H2}">${esc(t('guides.related'))}</h2>
          <ul class="mb-4 list-disc space-y-1.5 ps-5">${related}</ul>
        </section>` : ''}${sources ? `
        <section aria-labelledby="sourcesTitle">
          <h2 id="sourcesTitle" class="${H2}">${esc(t('guides.sources'))}</h2>
          <ul class="mb-4 list-disc space-y-1.5 ps-5 text-sm">${sources}</ul>
        </section>` : ''}

        <p class="mt-10 border-t border-slate-200 pt-6 text-sm muted dark:border-slate-800">${esc(t('guides.disclaimer'))}</p>
      </article>
    </div>`;
}

const ldBlock = (o) => `<script type="application/ld+json">\n  ${JSON.stringify(o, null, 2).replace(/</g, '\\u003c').replace(/\n/g, '\n  ')}\n  </script>`;

/** Head tags for a guide page or index: title, description, social, canonical/hreflang, JSON-LD. */
function setHead(doc, { title, description, lang, siteUrl, path: pagePath, alternates, ld, type = 'website' }) {
  const head = doc.querySelector('head');
  const set = (sel, value) => { const el = head.querySelector(sel); if (el) el.setAttribute('content', value); };
  head.querySelector('title').set_content(esc(title));
  set('meta[name="description"]', description);
  set('meta[property="og:title"]', title);
  set('meta[property="og:description"]', description);
  set('meta[property="og:type"]', type);
  for (const el of head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang], meta[property="og:url"], script[type="application/ld+json"]')) el.remove();
  const tags = [];
  if (siteUrl) {
    tags.push(`<link rel="canonical" href="${siteUrl}${pagePath}">`, `<meta property="og:url" content="${siteUrl}${pagePath}">`);
    for (const [l, href] of Object.entries(alternates)) tags.push(`<link rel="alternate" hreflang="${HREFLANG[l]}" href="${siteUrl}${href}">`);
    if (alternates.en) tags.push(`<link rel="alternate" hreflang="x-default" href="${siteUrl}${alternates.en}">`);
  }
  tags.push(...ld.map(ldBlock));
  head.insertAdjacentHTML('beforeend', `  ${tags.join('\n  ')}\n`);
  const html = doc.querySelector('html');
  html.setAttribute('lang', HREFLANG[lang]);
  if (RTL.has(lang)) html.setAttribute('dir', 'rtl'); else html.removeAttribute('dir');
  html.setAttribute('data-page-lang', lang);
  if (COUNTRY[lang]) html.setAttribute('data-page-country', COUNTRY[lang]);
  // The language picker goes to the same guide in another language when there is one
  html.setAttribute('data-alternates', JSON.stringify(alternates));
}

/** Writes every guide page into outDir. Returns the paths written. */
export function buildGuides({ root, outDir, siteUrl }) {
  const template = fs.readFileSync(path.join(outDir, 'guides', 'index.html'), 'utf8');
  const pages = renderGuides({ root, template, siteUrl });
  for (const [pagePath, html] of pages) {
    const dir = path.join(outDir, ...pagePath.split('/').filter(Boolean));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
  return [...pages.keys()];
}

/**
 * Every guide page as HTML, keyed by path ("/guides/", "/ur-pk/guides/x/"),
 * from the /guides/ page as template (built, or the dev server's version).
 */
export function renderGuides({ root, template, siteUrl }) {
  const en = readJson(path.join(root, 'src/i18n/locales/en.json'));
  const all = Object.fromEntries(Object.keys(GUIDE_BASES).map((l) => [l, loadGuides(root, l)]));
  const today = new Date().toISOString().slice(0, 10);
  const org = { '@type': 'Organization', name: 'Household Budget Optimizer' };
  const written = new Map();
  const write = (pagePath, doc) => written.set(pagePath, doc.toString());

  for (const [lang, base] of Object.entries(GUIDE_BASES)) {
    const guides = all[lang];
    if (!guides.size) continue;
    const t = makeT(lang === 'en' ? en : readJson(path.join(root, 'src/i18n/locales', `${lang}.json`)), en, base);
    const page = (main) => {
      const doc = parse(template, { comment: true });
      if (lang !== 'en') {
        applyMessages(doc, t);
        localizeLinks(doc, { home: HOME[lang], lang, guidesBase: base });
      }
      doc.querySelector('main').set_content(`\n    ${main}\n  `);
      return doc;
    };
    const crumbs = (items) => ({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(it.href && siteUrl ? { item: `${siteUrl}${it.href}` } : {}) }))
    });

    // Index
    const indexAlts = Object.fromEntries(Object.entries(GUIDE_BASES).filter(([l]) => all[l].size).map(([l, b]) => [l, b]));
    const index = page(indexMain(t, lang, guides));
    setHead(index, {
      title: t('guides.index.seoTitle'), description: t('guides.index.seoDescription'), lang, siteUrl, path: base, alternates: indexAlts,
      ld: [
        { '@context': 'https://schema.org', '@type': 'CollectionPage', name: t('guides.index.title'), description: t('guides.index.seoDescription'), inLanguage: HREFLANG[lang] },
        crumbs([{ name: t('about.breadcrumb.home'), href: HOME[lang] }, { name: t('guides.index.breadcrumb') }])
      ]
    });
    write(base, index);

    // Guides
    for (const g of guides.values()) {
      const pagePath = `${base}${g.slug}/`;
      const doc = page(articleMain(t, lang, g, guides));
      setHead(doc, {
        title: g.seo.title, description: g.seo.description, lang, siteUrl, path: pagePath, alternates: versions(all, g.slug), type: 'article',
        ld: [
          {
            '@context': 'https://schema.org', '@type': 'Article', headline: g.h1, description: g.seo.description, inLanguage: HREFLANG[lang],
            dateModified: today, author: org, publisher: org,
            ...(siteUrl ? { mainEntityOfPage: `${siteUrl}${pagePath}`, image: `${siteUrl}/og-image.png` } : {})
          },
          { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: HREFLANG[lang], mainEntity: g.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
          crumbs([{ name: t('about.breadcrumb.home'), href: HOME[lang] }, { name: t('guides.index.breadcrumb'), href: base }, { name: g.h1 }])
        ]
      });
      write(pagePath, doc);
    }
  }
  return written;
}

/** Sitemap entries for every guide page, each with its language alternates. */
export function guideSitemapPages(root) {
  const all = Object.fromEntries(Object.keys(GUIDE_BASES).map((l) => [l, loadGuides(root, l)]));
  const out = [];
  const indexAlts = Object.fromEntries(Object.entries(GUIDE_BASES).filter(([l]) => all[l].size));
  for (const [lang, base] of Object.entries(indexAlts)) {
    out.push({ path: base.slice(1, -1), priority: '0.7', changefreq: 'monthly', alternates: indexAlts });
    for (const slug of all[lang].keys()) out.push({ path: `${base}${slug}`.slice(1), priority: '0.7', changefreq: 'monthly', alternates: versions(all, slug) });
  }
  return out.map((p) => ({ ...p, hreflang: HREFLANG }));
}
