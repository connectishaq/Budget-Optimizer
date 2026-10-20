// The Smart Savings Engine rule dictionary, written for people with no
// finance background.
//
// Each rule declares:
//   id, category, icon   identity + presentation
//   label                the bill the card is about, in everyday words ("Fuel")
//   noun                 how the bill reads mid-sentence ("fuel")
//   title                the suggested change ("Carpool and combine errands"), or fn(ctx)
//   kind                 'cash' (lowers monthly spending) or 'interest' (interest
//                        avoided on debt; NOT counted as monthly cash savings)
//   pools                which amounts the % applies to. A pool is an input field
//                        or a derived amount ('subsRarely', 'subsStreaming', 'subsTools', 'cardInterest').
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
// ctx = { v, profile, P, B, C, country, currency, income, debts, subs, fmt }
//   v: monthly inputs · P: PROFILES[profile] (name, group) · B: benchmarks for
//   this country + profile · C: the country's data file (src/data/countries) ·
//   fmt: currency formatter for sentences. Rules listed in C.hideRules never run.
//
// Text is looked up in the "rules" messages when read (getters and functions),
// so it follows the active language.

import { t, has } from '../i18n/index.js';

const HIGH_APR = 15;

export const highAprCards = (debts) =>
  debts.filter((d) => d.type === 'card' && d.apr > HIGH_APR && d.balance > 0);

const typical = (c, amount, threshold, key) =>
  t(key, { amount: c.fmt(amount), group: c.P.group, threshold: c.fmt(threshold) });

const utilities = (c) => c.v.electricity + c.v.waterGas;
// Subscriptions still in use, of one type
const activeSubs = (c, kind) => c.subs.filter((s) => !s.rarely && s.kind === kind).reduce((a, s) => a + s.cost, 0);

// South Asian households get ideas that fit local bills: slab-based
// electricity tariffs, prepaid mobile bundles, few 0% balance-transfer cards.
const SOUTH_ASIA = ['PK', 'IN'];
export const isLocal = (c) => SOUTH_ASIA.includes(c.country);

export const RULES = [
  // ---------------- Housing ----------------
  {
    id: 'rent-burden', category: 'Housing', icon: 'key', kind: 'cash',
    get label() { return t('rules.rentBurden.label'); },
    get noun() { return t('rules.rentBurden.noun'); },
    pools: ['rent'],
    when: (c) => c.income > 0 && c.v.rent > 0.35 * c.income,
    pct: (c) => (c.profile === 'suburban' ? 0.05 : 0.15),
    effort: 'Medium', upfront: null,
    get title() { return t('rules.rentBurden.title'); },
    why: (c) => t('rules.rentBurden.why', { pct: Math.round((c.v.rent / c.income) * 100) }),
    flag: (c) => t('rules.rentBurden.flag', { pct: Math.round((c.v.rent / c.income) * 100) }),
    evidence: (c) => (c.profile === 'suburban'
      ? t('rules.rentBurden.evidenceOwner')
      : t('rules.rentBurden.evidenceRenter')),
    tips: (c) => (c.profile === 'suburban'
      ? [t('rules.rentBurden.tips.ownerRate'), t('rules.rentBurden.tips.ownerTax'), t('rules.rentBurden.tips.ownerInsurance')]
      : [t('rules.rentBurden.tips.renterLease'), t('rules.rentBurden.tips.renterRoommate'), t('rules.rentBurden.tips.renterCompare')])
  },
  {
    id: 'insurance-requote', category: 'Insurance', icon: 'umbrella', kind: 'cash',
    get label() { return t('rules.insuranceRequote.label'); },
    get noun() { return t('rules.insuranceRequote.noun'); },
    pools: ['homeIns', 'carIns'],
    when: (c) => c.v.homeIns + c.v.carIns > c.B.thresholds.insurance,
    pct: 0.12, effort: 'Easy', upfront: null,
    get title() { return t('rules.insuranceRequote.title'); },
    why: (c) => typical(c, c.v.homeIns + c.v.carIns, c.B.thresholds.insurance, 'rules.insuranceRequote.why'),
    get evidence() { return t('rules.insuranceRequote.evidence'); },
    tips: () => [t('rules.insuranceRequote.tips.quotes'), t('rules.insuranceRequote.tips.bundle'), t('rules.insuranceRequote.tips.excess')]
  },

  // ---------------- Utilities ----------------
  {
    id: 'utilities-efficiency', category: 'Utilities', icon: 'bolt', kind: 'cash',
    get label() { return t('rules.utilitiesEfficiency.label'); },
    get noun() { return t('rules.utilitiesEfficiency.noun'); },
    pools: ['electricity', 'waterGas'],
    when: (c) => utilities(c) > c.B.thresholds.utilities,
    pct: 0.12, effort: 'Easy', upfront: 'ledKit',
    get title() { return t('rules.utilitiesEfficiency.title'); },
    why: (c) => typical(c, utilities(c), c.B.thresholds.utilities, 'rules.utilitiesEfficiency.why'),
    get evidence() { return t('rules.utilitiesEfficiency.evidence'); },
    tips: () => [t('rules.utilitiesEfficiency.tips.night'), t('rules.utilitiesEfficiency.tips.standby'), t('rules.utilitiesEfficiency.tips.led')]
  },
  {
    id: 'smart-thermostat', category: 'Utilities', icon: 'thermometer', kind: 'cash',
    get label() { return t('rules.smartThermostat.label'); },
    get noun() { return t('rules.smartThermostat.noun'); },
    pools: ['electricity', 'waterGas'],
    when: (c) => !isLocal(c) && c.profile !== 'single' && utilities(c) > c.B.thresholds.utilities,
    pct: 0.08, effort: 'Requires purchase', upfront: 'smartThermostat',
    get title() { return t('rules.smartThermostat.title'); },
    why: (c) => typical(c, utilities(c), c.B.thresholds.utilities, 'rules.smartThermostat.why'),
    get evidence() { return t('rules.smartThermostat.evidence'); },
    tips: () => [t('rules.smartThermostat.tips.rebate'), t('rules.smartThermostat.tips.away'), t('rules.smartThermostat.tips.report')]
  },
  {
    id: 'electricity-slab', category: 'Utilities', icon: 'bolt', kind: 'cash',
    get label() { return t('rules.electricitySlab.label'); },
    get noun() { return t('rules.electricitySlab.noun'); },
    pools: ['electricity'],
    when: (c) => isLocal(c) && c.v.electricity > c.B.ranges.electricity[1],
    pct: 0.15, effort: 'Easy', upfront: null,
    get title() { return t('rules.electricitySlab.title'); },
    why: (c) => typical(c, c.v.electricity, c.B.ranges.electricity[1], 'rules.electricitySlab.why'),
    get evidence() { return t('rules.electricitySlab.evidence'); },
    tips: () => [
      t('rules.electricitySlab.tips.units'),
      t('rules.electricitySlab.tips.ac'),
      t('rules.electricitySlab.tips.peak')
    ]
  },
  {
    id: 'utilities-tuneup', category: 'Utilities', icon: 'lightbulb', kind: 'cash',
    get label() { return t('rules.utilitiesTuneup.label'); },
    get noun() { return t('rules.utilitiesTuneup.noun'); },
    pools: ['electricity', 'waterGas'],
    when: (c) => utilities(c) > c.B.thresholds.utilities * 0.55 && utilities(c) <= c.B.thresholds.utilities,
    pct: 0.06, effort: 'Easy', upfront: 'tuneup',
    get title() { return t('rules.utilitiesTuneup.title'); },
    why: (c) => t('rules.utilitiesTuneup.why', { amount: c.fmt(utilities(c)) }),
    get evidence() { return t('rules.utilitiesTuneup.evidence'); },
    tips: () => [t('rules.utilitiesTuneup.tips.shower'), t('rules.utilitiesTuneup.tips.cold'), t('rules.utilitiesTuneup.tips.heater')]
  },
  {
    id: 'internet-renegotiate', category: 'Utilities', icon: 'wifi', kind: 'cash',
    get label() { return t('rules.internetRenegotiate.label'); },
    get noun() { return t('rules.internetRenegotiate.noun'); },
    pools: ['internet'],
    when: (c) => c.v.internet > c.B.thresholds.internet,
    pct: 0.20, effort: 'Easy', upfront: null,
    get title() { return t('rules.internetRenegotiate.title'); },
    why: (c) => typical(c, c.v.internet, c.B.thresholds.internet, 'rules.internetRenegotiate.why'),
    get evidence() { return t('rules.internetRenegotiate.evidence'); },
    tips: (c) => (isLocal(c)
      ? [t('rules.internetRenegotiate.tips.localBundle'), t('rules.internetRenegotiate.tips.localWifi'), t('rules.internetRenegotiate.tips.localPackage')]
      : [t('rules.internetRenegotiate.tips.newCustomer'), t('rules.internetRenegotiate.tips.speedTest'), t('rules.internetRenegotiate.tips.prepaid')])
  },

  // ---------------- Transport ----------------
  {
    id: 'fuel-carpool', category: 'Transport', icon: 'car', kind: 'cash',
    get label() { return t('rules.fuelCarpool.label'); },
    get noun() { return t('rules.fuelCarpool.noun'); },
    pools: ['fuel'],
    when: (c) => c.profile === 'suburban' && c.v.fuel > c.B.thresholds.fuel,
    pct: 0.15, effort: 'Easy', upfront: null,
    get title() { return t('rules.fuelCarpool.title'); },
    why: (c) => typical(c, c.v.fuel, c.B.thresholds.fuel, 'rules.fuelCarpool.why'),
    get evidence() { return t('rules.fuelCarpool.evidence'); },
    tips: () => [t('rules.fuelCarpool.tips.schoolRuns'), t('rules.fuelCarpool.tips.errands'), t('rules.fuelCarpool.tips.tyres')]
  },
  {
    id: 'fuel-carlight', category: 'Transport', icon: 'bike', kind: 'cash',
    get label() { return t('rules.fuelCarlight.label'); },
    get noun() { return t('rules.fuelCarlight.noun'); },
    pools: ['fuel'],
    when: (c) => c.profile === 'single' && c.v.fuel > c.B.thresholds.fuel,
    pct: 0.20, effort: 'Medium', upfront: null,
    get title() { return t('rules.fuelCarlight.title'); },
    why: (c) => typical(c, c.v.fuel, c.B.thresholds.fuel, 'rules.fuelCarlight.why'),
    get evidence() { return t('rules.fuelCarlight.evidence'); },
    tips: () => [t('rules.fuelCarlight.tips.walk'), t('rules.fuelCarlight.tips.bigShops'), t('rules.fuelCarlight.tips.pass')]
  },
  {
    id: 'fuel-hybrid-commute', category: 'Transport', icon: 'laptop', kind: 'cash',
    get label() { return t('rules.fuelHybridCommute.label'); },
    get noun() { return t('rules.fuelHybridCommute.noun'); },
    pools: ['fuel'],
    when: (c) => c.profile === 'youngpro' && c.v.fuel > c.B.thresholds.fuel,
    pct: 0.15, effort: 'Medium', upfront: null,
    get title() { return t('rules.fuelHybridCommute.title'); },
    why: (c) => typical(c, c.v.fuel, c.B.thresholds.fuel, 'rules.fuelHybridCommute.why'),
    get evidence() { return t('rules.fuelHybridCommute.evidence'); },
    tips: () => [t('rules.fuelHybridCommute.tips.wfh'), t('rules.fuelHybridCommute.tips.share'), t('rules.fuelHybridCommute.tips.smooth')]
  },
  {
    id: 'transit-pass', category: 'Transport', icon: 'ticket', kind: 'cash',
    get label() { return t('rules.transitPass.label'); },
    get noun() { return t('rules.transitPass.noun'); },
    pools: ['transit'],
    when: (c) => c.v.transit > c.B.thresholds.transit,
    pct: 0.10, effort: 'Easy', upfront: null,
    get title() { return t('rules.transitPass.title'); },
    why: (c) => typical(c, c.v.transit, c.B.thresholds.transit, 'rules.transitPass.why'),
    get evidence() { return t('rules.transitPass.evidence'); },
    tips: () => [t('rules.transitPass.tips.compare'), t('rules.transitPass.tips.tollTag'), t('rules.transitPass.tips.employer')]
  },
  {
    id: 'car-refinance', category: 'Transport', icon: 'percent', kind: 'cash',
    get label() { return t('rules.carRefinance.label'); },
    get noun() { return t('rules.carRefinance.noun'); },
    pools: ['carLoan'],
    when: (c) => c.v.carLoan > c.B.thresholds.carLoan,
    pct: 0.10, effort: 'Medium', upfront: null,
    get title() { return t('rules.carRefinance.title'); },
    why: (c) => typical(c, c.v.carLoan, c.B.thresholds.carLoan, 'rules.carRefinance.why'),
    get evidence() { return t('rules.carRefinance.evidence'); },
    tips: () => [t('rules.carRefinance.tips.banks'), t('rules.carRefinance.tips.term'), t('rules.carRefinance.tips.fee')]
  },

  // ---------------- Family & Lifestyle ----------------
  {
    id: 'groceries-plan', category: 'Groceries', icon: 'cart', kind: 'cash',
    get label() { return t('rules.groceriesPlan.label'); },
    get noun() { return t('rules.groceriesPlan.noun'); },
    pools: ['groceries'],
    when: (c) => c.v.groceries > c.B.ranges.groceries[1],
    pct: 0.12, effort: 'Easy', upfront: null,
    get title() { return t('rules.groceriesPlan.title'); },
    why: (c) => typical(c, c.v.groceries, c.B.ranges.groceries[1], 'rules.groceriesPlan.why'),
    get evidence() { return t('rules.groceriesPlan.evidence'); },
    tips: (c) => [
      t('rules.groceriesPlan.tips.plan'),
      isLocal(c)
        ? t('rules.groceriesPlan.tips.localBulk')
        : t('rules.groceriesPlan.tips.storeBrand'),
      c.profile === 'suburban' ? t('rules.groceriesPlan.tips.bigPacks') : t('rules.groceriesPlan.tips.freeze')
    ]
  },
  {
    id: 'dining-swap', category: 'Eating out', icon: 'utensils', kind: 'cash',
    get label() { return t('rules.diningSwap.label'); },
    get noun() { return t('rules.diningSwap.noun'); },
    pools: ['dining'],
    when: (c) => c.v.dining > c.B.thresholds.diningFloor && c.v.dining > c.v.groceries,
    pct: 0.40, effort: 'Medium', upfront: null,
    get title() { return t('rules.diningSwap.title'); },
    why: (c) => t('rules.diningSwap.why', { dining: c.fmt(c.v.dining), groceries: c.fmt(c.v.groceries) }),
    get evidence() { return t('rules.diningSwap.evidence'); },
    tips: () => [t('rules.diningSwap.tips.swap'), t('rules.diningSwap.tips.lunch'), t('rules.diningSwap.tips.special')]
  },
  {
    id: 'impulse-24h', category: 'Shopping', icon: 'hourglass', kind: 'cash',
    get label() { return t('rules.impulse24h.label'); },
    get noun() { return t('rules.impulse24h.noun'); },
    pools: ['misc'],
    when: (c) => c.v.misc > c.B.ranges.misc[1],
    pct: 0.25, effort: 'Easy', upfront: null,
    get title() { return t('rules.impulse24h.title'); },
    why: (c) => typical(c, c.v.misc, c.B.ranges.misc[1], 'rules.impulse24h.why'),
    get evidence() { return t('rules.impulse24h.evidence'); },
    tips: () => [t('rules.impulse24h.tips.wait'), t('rules.impulse24h.tips.cards'), t('rules.impulse24h.tips.notifications')]
  },
  {
    id: 'school-discounts', category: 'Family', icon: 'school', kind: 'cash',
    get label() { return t('rules.schoolDiscounts.label'); },
    get noun() { return t('rules.schoolDiscounts.noun'); },
    pools: ['school'],
    when: (c) => c.v.school > c.B.thresholds.school,
    pct: 0.08, effort: 'Easy', upfront: null,
    get title() { return t('rules.schoolDiscounts.title'); },
    why: (c) => typical(c, c.v.school, c.B.thresholds.school, 'rules.schoolDiscounts.why'),
    get evidence() { return t('rules.schoolDiscounts.evidence'); },
    tips: () => [t('rules.schoolDiscounts.tips.siblings'), t('rules.schoolDiscounts.tips.upfront'), t('rules.schoolDiscounts.tips.secondHand')]
  },
  {
    id: 'medical-generic', category: 'Health', icon: 'heart-pulse', kind: 'cash',
    get label() { return t('rules.medicalGeneric.label'); },
    get noun() { return t('rules.medicalGeneric.noun'); },
    pools: ['medical'],
    when: (c) => c.v.medical > c.B.ranges.medical[1],
    pct: 0.20, effort: 'Easy', upfront: null,
    get title() { return t('rules.medicalGeneric.title'); },
    why: (c) => typical(c, c.v.medical, c.B.ranges.medical[1], 'rules.medicalGeneric.why'),
    get evidence() { return t('rules.medicalGeneric.evidence'); },
    tips: (c) => [
      t('rules.medicalGeneric.tips.generic'),
      t('rules.medicalGeneric.tips.monthlyPack'),
      isLocal(c) ? t('rules.medicalGeneric.tips.localCover') : t('rules.medicalGeneric.tips.insurance')
    ]
  },

  // ---------------- Subscriptions ----------------
  {
    id: 'subs-cancel-unused', category: 'Subscriptions', icon: 'repeat', kind: 'cash',
    get label() { return t('rules.subsCancelUnused.label'); },
    get noun() { return t('rules.subsCancelUnused.noun'); },
    pools: ['subsRarely'],
    when: (c) => c.subs.some((s) => s.rarely && s.cost > 0),
    pct: 1, maxPct: 1, effort: 'Easy', upfront: null,
    get title() { return t('rules.subsCancelUnused.title'); },
    why: (c) => {
      const names = c.subs.filter((s) => s.rarely && s.cost > 0).map((s) => s.name || t('rules.subsCancelUnused.unnamed'));
      return t('rules.subsCancelUnused.why', { names: names.join(', ') });
    },
    get evidence() { return t('rules.subsCancelUnused.evidence'); },
    tips: () => [t('rules.subsCancelUnused.tips.cancel'), t('rules.subsCancelUnused.tips.trials'), t('rules.subsCancelUnused.tips.reminder')]
  },
  {
    id: 'subs-rotate', category: 'Subscriptions', icon: 'tv', kind: 'cash',
    get label() { return t('rules.subsRotate.label'); },
    get noun() { return t('rules.subsRotate.noun'); },
    pools: ['subsStreaming'],
    when: (c) => activeSubs(c, 'streaming') > c.B.thresholds.subsActive,
    pct: 0.30, effort: 'Easy', upfront: null,
    get title() { return t('rules.subsRotate.title'); },
    why: (c) => typical(c, activeSubs(c, 'streaming'), c.B.thresholds.subsActive, 'rules.subsRotate.why'),
    get evidence() { return t('rules.subsRotate.evidence'); },
    tips: () => [t('rules.subsRotate.tips.one'), t('rules.subsRotate.tips.ads'), t('rules.subsRotate.tips.family')]
  },
  {
    id: 'subs-tools-yearly', category: 'Subscriptions', icon: 'laptop', kind: 'cash',
    get label() { return t('rules.subsToolsYearly.label'); },
    get noun() { return t('rules.subsToolsYearly.noun'); },
    pools: ['subsTools'],
    when: (c) => activeSubs(c, 'tools') > c.B.thresholds.subsActive,
    pct: 0.15, effort: 'Easy', upfront: null,
    get title() { return t('rules.subsToolsYearly.title'); },
    why: (c) => typical(c, activeSubs(c, 'tools'), c.B.thresholds.subsActive, 'rules.subsToolsYearly.why'),
    get evidence() { return t('rules.subsToolsYearly.evidence'); },
    tips: () => [
      t('rules.subsToolsYearly.tips.yearly'),
      t('rules.subsToolsYearly.tips.overlap'),
      t('rules.subsToolsYearly.tips.employer')
    ]
  },

  // ---------------- Debt ----------------
  {
    id: 'debt-avalanche', category: 'Debt', icon: 'card', kind: 'interest',
    get label() { return t('rules.debtAvalanche.label'); },
    get noun() { return t('rules.debtAvalanche.noun'); },
    pools: ['cardInterest'],
    when: (c) => highAprCards(c.debts).length > 0,
    pct: 0.75, maxPct: 1, effort: 'Medium',
    // A 0% balance-transfer card typically charges a one-off 3% fee
    upfront: (c) => highAprCards(c.debts).reduce((a, d) => a + d.balance, 0) * 0.03,
    title: (c) => (isLocal(c) ? t('rules.debtAvalanche.titleLocal') : t('rules.debtAvalanche.title')),
    why: (c) => {
      const top = [...highAprCards(c.debts)].sort((a, b) => b.apr - a.apr)[0];
      return t('rules.debtAvalanche.why', { name: top.name || t('rules.debtAvalanche.whyUnnamed'), apr: top.apr });
    },
    flag: (c) => {
      const top = [...highAprCards(c.debts)].sort((a, b) => b.apr - a.apr)[0];
      return t('rules.debtAvalanche.flag', { name: top.name || t('rules.debtAvalanche.flagUnnamed'), apr: top.apr });
    },
    evidence: (c) => (isLocal(c)
      ? t('rules.debtAvalanche.evidenceLocal')
      : t('rules.debtAvalanche.evidence')),
    tips: (c) => {
      const order = [...c.debts].filter((d) => d.balance > 0).sort((a, b) => b.apr - a.apr)
        .map((d) => t('rules.debtAvalanche.orderItem', { name: d.name || t('rules.debtAvalanche.orderUnnamed'), apr: d.apr }));
      return [
        isLocal(c)
          ? t('rules.debtAvalanche.tips.localLoan')
          : t('rules.debtAvalanche.tips.transfer'),
        t('rules.debtAvalanche.tips.order', { order: order.join(' → ') }),
        t('rules.debtAvalanche.tips.minimum')
      ];
    }
  }
];

// ---------------- Country ideas ----------------
// Each country's data file lists `localTips` (energy tariff switching in GB/DE,
// generator-to-solar in PK/NG, rent cheques in AE…). They become rules shaped
// like the ones above, on the bill named by `pool`, so they share the same
// cards, stacking and plan. Their text is in the "localTips.<id>" messages;
// the data file's English is the fallback.

const POOL_ICON = {
  rent: 'key', electricity: 'bolt', waterGas: 'flame', transit: 'ticket', internet: 'wifi', carIns: 'umbrella',
  misc: 'bag', cardInterest: 'card', councilTax: 'home', privateHealth: 'heart-pulse', healthPremium: 'heart-pulse',
  generatorFuel: 'fuel', galon: 'cart'
};

/** The amount a country idea works on: card interest, or a bill (including the country's own). */
const poolAmount = (c, pool) => (pool === 'cardInterest'
  ? highAprCards(c.debts).reduce((a, d) => a + (d.balance * d.apr) / 1200, 0)
  : c.v[pool] || 0);

function localRule(tip) {
  const k = `localTips.${tip.id}`;
  const msg = (key, fallback) => (has(`${k}.${key}`) ? t(`${k}.${key}`) : fallback);
  return {
    id: tip.id, category: 'Local', icon: POOL_ICON[tip.pool] || 'lightbulb', local: true,
    kind: tip.pool === 'cardInterest' ? 'interest' : 'cash',
    get label() { return msg('label', tip.title); },
    get noun() { return msg('noun', tip.pool); },
    pools: [tip.pool],
    // Shown when the bill is there to work on, and only for the households it fits
    when: (c) => poolAmount(c, tip.pool) > 0 && (!tip.profiles || tip.profiles.includes(c.profile)),
    pct: tip.pct, maxPct: tip.pool === 'cardInterest' ? 1 : undefined,
    effort: EFFORT_ORDER[tip.effort] == null ? 'Easy' : tip.effort,
    upfront: () => tip.upfront || 0,
    get title() { return msg('title', tip.title); },
    why: () => msg('why', tip.why),
    get evidence() { return msg('evidence', ''); },
    tips: () => tip.tips.map((x, i) => msg(`tips.${i + 1}`, x))
  };
}

const localCache = new WeakMap();
/** The country's ideas as rules (built once per loaded country). */
export function localRules(C) {
  if (!localCache.has(C)) localCache.set(C, (C.localTips || []).map(localRule));
  return localCache.get(C);
}

export const EFFORT_ORDER = { Easy: 0, Medium: 1, 'Requires purchase': 2 };
// Keys are the stored `effort` values; the displayed words follow the active language.
export const EFFORT_LABEL = {
  get Easy() { return t('rules.effort.easy'); },
  get Medium() { return t('rules.effort.medium'); },
  get 'Requires purchase'() { return t('rules.effort.purchase'); }
};
