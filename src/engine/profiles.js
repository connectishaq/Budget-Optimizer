// Household profiles and per-country benchmark sets.
//
// Each currency has its own hand-written benchmark set (typical monthly
// ranges, rule thresholds, one-off costs, sample budgets). To add a country,
// add a block to BENCHMARKS with the same shape — nothing else changes.
// Currencies without their own set fall back to the US set scaled by a rough
// cost-of-living factor, and are flagged `approximate: true` in the UI.

export const PROFILES = {
  single: { name: 'Single City Renter', group: 'city renters' },
  suburban: { name: 'Suburban Family of 4', group: 'families' },
  youngpro: { name: 'Young Professional', group: 'young professionals' }
};
export const PROFILE_KEYS = Object.keys(PROFILES);

/*
 * Set shape:
 *   costs:     one-off purchase costs used by rules (LED kit, smart thermostat, tune-up kit)
 *   profiles:  per profile
 *     ranges:        [low, high] typical monthly amount per input field
 *     thresholds:    amounts above which a rule fires
 *     categoryShare: typical share of income per spending category
 *   samples:   example budget per profile (values, debts, subscriptions)
 */

const USD = {
  approximate: false,
  costs: { ledKit: 40, smartThermostat: 130, tuneup: 15 },
  profiles: {
    single: {
      ranges: {
        income: [3200, 5200], rent: [1200, 1800], homeIns: [12, 25],
        electricity: [45, 85], waterGas: [25, 55], internet: [55, 85],
        fuel: [60, 120], transit: [80, 130], carIns: [90, 160], carLoan: [0, 350],
        school: [0, 0], groceries: [250, 350], dining: [150, 300], misc: [60, 100]
      },
      thresholds: { utilities: 120, fuel: 120, transit: 130, internet: 80, insurance: 100, carLoan: 350, school: 200, diningFloor: 50, subsActive: 45 },
      categoryShare: { housing: 0.35, utilities: 0.06, transport: 0.10, family: 0.20, debt: 0.10, subscriptions: 0.02 }
    },
    suburban: {
      ranges: {
        income: [6000, 9500], rent: [1800, 2600], homeIns: [100, 180],
        electricity: [110, 170], waterGas: [60, 110], internet: [70, 110],
        fuel: [150, 200], transit: [20, 60], carIns: [180, 280], carLoan: [400, 700],
        school: [200, 600], groceries: [800, 950], dining: [200, 400], misc: [100, 150]
      },
      thresholds: { utilities: 200, fuel: 200, transit: 100, internet: 80, insurance: 100, carLoan: 350, school: 200, diningFloor: 50, subsActive: 45 },
      categoryShare: { housing: 0.30, utilities: 0.07, transport: 0.15, family: 0.28, debt: 0.10, subscriptions: 0.02 }
    },
    youngpro: {
      ranges: {
        income: [4500, 7000], rent: [1400, 2100], homeIns: [15, 30],
        electricity: [55, 95], waterGas: [30, 60], internet: [65, 95],
        fuel: [100, 150], transit: [60, 120], carIns: [120, 200], carLoan: [250, 450],
        school: [0, 300], groceries: [300, 400], dining: [250, 450], misc: [80, 120]
      },
      thresholds: { utilities: 150, fuel: 150, transit: 100, internet: 80, insurance: 100, carLoan: 350, school: 200, diningFloor: 50, subsActive: 45 },
      categoryShare: { housing: 0.30, utilities: 0.06, transport: 0.12, family: 0.22, debt: 0.10, subscriptions: 0.02 }
    }
  },
  samples: {
    single: {
      values: { income: 4100, rent: 1650, homeIns: 18, electricity: 70, waterGas: 40, internet: 95, fuel: 140, transit: 127, carIns: 120, carLoan: 0, school: 0, groceries: 420, dining: 260, misc: 210, emergencyFund: 2500 },
      debts: [{ type: 'card', name: 'Visa card', balance: 3200, apr: 24.9, payment: 120 }],
      subscriptions: [{ name: 'Netflix', cost: 15.49, rarely: false }, { name: 'Spotify', cost: 11.99, rarely: false }, { name: 'Gym membership', cost: 45, rarely: true }]
    },
    suburban: {
      values: { income: 7200, rent: 2100, homeIns: 160, electricity: 165, waterGas: 85, internet: 120, fuel: 320, transit: 45, carIns: 260, carLoan: 480, school: 450, groceries: 1150, dining: 380, misc: 260, emergencyFund: 6000 },
      debts: [
        { type: 'card', name: 'Store credit card', balance: 5400, apr: 22.9, payment: 180 },
        { type: 'loan', name: 'Personal loan', balance: 7800, apr: 9.5, payment: 250 }
      ],
      subscriptions: [{ name: 'Netflix', cost: 22.99, rarely: false }, { name: 'Disney+', cost: 13.99, rarely: true }, { name: 'Amazon Prime', cost: 14.99, rarely: false }, { name: 'Meal-kit box', cost: 59.99, rarely: true }]
    },
    youngpro: {
      values: { income: 5600, rent: 1950, homeIns: 22, electricity: 95, waterGas: 55, internet: 110, fuel: 210, transit: 60, carIns: 170, carLoan: 380, school: 250, groceries: 480, dining: 520, misc: 340, emergencyFund: 4000 },
      debts: [
        { type: 'card', name: 'Rewards card', balance: 4100, apr: 27.4, payment: 160 },
        { type: 'loan', name: 'Student loan', balance: 18500, apr: 5.5, payment: 210 }
      ],
      subscriptions: [{ name: 'Streaming bundle', cost: 19.99, rarely: false }, { name: 'Cloud storage', cost: 9.99, rarely: false }, { name: 'Language app', cost: 12.99, rarely: true }, { name: 'Fitness app', cost: 14.99, rarely: true }]
    }
  }
};

// Pakistani households (urban, 2025–26 price levels). Electricity is a much
// bigger share of the budget than in the US; home insurance is uncommon.
const PKR = {
  approximate: false,
  costs: { ledKit: 6000, smartThermostat: 30000, tuneup: 2500 },
  profiles: {
    single: {
      ranges: {
        income: [90000, 160000], rent: [25000, 40000], homeIns: [0, 1000],
        electricity: [6000, 14000], waterGas: [1500, 4000], internet: [3000, 6000],
        fuel: [5000, 10000], transit: [3000, 8000], carIns: [0, 3000], carLoan: [0, 25000],
        school: [0, 0], groceries: [18000, 28000], dining: [5000, 12000], misc: [5000, 10000]
      },
      thresholds: { utilities: 18000, fuel: 10000, transit: 8000, internet: 6000, insurance: 3000, carLoan: 25000, school: 15000, diningFloor: 3000, subsActive: 2500 },
      categoryShare: { housing: 0.30, utilities: 0.14, transport: 0.12, family: 0.35, debt: 0.10, subscriptions: 0.02 }
    },
    suburban: {
      ranges: {
        income: [220000, 400000], rent: [50000, 90000], homeIns: [0, 2000],
        electricity: [15000, 32000], waterGas: [3000, 8000], internet: [4000, 8000],
        fuel: [18000, 28000], transit: [0, 6000], carIns: [3000, 8000], carLoan: [0, 60000],
        school: [20000, 50000], groceries: [60000, 85000], dining: [8000, 20000], misc: [10000, 18000]
      },
      thresholds: { utilities: 40000, fuel: 28000, transit: 6000, internet: 8000, insurance: 8000, carLoan: 60000, school: 45000, diningFloor: 5000, subsActive: 3000 },
      categoryShare: { housing: 0.25, utilities: 0.14, transport: 0.15, family: 0.40, debt: 0.10, subscriptions: 0.02 }
    },
    youngpro: {
      ranges: {
        income: [150000, 300000], rent: [40000, 75000], homeIns: [0, 1500],
        electricity: [10000, 22000], waterGas: [2000, 5000], internet: [4000, 7000],
        fuel: [12000, 22000], transit: [3000, 7000], carIns: [3000, 7000], carLoan: [0, 50000],
        school: [0, 15000], groceries: [25000, 38000], dining: [12000, 28000], misc: [8000, 15000]
      },
      thresholds: { utilities: 27000, fuel: 22000, transit: 7000, internet: 7000, insurance: 6000, carLoan: 50000, school: 15000, diningFloor: 5000, subsActive: 3000 },
      categoryShare: { housing: 0.28, utilities: 0.12, transport: 0.18, family: 0.32, debt: 0.10, subscriptions: 0.02 }
    }
  },
  samples: {
    single: {
      values: { income: 150000, rent: 35000, homeIns: 0, electricity: 12000, waterGas: 2500, internet: 4500, fuel: 12000, transit: 9000, carIns: 0, carLoan: 0, school: 0, groceries: 30000, dining: 14000, misc: 12000, emergencyFund: 50000 },
      debts: [{ type: 'card', name: 'Credit card', balance: 60000, apr: 38, payment: 5000 }],
      subscriptions: [{ name: 'Netflix', cost: 1100, rarely: false }, { name: 'Spotify', cost: 349, rarely: false }, { name: 'Gym membership', cost: 4000, rarely: true }]
    },
    suburban: {
      values: { income: 350000, rent: 60000, homeIns: 0, electricity: 36000, waterGas: 6000, internet: 9000, fuel: 32000, transit: 2000, carIns: 6000, carLoan: 0, school: 35000, groceries: 90000, dining: 15000, misc: 22000, emergencyFund: 150000 },
      debts: [{ type: 'card', name: 'Credit card', balance: 180000, apr: 40, payment: 12000 }],
      subscriptions: [{ name: 'Netflix', cost: 1100, rarely: false }, { name: 'YouTube Premium', cost: 479, rarely: false }, { name: 'Gym membership', cost: 6000, rarely: true }]
    },
    youngpro: {
      values: { income: 290000, rent: 60000, homeIns: 0, electricity: 20000, waterGas: 3500, internet: 6500, fuel: 26000, transit: 4000, carIns: 5000, carLoan: 45000, school: 0, groceries: 32000, dining: 34000, misc: 17000, emergencyFund: 80000 },
      debts: [{ type: 'card', name: 'Credit card', balance: 120000, apr: 40, payment: 9000 }],
      subscriptions: [{ name: 'Netflix', cost: 1100, rarely: false }, { name: 'Spotify', cost: 349, rarely: false }, { name: 'Cloud storage', cost: 650, rarely: false }, { name: 'Language app', cost: 1200, rarely: true }, { name: 'Gym membership', cost: 7000, rarely: true }]
    }
  }
};

export const BENCHMARKS = { USD, PKR };

/** Rough cost-of-living factors, used ONLY for currencies without their own set. */
const FALLBACK_SCALE = { CAD: 1.3, AUD: 1.45, GBP: 0.75, EUR: 0.85, AED: 3, INR: 28 };

const round = (n) => (n >= 100 ? Math.round(n / 5) * 5 : Math.round(n * 100) / 100);
const mapObj = (o, fn) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fn(v)]));

function scaledSet(base, k) {
  return {
    approximate: true,
    costs: mapObj(base.costs, (v) => round(v * k)),
    profiles: mapObj(base.profiles, (p) => ({
      ranges: mapObj(p.ranges, ([lo, hi]) => [round(lo * k), round(hi * k)]),
      thresholds: mapObj(p.thresholds, (v) => round(v * k)),
      categoryShare: p.categoryShare
    })),
    samples: mapObj(base.samples, (s) => ({
      values: mapObj(s.values, (v) => Math.round(v * k)),
      debts: s.debts.map((d) => ({ ...d, balance: Math.round(d.balance * k), payment: Math.round(d.payment * k) })),
      subscriptions: s.subscriptions.map((x) => ({ ...x, cost: round(x.cost * k) }))
    }))
  };
}

const derived = {};
/** The benchmark set for a currency (its own, or an approximate scaled one). */
export function benchmarkSet(currency) {
  if (BENCHMARKS[currency]) return BENCHMARKS[currency];
  derived[currency] ||= scaledSet(USD, FALLBACK_SCALE[currency] ?? 1);
  return derived[currency];
}

/** Benchmarks for one currency + profile: { ranges, thresholds, categoryShare, costs, approximate }. */
export function benchmarkFor(currency, profile) {
  const set = benchmarkSet(currency);
  const p = set.profiles[profile] || set.profiles.suburban;
  return { ...p, costs: set.costs, approximate: set.approximate };
}

/** Typical [low, high] monthly range for an input field. */
export function typicalRange(profile, field, currency) {
  return benchmarkFor(currency, profile).ranges[field] || null;
}

let seq = 0;
const rid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Example budget for a profile in the active currency, with fresh row ids. */
export function sampleFor(profile, currency) {
  const set = benchmarkSet(currency);
  const s = set.samples[profile] || set.samples.suburban;
  return {
    values: { ...s.values },
    debts: s.debts.map((d) => ({ id: rid('d'), ...d })),
    subscriptions: s.subscriptions.map((x) => ({ id: rid('s'), ...x }))
  };
}

export const newId = rid;
