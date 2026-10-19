// "Start over": clear the numbers being worked on (goals, settings and saved
// months stay), or delete everything on this device including history.

import { getState, replaceState, defaultState, clearStorage } from '../state.js';
import { clearHistory } from '../history-store.js';
import { flushSave, forgetCopied, forgetSession } from './months.js';
import { downloadBackup } from './history.js';
import { $, toast, choiceDialog } from './dom.js';
import { t } from '../i18n/index.js';

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
  toast(t('reset.cleared'), {
    action: { label: t('common.undo'), onClick: () => replaceState(prev, 'replace') }
  });
}

async function deleteEverything() {
  const choice = await choiceDialog({
    title: t('reset.deleteAll.title'),
    message: t('reset.deleteAll.message'),
    confirmLabel: t('reset.deleteAll.confirm'),
    danger: true,
    altLabel: t('reset.deleteAll.backupFirst')
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
  toast(t('reset.deleted'), { tone: 'info' });
}

export async function startOver() {
  const choice = await choiceDialog({
    title: t('reset.startOver.title'),
    message: t('reset.startOver.message'),
    confirmLabel: t('reset.startOver.clear'),
    altLabel: t('reset.deleteAll.confirm'),
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
