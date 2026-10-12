// Small DOM helpers shared by the UI modules.

import { money, money2, moneyShort, currencySymbol } from '../utils/format.js';

export const $ = (id) => document.getElementById(id);

export const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Only touch the DOM when the value actually changed. */
export function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}
export function setHTML(el, html) {
  if (el && el.__html !== html) {
    el.innerHTML = html;
    el.__html = html;
  }
}
export function setAttr(el, name, value) {
  if (el && el.getAttribute(name) !== String(value)) el.setAttribute(name, value);
}

export const isLite = () => document.documentElement.classList.contains('lite');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export const motionOK = () => !isLite() && !reduceMotion.matches;

/**
 * Animated number counter using requestAnimationFrame. Skipped (instant) in
 * lite mode and when the user prefers reduced motion.
 */
export function animateNumber(el, to, format, duration = 550) {
  if (!el) return;
  const from = el.__value ?? 0;
  el.__value = to;
  if (el.__raf) cancelAnimationFrame(el.__raf);
  if (!motionOK() || from === to || document.hidden) {
    setText(el, format(to));
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    setText(el, format(from + (to - from) * eased));
    if (t < 1) el.__raf = requestAnimationFrame(step);
  };
  el.__raf = requestAnimationFrame(step);
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Display helpers for the Monthly / Annual toggle. Flow amounts (bills,
 * savings) are multiplied by `f`; balances (funds, goals, projections) use `raw`.
 */
export function makeView(state) {
  const cur = state.currency;
  const f = state.period === 'annual' ? 12 : 1;
  return {
    cur, f,
    per: f === 12 ? '/yr' : '/mo',
    periodWord: f === 12 ? 'year' : 'month',
    m: (n) => money(n * f, cur),
    m2: (n) => money2(n * f, cur),
    raw: (n) => money(n, cur),
    short: (n) => moneyShort(n, cur),
    symbol: currencySymbol(cur)
  };
}

// ---------------- Toasts ----------------
export function toast(message, { action, tone = 'success', timeout } = {}) {
  const region = $('toastRegion');
  if (!region) return;
  const el = document.createElement('div');
  el.className = 'toast-enter pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg ring-1 ring-white/10 dark:bg-slate-800';
  const ic = tone === 'error' ? 'alert' : tone === 'info' ? 'info' : 'check-circle';
  const color = tone === 'error' ? 'text-rose-400' : tone === 'info' ? 'text-indigo-300' : 'text-emerald-400';
  el.innerHTML = `${icon(ic, color)}<span>${esc(message)}</span>`;
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ml-1 min-h-11 rounded-lg px-2 font-bold text-indigo-300 hover:text-indigo-200';
    b.textContent = action.label;
    b.addEventListener('click', () => { action.onClick(); el.remove(); });
    el.append(b);
  }
  region.append(el);
  setTimeout(() => el.remove(), timeout ?? (action ? 6000 : 2800));
}

// ---------------- Screen-reader announcements ----------------
let announceTimer;
/** Debounced polite announcement so screen readers aren't flooded while typing. */
export function announce(message, delay = 900) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    const el = $('srAnnounce');
    if (el) {
      el.textContent = '';
      requestAnimationFrame(() => { el.textContent = message; });
    }
  }, delay);
}

// ---------------- Confirm dialog ----------------
/** Promise-based wrapper around the native <dialog> element. */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  const dlg = $('confirmDialog');
  $('confirmTitle').textContent = title;
  $('confirmMessage').textContent = message;
  const ok = $('confirmOk');
  ok.textContent = confirmLabel;
  ok.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  return new Promise((resolve) => {
    const done = (value) => {
      dlg.removeEventListener('close', onClose);
      resolve(value);
    };
    const onClose = () => done(dlg.returnValue === 'ok');
    dlg.addEventListener('close', onClose);
    dlg.returnValue = '';
    dlg.showModal();
    $('confirmCancel').focus();
  });
}
