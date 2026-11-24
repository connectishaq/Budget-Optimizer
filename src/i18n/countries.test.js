import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countryFromTimeZone, guessCountry, startCountry, COUNTRY_CODES, GLOBAL } from './countries.js';
import { noticeVisible } from '../ui/country-notice.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('time zone -> country', () => {
  it('maps the zones of the countries we cover', () => {
    const cases = {
      'Asia/Karachi': 'PK', 'Europe/London': 'GB', 'America/New_York': 'US', 'America/Chicago': 'US',
      'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US',
      'Pacific/Honolulu': 'US', 'America/Indiana/Indianapolis': 'US', 'America/Kentucky/Louisville': 'US',
      'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Dubai': 'AE', 'Australia/Sydney': 'AU', 'Australia/Perth': 'AU',
      'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Halifax': 'CA', 'America/St_Johns': 'CA',
      'Asia/Riyadh': 'SA', 'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES', 'America/Mexico_City': 'MX',
      'America/Tijuana': 'MX', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'America/Sao_Paulo': 'BR',
      'Asia/Jakarta': 'ID', 'Africa/Lagos': 'NG'
    };
    for (const [tz, code] of Object.entries(cases)) expect(countryFromTimeZone(tz), tz).toBe(code);
  });

  it('only ever returns a country we have data for', () => {
    for (const tz of ['Europe/Rome', 'Asia/Tokyo', 'America/Bogota', 'Africa/Nairobi', 'UTC', 'Etc/GMT+5', '', null, undefined, 42]) {
      expect(countryFromTimeZone(tz), String(tz)).toBeNull();
    }
    for (const tz of ['America/Boise', 'America/Edmonton', 'Asia/Makassar', 'Australia/Darwin']) {
      expect(COUNTRY_CODES).toContain(countryFromTimeZone(tz));
    }
  });
});

describe('guessCountry', () => {
  it('uses the time zone first', () => {
    expect(guessCountry({ timeZone: 'Asia/Dubai', languages: ['en-GB'] })).toBe('AE');
  });
  it('falls back to the browser language region as the tiebreaker', () => {
    expect(guessCountry({ timeZone: 'UTC', languages: ['ur-PK', 'en'] })).toBe('PK');
    expect(guessCountry({ timeZone: 'Europe/Rome', languages: ['it-IT', 'en-US'] })).toBe('US');
  });
  it('gives up (keeps the default) when neither points to a country we cover', () => {
    expect(guessCountry({ timeZone: 'Asia/Tokyo', languages: ['ja-JP', 'en'] })).toBeNull();
  });
});

describe('startCountry: the visitor’s own choice always wins', () => {
  const home = { home: true, restored: false, timeZone: 'Asia/Karachi', languages: ['en-US'] };

  it('guesses on a first visit to the home page', () => {
    expect(startCountry({ ...home, stored: null, page: null })).toEqual({ country: 'PK', guessed: true });
  });
  it('keeps a country the visitor chose (dropdown, saved budget, share link)', () => {
    expect(startCountry({ ...home, stored: 'GB', page: null })).toEqual({ country: 'GB', guessed: false });
    for (const code of COUNTRY_CODES) {
      expect(startCountry({ ...home, stored: code, page: null }), code).toEqual({ country: code, guessed: false });
    }
  });
  it('treats a saved GLOBAL with no saved budget as not chosen, so the guess runs', () => {
    expect(startCountry({ ...home, stored: GLOBAL, page: null })).toEqual({ country: 'PK', guessed: true });
    // …and still falls back to GLOBAL when the guess finds nothing
    expect(startCountry({ ...home, stored: GLOBAL, page: null, timeZone: 'Asia/Tokyo', languages: ['ja'] })).toEqual({ country: GLOBAL, guessed: false });
  });
  it('keeps a saved GLOBAL when there is a saved budget', () => {
    expect(startCountry({ ...home, restored: true, stored: GLOBAL, page: null })).toEqual({ country: GLOBAL, guessed: false });
  });
  it('keeps the page country over a saved GLOBAL on a language/country page', () => {
    expect(startCountry({ ...home, home: false, stored: GLOBAL, page: 'GB' })).toEqual({ country: 'GB', guessed: false });
  });
  it('keeps the country of a language/country page (/en-gb/)', () => {
    expect(startCountry({ ...home, home: false, stored: null, page: 'GB' })).toEqual({ country: 'GB', guessed: false });
  });
  it('never guesses from the time zone for a saved budget: it starts exactly as before', () => {
    expect(startCountry({ ...home, restored: true, stored: null, page: null })).toEqual({ country: 'US', guessed: false });
    expect(startCountry({ ...home, restored: true, stored: null, page: null, languages: ['en'] })).toEqual({ country: GLOBAL, guessed: false });
  });
  it('never guesses away from the home page', () => {
    expect(startCountry({ ...home, home: false, stored: null, page: null }).guessed).toBe(false);
  });
  it('falls back to GLOBAL when nothing matches', () => {
    expect(startCountry({ ...home, stored: null, page: null, timeZone: 'Asia/Tokyo', languages: ['ja'] })).toEqual({ country: GLOBAL, guessed: false });
  });
});

describe('the "Showing … figures" note', () => {
  it('shows only while the country is still the guessed one and the note is not closed', () => {
    expect(noticeVisible('PK', 'PK', false)).toBe(true);
    expect(noticeVisible('GB', 'PK', false)).toBe(false); // changed by dropdown or share link
    expect(noticeVisible('PK', null, false)).toBe(false); // chosen, not guessed
    expect(noticeVisible('PK', 'PK', true)).toBe(false); // closed
  });
});

describe('no redirect: the guess never changes the page address', () => {
  // Googlebot and visitors must get the same page; the guess only sets the calculator's state
  const files = ['src/i18n/countries.js', 'src/ui/country-notice.js', 'src/main.js'];
  const redirect = /location\.(href|pathname|search)\s*=[^=]|location\.(assign|replace|reload)\s*\(|window\.location\s*=[^=]|history\.(pushState|replaceState)\s*\(|http-equiv=["']?refresh/i;
  for (const f of files) {
    it(`${f} has no redirect or address change`, () => {
      expect(fs.readFileSync(path.join(root, f), 'utf8')).not.toMatch(redirect);
    });
  }
  it('the home page has no meta refresh', () => {
    expect(fs.readFileSync(path.join(root, 'index.html'), 'utf8')).not.toMatch(/http-equiv=["']?refresh/i);
  });
});
