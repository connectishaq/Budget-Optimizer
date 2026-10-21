import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { prerenderLocales, alternateLinks, sitemapXml, fillFigures } from './scripts/prerender-locales.mjs';
import { LOCALE_PAGES } from './src/i18n/locale-pages.js';
import { buildGuides, renderGuides, guideSitemapPages } from './scripts/build-guides.mjs';
import { GUIDE_BASES } from './src/i18n/guide-langs.js';
import { ENABLED_LANGUAGES } from './src/i18n/enabled.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES = ['privacy-policy', 'terms-of-use', 'contact', 'about', 'guides'];

/**
 * Injects site-specific values (domain, AdSense, contact email) into index.html
 * and finalises robots.txt / sitemap.xml in /dist. All values come from .env so
 * nothing domain-specific is hard-coded in the source.
 */
function siteConfig(env) {
  const siteUrl = (env.SITE_URL || '').trim().replace(/\/+$/, '');
  const adsClient = (env.VITE_ADSENSE_CLIENT || '').trim();
  const contactEmail = (env.VITE_CONTACT_EMAIL || '').trim();
  let outDir = 'dist';
  let isBuild = false;

  return {
    name: 'site-config',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build' && !process.env.VITEST;
    },
    configureServer(server) {
      // The guides are made after the build (closeBundle), so the dev server
      // renders them on request from the same code: /guides/, /guides/<slug>/,
      // /ur-pk/guides/…
      const bases = Object.values(GUIDE_BASES).map((b) => b.slice(0, -1));
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split(/[?#]/)[0].replace(/index\.html$/, '');
        if (req.method !== 'GET' || !bases.some((b) => url === b || url.startsWith(`${b}/`))) return next();
        try {
          const raw = fs.readFileSync(path.resolve(__dirname, 'guides/index.html'), 'utf8');
          const template = await server.transformIndexHtml('/guides/index.html', raw, req.originalUrl);
          const pagePath = url.endsWith('/') ? url : `${url}/`;
          const html = renderGuides({ root: __dirname, template, siteUrl }).get(pagePath);
          if (!html) return next();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (err) {
          next(err);
        }
      });
    },
    transformIndexHtml(html, ctx) {
      // "/privacy-policy/index.html" -> "/privacy-policy/"; the home page is "/"
      const pagePath = (ctx?.path || '/').replace(/index\.html$/, '');
      const pageUrl = `${siteUrl}${pagePath}`;
      // Social networks need an absolute image URL, so the share image needs the domain too
      const urlTags = siteUrl
        ? [
          `<link rel="canonical" href="${pageUrl}">`,
          `<meta property="og:url" content="${pageUrl}">`,
          `<meta property="og:image" content="${siteUrl}/og-image.png">`,
          '<meta property="og:image:width" content="1200">',
          '<meta property="og:image:height" content="630">',
          '<meta property="og:image:alt" content="Household Budget Optimizer: an example month showing income, bills and money to save">',
          `<meta name="twitter:image" content="${siteUrl}/og-image.png">`,
          // The home page lists every language/country page (the locale pages get the same set)
          ...(pagePath === '/' ? [alternateLinks(siteUrl)] : [])
        ].join('\n  ')
        : '';
      const contact = contactEmail
        ? `<a href="mailto:${contactEmail}" class="font-semibold text-indigo-300 underline-offset-2 hover:underline">${contactEmail}</a>`
        : 'the contact details listed by the site owner';
      // Shared header and footer for the standalone pages (privacy, terms, contact)
      const partial = (name) => fs.readFileSync(path.resolve(__dirname, 'src/partials', `${name}.html`), 'utf8');
      return html
        .replace('<!--SITE_HEADER-->', () => partial('header'))
        .replace('<!--SITE_FOOTER-->', () => partial('footer'))
        .replace('<!--LOCALE_PICKER-->', () => partial('locale-picker'))
        .replace('<!--COUNTRY_SOURCES-->', () => countrySourcesHtml())
        .replace('<!--SITE_URL_TAGS-->', urlTags)
        .replace(/__SITE_URL__/g, siteUrl ? `${siteUrl}/` : '')
        .replace('__ADS_ON__', adsClient ? 'true' : 'false')
        .replace('__LIVE_LANGUAGES__', JSON.stringify(ENABLED_LANGUAGES))
        .replace(/<!--CONTACT_EMAIL-->/g, contact)
        .replace(/__CONTACT_EMAIL__/g, contactEmail)
        .replace(/__YEAR__/g, String(new Date().getFullYear()));
    },
    async closeBundle() {
      const robots = path.join(outDir, 'robots.txt');
      const sitemap = path.join(outDir, 'sitemap.xml');
      if (!isBuild || !fs.existsSync(robots)) return; // dev server / tests: nothing to finalise
      const today = new Date().toISOString().slice(0, 10);
      // Real example figures in the static HTML: the home page (US example, as
      // before) and each language/country page (its own country)
      const figures = await exampleFigures([['en', 'US'], ...LOCALE_PAGES.map((p) => [p.lang, p.country])]);
      const homeFile = path.join(outDir, 'index.html');
      const home = parse(fs.readFileSync(homeFile, 'utf8'), { comment: true });
      fillFigures(home, figures['en-US']);
      fs.writeFileSync(homeFile, home.toString());
      // One static page per language + country, same design (/en-gb/, /ar-ae/…)
      const locales = prerenderLocales({ root: __dirname, outDir, siteUrl, figures });
      console.log(`✓ ${locales.length} language/country pages: /${locales.join('/, /')}/`);
      // Money guides (/guides/…, /ur-pk/guides/…), built from src/i18n/guides
      const guides = buildGuides({ root: __dirname, outDir, siteUrl });
      console.log(`✓ ${guides.length} guide pages`);
      if (siteUrl) {
        fs.writeFileSync(robots, fs.readFileSync(robots, 'utf8').replace(/__SITE_URL__/g, siteUrl));
        fs.writeFileSync(sitemap, sitemapXml(siteUrl, today, [
          { path: 'contact', priority: '0.5' },
          { path: 'about', priority: '0.5' },
          { path: 'privacy-policy', priority: '0.3' },
          { path: 'terms-of-use', priority: '0.3' },
          ...guideSitemapPages(__dirname)
        ]));
      } else {
        // Without a domain a sitemap would be invalid, so drop it and the robots.txt reference.
        fs.writeFileSync(robots, fs.readFileSync(robots, 'utf8').replace(/^Sitemap:.*$/m, '').trimEnd() + '\n');
        fs.rmSync(sitemap, { force: true });
        console.warn('\n⚠  SITE_URL is not set in .env — canonical tags, hreflang links, og:url, the share image and sitemap.xml were skipped.\n');
      }
      if (!adsClient) console.warn('ℹ  VITE_ADSENSE_CLIENT is not set — ad slots are hidden in this build.');
      if (!contactEmail) console.warn('ℹ  VITE_CONTACT_EMAIL is not set — the Contact section shows a generic line.');
      if (!contactEmail && !(env.VITE_CONTACT_FORM_ENDPOINT || '').trim()) {
        console.warn([
          '',
          '⚠  WARNING: neither VITE_CONTACT_FORM_ENDPOINT nor VITE_CONTACT_EMAIL is set. The contact page can’t send',
          '   messages, so it shows “Messages can’t be sent from here yet” instead of the form. See README → Contact form.',
          ''
        ].join('\n'));
      }
    }
  };
}

/**
 * Example figures for the static HTML: runs the calculator on each country's
 * example budget through Vite's SSR loader (src/prerender-figures.js), so the
 * same code and data as the page are used. Returns { "<lang>-<CC>": figures }.
 */
async function exampleFigures(pairs) {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false, root: __dirname, plugins: [englishSplit()], logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom'
  });
  try {
    const mod = await server.ssrLoadModule('/src/prerender-figures.js');
    const out = {};
    for (const [lang, country] of pairs) {
      const key = `${lang}-${country}`;
      if (!out[key]) out[key] = await mod.exampleFigures(lang, country);
    }
    return out;
  } finally {
    await server.close();
  }
}

/**
 * About page, "Where the numbers come from": a table of every country file
 * (currency, last reviewed, number of sources) and the source lists, read from
 * src/data/countries so it never goes out of date. English names and dates;
 * src/about.js shows them in the visitor's language.
 */
function countrySourcesHtml() {
  const dir = path.resolve(__dirname, 'src/data/countries');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const files = fs.readdirSync(dir).filter((f) => /^([A-Z]{2}|GLOBAL)\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    // Only public web sources are listed and counted (not internal notes such as "v1 benchmark set")
    .map((c) => ({ ...c, sources: (c.sources || []).filter((src) => /^https?:\/\//.test(src.url || '')) }))
    .sort((a, b) => (a.code === 'GLOBAL') - (b.code === 'GLOBAL') || names.of(a.code === 'GLOBAL' ? 'US' : a.code).localeCompare(names.of(b.code === 'GLOBAL' ? 'US' : b.code)));
  const name = (c) => (c.code === 'GLOBAL'
    ? '<span data-i18n="about.table.otherCountries">Other countries</span>'
    : `<span data-country-name="${c.code}">${esc(names.of(c.code))}</span>`);
  const date = (d) => `<time datetime="${esc(d)}">${esc(new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }))}</time>`;
  const count = (n) => `<span data-i18n="about.table.sourceCount" data-i18n-vars='{"count":${n}}'>${n === 1 ? '1 source' : `${n} sources`}</span>`;
  const rows = files.map((c) => `<tr><td>${name(c)}</td><td>${esc(c.currency || '')}</td><td>${date(c.lastReviewed)}</td><td>${c.sources.length}</td></tr>`).join('\n              ');
  const lists = files.filter((c) => c.sources.length).map((c) => {
    const items = c.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener nofollow" target="_blank">${esc(s.title)}</a></li>`).join('');
    return `<details class="faq"><summary><span>${name(c)} · ${count(c.sources.length)}</span></summary><ul class="mt-0 pb-4 pe-4 ps-9 text-sm">${items}</ul></details>`;
  }).join('\n          ');
  return `<div class="table-wrap">
            <table>
              <thead><tr><th scope="col" class="text-start" data-i18n="about.table.country">Country</th><th scope="col" class="text-start" data-i18n="about.table.currency">Currency</th><th scope="col" class="text-start" data-i18n="about.table.reviewed">Last reviewed</th><th scope="col" class="text-start" data-i18n="about.table.sources">Sources</th></tr></thead>
              <tbody>
              ${rows}
              </tbody>
            </table>
          </div>
          <h3 class="mt-6 font-semibold text-slate-900 dark:text-white" data-i18n="about.table.listTitle">Sources by country</h3>
          <div class="mt-3 space-y-3">
          ${lists}
          </div>`;
}

/**
 * English is bundled with the app, but on English pages the article, privacy
 * policy, terms and search text are already in the HTML. So en.json is served
 * as two modules: "virtual:en-core" (everything the scripts use) and
 * "virtual:en-static" (that page text), loaded only with another language, as
 * its fallback. en.json itself stays one file for translators and the checks.
 */
const EN_STATIC = ['page', 'privacy', 'terms', 'seo'];
const EN_STATIC_KEEP = { page: ['inputs'] }; // used by scripts too
function englishSplit() {
  const file = path.resolve(__dirname, 'src/i18n/locales/en.json');
  const ids = { 'virtual:en-core': '\0en-core', 'virtual:en-static': '\0en-static' };
  return {
    name: 'english-split',
    resolveId: (id) => ids[id],
    load(id) {
      if (id !== ids['virtual:en-core'] && id !== ids['virtual:en-static']) return null;
      this.addWatchFile(file);
      const en = JSON.parse(fs.readFileSync(file, 'utf8'));
      const core = {};
      const rest = {};
      for (const [ns, v] of Object.entries(en)) {
        if (!EN_STATIC.includes(ns)) { core[ns] = v; continue; }
        const keep = EN_STATIC_KEEP[ns] || [];
        rest[ns] = Object.fromEntries(Object.entries(v).filter(([k]) => !keep.includes(k)));
        if (keep.length) core[ns] = Object.fromEntries(Object.entries(v).filter(([k]) => keep.includes(k)));
      }
      return `export default ${JSON.stringify(id === ids['virtual:en-core'] ? core : rest)};`;
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [tailwindcss(), englishSplit(), siteConfig(env)],
    test: { include: ["src/**/*.test.js"] },
    build: {
      target: 'es2020',
      rollupOptions: {
        input: Object.fromEntries([
          ['main', path.resolve(__dirname, 'index.html')],
          // Served by static hosts for any missing address (Netlify, Cloudflare Pages, GitHub Pages…)
          ['404', path.resolve(__dirname, '404.html')],
          ...PAGES.map((p) => [p, path.resolve(__dirname, p, 'index.html')])
        ])
      },
      cssMinify: true,
      reportCompressedSize: true
    }
  };
});
