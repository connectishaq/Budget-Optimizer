import { describe, it, expect } from 'vitest';
import { setConsentDefaults, CONSENT_REGIONS } from './ads.js';
import { urlLanguage } from './i18n/picker.js';

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

describe('?lang= from language/country pages', () => {
  it('opens the legal pages in that language for the visit', () => {
    expect(urlLanguage('?lang=de')).toBe('de');
    expect(urlLanguage('?topic=bug&lang=ur')).toBe('ur');
    expect(urlLanguage('?lang=xx')).toBeNull();
    expect(urlLanguage('')).toBeNull();
  });
});
