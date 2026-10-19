// Contact page form. Sends through the form service set in .env
// (VITE_CONTACT_FORM_ENDPOINT, e.g. Formspree or Web3Forms). Without one it
// falls back to opening the visitor's email app addressed to VITE_CONTACT_EMAIL.

import './page.js';

const ENDPOINT = (import.meta.env.VITE_CONTACT_FORM_ENDPOINT || '').trim();
const ACCESS_KEY = (import.meta.env.VITE_CONTACT_FORM_KEY || '').trim();
const EMAIL = (import.meta.env.VITE_CONTACT_EMAIL || '').trim();

const LIMITS = { name: 100, message: 3000 };
const MIN_MESSAGE = 20;
const TOPICS = {
  bug: 'Something isn’t working',
  calculation: 'Question about a calculation or figure',
  idea: 'Idea, feature or currency request',
  question: 'General question',
  privacy: 'Privacy or data request',
  business: 'Advertising or partnership',
  press: 'Press or media',
  other: 'Something else'
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
  if (field === 'name') return !v ? 'Please tell us your name.' : v.length > LIMITS.name ? `Please keep your name under ${LIMITS.name} characters.` : '';
  if (field === 'email') return !v ? 'Please add your email so we can reply.' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? 'That email doesn’t look right. Check for typos, like name@example.com.' : '';
  if (field === 'topic') return TOPICS[v] ? '' : 'Please choose what your message is about.';
  return v.length < MIN_MESSAGE ? `Please write a little more (at least ${MIN_MESSAGE} characters) so we can help.`
    : v.length > LIMITS.message ? `Please keep your message under ${LIMITS.message} characters.` : '';
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
    topic: TOPICS[form.elements.topic.value],
    message: form.elements.message.value.trim(),
    page: document.referrer && new URL(document.referrer).origin === location.origin ? document.referrer : location.href
  };
  const subject = `Budget Optimizer: ${data.topic}`;

  if (!ENDPOINT) {
    if (!EMAIL) throw new Error('not-configured');
    const body = `${data.message}\n\n—\n${data.name}\nTopic: ${data.topic}`;
    location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return 'mailto';
  }

  const body = new FormData();
  for (const [k, v] of Object.entries(data)) body.append(k, v);
  body.append('subject', subject); // Web3Forms
  body.append('_subject', subject); // Formspree
  body.append('_replyto', data.email);
  body.append('from_name', 'Budget Optimizer contact form');
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

  if (EMAIL) {
    const alt = $('c-email-alt');
    alt.append('Prefer email? Write to ');
    const a = document.createElement('a');
    a.href = `mailto:${EMAIL}`;
    a.className = 'link';
    a.textContent = EMAIL;
    alt.append(a, '.');
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
    $('c-status').hidden = true;
    const bad = validate(form);
    if (bad) { $(`c-${bad}`).focus(); return; }

    // Bots fill the hidden field; pretend it worked and send nothing
    if (form.elements.website.value) {
      form.reset(); updateCount();
      showStatus('success', 'Thanks, your message is on its way.', 'We usually reply within 2 working days.');
      return;
    }

    if (ENDPOINT && navigator.onLine === false) {
      showStatus('error', 'You’re offline.', 'Connect to the internet and press Send again. Your message is still in the form.');
      return;
    }

    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      const how = await send(form);
      if (how === 'mailto') {
        showStatus('success', 'Your email app should open now.', `Press send there to reach us. If nothing opened, write to ${EMAIL}.`);
      } else {
        form.reset(); updateCount();
        showStatus('success', 'Thanks, your message is on its way.', 'We usually reply within 2 working days. Check your spam folder if you don’t hear back.');
      }
    } catch (err) {
      showStatus('error', 'Your message wasn’t sent.',
        err.message === 'not-configured'
          ? 'The contact form isn’t set up yet. Please try again later.'
          : `Please check your connection and try again${EMAIL ? `, or email us at ${EMAIL}` : ''}. Your message is still in the form.`);
    } finally {
      button.disabled = false;
      button.textContent = 'Send message';
    }
  });
}

initContactForm();
