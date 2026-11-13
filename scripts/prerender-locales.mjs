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
import { GUIDE_BASES } from '../src/i18n/guide-langs.js';
import { publisher, siteGraph, articleLd, ldScript, plainText, updatedTime, ogLocale, HOME_ARTICLE } from './structured-data.mjs';

const RTL = new Set(['ar', 'ur']);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
/** Fills {placeholders} from a data-i18n-vars JSON attribute. */
const fill = (msg, vars) => (vars ? msg.replace(/\{(\w+)\}/g, (m, n) => JSON.parse(vars)[n] ?? m) : msg);

const isPlural = (v) => v && typeof v === 'object' && typeof v.other === 'string';
function lookup(obj, key) {
  let cur = obj;
  for (const part of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return isPlural(cur) ? cur.other : cur;
}

/** t(key) for one language, with English filling any gap. Throws on unknown keys. */
export function makeT(messages, en, where) {
  return (key) => {
    const v = lookup(messages, key) ?? lookup(en, key);
    if (v == null) throw new Error(`${where}: no message for ${key}`);
    return v;
  };
}

/** Translates static markup the way the browser does (data-i18n, -html, -attr, data-country-name). */
export function applyMessages(doc, t, lang) {
  for (const el of doc.querySelectorAll('[data-i18n]')) el.set_content(esc(fill(t(el.getAttribute('data-i18n')), el.getAttribute('data-i18n-vars'))));
  for (const el of doc.querySelectorAll('[data-i18n-html]')) el.set_content(t(el.getAttribute('data-i18n-html')));
  for (const el of doc.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
      const [a, key] = pair.split(':').map((x) => x.trim());
      if (a && key) el.setAttribute(a, t(key));
    }
  }
  const names = new Intl.DisplayNames([lang, 'en'], { type: 'region' });
  for (const el of doc.querySelectorAll('[data-country-name]')) el.set_content(esc(names.of(el.getAttribute('data-country-name'))));
}

/**
 * Keeps links on a language page: home ("/") and its sections ("/#app") go to
 * that page, guides go to the guides in that language when there are any, and
 * the privacy, terms, about, methodology and contact pages open in that language
 * (#lang=xx). The language goes in the fragment, never the query string: search
 * engines ignore fragments, so these links can't create ?lang= duplicates of
 * /contact/, /about/… (scripts/lang-url-check.mjs checks the built site).
 */
export function localizeLinks(doc, { home, lang, guidesBase }) {
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (href === '/') a.setAttribute('href', home);
    else if (href.startsWith('/#')) a.setAttribute('href', `${home}${href.slice(1)}`);
    else if (guidesBase && href.startsWith('/guides/')) a.setAttribute('href', `${guidesBase}${href.slice('/guides/'.length)}`);
    else if (/^\/(privacy-policy|terms-of-use|contact|about|methodology)\//.test(href)) {
      a.setAttribute('href', `${href.split('#')[0]}#lang=${lang}`);
    }
  }
}

/**
 * hreflang links for every page: the home page as generic English ("en", so it
 * lists itself), every language/country page, and x-default (the home page).
 * The same set goes on all of them and in the sitemap.
 */
export function alternateLinks(siteUrl) {
  if (!siteUrl) return '';
  return [
    `<link rel="alternate" hreflang="en" href="${siteUrl}/">`,
    ...LOCALE_PAGES.map((p) => `<link rel="alternate" hreflang="${bcp47(p.path)}" href="${siteUrl}/${p.path}/">`),
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}/">`
  ].join('\n  ');
}

/** The sitemap: the home page and every locale page, each listing all alternates. */
export function sitemapXml(siteUrl, today, extraPages = []) {
  const alts = [
    `    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/"/>`,
    ...LOCALE_PAGES.map((p) => `    <xhtml:link rel="alternate" hreflang="${bcp47(p.path)}" href="${siteUrl}/${p.path}/"/>`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/"/>`
  ].join('\n');
  const url = (loc, priority, changefreq, withAlts) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${withAlts ? `\n${withAlts === true ? alts : withAlts}` : ''}
  </url>`;
  // Extra pages can list their own hreflang links: { hreflangs: { en: '/guides/x/', 'x-default': '/guides/x/' } }
  const ownAlts = (x) => (x.hreflangs
    ? Object.entries(x.hreflangs).map(([code, href]) => `    <xhtml:link rel="alternate" hreflang="${code}" href="${siteUrl}${href}"/>`).join('\n')
    : false);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[
    url(`${siteUrl}/`, '1.0', 'monthly', true),
    ...LOCALE_PAGES.map((p) => url(`${siteUrl}/${p.path}/`, '0.9', 'monthly', true)),
    ...extraPages.map((x) => url(`${siteUrl}/${x.path}/`, x.priority, x.changefreq || 'yearly', ownAlts(x)))
  ].join('\n')}
</urlset>
`;
}

function jsonLd(t, page, currency, pageUrl, siteUrl, article) {
  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('seo.app.name'),
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    publisher: publisher(siteUrl),
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
  // The article below the calculator, by the About page's Person (as on the guides)
  const post = articleLd({ siteUrl, path: `/${page.path}/`, lang: bcp47(page.path), mainEntity: false, ...article });
  return [app, faq, siteGraph(siteUrl, bcp47(page.path)), post].map(ldScript).join('\n  ');
}

// The "Example" badge on pre-rendered results (same look as the hero card's);
// src/ui/dashboard.js removes every [data-example-badge] once real figures render
const BADGE = 'rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400';
const BADGE_ON_DARK = 'rounded bg-white/15 px-1.5 py-0.5 text-xs text-emerald-50';
const badge = (text, cls, extra = '') => `<span data-example-badge class="${cls}${extra ? ` ${extra}` : ''}" data-i18n="page.hero.receipt.badge">${esc(text)}</span>`;

/**
 * Puts example figures (src/prerender-figures.js) into the hero card, the
 * results (summary, "Your month, added up", Budget health, savings growth) and
 * the phone's sticky bar, with an "Example" badge on each results panel.
 * Scripts replace them later.
 */
export function fillFigures(doc, f) {
  const all = (sel) => doc.querySelectorAll(sel);
  const one = (sel) => doc.querySelector(sel);
  const put = (sel, text) => { for (const el of all(sel)) el.set_content(esc(text)); };
  const html = (sel, markup) => one(sel)?.set_content(markup);
  // An amount, with the exact figure on hover when it's shortened (as setMoney does)
  const money = (sel, [text, exact]) => {
    const el = one(sel);
    if (!el) return;
    el.set_content(esc(text));
    if (exact && exact !== text) el.setAttribute('title', exact);
    else el.removeAttribute('title');
  };
  put('[data-example="income"]', f.income);
  put('[data-example="bills"]', `−${f.bills}`);
  put('[data-example="left"]', f.left);
  put('[data-example="plan"]', f.plan);
  put('[data-example="toSave"]', f.toSave);
  put('#sumMonthly', f.monthly);
  put('#sumAnnual', f.annual);
  put('#sumCurrent', f.current);
  put('#sumOptimized', f.optimized);
  put('#mbAmount', f.monthly);
  if (f.summary) put('#plainSummary', f.summary);

  // "Your month, added up"
  const rc = f.receipt;
  if (rc) {
    put('#rcIncomeLabel', rc.incomeLabel);
    money('#rcIncome', rc.income);
    // Shown only with bonuses (set both ways: language pages start from the built home page)
    if (rc.extras) { one('#rcExtrasRow')?.removeAttribute('hidden'); money('#rcExtras', rc.extras); } else one('#rcExtrasRow')?.setAttribute('hidden', '');
    money('#rcBills', rc.bills);
    put('#rcLeftLabel', rc.leftLabel);
    money('#rcLeft', rc.left);
    one('#rcLeft')?.setAttribute('class', rc.leftClass.trim());
    money('#rcPlan', rc.plan);
    money('#rcTotal', rc.total);
    put('#rcNote', rc.note);
  }

  // Budget health
  const h = f.health;
  if (h) {
    put('#healthScore', h.score);
    put('#healthLabel', h.label);
    one('#healthLabel')?.setAttribute('class', h.labelClass);
    html('#healthTip', h.tipHtml);
    one('#healthTip')?.setAttribute('class', h.tipClass);
    html('#healthParts', h.partsHtml);
  }

  // How your savings could grow
  const g = f.growth;
  if (g) {
    put('#fvAltLabel', g.altLabel);
    if (g.single) one('#fvCurItem')?.setAttribute('hidden', ''); else one('#fvCurItem')?.removeAttribute('hidden');
    html('#fvAlt', g.altHtml);
    html('#fvCur', g.curHtml);
    html('#fvLabel', g.sideHtml);
    put('#fvYears', g.yearsAfter);
    html('#fvDiff', g.diffHtml);
    put('#projectionSummary', g.summary);
  }

  // "Example" on each panel, next to the figures (removed in the browser by
  // renderDashboard), in the words of the hero card's own badge, already in the
  // page's language. Language pages start from the built home page, so its
  // badges go first.
  for (const el of all('[data-example-badge]')) el.remove();
  const label = one('[data-i18n="page.hero.receipt.badge"]')?.text.trim();
  if (label) {
    one('#sumLabel')?.parentNode.insertAdjacentHTML('beforeend', badge(label, BADGE_ON_DARK, 'ms-auto'));
    one('#rcTitle')?.insertAdjacentHTML('afterend', badge(label, BADGE, 'ms-auto me-2'));
    if (h) one('#healthLabel')?.insertAdjacentHTML('afterend', badge(label, BADGE, 'ms-auto self-center'));
    if (g) one('#fvCurItem')?.insertAdjacentHTML('afterend', `<li data-example-badge class="flex items-center">${badge(label, BADGE).replace(' data-example-badge', '')}</li>`);
  }
}

/**
 * Writes <outDir>/<page>/index.html for every locale page. `figures` maps
 * "<lang>-<country>" to example figures. Returns the list of pages written.
 */
export function prerenderLocales({ root, outDir, siteUrl, figures = {} }) {
  const home = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const en = readJson(path.join(root, 'src/i18n/locales/en.json'));
  const written = [];

  for (const page of LOCALE_PAGES) {
    const messages = page.lang === 'en' ? en : readJson(path.join(root, 'src/i18n/locales', `${page.lang}.json`));
    const articleFile = path.join(root, 'src/i18n/articles', `${page.path}.json`);
    const article = fs.existsSync(articleFile) ? readJson(articleFile) : null;
    if (!article && page.path !== 'en-us') throw new Error(`Missing article for /${page.path}/ (${articleFile})`);
    const t = makeT(messages, en, `/${page.path}/`);
    const country = readJson(path.join(root, 'src/data/countries', `${page.country}.json`));
    const pageUrl = siteUrl ? `${siteUrl}/${page.path}/` : '';
    const doc = parse(home, { comment: true });

    // ---- Words: the same keys the browser would translate
    applyMessages(doc, t, page.lang);

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

    // ---- The article's "Last updated" (as on the guides) and its Article JSON-LD:
    // the country's version, or the home page article where a page has none
    const articleInfo = {
      headline: article?.guide?.title || t('page.guide.title'),
      description: plainText(article?.guide?.intro1_html || t('page.guide.intro1_html')),
      datePublished: article?.datePublished || HOME_ARTICLE.datePublished,
      dateModified: article?.dateModified || HOME_ARTICLE.dateModified
    };
    const [before, after = ''] = t('guides.updated').split('{date}');
    const dateLocale = page.lang === 'en' ? 'en-GB' : `${page.lang}-${page.country}-u-nu-latn`;
    doc.querySelector('#guideUpdated')?.set_content(`${esc(before)}${updatedTime(articleInfo.dateModified, dateLocale)}${esc(after)}`);

    // ---- The page's own H1 ("Household Budget Calculator for Pakistan"), kept
    // when the browser translates the page
    if (article?.h1_html) {
      const h1 = doc.querySelector('h1');
      h1.set_content(article.h1_html);
      h1.removeAttribute('data-i18n-html');
    }

    // ---- The country's example budget, so the figures aren't 0 before scripts run
    if (figures?.[`${page.lang}-${page.country}`]) fillFigures(doc, figures[`${page.lang}-${page.country}`]);

    // ---- Links stay on this page and in its language (see localizeLinks)
    localizeLinks(doc, { home: `/${page.path}/`, lang: page.lang, guidesBase: page.lang === 'en' ? null : GUIDE_BASES[page.lang] });

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
    set('meta[property="og:locale"]', ogLocale(bcp47(page.path)));
    set('meta[name="twitter:title"]', article?.seo?.title || t('seo.twitterTitle'));
    set('meta[name="twitter:description"]', article?.seo?.description || t('seo.twitterDescription'));
    set('meta[property="og:image:alt"]', t('seo.ogImageAlt'));
    for (const el of head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang], meta[property="og:url"], script[type="application/ld+json"]')) el.remove();
    const tags = [];
    if (pageUrl) tags.push(`<link rel="canonical" href="${pageUrl}">`, `<meta property="og:url" content="${pageUrl}">`, alternateLinks(siteUrl));
    tags.push(jsonLd(t, page, country.currency, pageUrl, siteUrl, articleInfo));
    head.insertAdjacentHTML('beforeend', `  ${tags.join('\n  ')}\n`);

    const dir = path.join(outDir, page.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), doc.toString());
    written.push(page.path);
  }
  return written;
}
