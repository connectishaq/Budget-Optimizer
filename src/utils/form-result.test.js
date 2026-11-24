import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { formResult } from './form-result.js';

describe('contact form: "Sent" only when the service confirms it', () => {
  it('counts Web3Forms {success: true} and Formspree {ok: true} as sent', () => {
    expect(formResult(true, { success: true, message: 'Email sent successfully!' })).toBe('sent');
    expect(formResult(true, { ok: true, next: '/thanks' })).toBe('sent');
  });

  it('treats an explicit failure or an HTTP error as rejected', () => {
    expect(formResult(false, { success: false, message: 'Invalid access key' })).toBe('rejected');
    expect(formResult(true, { success: false })).toBe('rejected');
    expect(formResult(true, { ok: false })).toBe('rejected');
    expect(formResult(false, null)).toBe('rejected'); // e.g. a 400 HTML error page
  });

  it('never says "Sent" for a reply it cannot read as a confirmation', () => {
    expect(formResult(true, null)).toBe('unconfirmed'); // HTML page with HTTP 200
    expect(formResult(true, {})).toBe('unconfirmed'); // empty JSON
    expect(formResult(true, { message: 'Thanks' })).toBe('unconfirmed');
    expect(formResult(true, { success: 'true' })).toBe('unconfirmed'); // a string is not a confirmation
  });
});

describe('contact form without JavaScript', () => {
  const html = fs.readFileSync(new URL('../../contact/index.html', import.meta.url), 'utf8');
  const form = html.match(/<form\b[^>]*id="contactForm"[^>]*>/)[0];

  it('posts (never a GET that would put the message in the address) to the form service', () => {
    expect(form).toMatch(/\bmethod="post"/i);
    expect(form).toMatch(/\baction="__CONTACT_FORM_ACTION__"/);
    expect(html).toMatch(/name="access_key" value="__CONTACT_FORM_KEY__"/);
  });

  it('keeps the browser’s own checks, matching the page’s limits', () => {
    expect(form).not.toMatch(/novalidate/i);
    expect(html).toMatch(/id="c-name"[^>]*maxlength="100"[^>]*required/);
    expect(html).toMatch(/id="c-email"[^>]*type="email"[^>]*required/);
    expect(html).toMatch(/id="c-message"[^>]*minlength="20" maxlength="3000" required/);
  });

  it('lets the form service post through the content security policy', () => {
    const headers = fs.readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
    expect(headers).toMatch(/form-action 'self' https:\/\/api\.web3forms\.com/);
  });
});
