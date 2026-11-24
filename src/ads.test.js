import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { setConsentDefaults, CONSENT_REGIONS } from './ads.js';
import { urlLanguage, cleanLangUrl } from './i18n/picker.js';

describe('ad consent', () => {
  it('denies personalised ads by default in the EEA, UK and Switzerland, before any Google tag', () => {
    const w = {};
    setConsentDefaults(w);
    const calls = w.dataLayer.map((args) => [...args]);
    const [regional, rest] = calls.filter((c) => c[0] === 'consent' && c[1] === 'default').map((c) => c[2]);
    expect(regional).toMatchObject({ ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    for (const c of ['DE', 'FR', 'IE', 'NO', 'GB', 'CH']) expect(regional.region).toContain(c);
    expect(regional.region).not.toContain('US');
    expect(rest.region).toBeUndefined();
    expect(rest.ad_personalization).toBe('granted');
    expect(calls).toContainEqual(['set', 'ads_data_redaction', true]);
  });

  it('lists 30 EEA countries plus the UK and Switzerland', () => {
    expect(new Set(CONSENT_REGIONS).size).toBe(32);
  });
});

describe('#lang= from language/country pages', () => {
  it('opens the legal pages in that language for the visit', () => {
    expect(urlLanguage('', '#lang=hi')).toBe('hi');
    expect(urlLanguage('?topic=bug', '#lang=ur')).toBe('ur');
    expect(urlLanguage('', '#lang=de')).toBeNull(); // switched off
    expect(urlLanguage('', '#app')).toBeNull();
    expect(urlLanguage('', '')).toBeNull();
  });

  it('still reads old ?lang= links, the fragment winning', () => {
    expect(urlLanguage('?lang=hi', '')).toBe('hi');
    expect(urlLanguage('?topic=bug&lang=ur', '')).toBe('ur');
    expect(urlLanguage('?lang=xx', '')).toBeNull();
    expect(urlLanguage('?lang=es', '#lang=ur')).toBe('ur');
  });

  it('turns an old ?lang= address into the clean one', () => {
    expect(cleanLangUrl('https://x.test/contact/?lang=ur')).toBe('https://x.test/contact/#lang=ur');
    expect(cleanLangUrl('https://x.test/contact/?topic=bug&lang=es')).toBe('https://x.test/contact/?topic=bug#lang=es');
    expect(cleanLangUrl('https://x.test/about/?lang=xx')).toBe('https://x.test/about/');
    expect(cleanLangUrl('https://x.test/about/#lang=ur')).toBeNull();
  });
});

describe('empty ad areas before ads are live', () => {
  // Read the page and stylesheet as files (vitest runs in node, no DOM)
  const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  const html = read('../index.html');
  const css = read('./styles.css');

  it('marks every "Advertisement" area so it can be hidden', () => {
    const asides = html.match(/<aside\b[^>]*aria-label="Advertisement"[^>]*>/g) || [];
    expect(asides.length).toBeGreaterThan(0);
    for (const tag of asides) expect(tag).toContain('data-ad-area');
  });

  it('hides them (display: none, so screen readers skip them) unless ads are on', () => {
    expect(css).toMatch(/html:not\(\.ads-on\):not\(\.ads-preview\) \[data-ad-area\][^{]*\{\s*display:\s*none !important;/);
  });
});
