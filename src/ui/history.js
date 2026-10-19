// Backup files (download / open with merge or replace), opt-in share links
// and the one-page printable action plan. Month-by-month history itself
// lives in months.js.

import { getState, replaceState, normalizeState, hasData } from '../state.js';
import { PROFILES } from '../engine/profiles.js';
import { EFFORT_LABEL } from '../engine/rules.js';
import { makeBackup, parseBackup, backupFileName, describeMonths, mergeHistory, monthLabel, MAX_MONTHS } from '../engine/history.js';
import { getHistory, importMonths, markBackup } from '../history-store.js';
import { $, esc, toast, confirmDialog, choiceDialog } from './dom.js';

let latest = null; // { state, result, view } from the most recent render

// ---------------- Share link (opt-in) ----------------
const toB64Url = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (b64) => {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

function shareableState(s) {
  const { profile, currency, period, values, debts, subscriptions, yearly, extras, plan, projection, goals, allocation, housingFree } = s;
  return { profile, currency, period, values, debts, subscriptions, yearly, extras, plan, projection, goals, allocation, housingFree };
}

function createShareLink() {
  const url = `${location.origin}${location.pathname}#data=${toB64Url(JSON.stringify(shareableState(getState())))}`;
  $('shareUrl').value = url;
  $('shareBox').hidden = false;
  $('shareUrl').select();
}

async function copyShareLink() {
  const input = $('shareUrl');
  try {
    await navigator.clipboard.writeText(input.value);
    toast('Link copied');
  } catch {
    input.select();
    toast('Press Ctrl+C (or long-press) to copy the selected link', { tone: 'info' });
  }
}

/** Offers to load a budget from a share link; never applied without consent. */
async function checkSharedHash() {
  const m = location.hash.match(/^#data=([\w-]+)$/);
  if (!m) return;
  let data;
  try { data = JSON.parse(fromB64Url(m[1])); } catch { data = null; }
  history.replaceState(null, '', location.pathname + location.search);
  // A link with no budget in it would only wipe the numbers here
  const shared = data && normalizeState(data);
  if (!shared || !hasData(shared)) { toast('That share link is invalid or incomplete', { tone: 'error' }); return; }
  const ok = await confirmDialog({
    title: 'Open shared budget?',
    message: 'This link contains budget numbers someone shared with you. Loading it replaces the numbers you’re working on now. Your saved months are kept.',
    confirmLabel: 'Load shared budget'
  });
  if (!ok) return;
  const cur = getState();
  replaceState({ ...shared, ui: { ...cur.ui, mode: 'results', sample: false } }, 'import');
  toast('Shared budget loaded');
}

// ---------------- Backup ----------------
/** Downloads one file with every saved month and the current budget. */
export function downloadBackup() {
  const now = new Date();
  const blob = new Blob([JSON.stringify(makeBackup(getState(), getHistory().months, now), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = backupFileName(now);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  markBackup(now);
  toast('Backup downloaded');
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "18 saved months (Apr 2025 – Oct 2026)" */
function monthsText(months) {
  const d = describeMonths(months);
  if (!d.count) return 'no saved months';
  return d.count === 1 ? `1 saved month (${monthLabel(d.from)})` : `${plural(d.count, 'saved month')} (${monthLabel(d.from)} – ${monthLabel(d.to)})`;
}

async function openBackup(file) {
  if (!file) return;
  if (file.size > 5_000_000) { toast('That file is too large to be a budget backup', { tone: 'error' }); return; }
  let raw;
  try { raw = JSON.parse(await file.text()); } catch { raw = null; }
  const parsed = parseBackup(raw);
  if (!parsed.ok) { toast("That file isn't a budget backup", { tone: 'error' }); return; }

  const here = getHistory().months;
  const merged = mergeHistory(here, parsed.months, 'merge');
  const overflow = merged.dropped.length
    ? ` Only the newest ${MAX_MONTHS} months are kept, so merging would remove ${plural(merged.dropped.length, 'older month')}.`
    : '';
  const choice = await choiceDialog({
    title: 'Open this backup?',
    message: `“${file.name}” has ${monthsText(parsed.months)}, plus your numbers and settings. This device has ${monthsText(here)}.`
      + ` Merge adds the backup’s months to these (where both have the same month, the one saved most recently is kept).`
      + ` Replace swaps everything here for the backup.${overflow}`,
    confirmLabel: 'Merge',
    altLabel: 'Replace',
    altDanger: true
  });
  if (!choice) return;
  const mode = choice === 'alt' ? 'replace' : 'merge';
  const cur = getState();
  const dropped = importMonths(parsed.months, mode);
  // Merging keeps the numbers you're working on, unless there are none yet
  if (mode === 'replace' || !hasData(cur)) {
    replaceState({ ...parsed.state, ui: { ...cur.ui, mode: 'results', sample: false } }, 'import');
  }
  const count = getHistory().months.length;
  toast(`${mode === 'replace' ? 'Backup opened' : 'Backup merged'}: ${plural(count, 'saved month')} on this device${dropped.length ? `, ${plural(dropped.length, 'older month')} left out` : ''}`);
}

// ---------------- Print ----------------
function buildPrintPlan() {
  if (!latest) return;
  const { state, result, view } = latest;
  const committed = result.plan.filter((p) => p.committed).sort((a, b) => b.monthly - a.monthly);
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  $('printPlan').innerHTML = `
    <h1 style="font-size:20pt;font-weight:800;margin:0">My savings plan</h1>
    <p style="color:#475569;margin:4px 0 14px">${esc(PROFILES[state.profile].name)} · ${state.currency} · ${date}</p>
    <table style="margin-bottom:14px"><tbody>
      <tr><th>What you spend now</th><td class="num">${view.raw(result.totals.spend)} a month</td><th>Money you could save each month</th><td class="num"><strong>${view.rawS(result.savings)}</strong></td></tr>
      <tr><th>What you could spend</th><td class="num">${view.rawS(result.optimized)} a month</td><th>That’s this much a year</th><td class="num"><strong>${view.rawS(result.savings * 12)}</strong></td></tr>
      ${result.health ? `<tr><th>Budget health score</th><td class="num">${result.health.score}/100 (${result.health.label})</td><th></th><td></td></tr>` : ''}
    </tbody></table>
    <h2 style="font-size:13pt;margin:10px 0 6px">Changes in my plan (${committed.length})</h2>
    ${committed.length ? `<table><thead><tr><th>Change</th><th>Effort</th><th class="num">Cost to start</th><th class="num">Saves a month</th><th class="num">Saves a year</th></tr></thead><tbody>
      ${committed.map((p) => `<tr><td><strong>${esc(p.label)}: ${esc(p.title)}</strong><br><span style="color:#475569;font-size:9.5pt">${esc(p.tips[0] || '')}${p.kind === 'interest' ? ' (interest avoided, not counted as monthly savings)' : ''}</span></td><td>${EFFORT_LABEL[p.effort]}</td><td class="num">${p.upfront > 0 ? view.raw(p.upfront) : 'Nothing'}</td><td class="num">${view.rawS(p.monthly)}</td><td class="num">${view.rawS(p.annual)}</td></tr>`).join('')}
    </tbody></table>` : '<p>Nothing added to the plan yet.</p>'}
    ${state.goals.length ? `<h2 style="font-size:13pt;margin:14px 0 6px">Goals</h2><ul>${state.goals.map((g) => `<li>${esc(g.name || 'Goal')}: ${view.raw(g.target)}</li>`).join('')}</ul>` : ''}
    <p style="color:#64748b;font-size:8.5pt;margin-top:18px">These are estimates to help you plan, not financial advice. Worked out privately in your browser.</p>`;
}

export function renderHistory(state, result, view) {
  latest = { state, result, view };
}

export function initHistory() {
  $('btnShare').addEventListener('click', createShareLink);
  $('btnCopyShare').addEventListener('click', copyShareLink);
  // Every "Download backup" button on the page
  document.addEventListener('click', (e) => { if (e.target.closest('[data-backup]')) downloadBackup(); });
  $('importFile').addEventListener('change', (e) => {
    openBackup(e.target.files[0]);
    e.target.value = '';
  });
  $('btnPrint').addEventListener('click', () => { buildPrintPlan(); window.print(); });
  window.addEventListener('beforeprint', buildPrintPlan);
  checkSharedHash();
  window.addEventListener('hashchange', checkSharedHash);
}
