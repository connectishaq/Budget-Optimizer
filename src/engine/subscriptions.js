// Subscription types: a label, a one-line guideline, and whether the type
// counts as a must-pay bill. The type is guessed from the name until the
// user picks one, so "Netflix" lands in streaming and "Claude" in tools.
// Labels and tips are read from the "subs" messages in the active language.

import { t } from '../i18n/index.js';

export const SUB_KINDS = {
  streaming: {
    get label() { return t('subs.kinds.streaming.label'); }, icon: 'tv', need: false,
    get tip() { return t('subs.kinds.streaming.tip'); }
  },
  tools: {
    get label() { return t('subs.kinds.tools.label'); }, icon: 'laptop', need: true,
    get tip() { return t('subs.kinds.tools.tip'); }
  },
  cloud: {
    get label() { return t('subs.kinds.cloud.label'); }, icon: 'save', need: false,
    get tip() { return t('subs.kinds.cloud.tip'); }
  },
  fitness: {
    get label() { return t('subs.kinds.fitness.label'); }, icon: 'heart-pulse', need: false,
    get tip() { return t('subs.kinds.fitness.tip'); }
  },
  learning: {
    get label() { return t('subs.kinds.learning.label'); }, icon: 'school', need: false,
    get tip() { return t('subs.kinds.learning.tip'); }
  },
  membership: {
    get label() { return t('subs.kinds.membership.label'); }, icon: 'cart', need: false,
    get tip() { return t('subs.kinds.membership.tip'); }
  },
  other: {
    get label() { return t('subs.kinds.other.label'); }, icon: 'repeat', need: false,
    get tip() { return t('subs.kinds.other.tip'); }
  }
};
export const SUB_KIND_KEYS = Object.keys(SUB_KINDS);

// Checked in order, so more specific types come first ("gym membership" is fitness)
const KEYWORDS = [
  ['tools', ['claude', 'chatgpt', 'openai', 'gemini', 'copilot', 'perplexity', 'midjourney', 'cursor', 'github', 'jetbrains', 'notion', 'slack', 'zoom', 'office', 'microsoft 365', 'adobe', 'photoshop', 'canva', 'figma', 'grammarly', 'linkedin', 'vpn', '1password', 'lastpass', 'domain', 'hosting']],
  ['cloud', ['icloud', 'google one', 'google drive', 'dropbox', 'onedrive', 'cloud', 'storage', 'backup']],
  ['fitness', ['gym', 'fitness', 'yoga', 'peloton', 'strava', 'fitbit', 'myfitnesspal', 'headspace', 'calm', 'workout']],
  ['learning', ['duolingo', 'babbel', 'coursera', 'udemy', 'skillshare', 'masterclass', 'brilliant', 'language', 'course', 'tuition', 'class']],
  ['membership', ['amazon prime', 'costco', 'walmart+', 'uber one', 'careem', 'foodpanda', 'swiggy', 'zomato', 'deliveroo', 'doordash', 'instacart', 'meal', 'delivery', 'newspaper', 'news', 'magazine', 'club']],
  ['streaming', ['netflix', 'spotify', 'youtube', 'disney', 'prime video', 'hulu', 'hbo', 'apple music', 'apple tv', 'deezer', 'tidal', 'crunchyroll', 'paramount', 'peacock', 'hotstar', 'jiocinema', 'zee5', 'sonyliv', 'tamasha', 'shahid', 'osn', 'audible', 'kindle', 'xbox', 'playstation', 'ps plus', 'game pass', 'nintendo', 'steam', 'twitch', 'streaming', 'music', 'tv', 'game']]
];

/** Best guess from the name, or 'other'. */
export function guessSubKind(name) {
  const n = String(name || '').toLowerCase();
  if (!n.trim()) return 'other';
  for (const [kind, words] of KEYWORDS) if (words.some((w) => n.includes(w))) return kind;
  return 'other';
}

/** The type in use: the user's pick, otherwise the guess from the name. */
export const subKind = (s) => (SUB_KINDS[s.kind] ? s.kind : guessSubKind(s.name));
