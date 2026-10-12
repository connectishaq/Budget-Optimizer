import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

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
    transformIndexHtml(html) {
      const urlTags = siteUrl
        ? `<link rel="canonical" href="${siteUrl}/">\n    <meta property="og:url" content="${siteUrl}/">`
        : '';
      const contact = contactEmail
        ? `<a href="mailto:${contactEmail}" class="font-semibold text-indigo-300 underline-offset-2 hover:underline">${contactEmail}</a>`
        : 'the contact details listed by the site owner';
      return html
        .replace('<!--SITE_URL_TAGS-->', urlTags)
        .replace(/__SITE_URL__/g, siteUrl ? `${siteUrl}/` : '')
        .replace('__ADS_ON__', adsClient ? 'true' : 'false')
        .replace('<!--CONTACT_EMAIL-->', contact);
    },
    closeBundle() {
      const robots = path.join(outDir, 'robots.txt');
      const sitemap = path.join(outDir, 'sitemap.xml');
      if (!isBuild || !fs.existsSync(robots)) return; // dev server / tests: nothing to finalise
      const today = new Date().toISOString().slice(0, 10);
      if (siteUrl) {
        fs.writeFileSync(robots, fs.readFileSync(robots, 'utf8').replace(/__SITE_URL__/g, siteUrl));
        fs.writeFileSync(
          sitemap,
          fs.readFileSync(sitemap, 'utf8').replace(/__SITE_URL__/g, siteUrl).replace(/__LASTMOD__/g, today)
        );
      } else {
        // Without a domain a sitemap would be invalid, so drop it and the robots.txt reference.
        fs.writeFileSync(robots, fs.readFileSync(robots, 'utf8').replace(/^Sitemap:.*$/m, '').trimEnd() + '\n');
        fs.rmSync(sitemap, { force: true });
        console.warn('\n⚠  SITE_URL is not set in .env — canonical tag, og:url and sitemap.xml were skipped.\n');
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
    test: { include: ['src/**/*.test.js'] },
    build: {
      target: 'es2020',
      cssMinify: true,
      reportCompressedSize: true
    }
  };
});
