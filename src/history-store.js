// Month-by-month history in localStorage, kept apart from the live budget
// ('hbo:v3') so the budget stays small and fast to save. Versioned through
// normalizeHistory(); old snapshot rows from the budget are moved in once.

import { normalizeHistory, upsertMonth, migrateSnapshots, mergeHistory } from './engine/history.js';

const KEY = 'hbo:history';

let data = normalizeHistory(null);
const listeners = new Set();

export const getHistory = () => data;
export const subscribeHistory = (fn) => (listeners.add(fn), () => listeners.delete(fn));

function commit() {
  let ok = true;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { ok = false; }
  listeners.forEach((fn) => fn());
  return ok;
}

/**
 * Loads saved history. When there is none yet but the budget still holds the
 * old snapshot list, those rows become the first (totals-only) months.
 * Returns true when old snapshots were moved, so the caller can clear them.
 */
export function loadHistory(legacySnapshots = []) {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  data = normalizeHistory(raw);
  if (!raw && legacySnapshots.length) {
    data.months = migrateSnapshots(legacySnapshots);
    commit();
    return true;
  }
  return false;
}

/** Saves (or replaces) one month. Returns false when the browser refused to store it. */
export function saveMonth(entry) {
  data.months = upsertMonth(data.months, entry);
  data.meta.firstSaved ||= entry.savedAt;
  const ok = commit();
  if (ok && !data.meta.persistAsked) askPersist();
  return ok;
}

export function deleteMonth(month) {
  data.months = data.months.filter((m) => m.month !== month);
  commit();
}

/** Brings back a deleted month (undo). */
export function restoreMonth(entry) {
  data.months = upsertMonth(data.months, entry);
  commit();
}

/** Applies an imported backup's months. Returns the months that didn't fit. */
export function importMonths(months, mode) {
  const merged = mergeHistory(data.months, months, mode);
  data.months = merged.months;
  commit();
  return merged.dropped;
}

export function markBackup(now = new Date()) {
  data.lastBackup = now.toISOString();
  commit();
}

export function setMeta(key, value) {
  data.meta[key] = value;
  commit();
}

export function clearHistory() {
  data = normalizeHistory(null);
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn());
}

/**
 * Asks the browser not to clear this site's storage when space runs low.
 * Asked once, after the first save; a refusal or missing API changes nothing.
 */
function askPersist() {
  data.meta.persistAsked = true;
  commit();
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch { /* not supported */ }
}
