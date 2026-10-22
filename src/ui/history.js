// Backup files (download / open with merge or replace), opt-in share links
// and the one-page printable action plan. Month-by-month history itself
// lives in months.js.

import { getState, replaceState, normalizeState, hasData } from '../state.js';
import { PROFILES } from '../engine/profiles.js';
import { EFFORT_LABEL } from '../engine/rules.js';
import { makeBackup, parseBackup, backupFileName, describeMonths, mergeHistory, monthLabel, MAX_MONTHS } from '../engine/history.js';
import { getHistory, importMonths, markBackup } from '../history-store.js';
import { $, esc, toast, confirmDialog, choiceDialog } from './dom.js';
import { t } from '../i18n/index.js';
import { dateLocale } from '../utils/format.js';
import { canSave } from '../engine/calculate.js';
import { limitLabel } from './plan.js';

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
  const { profile, country, currency, period, payFrequency, values, local, custom, debts, subscriptions, yearly, extras, plan, projection, goals, allocation, housingFree } = s;
  return { profile, country, currency, period, payFrequency, values, local, custom, debts, subscriptions, yearly, extras, plan, projection, goals, allocation, housingFree };
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
    toast(t('backup.share.copied'));
  } catch {
    input.select();
    toast(t('backup.share.copyManual'), { tone: 'info' });
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
  if (!shared || !hasData(shared)) { toast(t('backup.share.invalid'), { tone: 'error' }); return; }
  const ok = await confirmDialog({
    title: t('backup.share.dialog.title'),
    message: t('backup.share.dialog.message'),
    confirmLabel: t('backup.share.dialog.confirm')
  });
  if (!ok) return;
  const cur = getState();
  replaceState({ ...shared, ui: { ...cur.ui, mode: 'results', sample: false } }, 'import');
  toast(t('backup.share.loaded'));
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
  toast(t('backup.downloaded'));
}

/** "18 saved months (Apr 2025 – Oct 2026)" */
function monthsText(months) {
  const d = describeMonths(months);
  if (!d.count) return t('backup.monthsNone');
  return d.count === 1 ? t('backup.monthsSingle', { month: monthLabel(d.from) }) : t('backup.monthsRange', { months: t('backup.savedMonths', { count: d.count }), from: monthLabel(d.from), to: monthLabel(d.to) });
}

async function openBackup(file) {
  if (!file) return;
  if (file.size > 5_000_000) { toast(t('backup.tooLarge'), { tone: 'error' }); return; }
  let raw;
  try { raw = JSON.parse(await file.text()); } catch { raw = null; }
  const parsed = parseBackup(raw);
  if (!parsed.ok) { toast(t('backup.notBackup'), { tone: 'error' }); return; }

  const here = getHistory().months;
  const merged = mergeHistory(here, parsed.months, 'merge');
  const overflow = merged.dropped.length
    ? ` ${t('backup.openDialog.overflow', { count: MAX_MONTHS, dropped: t('backup.olderMonths', { count: merged.dropped.length }) })}`
    : '';
  const choice = await choiceDialog({
    title: t('backup.openDialog.title'),
    message: t('backup.openDialog.message', { file: file.name, backupMonths: monthsText(parsed.months), hereMonths: monthsText(here) }) + overflow,
    confirmLabel: t('backup.openDialog.merge'),
    altLabel: t('backup.openDialog.replace'),
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
  const done = mode === 'replace' ? 'opened' : 'merged';
  const months = t('backup.savedMonths', { count });
  toast(dropped.length
    ? t(`backup.imported.${done}Dropped`, { months, dropped: t('backup.olderMonths', { count: dropped.length }) })
    : t(`backup.imported.${done}`, { months }));
}

// ---------------- Print ----------------
function buildPrintPlan() {
  if (!latest) return;
  const { state, result, view } = latest;
  const committed = result.plan.filter((p) => p.committed).sort((a, b) => b.monthly - a.monthly);
  const limits = (result.balance?.lines || []).filter((l) => l.committed);
  const date = new Date().toLocaleDateString(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' });
  $('printPlan').innerHTML = `
    <h1 style="font-size:20pt;font-weight:800;margin:0">${esc(t('backup.print.title'))}</h1>
    <p style="color:#475569;margin:4px 0 14px">${esc(PROFILES[state.profile].name)} · ${state.currency} · ${date}</p>
    <table style="margin-bottom:14px"><tbody>
      <tr><th>${esc(t('backup.print.spendNow'))}</th><td class="num">${t('backup.print.perMonth', { amount: view.raw(result.totals.spend) })}</td><th>${esc(t('backup.print.couldSave'))}</th><td class="num"><strong>${view.raw(Math.max(0, canSave(result)))}</strong></td></tr>
      <tr><th>${esc(t('backup.print.couldSpend'))}</th><td class="num">${t('backup.print.perMonth', { amount: view.rawS(result.optimized) })}</td><th>${esc(t('backup.print.perYear'))}</th><td class="num"><strong>${view.raw(Math.max(0, canSave(result)) * 12)}</strong></td></tr>
      ${result.health ? `<tr><th>${esc(t('backup.print.healthScore'))}</th><td class="num">${result.health.score}/100 (${result.health.label})</td><th></th><td></td></tr>` : ''}
    </tbody></table>
    <h2 style="font-size:13pt;margin:10px 0 6px">${esc(t('backup.print.changes', { count: committed.length + limits.length }))}</h2>
    ${committed.length + limits.length ? `<table><thead><tr><th>${esc(t('backup.print.cols.change'))}</th><th>${esc(t('backup.print.cols.effort'))}</th><th class="num">${esc(t('backup.print.cols.cost'))}</th><th class="num">${esc(t('backup.print.cols.monthly'))}</th><th class="num">${esc(t('backup.print.cols.yearly'))}</th></tr></thead><tbody>
      ${committed.map((p) => `<tr><td><strong>${esc(p.label)}: ${esc(p.title)}</strong><br><span style="color:#475569;font-size:9.5pt">${esc(p.tips[0] || '')}${p.kind === 'interest' ? ` ${esc(t('backup.print.interestNote'))}` : ''}</span></td><td>${EFFORT_LABEL[p.effort]}</td><td class="num">${p.upfront > 0 ? view.raw(p.upfront) : esc(t('backup.print.nothing'))}</td><td class="num">${view.rawS(p.monthly)}</td><td class="num">${view.rawS(p.annual)}</td></tr>`).join('')}
      ${limits.map((l) => `<tr><td><strong>${esc(t('backup.print.limit', { label: limitLabel(l, state.country), amount: view.rawS(l.aim) }))}</strong><br><span style="color:#475569;font-size:9.5pt">${esc(t(`plan.limits.tips.${l.tip}`))}</span></td><td>–</td><td class="num">${esc(t('backup.print.nothing'))}</td><td class="num">${view.rawS(l.cut)}</td><td class="num">${view.rawS(l.cut * 12)}</td></tr>`).join('')}
    </tbody></table>` : `<p>${esc(t('backup.print.emptyPlan'))}</p>`}
    ${state.goals.length ? `<h2 style="font-size:13pt;margin:14px 0 6px">${esc(t('backup.print.goals'))}</h2><ul>${state.goals.map((g) => `<li>${esc(g.name || t('backup.print.defaultGoal'))}: ${view.raw(g.target)}</li>`).join('')}</ul>` : ''}
    <p style="color:#64748b;font-size:8.5pt;margin-top:18px">${esc(t('backup.print.disclaimer'))}</p>`;
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
