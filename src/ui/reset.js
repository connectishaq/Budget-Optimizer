// "Start over": clear the numbers being worked on (goals, settings and saved
// months stay), or delete everything on this device including history.

import { getState, replaceState, defaultState, clearStorage } from '../state.js';
import { clearHistory } from '../history-store.js';
import { flushSave, forgetCopied, forgetSession } from './months.js';
import { downloadBackup } from './history.js';
import { $, toast, choiceDialog } from './dom.js';

/** Empties every amount and list, then starts the guided steps again. Undoable. */
export function clearNumbers() {
  flushSave();
  const prev = JSON.parse(JSON.stringify(getState()));
  forgetCopied();
  replaceState({
    ...prev,
    values: {}, extras: [], debts: [], subscriptions: [], yearly: [], housingFree: null,
    plan: { committed: {}, pct: {}, sort: prev.plan.sort },
    ui: { ...prev.ui, sample: false, mode: 'wizard', step: 1, sub: 0 }
  }, 'reset');
  toast('Numbers cleared. Your goals and saved months are kept.', {
    action: { label: 'Undo', onClick: () => replaceState(prev, 'replace') }
  });
}

async function deleteEverything() {
  const choice = await choiceDialog({
    title: 'Delete everything?',
    message: 'This removes all your numbers, goals and every saved month from this device. It can’t be undone. Download a backup first if you might want them later.',
    confirmLabel: 'Delete everything',
    danger: true,
    altLabel: 'Download backup first'
  });
  if (choice === 'alt') {
    downloadBackup();
    deleteEverything();
    return;
  }
  if (choice !== 'ok') return;
  const keep = getState();
  forgetSession();
  clearStorage();
  clearHistory();
  replaceState({ ...defaultState(), profile: keep.profile, currency: keep.currency }, 'reset');
  toast('Everything was deleted from this device', { tone: 'info' });
}

export async function startOver() {
  const choice = await choiceDialog({
    title: 'Start over?',
    message: 'Clear my numbers empties your income, bills, loans, subscriptions, yearly costs and plan choices, and takes you back to step 1. Your goals, settings and saved months are kept. Delete everything also removes your goals and every saved month.',
    confirmLabel: 'Clear my numbers',
    altLabel: 'Delete everything',
    altDanger: true
  });
  if (choice === 'ok') clearNumbers();
  else if (choice === 'alt') deleteEverything();
}

export function initReset() {
  $('wizStartOver').addEventListener('click', startOver);
  $('btnReset').addEventListener('click', startOver);
  $('startBlank').addEventListener('click', clearNumbers);
}
