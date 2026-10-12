// The Smart Savings Engine rule dictionary, written for people with no
// finance background.
//
// Each rule declares:
//   id, category, icon   identity + presentation
//   label                the bill the card is about, in everyday words ("Fuel")
//   noun                 how the bill reads mid-sentence ("fuel")
//   title                the suggested change ("Carpool and combine errands")
//   kind                 'cash' (lowers monthly spending) or 'interest' (interest
//                        avoided on debt; NOT counted as monthly cash savings)
//   pools                which amounts the % applies to. A pool is an input field
//                        or a derived amount ('subsRarely', 'subsActive', 'cardInterest').
//                        Rules sharing a pool apply in order to what is left, so
//                        savings never double-count.
//   when(ctx)            whether the rule fires (profile- and country-aware thresholds)
//   why(ctx)             one line: why this card is shown
//   evidence             start of the "how did we get this?" sentence, e.g.
//                        "People who wait 24 hours before buying usually cut"
//   pct, maxPct          default savings share and slider cap (default 2x, max 100%)
//   effort               'Easy' | 'Medium' | 'Requires purchase'
//   upfront              key into the benchmark `costs`, or fn(ctx) in local currency
//   tips(ctx)            three short action steps, most useful first
//   flag(ctx)            optional warning line
//
// ctx = { v, profile, P, B, income, debts, subs, fmt }
//   v: monthly inputs · P: PROFILES[profile] (name, group) · B: benchmarks for
//   this currency + profile · fmt: currency formatter for sentences.

const HIGH_APR = 15;

export const highAprCards = (debts) =>
  debts.filter((d) => d.type === 'card' && d.apr > HIGH_APR && d.balance > 0);

const typical = (c, amount, threshold, what) =>
  `Shown because your ${what} (${c.fmt(amount)}) is higher than what's typical for ${c.P.group} (${c.fmt(threshold)}).`;

const utilities = (c) => c.v.electricity + c.v.waterGas;

export const RULES = [
  // ---------------- Housing ----------------
  {
    id: 'rent-burden', category: 'Housing', icon: 'key', kind: 'cash',
    label: 'Rent / mortgage', noun: 'rent or mortgage',
    pools: ['rent'],
    when: (c) => c.income > 0 && c.v.rent > 0.35 * c.income,
    pct: (c) => (c.profile === 'suburban' ? 0.05 : 0.15),
    effort: 'Medium', upfront: null,
    title: 'Lower your housing cost',
    why: (c) => `Shown because housing takes ${Math.round((c.v.rent / c.income) * 100)}% of your income. Above 35% makes the rest of your budget tight.`,
    flag: (c) => `Housing takes ${Math.round((c.v.rent / c.income) * 100)}% of your income. Over 35% is a warning sign.`,
    evidence: (c) => (c.profile === 'suburban'
      ? 'Refinancing or appealing your property tax usually trims'
      : 'Renegotiating at renewal or sharing with a roommate usually cuts'),
    tips: (c) => (c.profile === 'suburban'
      ? ['Ask 2–3 banks for a cheaper mortgage rate.', 'Appeal your property tax if similar homes are valued lower.', 'Drop mortgage insurance once you own 20% of the home.']
      : ['Ask your landlord for a discount if you sign a longer lease.', 'Think about a roommate or a smaller place at renewal.', 'Look at other listings 2 months before renewal to compare.'])
  },
  {
    id: 'insurance-requote', category: 'Insurance', icon: 'umbrella', kind: 'cash',
    label: 'Insurance', noun: 'home and car insurance',
    pools: ['homeIns', 'carIns'],
    when: (c) => c.v.homeIns + c.v.carIns > c.B.thresholds.insurance,
    pct: 0.12, effort: 'Easy', upfront: null,
    title: 'Get new insurance quotes every year',
    why: (c) => typical(c, c.v.homeIns + c.v.carIns, c.B.thresholds.insurance, 'insurance'),
    evidence: 'Shopping around every year usually cuts',
    tips: () => ['Get 3 quotes before your policy renews.', 'Put home and car with one insurer for a discount.', 'Choose a higher excess you could pay from savings.']
  },

  // ---------------- Utilities ----------------
  {
    id: 'utilities-efficiency', category: 'Utilities', icon: 'bolt', kind: 'cash',
    label: 'Electricity & gas', noun: 'electricity and gas',
    pools: ['electricity', 'waterGas'],
    when: (c) => utilities(c) > c.B.thresholds.utilities,
    pct: 0.12, effort: 'Easy', upfront: 'ledKit',
    title: 'Small energy-saving habits',
    why: (c) => typical(c, utilities(c), c.B.thresholds.utilities, 'electricity and gas'),
    evidence: 'Turning heating or cooling down at night, switching off standby devices and using LED bulbs usually cuts',
    tips: () => ['Turn heating or AC down a few degrees at night and when you’re out.', 'Switch TVs and chargers off at the wall.', 'Change old bulbs to LED.']
  },
  {
    id: 'smart-thermostat', category: 'Utilities', icon: 'thermometer', kind: 'cash',
    label: 'Electricity & gas', noun: 'electricity and gas',
    pools: ['electricity', 'waterGas'],
    when: (c) => c.profile !== 'single' && utilities(c) > c.B.thresholds.utilities,
    pct: 0.08, effort: 'Requires purchase', upfront: 'smartThermostat',
    title: 'Install a smart thermostat',
    why: (c) => typical(c, utilities(c), c.B.thresholds.utilities, 'electricity and gas'),
    evidence: 'A smart thermostat that turns things down for you usually trims a further',
    tips: () => ['Check if your power company gives money back for one.', 'Turn on the setting that lowers it when everyone leaves.', 'Look at its monthly report and fix the most wasteful days.']
  },
  {
    id: 'utilities-tuneup', category: 'Utilities', icon: 'lightbulb', kind: 'cash',
    label: 'Electricity & gas', noun: 'electricity and gas',
    pools: ['electricity', 'waterGas'],
    when: (c) => utilities(c) > c.B.thresholds.utilities * 0.55 && utilities(c) <= c.B.thresholds.utilities,
    pct: 0.06, effort: 'Easy', upfront: 'tuneup',
    title: 'Quick energy tune-up',
    why: (c) => `Shown because your electricity and gas (${c.fmt(utilities(c))}) is close to typical. A few small fixes still help.`,
    evidence: 'Quick fixes like washing clothes in cold water and a water-saving shower head usually cut',
    tips: () => ['Fit a water-saving shower head.', 'Wash clothes in cold water and only run full loads.', 'Turn the water heater down a little.']
  },
  {
    id: 'internet-renegotiate', category: 'Utilities', icon: 'wifi', kind: 'cash',
    label: 'Internet & phone', noun: 'internet and phone',
    pools: ['internet'],
    when: (c) => c.v.internet > c.B.thresholds.internet,
    pct: 0.20, effort: 'Easy', upfront: null,
    title: 'Ask your provider for a better deal',
    why: (c) => typical(c, c.v.internet, c.B.thresholds.internet, 'internet and phone bill'),
    evidence: 'Calling your provider and asking for a better deal usually cuts',
    tips: () => ['Call and ask for the deal new customers get.', 'Do a speed test. If you use less than half, pick a cheaper plan.', 'Compare prepaid phone plans on the same network.']
  },

  // ---------------- Transport ----------------
  {
    id: 'fuel-carpool', category: 'Transport', icon: 'car', kind: 'cash',
    label: 'Fuel', noun: 'fuel',
    pools: ['fuel'],
    when: (c) => c.profile === 'suburban' && c.v.fuel > c.B.thresholds.fuel,
    pct: 0.15, effort: 'Easy', upfront: null,
    title: 'Carpool and combine errands',
    why: (c) => typical(c, c.v.fuel, c.B.thresholds.fuel, 'fuel bill'),
    evidence: 'Sharing school runs and doing errands in one trip usually cuts',
    tips: () => ['Share school runs with 2 or 3 nearby families.', 'Do all your errands in one trip each week.', 'Check tyre pressure once a month.']
  },
  {
    id: 'fuel-carlight', category: 'Transport', icon: 'bike', kind: 'cash',
    label: 'Fuel', noun: 'fuel',
    pools: ['fuel'],
    when: (c) => c.profile === 'single' && c.v.fuel > c.B.thresholds.fuel,
    pct: 0.20, effort: 'Medium', upfront: null,
    title: 'Use the car less in the city',
    why: (c) => typical(c, c.v.fuel, c.B.thresholds.fuel, 'fuel bill'),
    evidence: 'Walking, cycling or taking public transport for short trips usually cuts',
    tips: () => ['Walk or cycle for trips under 2 km.', 'Use the car only for big weekly shops.', 'Compare your fuel and parking costs with a monthly transport pass.']
  },
  {
    id: 'fuel-hybrid-commute', category: 'Transport', icon: 'laptop', kind: 'cash',
    label: 'Fuel', noun: 'fuel',
    pools: ['fuel'],
    when: (c) => c.profile === 'youngpro' && c.v.fuel > c.B.thresholds.fuel,
    pct: 0.15, effort: 'Medium', upfront: null,
    title: 'Commute fewer days a week',
    why: (c) => typical(c, c.v.fuel, c.B.thresholds.fuel, 'fuel bill'),
    evidence: 'Working from home one or two days a week usually cuts',
    tips: () => ['Ask your manager for 1–2 work-from-home days.', 'Share rides with a colleague who lives nearby.', 'Drive smoothly: gentle starts use less fuel.']
  },
  {
    id: 'transit-pass', category: 'Transport', icon: 'ticket', kind: 'cash',
    label: 'Fares & tolls', noun: 'fares and tolls',
    pools: ['transit'],
    when: (c) => c.v.transit > c.B.thresholds.transit,
    pct: 0.10, effort: 'Easy', upfront: null,
    title: 'Get a monthly pass or toll tag',
    why: (c) => typical(c, c.v.transit, c.B.thresholds.transit, 'fares and tolls'),
    evidence: 'A monthly pass or toll tag usually cuts',
    tips: () => ['Add up last month’s fares and compare with a monthly pass.', 'Get a toll tag for cheaper tolls.', 'Ask your employer if they help pay for travel.']
  },
  {
    id: 'car-refinance', category: 'Transport', icon: 'percent', kind: 'cash',
    label: 'Car loan', noun: 'car loan payment',
    pools: ['carLoan'],
    when: (c) => c.v.carLoan > c.B.thresholds.carLoan,
    pct: 0.10, effort: 'Medium', upfront: null,
    title: 'Look for a cheaper car loan',
    why: (c) => typical(c, c.v.carLoan, c.B.thresholds.carLoan, 'car loan payment'),
    evidence: 'Moving the loan to a lender with a lower interest rate usually cuts',
    tips: () => ['Ask 2–3 banks for their car loan rate.', 'Keep the same number of months left so you don’t pay for longer.', 'Check there’s no fee for paying the old loan off early.']
  },

  // ---------------- Family & Lifestyle ----------------
  {
    id: 'groceries-plan', category: 'Groceries', icon: 'cart', kind: 'cash',
    label: 'Groceries', noun: 'groceries',
    pools: ['groceries'],
    when: (c) => c.v.groceries > c.B.ranges.groceries[1],
    pct: 0.12, effort: 'Easy', upfront: null,
    title: 'Plan meals and buy store brands',
    why: (c) => typical(c, c.v.groceries, c.B.ranges.groceries[1], 'grocery bill'),
    evidence: 'Planning meals and buying store brands usually cuts',
    tips: (c) => [
      'Plan the week’s meals before you shop, and stick to the list.',
      'Buy the shop’s own brand for basics like rice, flour and oil.',
      c.profile === 'suburban' ? 'Buy big packs of things you always use.' : 'Cook extra and freeze portions for later.'
    ]
  },
  {
    id: 'dining-swap', category: 'Eating out', icon: 'utensils', kind: 'cash',
    label: 'Eating out', noun: 'eating out and takeaways',
    pools: ['dining'],
    when: (c) => c.v.dining > c.B.thresholds.diningFloor && c.v.dining > c.v.groceries,
    pct: 0.40, effort: 'Medium', upfront: null,
    title: 'Cook at home more often',
    why: (c) => `Shown because you spend more eating out (${c.fmt(c.v.dining)}) than on groceries (${c.fmt(c.v.groceries)}).`,
    evidence: 'Cooking at home a few more nights a week usually cuts',
    tips: () => ['Swap 2 takeaway nights a week for quick home meals.', 'Take lunch to work on weekdays.', 'Keep eating out for special occasions.']
  },
  {
    id: 'impulse-24h', category: 'Shopping', icon: 'hourglass', kind: 'cash',
    label: 'Impulse shopping', noun: 'random purchases',
    pools: ['misc'],
    when: (c) => c.v.misc > c.B.ranges.misc[1],
    pct: 0.25, effort: 'Easy', upfront: null,
    title: 'Wait 24 hours before you buy',
    why: (c) => typical(c, c.v.misc, c.B.ranges.misc[1], 'impulse shopping'),
    evidence: 'People who wait 24 hours before buying usually cut',
    tips: () => ['Wait a day before buying anything you don’t need.', 'Remove saved card details from shopping apps.', 'Turn off shop notifications and sale emails.']
  },
  {
    id: 'school-discounts', category: 'Family', icon: 'school', kind: 'cash',
    label: 'School fees & childcare', noun: 'school fees and childcare',
    pools: ['school'],
    when: (c) => c.v.school > c.B.thresholds.school,
    pct: 0.08, effort: 'Easy', upfront: null,
    title: 'Ask about school discounts',
    why: (c) => typical(c, c.v.school, c.B.thresholds.school, 'school and childcare costs'),
    evidence: 'Asking for sibling or pay-early discounts usually saves',
    tips: () => ['Ask the school about discounts for brothers and sisters.', 'Ask if paying for the year up front costs less.', 'Buy uniforms and books second-hand.']
  },

  // ---------------- Subscriptions ----------------
  {
    id: 'subs-cancel-unused', category: 'Subscriptions', icon: 'repeat', kind: 'cash',
    label: 'Unused subscriptions', noun: 'subscriptions you rarely use',
    pools: ['subsRarely'],
    when: (c) => c.subs.some((s) => s.rarely && s.cost > 0),
    pct: 1, maxPct: 1, effort: 'Easy', upfront: null,
    title: 'Cancel what you rarely use',
    why: (c) => {
      const names = c.subs.filter((s) => s.rarely && s.cost > 0).map((s) => s.name || 'Unnamed');
      return `Shown because you said you rarely use: ${names.join(', ')}.`;
    },
    evidence: 'Cancelling them saves',
    tips: () => ['Cancel them today. You can usually sign up again later.', 'Look at your bank statement for free trials that became paid.', 'Set a reminder 2 days before any new free trial ends.']
  },
  {
    id: 'subs-rotate', category: 'Subscriptions', icon: 'tv', kind: 'cash',
    label: 'Subscriptions', noun: 'subscriptions you use',
    pools: ['subsActive'],
    when: (c) => c.subs.filter((s) => !s.rarely).reduce((a, s) => a + s.cost, 0) > c.B.thresholds.subsActive,
    pct: 0.30, effort: 'Easy', upfront: null,
    title: 'Keep one streaming service at a time',
    why: (c) => typical(c, c.subs.filter((s) => !s.rarely).reduce((a, s) => a + s.cost, 0), c.B.thresholds.subsActive, 'subscriptions'),
    evidence: 'Keeping one service at a time and choosing cheaper plans usually cuts',
    tips: () => ['Keep one streaming service, then switch next month.', 'Choose the plan with ads, or pay yearly if it’s cheaper.', 'Share a family plan with people in your home.']
  },

  // ---------------- Debt ----------------
  {
    id: 'debt-avalanche', category: 'Debt', icon: 'card', kind: 'interest',
    label: 'Credit card interest', noun: 'credit card interest',
    pools: ['cardInterest'],
    when: (c) => highAprCards(c.debts).length > 0,
    pct: 0.75, maxPct: 1, effort: 'Medium',
    // A 0% balance-transfer card typically charges a one-off 3% fee
    upfront: (c) => highAprCards(c.debts).reduce((a, d) => a + d.balance, 0) * 0.03,
    title: 'Move the balance to a 0% card',
    why: (c) => {
      const top = [...highAprCards(c.debts)].sort((a, b) => b.apr - a.apr)[0];
      return `Shown because ${top.name || 'a card'} charges ${top.apr}% interest a year, which is expensive.`;
    },
    flag: (c) => {
      const top = [...highAprCards(c.debts)].sort((a, b) => b.apr - a.apr)[0];
      return `${top.name || 'A card'} charges ${top.apr}% a year in interest.`;
    },
    evidence: 'Moving the balance to a card with 0% interest for a while usually avoids',
    tips: (c) => {
      const order = [...c.debts].filter((d) => d.balance > 0).sort((a, b) => b.apr - a.apr).map((d) => `${d.name || 'Debt'} (${d.apr}%)`);
      return [
        'Ask your bank about a card with 0% interest on moved balances (usually a 3% fee).',
        `Pay the highest-interest loan first: ${order.join(' → ')}.`,
        'Keep paying at least the minimum on everything else.'
      ];
    }
  }
];

export const EFFORT_ORDER = { Easy: 0, Medium: 1, 'Requires purchase': 2 };
export const EFFORT_LABEL = { Easy: 'Easy', Medium: 'Takes some effort', 'Requires purchase': 'Needs a purchase' };
