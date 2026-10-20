import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLanguage, detectLanguage, dirOf, getLanguage } from './index.js';

describe('i18n helper', () => {
  beforeEach(async () => { await setLanguage('en'); });

  it('returns the key when a message is missing everywhere', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('picks the first live browser language', () => {
    expect(detectLanguage(['es-MX', 'en'])).toBe('es');
    // German has a translation but is switched off (src/i18n/enabled.js)
    expect(detectLanguage(['de-AT', 'en'])).toBe('en');
    expect(detectLanguage(['ja-JP', 'ur-PK'])).toBe('ur');
    expect(detectLanguage(['ja-JP'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });

  it('knows which languages read right to left', () => {
    expect(dirOf('ar')).toBe('rtl');
    expect(dirOf('ur')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
    expect(dirOf('hi')).toBe('ltr');
  });

  it('falls back to English for an unknown language', async () => {
    await setLanguage('xx');
    expect(getLanguage()).toBe('en');
  });
});
