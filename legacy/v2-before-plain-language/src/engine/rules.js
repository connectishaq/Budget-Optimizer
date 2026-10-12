// The Smart Savings Engine rule dictionary.
//
// Each rule declares:
//   id, category, icon         identity + presentation
//   pools                      which amounts the savings % applies to. A pool is
//                              an input field (e.g. 'fuel') or a derived amount
//                              ('subsRarely', 'subsActive', 'cardInterest').
//                              Rules that share a pool apply in order to what is
//                              left, so savings never double-count.
//   when(ctx)                  whether the rule fires (profile-aware thresholds)
//   pct                        default savings % (number or fn(ctx))
//   maxPct                     optional cap for the adjustable slider (default 2x pct, max 100%)
//   effort                     'Easy' | 'Medium' | 'Requires purchase'
//   upfront                    one-off cost in USD (scaled to currency) or fn(ctx) in local currency
//   title, description(ctx), tips(ctx)
//   flag(ctx)                  optional warning shown on the card (e.g. rent burden)
//
// ctx = { v, profile, P, k, income, debts, subs, fmt }
//   v: monthly input values, P: PROFILES[profile], k: currency benchmark scale,
//   fmt: currency formatter for descriptions.

const HIGH_APR = 15;

export const highAprCards = (debts) =>
  debts.filter((d) => d.type === 'card' && d.apr > HIGH_APR && d.balance > 0);

export const RULES = [
  // ---------------- Housing ----------------
  {
    id: 'rent-burden',
    category: 'Housing', icon: 'key',
    pools: ['rent'],
    when: (c) => c.income > 0 && c.v.rent > 0.35 * c.income,
    pct: (c) => (c.profile === 'suburban' ? 0.05 : 0.15),
    effort: 'Medium', upfront: 0,
    title: 'Reduce Your Housing Burden',
    flag: (c) => `Housing takes ${Math.round((c.v.rent / c.income) * 100)}% of income, above the 35% danger line.`,
    description: (c) =>
      c.profile === 'suburban'
        ? `Your rent/mortgage of ${c.fmt(c.v.rent)} is over 35% of take-home pay. Small structural changes add up here.`
        : `At ${c.fmt(c.v.rent)}, rent is over 35% of take-home pay. A roommate or renegotiation is the single biggest lever you have.`,
    tips: (c) =>
      c.profile === 'suburban'
        ? [
            'Get refinance quotes if your mortgage rate is 1%+ above current rates.',
            'Appeal your property tax assessment. Many appeals succeed with comparable sales.',
            'Remove private mortgage insurance (PMI) once you reach 20% equity.'
          ]
        : [
            'Ask your landlord for a renewal discount in exchange for a longer lease.',
            'Consider a roommate or a smaller unit at your next renewal.',
            'Compare listings 60 days before renewal. Use them as negotiating leverage.'
          ]
  },
  {
    id: 'insurance-requote',
    category: 'Insurance', icon: 'umbrella',
    pools: ['homeIns', 'carIns'],
    when: (c) => c.v.homeIns + c.v.carIns > 100 * c.k,
    pct: 0.12,
    effort: 'Easy', upfront: 0,
    title: 'Annual Insurance Re-Quote',
    description: (c) => `You pay ${c.fmt(c.v.homeIns + c.v.carIns)}/mo for home and car insurance. Loyalty rarely gets rewarded in insurance pricing.`,
    tips: () => [
      'Get 3 quotes every year before renewal. Comparison sites take 15 minutes.',
      'Bundle home and auto with one insurer for a multi-policy discount.',
      'Raise deductibles to a level your emergency fund can cover.'
    ]
  },

  // ---------------- Utilities ----------------
  {
    id: 'utilities-efficiency',
    category: 'Utilities', icon: 'bolt',
    pools: ['electricity', 'waterGas'],
    when: (c) => c.v.electricity + c.v.waterGas > c.P.utilityThreshold * c.k,
    pct: 0.12,
    effort: 'Easy', upfront: 40,
    title: 'Thermostat Schedule, Phantom Load Audit & LEDs',
    description: (c) => `Electricity + water/gas of ${c.fmt(c.v.electricity + c.v.waterGas)} is above the ${c.fmt(c.P.utilityThreshold * c.k)} benchmark for your profile.`,
    tips: () => [
      'Set the thermostat 7–10°F (4–6°C) back for 8 hours a day while asleep or away.',
      'Put TVs, consoles and chargers on smart power strips to kill standby drain.',
      'Swap remaining incandescent or halogen bulbs for LEDs (up to 75% less energy).'
    ]
  },
  {
    id: 'smart-thermostat',
    category: 'Utilities', icon: 'thermometer',
    pools: ['electricity', 'waterGas'],
    when: (c) => c.profile !== 'single' && c.v.electricity + c.v.waterGas > c.P.utilityThreshold * c.k,
    pct: 0.08,
    effort: 'Requires purchase', upfront: 130,
    title: 'Install a Smart Thermostat',
    description: () => 'A learning thermostat automates setbacks and adapts to your routine, adding savings on top of manual changes.',
    tips: () => [
      'Check your utility’s rebate program. Many cover $50–$100 of the cost.',
      'Enable geofencing so heating/cooling eases off when everyone leaves.',
      'Review the monthly energy report and trim the biggest run-time days.'
    ]
  },
  {
    id: 'utilities-tuneup',
    category: 'Utilities', icon: 'lightbulb',
    pools: ['electricity', 'waterGas'],
    when: (c) => {
      const u = c.v.electricity + c.v.waterGas;
      const t = c.P.utilityThreshold * c.k;
      return u > t * 0.55 && u <= t;
    },
    pct: 0.06,
    effort: 'Easy', upfront: 15,
    title: 'Quick Utility Tune-Up',
    description: (c) => `Your utilities (${c.fmt(c.v.electricity + c.v.waterGas)}) are in a healthy range, but a few small tweaks still pay off.`,
    tips: () => [
      'Install a low-flow showerhead (often free from your water utility).',
      'Wash laundry in cold water and run full loads only.',
      'Set the water heater to 120°F (49°C).'
    ]
  },
  {
    id: 'internet-renegotiate',
    category: 'Utilities', icon: 'wifi',
    pools: ['internet'],
    when: (c) => c.v.internet > 80 * c.k,
    pct: 0.20,
    effort: 'Easy', upfront: 0,
    title: 'Renegotiate Internet & Phone',
    description: (c) => `At ${c.fmt(c.v.internet)}/mo, internet/phone is above the ${c.fmt(80 * c.k)} typical benchmark.`,
    tips: () => [
      'Call the retention department and ask for the current new-customer rate.',
      'Run a speed test. If you use under half your bandwidth, drop a tier.',
      'Switch phone lines to a prepaid or MVNO plan on the same network.'
    ]
  },

  // ---------------- Transport ----------------
  {
    id: 'fuel-carpool',
    category: 'Transport', icon: 'car',
    pools: ['fuel'],
    when: (c) => c.profile === 'suburban' && c.v.fuel > 200 * c.k,
    pct: 0.15,
    effort: 'Easy', upfront: 0,
    title: 'Carpool & Batch Your Errands',
    description: (c) => `Fuel at ${c.fmt(c.v.fuel)} is above the ${c.fmt(200 * c.k)} benchmark for suburban families.`,
    tips: () => [
      'Set up a rotating school-run carpool with two or three nearby families.',
      'Batch errands into one weekly loop instead of several cold-engine trips.',
      'Keep tires inflated correctly. It improves fuel economy by up to 3%.'
    ]
  },
  {
    id: 'fuel-carlight',
    category: 'Transport', icon: 'bike',
    pools: ['fuel'],
    when: (c) => c.profile === 'single' && c.v.fuel > 120 * c.k,
    pct: 0.20,
    effort: 'Medium', upfront: 0,
    title: 'Go Car-Light in the City',
    description: (c) => `As a city renter, ${c.fmt(c.v.fuel)}/mo on fuel suggests trips that transit, bike-share or walking could cover.`,
    tips: () => [
      'Swap trips under 2 miles (3 km) for walking, bike-share or e-scooters.',
      'Keep the car for weekend bulk errands, and use car-share for the rest.',
      'Compare parking + fuel costs with an unlimited monthly transit pass.'
    ]
  },
  {
    id: 'fuel-hybrid-commute',
    category: 'Transport', icon: 'laptop',
    pools: ['fuel'],
    when: (c) => c.profile === 'youngpro' && c.v.fuel > 150 * c.k,
    pct: 0.15,
    effort: 'Medium', upfront: 0,
    title: 'Hybrid Commute Strategy',
    description: (c) => `Commuting fuel of ${c.fmt(c.v.fuel)}/mo can be trimmed with a smarter work-week pattern.`,
    tips: () => [
      'Negotiate one or two remote days per week. Each cuts commute fuel about 20%.',
      'Join a workplace carpool or vanpool (many employers subsidize them).',
      'Drive smoothly: gentle acceleration can boost mileage 10–15%.'
    ]
  },
  {
    id: 'transit-pass',
    category: 'Transport', icon: 'ticket',
    pools: ['transit'],
    when: (c) => c.v.transit > (c.profile === 'single' ? 130 : 100) * c.k,
    pct: 0.10,
    effort: 'Easy', upfront: 0,
    title: 'Transit Pass & Toll Discounts',
    description: (c) => `${c.fmt(c.v.transit)}/mo on transit and tolls suggests you're paying per ride or full-price tolls.`,
    tips: () => [
      'Compare per-ride costs with an unlimited monthly or annual pass.',
      'Use a toll transponder for discounted rates. Travel off-peak when possible.',
      'Ask your employer about pre-tax commuter benefits.'
    ]
  },
  {
    id: 'car-refinance',
    category: 'Transport', icon: 'percent',
    pools: ['carLoan'],
    when: (c) => c.v.carLoan > 350 * c.k,
    pct: 0.10,
    effort: 'Medium', upfront: 0,
    title: 'Refinance Your Car Loan',
    description: (c) => `A ${c.fmt(c.v.carLoan)}/mo car payment is worth re-pricing, especially if your credit has improved since you bought.`,
    tips: () => [
      'Get rate quotes from a credit union. They often beat dealer financing.',
      'Keep the same remaining term so you lower the payment without extending debt.',
      'Check for prepayment penalties before switching lenders.'
    ]
  },

  // ---------------- Family & Lifestyle ----------------
  {
    id: 'groceries-plan',
    category: 'Groceries', icon: 'cart',
    pools: ['groceries'],
    when: (c) => c.v.groceries > c.P.ranges.groceries[1] * c.k,
    pct: 0.12,
    effort: 'Easy', upfront: 0,
    title: 'Meal Planning & Store-Brand Swaps',
    description: (c) => `Groceries of ${c.fmt(c.v.groceries)} exceed the ${c.fmt(c.P.ranges.groceries[1] * c.k)} benchmark for a ${c.P.name}.`,
    tips: (c) => [
      'Plan the week’s meals around what’s already in the fridge before making a list.',
      'Switch staples to store brands. They’re often 20–30% cheaper.',
      c.profile === 'suburban'
        ? 'Buy family-size staples (rice, oats, frozen veg) at a warehouse club.'
        : 'Cook in batches and freeze single portions to cut waste.'
    ]
  },
  {
    id: 'dining-swap',
    category: 'Dining', icon: 'utensils',
    pools: ['dining'],
    when: (c) => c.v.dining > 50 * c.k && c.v.dining > c.v.groceries,
    pct: 0.40,
    effort: 'Medium', upfront: 0,
    title: 'Cook-at-Home Swap',
    description: (c) => `You spend more on dining out (${c.fmt(c.v.dining)}) than on groceries (${c.fmt(c.v.groceries)}). Swapping a few meals makes a big difference.`,
    tips: () => [
      'Replace two takeout nights a week with 20-minute home recipes.',
      'Meal-prep lunches on Sunday instead of buying them on workdays.',
      'Keep restaurant meals for occasions, not convenience.'
    ]
  },
  {
    id: 'impulse-24h',
    category: 'Lifestyle', icon: 'hourglass',
    pools: ['misc'],
    when: (c) => c.v.misc > c.P.ranges.misc[1] * c.k,
    pct: 0.25,
    effort: 'Easy', upfront: 0,
    title: 'The 24-Hour Rule & Streaming Rotation',
    description: (c) => `Miscellaneous/impulse spending of ${c.fmt(c.v.misc)} is above the ${c.fmt(c.P.ranges.misc[1] * c.k)} comfort zone for your profile.`,
    tips: () => [
      'Wait 24 hours before any non-essential purchase. Most urges fade.',
      'Rotate streaming services: keep one at a time and cancel after you finish a show.',
      'Delete saved card details from shopping apps to add healthy friction.'
    ]
  },
  {
    id: 'school-discounts',
    category: 'Family', icon: 'school',
    pools: ['school'],
    when: (c) => c.v.school > 200 * c.k,
    pct: 0.08,
    effort: 'Easy', upfront: 0,
    title: 'School & Childcare Discounts',
    description: (c) => `School fees/childcare of ${c.fmt(c.v.school)}/mo leave room for discounts many families don’t claim.`,
    tips: () => [
      'Ask about sibling discounts and annual-prepayment discounts.',
      'Buy uniforms, books and gear through school resale or swap groups.',
      'Use tax-advantaged childcare accounts or credits where available.'
    ]
  },

  // ---------------- Subscriptions ----------------
  {
    id: 'subs-cancel-unused',
    category: 'Subscriptions', icon: 'repeat',
    pools: ['subsRarely'],
    when: (c) => c.subs.some((s) => s.rarely && s.cost > 0),
    pct: 1, maxPct: 1,
    effort: 'Easy', upfront: 0,
    title: 'Cancel Subscriptions You Rarely Use',
    description: (c) => {
      const names = c.subs.filter((s) => s.rarely && s.cost > 0).map((s) => s.name || 'Unnamed');
      return `You marked ${names.length} subscription${names.length > 1 ? 's' : ''} as rarely used: ${names.join(', ')}.`;
    },
    tips: () => [
      'Cancel today. Most services let you resubscribe in one click later.',
      'Check your card statement for forgotten free trials that became paid plans.',
      'Set a calendar reminder 2 days before any new trial ends.'
    ]
  },
  {
    id: 'subs-rotate',
    category: 'Subscriptions', icon: 'tv',
    pools: ['subsActive'],
    when: (c) => c.subs.filter((s) => !s.rarely).reduce((a, s) => a + s.cost, 0) > 45 * c.k,
    pct: 0.30,
    effort: 'Easy', upfront: 0,
    title: 'Rotate & Downgrade Active Subscriptions',
    description: (c) => `Your active subscriptions total ${c.fmt(c.subs.filter((s) => !s.rarely).reduce((a, s) => a + s.cost, 0))}/mo.`,
    tips: () => [
      'Keep one streaming service at a time and rotate monthly.',
      'Switch to ad-supported tiers or annual billing (often 15–20% cheaper).',
      'Share family plans with your household where the terms allow.'
    ]
  },

  // ---------------- Debt ----------------
  {
    id: 'debt-avalanche',
    category: 'Debt', icon: 'card',
    pools: ['cardInterest'],
    when: (c) => highAprCards(c.debts).length > 0,
    pct: 0.75, maxPct: 1,
    effort: 'Medium',
    // Typical 3% balance-transfer fee on the high-APR balances
    upfront: (c) => highAprCards(c.debts).reduce((a, d) => a + d.balance, 0) * 0.03,
    title: 'Balance Transfer + Avalanche Payoff',
    flag: (c) => {
      const top = [...highAprCards(c.debts)].sort((a, b) => b.apr - a.apr)[0];
      return `${top.name || 'A card'} charges ${top.apr}% APR.`;
    },
    description: (c) => {
      const interest = highAprCards(c.debts).reduce((a, d) => a + (d.balance * d.apr) / 1200, 0);
      return `High-APR cards are costing you about ${c.fmt(interest)}/mo in interest. A 0% balance transfer stops most of it while you pay down principal.`;
    },
    tips: (c) => {
      const order = [...c.debts].filter((d) => d.balance > 0).sort((a, b) => b.apr - a.apr).map((d) => `${d.name || 'Debt'} (${d.apr}%)`);
      return [
        'Move high-APR balances to a 0% intro card (typically a 3% fee).',
        `Avalanche order (highest APR first): ${order.join(' → ')}.`,
        'Pay minimums on everything else and every extra dollar to the top of the list.'
      ];
    }
  }
];

export const EFFORT_ORDER = { Easy: 0, Medium: 1, 'Requires purchase': 2 };
