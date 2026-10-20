import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LOCALE_PAGES, ALL_LOCALE_PAGES, bcp47, pageFor, hrefFor } from './locale-pages.js';
import { ENABLED_LANGUAGES } from './enabled.js';
import { suggestion, browserLanguage } from './suggest.js';
import { LANGUAGES } from './index.js';
import { COUNTRY_CODES } from './countries.js';
import { alternateLinks, sitemapXml } from '../../scripts/prerender-locales.mjs';

describe('language/country pages', () => {
  it('cover the 17 pages in the brief, each a known language and country with an article', () => {
    expect(ALL_LOCALE_PAGES.map((p) => p.path)).toEqual([
      'en-us', 'en-gb', 'en-in', 'en-pk', 'en-ae', 'en-ca', 'en-au', 'es-es', 'es-mx',
      'hi-in', 'ur-pk', 'ar-ae', 'ar-sa', 'fr-fr', 'pt-br', 'id-id', 'de-de'
    ]);
    for (const p of ALL_LOCALE_PAGES) {
      expect(LANGUAGES[p.lang], p.path).toBeTruthy();
      expect(COUNTRY_CODES, p.path).toContain(p.country);
      expect(p.path).toBe(`${p.lang}-${p.country.toLowerCase()}`);
      if (p.path !== 'en-us') expect(fs.existsSync(path.resolve(__dirname, 'articles', `${p.path}.json`)), p.path).toBe(true);
    }
    expect(bcp47('ar-ae')).toBe('ar-AE');
  });

  it('find the right page for a language and country', () => {
    expect(pageFor('es', 'MX').path).toBe('es-mx');
    expect(pageFor('es', 'US').path).toBe('es-es');
    expect(pageFor('ja', 'JP')).toBeNull();
    expect(hrefFor('ar', 'SA')).toBe('/ar-sa/');
    expect(hrefFor('en', 'DE')).toBe('/'); // no English page for Germany: the English home page
    expect(hrefFor('es', 'FR')).toBe('/es-es/');
    expect(hrefFor('de', 'DE')).toBe('/'); // German is switched off: no page
  });

  it('list every page plus x-default in hreflang and the sitemap', () => {
    const links = alternateLinks('https://x.test');
    expect(links.match(/hreflang=/g)).toHaveLength(LOCALE_PAGES.length + 1);
    expect(links).toContain('hreflang="x-default" href="https://x.test/"');
    expect(alternateLinks('')).toBe('');
    const xml = sitemapXml('https://x.test', '2026-10-20', [{ path: 'contact', priority: '0.5' }]);
    expect(xml.match(/<url>/g)).toHaveLength(LOCALE_PAGES.length + 2);
    expect(xml).toContain('<loc>https://x.test/hi-in/</loc>');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });
});

describe('language switch (src/i18n/enabled.js)', () => {
  it('builds pages only for live languages', () => {
    expect(ENABLED_LANGUAGES).toEqual(['en', 'ur', 'hi', 'ar', 'es']);
    expect(LOCALE_PAGES.map((p) => p.path)).toEqual([
      'en-us', 'en-gb', 'en-in', 'en-pk', 'en-ae', 'en-ca', 'en-au', 'es-es', 'es-mx', 'hi-in', 'ur-pk', 'ar-ae', 'ar-sa'
    ]);
    expect(alternateLinks('https://x.test')).not.toMatch(/hreflang="(fr|pt|de|id)-/);
    expect(sitemapXml('https://x.test', '2026-10-20')).not.toContain('/de-de/');
  });

  it('never suggests a switched-off language', () => {
    expect(suggestion('ur', 'PK', 'fr')).toBeNull();
  });
});

describe('language suggestion banner', () => {
  it('suggests the browser language only when it differs and we have it', () => {
    expect(suggestion('de', 'DE', 'de')).toBeNull();
    expect(suggestion('de', 'DE', null)).toBeNull();
    expect(suggestion('de', 'DE', 'en', true)).toBeNull(); // closed before
    const s = suggestion('en', 'AE', 'ar');
    expect(s).toMatchObject({ lang: 'ar', href: '/ar-ae/' });
    expect(s.text).toMatch(/بالعربية/);
    expect(suggestion('de', 'DE', 'en').href).toBe('/');
  });

  it("reads only languages the browser really lists (never guesses English)", () => {
    expect(browserLanguage(['ja-JP', 'ko'])).toBeNull();
    expect(browserLanguage(['ja-JP', 'ar-SA', 'en'])).toBe('ar');
    expect(browserLanguage(['pt-BR', 'en'])).toBe('en'); // Portuguese is switched off
  });
});
