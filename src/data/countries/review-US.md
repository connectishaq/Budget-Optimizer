# Benchmark review: United States (US, USD)

Reviewed 2026-10-20. All amounts are monthly USD unless stated otherwise. Sources are listed in `US.json` under `sources`.

## Country-wide

| Value | Result | Old → new | Source / reason |
|---|---|---|---|
| inflation | Confirmed | 3 | BLS CPI-U 3.7% (Sept 2026); Cleveland Fed 10-yr expectation ~2.5% |
| returns.longTerm | Confirmed | 8 | Damodaran S&P 500 1928-2025 ~10.0% geometric; 8 is a deliberately cautious figure |
| returns.shares | Confirmed | 10 | Damodaran S&P 500 1928-2025 ~10.0% |
| defaults.cardApr (unflagged) | Confirmed (source added) | 22 | Fed G.19: accounts assessed interest averaged 22.3% in 2025 |
| localTips us-open-enrollment pct | Still unverified | 0.1 | No national study of the typical saving from switching plans |

## single

| Value | Result | Old → new | Source / reason |
|---|---|---|---|
| income | Confirmed | 3200-5200 | BLS Q2 2026 median full-time $1,251/wk; take-home is our tax estimate |
| rent | Confirmed | 1200-1800 | ACS 2024 median gross rent $1,487; Apartment List 1-bed $1,220; Zillow ~$1,950 |
| groceries | Changed | 250-350 → 280-420 | BLS CE 2024 one-person food at home $3,395/yr; USDA food plans |
| electricity | Changed | 45-85 → 60-110 | EIA RECS 2020 apartment kWh × EIA 2026 price 18.2¢ ≈ $92 |
| fuel | Changed | 60-120 → 90-180 | BLS CE 2022 one-person gasoline $1,590/yr at $3.95/gal, rescaled to AAA ~$4.30 (Oct 2026) |
| healthPremium | Still unverified | 80-200 | Centre is KFF 2025 ($120/mo); spread is an estimate |

## suburban (family of four)

| Value | Result | Old → new | Source / reason |
|---|---|---|---|
| income | Confirmed | 6000-9500 | Census 2025 median household $87,460 ($76,060 after tax); two-earner families sit above |
| rent | Confirmed | 1800-2600 | Zillow typical rent ~$1,950; no national 3-bed series, top end is an estimate |
| groceries | Changed | 800-950 → 800-1200 | USDA Thrifty plan family of four $1,023 (June 2026); BLS CE 2024 four-person $8,697/yr |
| electricity | Changed | 110-170 → 140-230 | EIA RECS 2020 single-family detached ~12,400 kWh/yr × 18.2¢ ≈ $188 |
| fuel | Changed | 150-200 → 280-450 | BLS CE 2022 four-person gasoline $4,467/yr at $3.95/gal → ~$405 at $4.30 |
| school (childcare) | Still unverified | 200-600 | Child Care Aware has no national school-age price; kept as an estimate |
| healthPremium | Confirmed | 350-800 | KFF 2025 family worker contribution $6,850/yr; 23-36% share by firm size ≈ $520-$810 |

## youngpro

| Value | Result | Old → new | Source / reason |
|---|---|---|---|
| income | Confirmed | 4500-7000 | BLS Q2 2026 bachelor's median $1,768/wk (~$5,900 take-home, our estimate) |
| rent | Confirmed | 1400-2100 | Between ACS median $1,487 and Zillow ~$1,950 |
| groceries | Changed | 300-400 → 350-600 | BLS CE 2024 two-person food at home $6,088/yr |
| electricity | Changed | 55-95 → 70-130 | EIA RECS 2020 apartment kWh × 18.2¢ |
| fuel | Changed | 100-150 → 150-300 | BLS CE 2022 two-person gasoline $3,141/yr, rescaled to ~$4.30/gal |
| healthPremium | Still unverified | 100-350 | KFF summary has no employee-plus-spouse figure |

## Notes for the lead
- Samples were not changed: every sample value for the reviewed fields sits inside the new ranges.
- Thresholds were not changed, but `thresholds.fuel` (suburban 200, single 120, youngpro 150) now sits below the low end of the typical fuel range at Oct 2026 pump prices. Raising it would break `calculate.test.js` "fires carpooling at exactly 15% for suburban fuel > 200", so this is left for the lead to decide. The single `thresholds.utilities` (120) is also close to the new typical electricity + water/gas level.
- Fuel ranges follow the current price spike (AAA ~$4.30, up from ~$3.04 a year ago); revisit if pump prices fall back.
- The USDA food plan PDFs and BLS CE xlsx files could not be downloaded from this machine (403/404 errors); their figures were taken from search excerpts and FRED pages.

## Example budget (lead review, 2026-10-20)
The suburban example spent about $10 a month more than it earned once debts, subscriptions and yearly costs were counted. Lowered groceries 1,150 → 1,050, dining 380 → 300 and misc 260 → 150 (it was above its own typical range of 100–150). All values stay inside the reviewed ranges; the example now leaves money over.
