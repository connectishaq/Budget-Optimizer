// Contact page form. Sends through the form service set in .env
// (VITE_CONTACT_FORM_ENDPOINT, e.g. Formspree or Web3Forms). Without one it
// falls back to opening the visitor's email app addressed to VITE_CONTACT_EMAIL.
// With neither, the form is hidden and a note says messages can't be sent yet,
// so the page never pretends to send.

import { pageReady } from './page.js';
import { t } from './i18n/index.js';

const ENDPOINT = (import.meta.env.VITE_CONTACT_FORM_ENDPOINT || '').trim();
const ACCESS_KEY = (import.meta.env.VITE_CONTACT_FORM_KEY || '').trim();
const EMAIL = (import.meta.env.VITE_CONTACT_EMAIL || '').trim();

const LIMITS = { name: 100, message: 3000 };
const MIN_MESSAGE = 20;
// Topic value -> message key of its label (shown and sent as t(TOPICS[value]))
const TOPICS = {
  bug: 'contact.topics.bug',
  calculation: 'contact.topics.calculation',
  idea: 'contact.topics.idea',
  question: 'contact.topics.question',
  privacy: 'contact.topics.privacy',
  business: 'contact.topics.business',
  press: 'contact.topics.press',
  other: 'contact.topics.other'
};

const $ = (id) => document.getElementById(id);

function setError(field, message) {
  const input = $(`c-${field}`);
  const msg = $(`c-${field}-msg`);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  msg.textContent = message || '';
  return !message;
}

/** The problem with one field, or '' when it's fine. */
function fieldError(form, field) {
  const v = form.elements[field].value.trim();
  if (field === 'name') return !v ? t('contact.errors.nameMissing') : v.length > LIMITS.name ? t('contact.errors.nameTooLong', { max: LIMITS.name }) : '';
  if (field === 'email') return !v ? t('contact.errors.emailMissing') : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? t('contact.errors.emailInvalid') : '';
  if (field === 'topic') return TOPICS[v] ? '' : t('contact.errors.topicMissing');
  return v.length < MIN_MESSAGE ? t('contact.errors.messageTooShort', { min: MIN_MESSAGE })
    : v.length > LIMITS.message ? t('contact.errors.messageTooLong', { max: LIMITS.message }) : '';
}

/** Checks every field, shows messages next to them and returns the first bad one. */
function validate(form) {
  let first = null;
  for (const field of ['name', 'email', 'topic', 'message']) {
    if (!setError(field, fieldError(form, field)) && !first) first = field;
  }
  return first;
}

function showStatus(tone, title, text) {
  const box = $('c-status');
  box.hidden = false;
  box.setAttribute('role', tone === 'success' ? 'status' : 'alert');
  box.className = `mt-5 flex gap-3 rounded-xl px-4 py-3 text-sm ${tone === 'success'
    ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
    : 'bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200'}`;
  box.innerHTML = `<svg class="icon mt-0.5 shrink-0" aria-hidden="true"><use href="#i-${tone === 'success' ? 'check-circle' : 'alert'}"></use></svg><div><p class="font-semibold"></p><p class="mt-0.5"></p></div>`;
  const [t, p] = box.querySelectorAll('p');
  t.textContent = title;
  p.textContent = text;
  box.focus();
}

async function send(form) {
  const data = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    topic: t(TOPICS[form.elements.topic.value]),
    message: form.elements.message.value.trim(),
    page: document.referrer && new URL(document.referrer).origin === location.origin ? document.referrer : location.href
  };
  const subject = t('contact.mail.subject', { topic: data.topic });

  if (!ENDPOINT) {
    if (!EMAIL) throw new Error('not-configured');
    const body = t('contact.mail.body', { message: data.message, name: data.name, topic: data.topic });
    location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return 'mailto';
  }

  const body = new FormData();
  for (const [k, v] of Object.entries(data)) body.append(k, v);
  body.append('subject', subject); // Web3Forms
  body.append('_subject', subject); // Formspree
  body.append('_replyto', data.email);
  body.append('from_name', 'SpendMath contact form');
  if (ACCESS_KEY) body.append('access_key', ACCESS_KEY);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', body, headers: { Accept: 'application/json' }, signal: ctrl.signal });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false || json.ok === false) throw new Error('rejected');
    return 'sent';
  } finally {
    clearTimeout(timer);
  }
}

function initContactForm() {
  const form = $('contactForm');
  if (!form) return;
  const button = $('c-submit');

  if (!ENDPOINT && !EMAIL) {
    form.hidden = true;
    $('c-reply-time').hidden = true;
    $('c-unavailable').hidden = false;
    return;
  }
  let sending = false;

  if (EMAIL) {
    const alt = $('c-email-alt');
    const [before, after = ''] = t('contact.emailAlt').split('{email}');
    alt.append(before);
    const a = document.createElement('a');
    a.href = `mailto:${EMAIL}`;
    a.className = 'link';
    a.textContent = EMAIL;
    alt.append(a, after);
    alt.hidden = false;
  }
  const counter = $('c-message-count');

  // ?topic=bug preselects the topic, so other pages can link straight to it
  const pre = new URLSearchParams(location.search).get('topic');
  if (TOPICS[pre]) form.elements.topic.value = pre;

  const updateCount = () => {
    const n = form.elements.message.value.trim().length;
    counter.textContent = `${n} / ${LIMITS.message}`;
    counter.classList.toggle('text-rose-700', n > LIMITS.message);
  };
  form.elements.message.addEventListener('input', updateCount);
  updateCount();

  // Clear a field's message as soon as it's fixed
  const recheck = (e) => {
    const f = e.target.name;
    if (e.target.getAttribute('aria-invalid') === 'true') setError(f, fieldError(form, f));
  };
  form.addEventListener('input', recheck);
  form.addEventListener('change', recheck);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return; // one message at a time, however often the button is pressed
    $('c-status').hidden = true;
    const bad = validate(form);
    if (bad) { $(`c-${bad}`).focus(); return; }

    // Bots fill the hidden field; pretend it worked and send nothing
    if (form.elements.website.value) {
      form.reset(); updateCount();
      showStatus('success', t('contact.status.sentTitle'), t('contact.status.sentTextBrief'));
      return;
    }

    if (ENDPOINT && navigator.onLine === false) {
      showStatus('error', t('contact.status.offlineTitle'), t('contact.status.offlineText'));
      return;
    }

    sending = true;
    button.disabled = true;
    button.textContent = t('contact.form.sending');
    try {
      const how = await send(form);
      if (how === 'mailto') {
        showStatus('success', t('contact.status.mailtoTitle'), t('contact.status.mailtoText', { email: EMAIL }));
      } else {
        form.reset(); updateCount();
        showStatus('success', t('contact.status.sentTitle'), t('contact.status.sentText'));
      }
    } catch (err) {
      // The connection dropped while sending (fetch throws a TypeError)
      if (err.name === 'TypeError' && navigator.onLine === false) {
        showStatus('error', t('contact.status.offlineTitle'), t('contact.status.offlineText'));
        return;
      }
      showStatus('error', t('contact.status.failedTitle'),
        err.message === 'not-configured'
          ? t('contact.status.notConfigured')
          : EMAIL ? t('contact.status.failedTextWithEmail', { email: EMAIL }) : t('contact.status.failedText'));
    } finally {
      sending = false;
      button.disabled = false;
      button.textContent = t('contact.form.send');
    }
  });
}

pageReady.then(initContactForm);
