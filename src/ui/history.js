// Persistence & sharing: monthly snapshots + trend, opt-in share links,
// JSON export/import and the one-page printable action plan.

import { getState, setState, replaceState, normalizeState, hasData } from '../state.js';
import { PROFILES } from '../engine/profiles.js';
import { EFFORT_LABEL } from '../engine/rules.js';
// Snapshot amounts use the same lakh/crore display as the rest of the page
import { moneyNice as money } from '../utils/format.js';
import { $, icon, esc, setText, setHTML, toast, confirmDialog } from './dom.js';

let latest = null; // { state, result, view } from the most recent render

// ---------------- Snapshots ----------------
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

function saveSnapshot() {
  if (!latest) return;
  const { result, state } = latest;
  const key = monthKey();
  const snap = {
    id: `h${Date.now().toString(36)}`, month: key, savedAt: new Date().toISOString(), currency: state.currency,
    income: result.totals.income, spend: result.totals.spend, optimized: result.optimized,
    savings: result.savings, score: result.health ? result.health.score : null
  };
  const replaced = state.snapshots.some((s) => s.month === key);
  setState((s) => {
    s.snapshots = s.snapshots.filter((x) => x.month !== key).concat(snap).sort((a, b) => a.month.localeCompare(b.month)).slice(-36);
  });
  toast(replaced ? `${monthLabel(key)} updated` : 'This month is saved');
}

/** Small two-line SVG trend: spend vs optimized spend across snapshots. */
function trendSvg(snaps) {
  const W = 320, H = 96, P = 8;
  const vals = snaps.flatMap((s) => [s.spend, s.optimized]);
  const max = Math.max(...vals), min = Math.min(...vals);
  const span = max - min || 1;
  const x = (i) => P + (i * (W - 2 * P)) / Math.max(1, snaps.length - 1);
  const y = (v) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = (key) => snaps.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join(' ');
  const dots = (key, color) => snaps.map((s, i) => `<circle cx="${x(i)}" cy="${y(s[key])}" r="3.5" fill="${color}" stroke="var(--dot-ring,#fff)" stroke-width="2"><title>${monthLabel(s.month)}: ${money(s[key], s.currency)}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="h-24 w-full [--dot-ring:#fff] dark:[--dot-ring:#0f172a]" role="img" aria-label="Trend of total spend and optimized spend across ${snaps.length} snapshots">
    <path d="${line('spend')}" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="5 4"/>
    <path d="${line('optimized')}" fill="none" stroke="#047857" stroke-width="2"/>
    ${dots('spend', '#64748b')}${dots('optimized', '#047857')}
  </svg>`;
}

function renderSnapshots(state) {
  const snaps = state.snapshots;
  // Amounts in different currencies can't share one line, so the trend only
  // shows months saved in the currency picked now
  const same = snaps.filter((s) => s.currency === state.currency);
  const other = snaps.length - same.length;
  $('historyEmpty').hidden = snaps.length > 0;
  $('historyTrend').hidden = same.length < 2;
  if (same.length >= 2) setHTML($('trendSvg'), trendSvg(same));
  $('trendNote').hidden = !other;
  setText($('trendNote'), `${other} month${other === 1 ? '' : 's'} saved in another currency ${other === 1 ? 'is' : 'are'} left out of this line.`);
  setHTML($('snapshotRows'), [...snaps].reverse().map((s, i, arr) => {
    const prev = arr[i + 1];
    const delta = prev && prev.currency === s.currency ? s.spend - prev.spend : null;
    const deltaTxt = delta == null ? '<span class="muted">—</span>'
      : `<span class="${delta <= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'} font-semibold">${delta <= 0 ? '▼' : '▲'} ${money(Math.abs(delta), s.currency)}</span>`;
    return `<tr class="border-t border-slate-100 dark:border-slate-800">
      <th scope="row" class="py-2 pr-2 text-left font-semibold text-slate-900 dark:text-white">${monthLabel(s.month)}</th>
      <td class="px-2 py-2 text-right tabular-nums">${money(s.spend, s.currency)}</td>
      <td class="px-2 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">${money(s.savings, s.currency)}</td>
      <td class="hidden px-2 py-2 text-right tabular-nums sm:table-cell">${s.score ?? '—'}</td>
      <td class="px-2 py-2 text-right tabular-nums">${deltaTxt}</td>
      <td class="py-1 pl-1 text-right"><button type="button" class="btn-icon h-9 w-9 hover:text-rose-600" data-del-snap="${s.id}" aria-label="Delete snapshot ${monthLabel(s.month)}">${icon('trash', 'icon-sm')}</button></td>
    </tr>`;
  }).join(''));
}

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
  const { profile, currency, period, values, debts, subscriptions, yearly, plan, projection, goals, allocation, housingFree } = s;
  return { profile, currency, period, values, debts, subscriptions, yearly, plan, projection, goals, allocation, housingFree };
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
  if (!data) { toast('That share link is invalid or incomplete', { tone: 'error' }); return; }
  const ok = await confirmDialog({
    title: 'Open shared budget?',
    message: 'This link contains budget numbers someone shared with you. Loading it replaces the values currently saved on this device (your snapshots are kept).',
    confirmLabel: 'Load shared budget'
  });
  if (!ok) return;
  const cur = getState();
  replaceState({ ...normalizeState(data), snapshots: cur.snapshots, ui: { ...cur.ui, mode: 'results', sample: false } }, 'import');
  toast('Shared budget loaded');
}

// ---------------- Export / import ----------------
function exportJson() {
  const blob = new Blob([JSON.stringify({ app: 'household-budget-optimizer', exportedAt: new Date().toISOString(), data: getState() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `budget-optimizer-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup file downloaded');
}

async function importJson(file) {
  if (!file) return;
  if (file.size > 1_000_000) { toast('That file is too large to be a budget backup', { tone: 'error' }); return; }
  let parsed;
  try { parsed = JSON.parse(await file.text()); } catch { parsed = null; }
  const data = parsed?.data ?? parsed;
  if (!data || typeof data !== 'object' || !('values' in data)) {
    toast("That file isn't a Budget Optimizer backup", { tone: 'error' });
    return;
  }
  const ok = await confirmDialog({
    title: 'Import this backup?',
    message: `This replaces everything saved on this device with "${file.name}".`,
    confirmLabel: 'Import'
  });
  if (!ok) return;
  // Keep the screen the user is on; a backup's saved screen may be step 1
  replaceState({ ...data, ui: { ...getState().ui, mode: 'results', sample: false } }, 'import');
  toast('Backup imported');
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
  renderSnapshots(state);
  $('btnSnapshot').disabled = !hasData(state);
}

export function initHistory() {
  $('btnSnapshot').addEventListener('click', saveSnapshot);
  $('snapshotRows').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-snap]');
    if (!b) return;
    const id = b.dataset.delSnap;
    const st = getState();
    const idx = st.snapshots.findIndex((s) => s.id === id);
    const removed = st.snapshots[idx];
    setState((s) => { s.snapshots = s.snapshots.filter((x) => x.id !== id); });
    toast('Snapshot deleted', { action: { label: 'Undo', onClick: () => setState((s) => { s.snapshots.splice(idx, 0, removed); }) } });
  });
  $('btnShare').addEventListener('click', createShareLink);
  $('btnCopyShare').addEventListener('click', copyShareLink);
  $('btnExport').addEventListener('click', exportJson);
  $('importFile').addEventListener('change', (e) => {
    importJson(e.target.files[0]);
    e.target.value = '';
  });
  $('btnPrint').addEventListener('click', () => { buildPrintPlan(); window.print(); });
  window.addEventListener('beforeprint', buildPrintPlan);
  checkSharedHash();
  window.addEventListener('hashchange', checkSharedHash);
}
