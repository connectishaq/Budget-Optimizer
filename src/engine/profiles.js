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
 *   samples:   example budget per profile (values, debts, subscriptions, yearly
 *              costs, extra income); `suburban` is the complete one with every
 *              kind of bill and income filled in
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
        school: [0, 0], groceries: [250, 350], dining: [150, 300], misc: [60, 100],
        medical: [20, 80], homeHelp: [0, 0], familySupport: [0, 200], giving: [0, 100], other: [0, 150]
      },
      thresholds: { utilities: 120, fuel: 120, transit: 130, internet: 80, insurance: 100, carLoan: 350, school: 200, diningFloor: 50, subsActive: 45 },
      categoryShare: { housing: 0.35, utilities: 0.06, transport: 0.10, family: 0.20, debt: 0.10, subscriptions: 0.02, care: 0.04, yearly: 0.04 }
    },
    suburban: {
      ranges: {
        income: [6000, 9500], rent: [1800, 2600], homeIns: [100, 180],
        electricity: [110, 170], waterGas: [60, 110], internet: [70, 110],
        fuel: [150, 200], transit: [20, 60], carIns: [180, 280], carLoan: [400, 700],
        school: [200, 600], groceries: [800, 950], dining: [200, 400], misc: [100, 150],
        medical: [80, 250], homeHelp: [0, 400], familySupport: [0, 300], giving: [0, 250], other: [0, 250]
      },
      thresholds: { utilities: 200, fuel: 200, transit: 100, internet: 80, insurance: 100, carLoan: 350, school: 200, diningFloor: 50, subsActive: 45 },
      categoryShare: { housing: 0.30, utilities: 0.07, transport: 0.15, family: 0.28, debt: 0.10, subscriptions: 0.02, care: 0.06, yearly: 0.05 }
    },
    youngpro: {
      ranges: {
        income: [4500, 7000], rent: [1400, 2100], homeIns: [15, 30],
        electricity: [55, 95], waterGas: [30, 60], internet: [65, 95],
        fuel: [100, 150], transit: [60, 120], carIns: [120, 200], carLoan: [250, 450],
        school: [0, 300], groceries: [300, 400], dining: [250, 450], misc: [80, 120],
        medical: [30, 120], homeHelp: [0, 0], familySupport: [0, 250], giving: [0, 150], other: [0, 200]
      },
      thresholds: { utilities: 150, fuel: 150, transit: 100, internet: 80, insurance: 100, carLoan: 350, school: 200, diningFloor: 50, subsActive: 45 },
      categoryShare: { housing: 0.30, utilities: 0.06, transport: 0.12, family: 0.22, debt: 0.10, subscriptions: 0.02, care: 0.05, yearly: 0.04 }
    }
  },
  samples: {
    single: {
      values: { income: 4100, rent: 1650, homeIns: 18, electricity: 70, waterGas: 40, internet: 95, fuel: 140, transit: 127, carIns: 120, carLoan: 0, school: 0, groceries: 420, dining: 260, misc: 210, medical: 40, familySupport: 100, giving: 30, other: 40, emergencyFund: 2500 },
      debts: [{ type: 'card', name: 'Visa card', balance: 3200, apr: 24.9, payment: 120 }],
      subscriptions: [{ name: 'Netflix', cost: 15.49, rarely: false }, { name: 'Spotify', cost: 11.99, rarely: false }, { name: 'Gym membership', cost: 45, rarely: true }],
      yearly: [{ name: 'Festivals (Eid, Diwali, Christmas…)', cost: 600 }],
      extras: [{ name: 'Overtime', amount: 1800 }, { name: 'Festival bonus (Eid, Diwali, Christmas…)', amount: 500 }]
    },
    // The complete example: every bill, every kind of subscription, loans,
    // once-a-year costs and extra income, so people see everything they can add
    suburban: {
      values: { income: 7200, rent: 2100, homeIns: 160, electricity: 165, waterGas: 85, internet: 120, fuel: 320, transit: 45, carIns: 260, carLoan: 480, school: 450, groceries: 1150, dining: 380, misc: 260, medical: 120, homeHelp: 240, familySupport: 200, giving: 100, other: 90, emergencyFund: 6000 },
      debts: [
        { type: 'card', name: 'Store credit card', balance: 5400, apr: 22.9, payment: 180 },
        { type: 'loan', name: 'Personal loan', balance: 7800, apr: 9.5, payment: 250 }
      ],
      subscriptions: [
        { name: 'Netflix', cost: 22.99, rarely: false }, { name: 'Disney+', cost: 13.99, rarely: true },
        { name: 'Microsoft 365', cost: 9.99, rarely: false }, { name: 'iCloud storage', cost: 2.99, rarely: false },
        { name: 'Gym membership', cost: 59.99, rarely: true }, { name: 'Duolingo', cost: 12.99, rarely: true },
        { name: 'Amazon Prime', cost: 14.99, rarely: false }
      ],
      yearly: [{ name: 'Festivals (Eid, Diwali, Christmas…)', cost: 1800 }, { name: 'School books, uniforms and admission', cost: 600 }, { name: 'Car service and repairs', cost: 900 }],
      extras: [
        { name: 'Yearly performance bonus', amount: 6000 }, { name: 'Festival bonus (Eid, Diwali, Christmas…)', amount: 1000 },
        { name: 'Overtime', amount: 2400 }, { name: 'Extra work or side jobs', amount: 1800 }
      ]
    },
    youngpro: {
      values: { income: 5600, rent: 1950, homeIns: 22, electricity: 95, waterGas: 55, internet: 110, fuel: 210, transit: 60, carIns: 170, carLoan: 380, school: 250, groceries: 480, dining: 520, misc: 340, medical: 50, familySupport: 150, giving: 50, other: 60, emergencyFund: 4000 },
      debts: [
        { type: 'card', name: 'Rewards card', balance: 4100, apr: 27.4, payment: 160 },
        { type: 'loan', name: 'Student loan', balance: 18500, apr: 5.5, payment: 210 }
      ],
      subscriptions: [{ name: 'Streaming bundle', cost: 19.99, rarely: false }, { name: 'Cloud storage', cost: 9.99, rarely: false }, { name: 'Language app', cost: 12.99, rarely: true }, { name: 'Fitness app', cost: 14.99, rarely: true }],
      yearly: [{ name: 'Travel and trips home', cost: 1200 }],
      extras: [{ name: 'Yearly performance bonus', amount: 4000 }, { name: 'Extra work or side jobs', amount: 2400 }]
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
        school: [0, 0], groceries: [18000, 28000], dining: [5000, 12000], misc: [5000, 10000],
        medical: [1500, 5000], homeHelp: [0, 8000], familySupport: [0, 20000], giving: [0, 5000], other: [0, 8000]
      },
      thresholds: { utilities: 18000, fuel: 10000, transit: 8000, internet: 6000, insurance: 3000, carLoan: 25000, school: 15000, diningFloor: 3000, subsActive: 2500 },
      categoryShare: { housing: 0.30, utilities: 0.14, transport: 0.12, family: 0.35, debt: 0.10, subscriptions: 0.02, care: 0.08, yearly: 0.05 }
    },
    suburban: {
      ranges: {
        income: [220000, 400000], rent: [50000, 90000], homeIns: [0, 2000],
        electricity: [15000, 32000], waterGas: [3000, 8000], internet: [4000, 8000],
        fuel: [18000, 28000], transit: [0, 6000], carIns: [3000, 8000], carLoan: [0, 60000],
        school: [20000, 50000], groceries: [60000, 85000], dining: [8000, 20000], misc: [10000, 18000],
        medical: [5000, 15000], homeHelp: [10000, 30000], familySupport: [0, 30000], giving: [0, 10000], other: [0, 15000]
      },
      thresholds: { utilities: 40000, fuel: 28000, transit: 6000, internet: 8000, insurance: 8000, carLoan: 60000, school: 45000, diningFloor: 5000, subsActive: 3000 },
      categoryShare: { housing: 0.25, utilities: 0.14, transport: 0.15, family: 0.40, debt: 0.10, subscriptions: 0.02, care: 0.12, yearly: 0.06 }
    },
    youngpro: {
      ranges: {
        income: [150000, 300000], rent: [40000, 75000], homeIns: [0, 1500],
        electricity: [10000, 22000], waterGas: [2000, 5000], internet: [4000, 7000],
        fuel: [12000, 22000], transit: [3000, 7000], carIns: [3000, 7000], carLoan: [0, 50000],
        school: [0, 15000], groceries: [25000, 38000], dining: [12000, 28000], misc: [8000, 15000],
        medical: [2000, 7000], homeHelp: [0, 12000], familySupport: [0, 25000], giving: [0, 8000], other: [0, 10000]
      },
      thresholds: { utilities: 27000, fuel: 22000, transit: 7000, internet: 7000, insurance: 6000, carLoan: 50000, school: 15000, diningFloor: 5000, subsActive: 3000 },
      categoryShare: { housing: 0.28, utilities: 0.12, transport: 0.18, family: 0.32, debt: 0.10, subscriptions: 0.02, care: 0.08, yearly: 0.05 }
    }
  },
  samples: {
    single: {
      values: { income: 150000, rent: 35000, homeIns: 0, electricity: 12000, waterGas: 2500, internet: 4500, fuel: 12000, transit: 9000, carIns: 0, carLoan: 0, school: 0, groceries: 30000, dining: 14000, misc: 12000, medical: 2500, homeHelp: 3000, familySupport: 5000, giving: 1500, other: 2000, emergencyFund: 50000 },
      debts: [{ type: 'card', name: 'Credit card', balance: 60000, apr: 38, payment: 5000 }],
      subscriptions: [{ name: 'Netflix', cost: 1100, rarely: false }, { name: 'Spotify', cost: 349, rarely: false }, { name: 'Gym membership', cost: 4000, rarely: true }],
      yearly: [{ name: 'Festivals (Eid, Diwali, Christmas…)', cost: 30000 }],
      extras: [{ name: 'Festival bonus (Eid, Diwali, Christmas…)', amount: 75000 }, { name: 'Overtime', amount: 60000 }]
    },
    // The complete example (see the USD note)
    suburban: {
      values: { income: 400000, rent: 60000, homeIns: 1500, electricity: 36000, waterGas: 6000, internet: 9000, fuel: 32000, transit: 2000, carIns: 6000, carLoan: 35000, school: 35000, groceries: 90000, dining: 15000, misc: 22000, medical: 6000, homeHelp: 15000, familySupport: 20000, giving: 4000, other: 6000, emergencyFund: 150000 },
      debts: [
        { type: 'card', name: 'Credit card', balance: 180000, apr: 40, payment: 12000 },
        { type: 'loan', name: 'Personal loan', balance: 400000, apr: 22, payment: 15000 }
      ],
      subscriptions: [
        { name: 'Netflix', cost: 1100, rarely: false }, { name: 'YouTube Premium', cost: 479, rarely: true },
        { name: 'Microsoft 365', cost: 1800, rarely: false }, { name: 'Google One storage', cost: 650, rarely: false },
        { name: 'Gym membership', cost: 6000, rarely: true }, { name: 'Duolingo', cost: 1500, rarely: true },
        { name: 'Foodpanda Pro', cost: 450, rarely: false }
      ],
      yearly: [{ name: 'Festivals (Eid, Diwali, Christmas…)', cost: 120000 }, { name: 'School books, uniforms and admission', cost: 60000 }, { name: 'Car service and repairs', cost: 40000 }],
      extras: [
        { name: 'Festival bonus (Eid, Diwali, Christmas…)', amount: 200000 }, { name: 'Yearly performance bonus', amount: 400000 },
        { name: 'Overtime', amount: 120000 }, { name: 'Extra work or side jobs', amount: 180000 }
      ]
    },
    youngpro: {
      values: { income: 290000, rent: 60000, homeIns: 0, electricity: 20000, waterGas: 3500, internet: 6500, fuel: 26000, transit: 4000, carIns: 5000, carLoan: 45000, school: 0, groceries: 32000, dining: 34000, misc: 17000, medical: 3000, familySupport: 15000, giving: 2000, other: 4000, emergencyFund: 80000 },
      debts: [{ type: 'card', name: 'Credit card', balance: 120000, apr: 40, payment: 9000 }],
      subscriptions: [{ name: 'Netflix', cost: 1100, rarely: false }, { name: 'Spotify', cost: 349, rarely: false }, { name: 'Cloud storage', cost: 650, rarely: false }, { name: 'Language app', cost: 1200, rarely: true }, { name: 'Gym membership', cost: 7000, rarely: true }],
      yearly: [{ name: 'Festivals (Eid, Diwali, Christmas…)', cost: 40000 }],
      extras: [{ name: 'Yearly performance bonus', amount: 250000 }, { name: 'Extra work or side jobs', amount: 150000 }]
    }
  }
};

// Indian households in a metro or large city (2025–26 price levels).
// Electricity is cheap until the AC runs; cooking gas is LPG; household help
// and money sent home to family are common; credit cards charge about 3.5%
// a month (around 42% a year); car insurance is paid yearly, shown monthly.
const INR = {
  approximate: false,
  costs: { ledKit: 1500, smartThermostat: 8000, tuneup: 800 },
  profiles: {
    single: {
      ranges: {
        income: [50000, 90000], rent: [15000, 30000], homeIns: [0, 500],
        electricity: [1000, 2500], waterGas: [800, 1500], internet: [700, 1500],
        fuel: [2000, 4000], transit: [1500, 4000], carIns: [0, 1500], carLoan: [0, 12000],
        school: [0, 0], groceries: [6000, 10000], dining: [3000, 7000], misc: [3000, 6000],
        medical: [500, 2000], homeHelp: [0, 3000], familySupport: [0, 15000], giving: [0, 2000], other: [0, 4000]
      },
      thresholds: { utilities: 4000, fuel: 4000, transit: 4000, internet: 1500, insurance: 2000, carLoan: 12000, school: 10000, diningFloor: 1500, subsActive: 1200 },
      categoryShare: { housing: 0.30, utilities: 0.06, transport: 0.10, family: 0.30, debt: 0.10, subscriptions: 0.02, care: 0.10, yearly: 0.05 }
    },
    suburban: {
      ranges: {
        income: [120000, 250000], rent: [25000, 50000], homeIns: [0, 1000],
        electricity: [2500, 6000], waterGas: [1200, 2500], internet: [1200, 2500],
        fuel: [5000, 9000], transit: [0, 3000], carIns: [1500, 3500], carLoan: [0, 20000],
        school: [10000, 30000], groceries: [15000, 25000], dining: [4000, 10000], misc: [5000, 10000],
        medical: [2000, 6000], homeHelp: [4000, 12000], familySupport: [0, 20000], giving: [0, 5000], other: [0, 8000]
      },
      thresholds: { utilities: 8500, fuel: 9000, transit: 3000, internet: 2500, insurance: 3500, carLoan: 20000, school: 30000, diningFloor: 2500, subsActive: 1500 },
      categoryShare: { housing: 0.25, utilities: 0.06, transport: 0.12, family: 0.38, debt: 0.10, subscriptions: 0.02, care: 0.12, yearly: 0.06 }
    },
    youngpro: {
      ranges: {
        income: [80000, 160000], rent: [20000, 40000], homeIns: [0, 500],
        electricity: [1500, 3500], waterGas: [800, 1500], internet: [1000, 2000],
        fuel: [3000, 6000], transit: [1500, 4000], carIns: [1000, 2500], carLoan: [0, 15000],
        school: [0, 5000], groceries: [7000, 12000], dining: [6000, 15000], misc: [4000, 8000],
        medical: [800, 3000], homeHelp: [0, 5000], familySupport: [0, 20000], giving: [0, 3000], other: [0, 6000]
      },
      thresholds: { utilities: 5000, fuel: 6000, transit: 4000, internet: 2000, insurance: 2500, carLoan: 15000, school: 5000, diningFloor: 2500, subsActive: 1500 },
      categoryShare: { housing: 0.28, utilities: 0.05, transport: 0.14, family: 0.30, debt: 0.10, subscriptions: 0.02, care: 0.12, yearly: 0.05 }
    }
  },
  samples: {
    single: {
      values: { income: 75000, rent: 22000, homeIns: 0, electricity: 1800, waterGas: 1000, internet: 1600, fuel: 3500, transit: 4200, carIns: 0, carLoan: 0, school: 0, groceries: 9000, dining: 7500, misc: 5500, medical: 1000, homeHelp: 2500, familySupport: 8000, giving: 500, other: 1500, emergencyFund: 60000 },
      debts: [{ type: 'card', name: 'Credit card', balance: 45000, apr: 42, payment: 4000 }],
      subscriptions: [{ name: 'Netflix', cost: 499, rarely: false }, { name: 'Spotify', cost: 139, rarely: false }, { name: 'Gym membership', cost: 2000, rarely: true }],
      yearly: [{ name: 'Festivals (Diwali, Eid, Christmas…)', cost: 25000 }],
      extras: [{ name: 'Festival bonus (Eid, Diwali, Christmas…)', amount: 40000 }, { name: 'Overtime', amount: 30000 }]
    },
    // The complete example (see the USD note)
    suburban: {
      values: { income: 180000, rent: 35000, homeIns: 800, electricity: 5500, waterGas: 2000, internet: 1800, fuel: 9500, transit: 1500, carIns: 2500, carLoan: 15000, school: 22000, groceries: 24000, dining: 9000, misc: 9000, medical: 4000, homeHelp: 9000, familySupport: 10000, giving: 2000, other: 3000, emergencyFund: 200000 },
      debts: [
        { type: 'card', name: 'Credit card', balance: 120000, apr: 42, payment: 10000 },
        { type: 'loan', name: 'Personal loan', balance: 250000, apr: 13, payment: 8000 }
      ],
      subscriptions: [
        { name: 'Netflix', cost: 649, rarely: false }, { name: 'JioHotstar', cost: 299, rarely: true },
        { name: 'Microsoft 365', cost: 489, rarely: false }, { name: 'Google One storage', cost: 130, rarely: false },
        { name: 'Gym membership', cost: 2000, rarely: true }, { name: 'Duolingo', cost: 500, rarely: true },
        { name: 'Swiggy One', cost: 149, rarely: false }
      ],
      yearly: [{ name: 'Festivals (Diwali, Eid, Christmas…)', cost: 60000 }, { name: 'School books, uniforms and admission', cost: 40000 }, { name: 'Car service and repairs', cost: 15000 }],
      extras: [
        { name: 'Festival bonus (Eid, Diwali, Christmas…)', amount: 60000 }, { name: 'Yearly performance bonus', amount: 150000 },
        { name: 'Overtime', amount: 36000 }, { name: 'Extra work or side jobs', amount: 60000 }
      ]
    },
    youngpro: {
      values: { income: 120000, rent: 30000, homeIns: 0, electricity: 2800, waterGas: 1200, internet: 1800, fuel: 6500, transit: 3000, carIns: 1800, carLoan: 12000, school: 0, groceries: 10000, dining: 15000, misc: 7000, medical: 1500, homeHelp: 2500, familySupport: 10000, giving: 1000, other: 2000, emergencyFund: 80000 },
      debts: [{ type: 'card', name: 'Credit card', balance: 80000, apr: 42, payment: 6000 }],
      subscriptions: [{ name: 'Netflix', cost: 499, rarely: false }, { name: 'Spotify', cost: 139, rarely: false }, { name: 'Google One', cost: 130, rarely: false }, { name: 'Language app', cost: 500, rarely: true }, { name: 'Gym membership', cost: 2500, rarely: true }],
      yearly: [{ name: 'Travel and trips home', cost: 30000 }],
      extras: [{ name: 'Yearly performance bonus', amount: 120000 }, { name: 'Extra work or side jobs', amount: 60000 }]
    }
  }
};

export const BENCHMARKS = { USD, PKR, INR };

/** Rough cost-of-living factors, used ONLY for currencies without their own set. */
const FALLBACK_SCALE = { CAD: 1.3, AUD: 1.45, GBP: 0.75, EUR: 0.85, AED: 3 };

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
      subscriptions: s.subscriptions.map((x) => ({ ...x, cost: round(x.cost * k) })),
      yearly: s.yearly.map((x) => ({ ...x, cost: Math.round(x.cost * k) })),
      extras: (s.extras || []).map((x) => ({ ...x, amount: Math.round(x.amount * k) }))
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
    subscriptions: s.subscriptions.map((x) => ({ id: rid('s'), ...x })),
    yearly: s.yearly.map((x) => ({ id: rid('y'), ...x })),
    extras: (s.extras || []).map((x) => ({ id: rid('x'), ...x }))
  };
}

export const newId = rid;
