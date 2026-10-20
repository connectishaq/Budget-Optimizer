// Tiny i18n layer: t(key, vars) with {placeholder} interpolation, plural forms
// chosen by Intl.PluralRules, and English as the fallback for missing keys.
// English is bundled; every other language is loaded only when it's active.
// English page text that's already in the HTML (article, legal pages, search
// text) is left out of the bundle and loaded with other languages as their
// fallback (see englishSplit in vite.config.js).
//
// Message files are nested JSON. A key is its dot path ("wizard.next").
// A plural message is an object of Intl.PluralRules categories, always with
// "other": { "one": "{count} month", "other": "{count} months" }.
// Keys ending in "_html" may contain markup; their vars are inserted as-is,
// so callers must escape anything that came from the user.

import enCore from 'virtual:en-core';
import { isEnabledLanguage } from './enabled.js';

export const LANGUAGES = {
  en: { name: 'English', dir: 'ltr' },
  es: { name: 'Español', dir: 'ltr' },
  hi: { name: 'हिन्दी', dir: 'ltr' },
  ar: { name: 'العربية', dir: 'rtl' },
  ur: { name: 'اردو', dir: 'rtl' },
  fr: { name: 'Français', dir: 'ltr' },
  pt: { name: 'Português', dir: 'ltr' },
  id: { name: 'Bahasa Indonesia', dir: 'ltr' },
  de: { name: 'Deutsch', dir: 'ltr' }
};
export const DEFAULT_LANG = 'en';
const LANG_KEY = 'hbo:lang';

const loaders = import.meta.glob(['./locales/*.json', '!./locales/en.json']);

let en = enCore;
/** Adds the English page text, so another language can fall back to it. */
async function loadEnglishPageText() {
  if (en !== enCore) return;
  const rest = (await import('virtual:en-static')).default;
  const full = { ...enCore };
  for (const [ns, v] of Object.entries(rest)) full[ns] = { ...v, ...(enCore[ns] || {}) };
  en = full;
}

let lang = DEFAULT_LANG;
let messages = en;
const listeners = new Set();
const pluralCache = new Map();

/** Looks up a dot path in a nested message object. */
function lookup(obj, key) {
  let cur = obj;
  for (const part of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
// A plural message has only plural categories as keys, and always "other"
const isPlural = (v) => !!v && typeof v === 'object' && typeof v.other === 'string'
  && Object.keys(v).every((k) => PLURAL_CATEGORIES.has(k));

function pluralRules(l) {
  let r = pluralCache.get(l);
  if (!r) { r = new Intl.PluralRules(l); pluralCache.set(l, r); }
  return r;
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, name) => (vars[name] == null ? m : String(vars[name])));
}

/**
 * Translates a key. Falls back to English, then to the key itself, so a
 * missing translation never breaks the page.
 */
export function t(key, vars) {
  let msg = lookup(messages, key);
  let msgLang = lang;
  if (msg == null || (typeof msg === 'object' && !isPlural(msg))) {
    msg = lookup(en, key);
    msgLang = DEFAULT_LANG;
  }
  if (msg == null) {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (isPlural(msg)) {
    const n = Number(vars?.count ?? 0);
    msg = msg[pluralRules(msgLang).select(n)] ?? msg.other;
  }
  return interpolate(msg, vars);
}

/** True when the key exists (in the active language or English). */
export const has = (key) => lookup(messages, key) != null || lookup(en, key) != null;

export const getLanguage = () => lang;
export const dirOf = (l = lang) => LANGUAGES[l]?.dir || 'ltr';

/** A language that has a translation file and is switched on (src/i18n/enabled.js). */
export const isLive = (l) => !!LANGUAGES[l] && isEnabledLanguage(l);

/** Picks the first live language from the browser's list, or English. */
export function detectLanguage(list = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []) {
  for (const tag of list || []) {
    const base = String(tag || '').toLowerCase().split('-')[0];
    if (isLive(base)) return base;
  }
  return DEFAULT_LANG;
}

export function getStoredLanguage() {
  try {
    const l = localStorage.getItem(LANG_KEY);
    // A saved language that has since been switched off falls back to the default choice
    return isLive(l) ? l : null;
  } catch { return null; }
}

export function storeLanguage(l) {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* storage unavailable */ }
}

/** Loads a language's messages (lazily) and makes it active. */
export async function setLanguage(next) {
  const l = LANGUAGES[next] ? next : DEFAULT_LANG;
  if (l === DEFAULT_LANG) messages = en;
  else {
    const load = loaders[`./locales/${l}.json`];
    const [mod] = await Promise.all([load ? load() : null, loadEnglishPageText()]);
    messages = mod?.default ?? en;
  }
  lang = l;
  if (typeof document !== 'undefined') {
    // A language/country page keeps its regional tag (de-DE) from the build
    const html = document.documentElement;
    if (html.getAttribute('data-page-lang') !== l) html.lang = l;
    html.dir = dirOf(l);
  }
  listeners.forEach((fn) => fn(l));
  return l;
}

/** Called after every language change. Returns an unsubscribe function. */
export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Translates static markup:
 *   data-i18n="key"            -> textContent (data-i18n-vars='{"n":1}' fills placeholders)
 *   data-i18n-html="key"       -> innerHTML (trusted message files only)
 *   data-i18n-attr="aria-label:key;placeholder:key2"
 * English text stays inline in the HTML, so the English page needs no JS.
 */
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(el.dataset.i18n, el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : undefined);
    if (el.textContent !== v) el.textContent = v;
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const v = t(el.dataset.i18nHtml);
    if (el.innerHTML !== v) el.innerHTML = v;
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
}
