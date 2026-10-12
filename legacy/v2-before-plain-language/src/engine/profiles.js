// Household profiles: typical monthly ranges (in USD), benchmarks that drive
// rule thresholds, and sample data for first-time visitors.

/**
 * Benchmarks are written in USD. For other currencies they are scaled by a
 * rough cost-of-living-adjusted factor (not a live exchange rate), so a
 * "typical" fuel bill in PKR or INR reflects local price levels.
 */
export const CURRENCY_SCALE = {
  USD: 1,
  CAD: 1.3,
  AUD: 1.45,
  GBP: 0.75,
  EUR: 0.85,
  AED: 3,
  INR: 28,
  PKR: 90
};

export const scaleFor = (currency) => CURRENCY_SCALE[currency] ?? 1;

export const PROFILES = {
  single: {
    name: 'Single City Renter',
    // [low, high] typical monthly ranges in USD
    ranges: {
      income: [3200, 5200], rent: [1200, 1800], homeIns: [12, 25],
      electricity: [45, 85], waterGas: [25, 55], internet: [55, 85],
      fuel: [60, 120], transit: [80, 130], carIns: [90, 160], carLoan: [0, 350],
      school: [0, 0], groceries: [250, 350], dining: [150, 300], misc: [60, 100]
    },
    utilityThreshold: 120,
    // Benchmark share of income per spending category (used for highlighting)
    categoryShare: { housing: 0.35, utilities: 0.06, transport: 0.10, family: 0.20, debt: 0.10, subscriptions: 0.02 }
  },
  suburban: {
    name: 'Suburban Family of 4',
    ranges: {
      income: [6000, 9500], rent: [1800, 2600], homeIns: [100, 180],
      electricity: [110, 170], waterGas: [60, 110], internet: [70, 110],
      fuel: [150, 200], transit: [20, 60], carIns: [180, 280], carLoan: [400, 700],
      school: [200, 600], groceries: [800, 950], dining: [200, 400], misc: [100, 150]
    },
    utilityThreshold: 200,
    categoryShare: { housing: 0.30, utilities: 0.07, transport: 0.15, family: 0.28, debt: 0.10, subscriptions: 0.02 }
  },
  youngpro: {
    name: 'Young Professional',
    ranges: {
      income: [4500, 7000], rent: [1400, 2100], homeIns: [15, 30],
      electricity: [55, 95], waterGas: [30, 60], internet: [65, 95],
      fuel: [100, 150], transit: [60, 120], carIns: [120, 200], carLoan: [250, 450],
      school: [0, 300], groceries: [300, 400], dining: [250, 450], misc: [80, 120]
    },
    utilityThreshold: 150,
    categoryShare: { housing: 0.30, utilities: 0.06, transport: 0.12, family: 0.22, debt: 0.10, subscriptions: 0.02 }
  }
};

export const PROFILE_KEYS = Object.keys(PROFILES);

/** Typical [low, high] range for a field, scaled to the active currency. */
export function typicalRange(profile, field, currency) {
  const r = PROFILES[profile]?.ranges[field];
  if (!r) return null;
  const k = scaleFor(currency);
  return [r[0] * k, r[1] * k];
}

let seq = 0;
const rid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Realistic sample budgets (USD) so first-time visitors see results instantly. */
const SAMPLES = {
  single: {
    values: { income: 4100, rent: 1650, homeIns: 18, electricity: 70, waterGas: 40, internet: 95, fuel: 140, transit: 127, carIns: 120, carLoan: 0, school: 0, groceries: 420, dining: 260, misc: 210, emergencyFund: 2500 },
    debts: [{ type: 'card', name: 'Visa card', balance: 3200, apr: 24.9, payment: 120 }],
    subscriptions: [
      { name: 'Netflix', cost: 15.49, rarely: false },
      { name: 'Spotify', cost: 11.99, rarely: false },
      { name: 'Gym membership', cost: 45, rarely: true }
    ]
  },
  suburban: {
    values: { income: 7200, rent: 2100, homeIns: 160, electricity: 165, waterGas: 85, internet: 120, fuel: 320, transit: 45, carIns: 260, carLoan: 480, school: 450, groceries: 1150, dining: 380, misc: 260, emergencyFund: 6000 },
    debts: [
      { type: 'card', name: 'Store credit card', balance: 5400, apr: 22.9, payment: 180 },
      { type: 'loan', name: 'Personal loan', balance: 7800, apr: 9.5, payment: 250 }
    ],
    subscriptions: [
      { name: 'Netflix', cost: 22.99, rarely: false },
      { name: 'Disney+', cost: 13.99, rarely: true },
      { name: 'Amazon Prime', cost: 14.99, rarely: false },
      { name: 'Meal-kit box', cost: 59.99, rarely: true }
    ]
  },
  youngpro: {
    values: { income: 5600, rent: 1950, homeIns: 22, electricity: 95, waterGas: 55, internet: 110, fuel: 210, transit: 60, carIns: 170, carLoan: 380, school: 250, groceries: 480, dining: 520, misc: 340, emergencyFund: 4000 },
    debts: [
      { type: 'card', name: 'Rewards card', balance: 4100, apr: 27.4, payment: 160 },
      { type: 'loan', name: 'Student loan', balance: 18500, apr: 5.5, payment: 210 }
    ],
    subscriptions: [
      { name: 'Streaming bundle', cost: 19.99, rarely: false },
      { name: 'Cloud storage', cost: 9.99, rarely: false },
      { name: 'Language app', cost: 12.99, rarely: true },
      { name: 'Fitness app', cost: 14.99, rarely: true }
    ]
  }
};

/** Sample data for a profile, scaled to the active currency. */
export function sampleFor(profile, currency) {
  const s = SAMPLES[profile] || SAMPLES.suburban;
  const k = scaleFor(currency);
  const round = (n) => Math.round(n * k * 100) / 100;
  const values = {};
  for (const [key, v] of Object.entries(s.values)) values[key] = Math.round(v * k);
  return {
    values,
    debts: s.debts.map((d) => ({ id: rid('d'), ...d, balance: Math.round(d.balance * k), payment: Math.round(d.payment * k) })),
    subscriptions: s.subscriptions.map((x) => ({ id: rid('s'), ...x, cost: round(x.cost) }))
  };
}

export const newId = rid;
