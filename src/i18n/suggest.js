// "This page is also in English" banner for the language/country pages
// (/de-de/…). Shown only when the browser prefers another language we have a
// page in; it's a link, never a redirect, and closing it is remembered.
// The sentence is written in the browser's language, so it lives here rather
// than in the (lazily loaded) message files.

import { dirOf } from './index.js';
import { hrefFor } from './locale-pages.js';

const KEY = 'hbo:suggestClosed';

const TEXT = {
  en: ['This page is also in English', 'Close'],
  es: ['Esta página también está en español', 'Cerrar'],
  hi: ['यह पेज हिन्दी में भी है', 'बंद करें'],
  ar: ['هذه الصفحة متوفرة أيضًا بالعربية', 'إغلاق'],
  ur: ['یہ صفحہ اردو میں بھی دستیاب ہے', 'بند کریں'],
  fr: ['Cette page existe aussi en français', 'Fermer'],
  pt: ['Esta página também está em português', 'Fechar'],
  id: ['Halaman ini juga tersedia dalam bahasa Indonesia', 'Tutup'],
  de: ['Diese Seite gibt es auch auf Deutsch', 'Schließen']
};

/** The browser's first language that we have, or null (no fallback to English here). */
export function browserLanguage(list = navigator.languages || [navigator.language]) {
  for (const tag of list || []) {
    const base = String(tag || '').toLowerCase().split('-')[0];
    if (TEXT[base]) return base;
  }
  return null;
}

/** The page to suggest for this browser, or null (same language, unsupported, or closed before). */
export function suggestion(pageLang, pageCountry, browserLang, closed = false) {
  if (closed || !TEXT[browserLang] || browserLang === pageLang) return null;
  return { lang: browserLang, href: hrefFor(browserLang, pageCountry), text: TEXT[browserLang][0], close: TEXT[browserLang][1] };
}

export function initLanguageSuggestion() {
  const html = document.documentElement;
  const pageLang = html.getAttribute('data-page-lang');
  const box = document.getElementById('langSuggest');
  if (!pageLang || !box) return;
  let closed = false;
  try { closed = localStorage.getItem(KEY) === '1'; } catch { /* storage unavailable */ }
  const s = suggestion(pageLang, html.getAttribute('data-page-country'), browserLanguage(), closed);
  if (!s) return;
  const link = document.getElementById('langSuggestLink');
  link.textContent = s.text;
  link.href = s.href;
  link.lang = s.lang;
  link.hreflang = s.lang;
  box.dir = dirOf(s.lang);
  const close = document.getElementById('langSuggestClose');
  close.setAttribute('aria-label', s.close);
  close.addEventListener('click', () => {
    box.hidden = true;
    try { localStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ }
  });
  box.hidden = false;
}
