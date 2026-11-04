import { describe, it, expect } from 'vitest';
import { isOfficialSource, sourceRel } from '../scripts/official-sources.mjs';

describe('source links (scripts/official-sources.mjs)', () => {
  it('follows government, central bank and statistics office links', () => {
    for (const url of [
      'https://www.bls.gov/cpi/', 'https://www.ons.gov.uk/x', 'https://mospi.gov.in/', 'https://www.pbs.gov.pk/',
      'https://www.diputados.gob.mx/', 'https://www150.statcan.gc.ca/t1/', 'https://www.destatis.de/', 'https://www.insee.fr/',
      'https://fred.stlouisfed.org/series/X', 'https://www.centralbank.ae/', 'https://nepra.org.pk/', 'https://www.sama.gov.sa/'
    ]) expect(isOfficialSource(url), url).toBe(true);
    expect(sourceRel('https://www.bls.gov/')).toBe('noopener');
  });

  it('keeps nofollow on news, banks, comparison sites and lookalikes', () => {
    for (const url of [
      'https://www.dawn.com/', 'https://www.zameen.com/', 'https://www.bankrate.com/', 'https://www.mcb.com.pk/',
      'https://www.moneysavingexpert.com/', 'https://govnews.example.com/', 'https://notdestatis.de/', 'not a url'
    ]) expect(isOfficialSource(url), url).toBe(false);
    expect(sourceRel('https://www.dawn.com/')).toBe('noopener nofollow');
  });
});
