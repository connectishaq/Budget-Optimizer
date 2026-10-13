// Subscription types: a label, a one-line guideline, and whether the type
// counts as a must-pay bill. The type is guessed from the name until the
// user picks one, so "Netflix" lands in streaming and "Claude" in tools.

export const SUB_KINDS = {
  streaming: {
    label: 'Streaming & games', icon: 'tv', need: false,
    tip: 'Keep one or two at a time and switch each month. You can rejoin any time.'
  },
  tools: {
    label: 'Work & AI tools', icon: 'laptop', need: true,
    tip: 'Keep it if it saves you time or earns you money. Paying yearly or sharing a team plan is often cheaper.'
  },
  cloud: {
    label: 'Cloud storage & apps', icon: 'save', need: false,
    tip: 'Clear out old files before paying for more space. One family plan can cover everyone at home.'
  },
  fitness: {
    label: 'Gym & fitness', icon: 'heart-pulse', need: false,
    tip: 'Worth it if you go at least twice a week. If not, a pay-per-visit pass is usually cheaper.'
  },
  learning: {
    label: 'Learning & courses', icon: 'school', need: false,
    tip: 'Set a finish date. Many apps and courses have a free version that covers the basics.'
  },
  membership: {
    label: 'Memberships & delivery', icon: 'cart', need: false,
    tip: 'Add up what it saved you last month. If that’s less than the fee, cancel it.'
  },
  other: {
    label: 'Other', icon: 'repeat', need: false,
    tip: 'Ask yourself: would I sign up again today at this price?'
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
