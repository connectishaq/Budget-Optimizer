# Benchmark review: United Arab Emirates (AE, AED)

Reviewed 2026-10-20. 18 values reviewed: 10 confirmed, 8 changed. 100 values are still flagged `verify: true`.

Main sources:
- Real Estate Club Dubai utilities guide, Mar 2026 ("RECD"). It gives annual-average DEWA bills (electricity and water together), water, gas, district cooling and internet costs by home size.
- e& Home Wireless price page.
- Khaleej Times, October 2026 fuel prices.
- Yallamotor on Salik tolls with VAT.
- Michael Page UAE Salary Guide 2026, as reported by The National.

The DEWA bill covers both electricity and water, but the app has separate electricity and water/gas fields. I split each bill by taking the water share out of the electricity figure. This split is my own calculation from RECD's figures, not a published number.

## single (single renter, studio or 1-bed)
| Item | Result | Detail |
|---|---|---|
| electricity | changed [250, 600] → [150, 500] | DEWA bill incl. water: studio 200–400, 1-bed 300–600 (RECD); water share removed |
| waterGas | changed [100, 250] → [60, 150] | water on DEWA bill ~50–100; cylinder gas 20–45 (RECD) |
| internet | confirmed [350, 600] | home plan 299–389 plus mobile ~150 (RECD); e& Home Wireless from 229 + VAT |
| thresholds.utilities | changed 800 → 650 | top of 1-bed DEWA bill (600) plus gas |
| thresholds.internet | confirmed 550 | |
| chillerFee | confirmed [0, 600] | district cooling average ~400 (studio) and ~550 (1-bed) (RECD) |
| sample waterGas | 150 → 100 | moved inside the new range |
| income | unverified | no official wage data; Michael Page: over 60% of roles pay 10k–40k a month, but no median for this household |
| fuel | unverified | price confirmed (Special 95 AED 4.28/L); the monthly distance driven is an assumption |
| transit | unverified | Salik confirmed; no current official nol monthly pass price |
| groceries, dining, misc, medical, insurance, carLoan, homeHelp, familySupport, giving, other, categoryShare, other thresholds | unverified | no UAE household expenditure data published (FCSC/SCAD 2024 survey results not found) |

## suburban (family of four, 3-bed flat or villa)
| Item | Result | Detail |
|---|---|---|
| electricity | confirmed [700, 1500] | DEWA bill incl. water: 3-bed flat 600–1,200, 4-bed villa 1,200–2,500 (RECD) |
| waterGas | changed [250, 600] → [120, 450] | water: 2-bed flat 80–150, villa 400–800 in summer only; gas 30–40 (RECD) |
| internet | confirmed [450, 800] | home plan 389–549 plus mobile ~200 (RECD) |
| thresholds.utilities | confirmed 2000 | within the villa DEWA range |
| thresholds.internet | confirmed 700 | |
| chillerFee | changed [0, 1000] → [0, 1100] | district-cooled 3-bed averages ~1,100 (RECD) |
| sample waterGas | 400 → 300 | moved inside the new range |
| income, fuel, groceries, everything else | unverified | as for single; no household income survey published |

## youngpro (couple or single higher earner, 1–2 bed)
| Item | Result | Detail |
|---|---|---|
| electricity | changed [400, 900] → [250, 700] | DEWA bill incl. water: 1-bed 300–600, 2-bed 400–800 (RECD) |
| waterGas | changed [150, 350] → [80, 200] | water ~80–150 plus gas 25–45 (RECD) |
| internet | confirmed [400, 700] | |
| thresholds.utilities | changed 1200 → 900 | top of 2-bed DEWA bill plus gas |
| thresholds.internet | confirmed 650 | |
| chillerFee | confirmed [0, 800] | ~550 (1-bed) to ~800 (2-bed) (RECD) |
| sample waterGas | 250 → 130 | moved inside the new range |
| income, fuel, transit, dining, groceries, everything else | unverified | as above |

## Not reviewed / still open
- Rent and school fees are not flagged, so I left them unchanged. They look consistent with 2026 data:
  - dubizzle H1 2026 average yearly rents: studios 37k–44k and 1-beds 56k–65k in affordable areas; 3-bed villas 112k–146k.
  - KHDA froze tuition for 2026–27. Outstanding-rated schools charge AED 29k–112k a year.
- Groceries and dining: I found no official source and no reputable survey, so the estimates are kept.
- inflation, returns, defaults and costs were not reviewed.
