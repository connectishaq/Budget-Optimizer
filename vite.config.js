import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prerenderLocales, alternateLinks, sitemapXml } from './scripts/prerender-locales.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES = ['privacy-policy', 'terms-of-use', 'contact'];

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
        .replace('<!--SITE_URL_TAGS-->', urlTags)
        .replace(/__SITE_URL__/g, siteUrl ? `${siteUrl}/` : '')
        .replace('__ADS_ON__', adsClient ? 'true' : 'false')
        .replace(/<!--CONTACT_EMAIL-->/g, contact)
        .replace(/__CONTACT_EMAIL__/g, contactEmail)
        .replace(/__YEAR__/g, String(new Date().getFullYear()));
    },
    closeBundle() {
      const robots = path.join(outDir, 'robots.txt');
      const sitemap = path.join(outDir, 'sitemap.xml');
      if (!isBuild || !fs.existsSync(robots)) return; // dev server / tests: nothing to finalise
      const today = new Date().toISOString().slice(0, 10);
      // One static page per language + country, same design (/en-gb/, /ar-ae/…)
      const locales = prerenderLocales({ root: __dirname, outDir, siteUrl });
      console.log(`✓ ${locales.length} language/country pages: /${locales.join('/, /')}/`);
      if (siteUrl) {
        fs.writeFileSync(robots, fs.readFileSync(robots, 'utf8').replace(/__SITE_URL__/g, siteUrl));
        fs.writeFileSync(sitemap, sitemapXml(siteUrl, today, [
          { path: 'contact', priority: '0.5' },
          { path: 'privacy-policy', priority: '0.3' },
          { path: 'terms-of-use', priority: '0.3' }
        ]));
      } else {
        // Without a domain a sitemap would be invalid, so drop it and the robots.txt reference.
        fs.writeFileSync(robots, fs.readFileSync(robots, 'utf8').replace(/^Sitemap:.*$/m, '').trimEnd() + '\n');
        fs.rmSync(sitemap, { force: true });
        console.warn('\n⚠  SITE_URL is not set in .env — canonical tags, hreflang links, og:url, the share image and sitemap.xml were skipped.\n');
      }
      if (!adsClient) console.warn('ℹ  VITE_ADSENSE_CLIENT is not set — ad slots are hidden in this build.');
      if (!contactEmail) console.warn('ℹ  VITE_CONTACT_EMAIL is not set — the Contact section shows a generic line.');
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [tailwindcss(), siteConfig(env)],
    test: { include: ["src/**/*.test.js"] },
    build: {
      target: 'es2020',
      rollupOptions: {
        input: Object.fromEntries([
          ['main', path.resolve(__dirname, 'index.html')],
          ...PAGES.map((p) => [p, path.resolve(__dirname, p, 'index.html')])
        ])
      },
      cssMinify: true,
      reportCompressedSize: true
    }
  };
});
