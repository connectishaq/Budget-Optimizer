# Country data files

One JSON file per country (`US.json`, `GB.json`, …) plus `GLOBAL.json`. They replace the old
"US numbers × a currency factor" logic: every typical range, threshold and default comes from the
selected country.

## Marking uncertain numbers
Any number (or `[low, high]` pair) you are not confident about is written as
`{ "value": <number or [lo, hi]>, "verify": true, "note": "why it's uncertain" }`.
The loader unwraps these, and `npm run benchmarks:review` lists them in `REVIEW_BENCHMARKS.md`.
Never present an estimate as a fact: if it isn't from a source you cite, mark it.

## Shape
```jsonc
{
  "code": "GB",
  "currency": "GBP",
  "locale": "en-GB",                // default formatting locale
  "lakh": false,                    // true only for IN and PK (1,00,000 grouping, lakh/crore)
  "payFrequency": "monthly",        // "weekly" | "biweekly" | "semimonthly" | "monthly"
  "inflation": 3.0,                 // % a year, used as the default for "show in today's money"
  "returns": {                      // % a year for the four existing growth options, in this order
    "savings": 4.0,                 // safe savings account / deposit rate
    "balanced": 5.5,                // savings and investing
    "longTerm": 7.0,                // long-term index average (local index where sensible)
    "shares": 9.0                   // mostly shares
  },
  "defaults": { "cardApr": 24, "loanApr": 9 },   // typical APR % for new credit-card / loan rows
  "costs": { "ledKit": 35, "smartThermostat": 120, "tuneup": 15 },  // one-off costs used by rules, local currency
  "profiles": {                     // the three existing household types, all monthly, local currency
    "single":   { "ranges": { … }, "thresholds": { … }, "categoryShare": { … } },
    "suburban": { … },
    "youngpro": { … }
  },
  "samples": { "single": { … }, "suburban": { … }, "youngpro": { … } },
  "extraFields": [                  // optional local bills, shown only for this country
    { "key": "councilTax", "label": "Council tax", "group": "housing", "need": true,
      "help": "Your monthly council tax bill (10 or 12 instalments a year shown as a monthly amount).",
      "ranges": { "single": [90, 160], "suburban": [150, 260], "youngpro": [100, 180] } }
  ],
  "localTips": [                    // savings ideas only for this country (see "localTips" below)
    { "id": "gb-energy-switch", "pool": "electricity", "title": "…", "why": "…", "tips": ["…", "…", "…"], "pct": 0.1,
      "effort": "Easy", "upfront": 0, "profiles": ["single"] }
  ],
  "hideRules": [],                  // ids of existing rules that don't apply here (see src/engine/rules.js RULES ids)
  "sources": [ { "title": "…", "url": "https://…", "usedFor": "rent, groceries" } ],
  "lastReviewed": "2026-10-19"
}
```

### extraFields — the country's own bills
Shown only for that country, inside the existing input group named by `group` (`housing`,
`utilities`, `transport`, `family` or `care`). They count in that group's category, as a must-pay
bill when `need` is true (otherwise a nice-to-have), and are available to savings rules as
`ctx.v.<key>`. `label` and `help` here are the English source: the page shows
`countryFields.<CODE>.<key>.label/help` from the message files (copy new ones into `en.json`, then
translate). Example budgets fill must-pay ones at the middle of their range.

### localTips — the country's own savings ideas
Each becomes a savings card like the built-in rules (src/engine/rules.js `localRules`), shown when
the bill named by `pool` is above 0. `pool` is any input field, one of the country's `extraFields`,
or `cardInterest` (interest on high-rate cards; saves interest, not cash). `pct` is the default
share of that bill saved; ideas on the same bill stack on what's left, after the general ones.
`effort` is `Easy`, `Medium` or `Requires purchase`; `upfront` is a one-off cost in local money
(omit for none); `profiles` limits the idea to some household types (omit for all). The text
shown is `localTips.<id>.{label, noun, title, why, evidence, tips.1-3}` in the message files:
`label`/`noun` name the bill ("Council tax" / "council tax"), and `evidence` starts the "How did
we get this?" sentence ("The single person discount cuts" … "a quarter of this spending").
`hideRules` lists built-in rule ids that don't fit the country (e.g. `electricity-slab` where
tariffs aren't slab-based).

### profiles.*.ranges — `[low, high]` typical monthly amount for each existing input field
`income` (monthly take-home pay), `rent`, `homeIns`, `electricity`, `waterGas`, `internet`, `fuel`,
`transit`, `carIns`, `carLoan`, `school`, `groceries`, `dining`, `misc`, `medical`, `homeHelp`,
`familySupport`, `giving`, `other`.

### profiles.*.thresholds — monthly amounts above which a savings idea fires
`utilities` (electricity + water/gas), `fuel`, `transit`, `internet`, `insurance` (car insurance),
`carLoan`, `school`, `diningFloor` (minimum dining spend before the dining idea shows),
`subsActive` (subscriptions in use).

### profiles.*.categoryShare — typical share of take-home pay (0–1)
`housing`, `utilities`, `transport`, `family`, `debt`, `subscriptions`, `care`, `yearly`.

### samples.* — an example budget per household type
`values` (every range field above plus `emergencyFund`, a total), `debts`
(`{type:"card"|"loan", name, balance, apr, payment}`), `subscriptions` (`{name, cost, rarely}`),
`yearly` (`{name, cost}` whole-year cost), `extras` (`{name, amount}` whole-year amount).
`suburban` is the complete example: fill every field, at least one card and one loan, 5–7
subscriptions, 3 yearly costs and 3–4 kinds of extra income. Use local brand names for
subscriptions (e.g. JioHotstar in India). For yearly costs and extra income, reuse these names when
they fit: "Festivals (Eid, Diwali, Christmas…)", "Weddings and gifts", "School books, uniforms and
admission", "Car service and repairs", "Yearly insurance", "Travel and trips home", "Home repairs",
"Festival bonus (Eid, Diwali, Christmas…)", "Yearly performance bonus", "Appreciation bonus",
"Overtime", "Extra work or side jobs", "13th-month salary", "Tax refund".

Household types: **single** = single person renting in a city · **suburban** = family of four
(two adults, two children) in a suburb/second city · **youngpro** = young professional couple or
single high earner in a big city.
