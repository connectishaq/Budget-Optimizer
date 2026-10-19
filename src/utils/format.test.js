import { describe, it, expect, afterEach } from 'vitest';
import { setLanguage } from '../i18n/index.js';
import { parseAmount, money, moneyNice, numberLocale, dateLocale, decimalSeparator, setFormatRegion, withSign } from './format.js';

const LRI = '⁦';
const PDI = '⁩';

afterEach(async () => {
  await setLanguage('en');
  setFormatRegion(null);
});

describe('locale number parsing', () => {
  it('reads a decimal comma where the locale uses one', () => {
    const comma = { decimal: ',' };
    expect(parseAmount('1.200', comma).value).toBe(1200);
    expect(parseAmount('12,5', comma).value).toBe(12.5);
    expect(parseAmount('1.234,56', comma).value).toBe(1234.56);
    expect(parseAmount('1 234,56 €', comma).value).toBe(1234.56);
    expect(parseAmount('5k', comma).error).toBeTruthy();
  });

  it('keeps reading a decimal point by default', () => {
    expect(parseAmount('1.200').value).toBe(1.2);
    expect(parseAmount('1,200').value).toBe(1200);
    expect(parseAmount('1,50,000').value).toBe(150000);
  });

  it('knows which mark each language types', async () => {
    expect(decimalSeparator('EUR')).toBe('.'); // English
    await setLanguage('de');
    setFormatRegion('DE');
    expect(decimalSeparator('EUR')).toBe(',');
  });
});

describe('currency formatting', () => {
  it('leaves English exactly as before', () => {
    expect(numberLocale('USD')).toBe('en-US');
    expect(numberLocale('EUR')).toBe('en-IE');
    expect(money(1234.4, 'USD')).toBe('$1,234');
    expect(dateLocale()).toBe('en-US');
  });

  it('uses the language and the country for other languages', async () => {
    await setLanguage('de');
    setFormatRegion('DE');
    expect(numberLocale('EUR')).toBe('de-DE-u-nu-latn');
    expect(money(1234.4, 'EUR')).toMatch(/^1\.234\s€$/);
  });

  it('groups rupees in lakh and crore', async () => {
    expect(money(150000, 'INR')).toBe('₹1,50,000');
    expect(moneyNice(350000, 'INR')).toBe('₹3.5 lakh');
    expect(moneyNice(11600000, 'PKR')).toMatch(/1\.16 crore$/);
    await setLanguage('hi');
    setFormatRegion('IN');
    expect(money(150000, 'INR')).toContain('1,50,000');
  });

  it('keeps amounts left to right on right-to-left pages, sign included', async () => {
    expect(withSign('+', money(544, 'USD'))).toBe('+$544'); // no marks in English
    await setLanguage('ar');
    setFormatRegion('AE');
    const m = money(544, 'USD');
    expect(m.startsWith(LRI) && m.endsWith(PDI)).toBe(true);
    const signed = withSign('+', m);
    expect(signed.startsWith(`${LRI}+`)).toBe(true);
    expect(signed.match(new RegExp(LRI, 'g'))).toHaveLength(1); // one isolate around sign + amount
  });
});
