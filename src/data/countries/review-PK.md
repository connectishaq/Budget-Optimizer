# Pakistan (PK) benchmark review — 2026-10-20

These amounts are monthly, in PKR, and income is take-home pay. Survey figures from HIES and LFS 2024-25 were raised by about 15% to bring them to late-2026 prices. That figure comes from PBS national CPI: the index was 304.3 in September 2026, against about 265 in the middle of the survey period. The 265 was worked out from the PBS year-on-year rates of 10.26% for September 2026 and 5.76% for September 2025.

Electricity amounts were calculated from the NEPRA unprotected domestic slabs as reported by Nukta (Jul 2025), with the Feb 2026 slab cuts and fixed charges reported by The News, plus 18% GST and 1.5% duty. Fuel amounts use petrol at Rs 390.23/litre, the OGRA price from 16 Oct 2026 as reported by APP. Full links are in `sources` in PK.json.

**Main finding:** the old income ranges described high earners, not typical urban households. The old family range was 220–400k. HIES 2024-25 puts the top urban quintile at an average of only Rs 146,920 a month (about 169k at 2026 prices). The old family grocery range of 60–85k was also about double what HIES spending shares support.

## single
| Field | Result | Old → new | Source |
|---|---|---|---|
| income | changed | 90–160k → **55–130k** | PBS LFS 2024-25 wages (urban ~44k, professionals 62.8k, managers 103.3k) +15% CPI; minimum wage Rs 40,700 |
| rent | changed | 25–40k → **20–45k** | Zameen Index, Aug 2026 (North Karachi 30k, Saddar 41k, Nawab Town 36k, Johar Town 45k) |
| groceries | changed | 18–28k → **12–22k** | HIES 2024-25 per-capita consumption and food share (plus a living-alone premium, which is judgement) |
| electricity | confirmed | 6–14k | NEPRA slab calculation, about 190–345 units |
| internet | confirmed | 3–6k | PTCL Flash Fiber Rs 3,499–4,999 incl. tax (ProPakistani) |
| fuel | confirmed | 5–10k | petrol Rs 390.23/litre gives 13–26 litres |
| school | confirmed | 0–0 | this household has no children |
| thresholds fuel / internet | confirmed | 10k / 6k | equal the top of the reviewed ranges |
| waterGas | unverified | 1.5–4k | Dawn gives the minimum gas bills (Rs 755 / Rs 1,820), but there is no data on average bills |
| dining | unverified | 5–12k | HIES puts restaurants at 6.6% of spending, with no figure by household type |

## suburban (family of four)
| Field | Result | Old → new | Source |
|---|---|---|---|
| income | changed | 220–400k → **130–350k** | HIES 2024-25 urban 4th and 5th quintile household income (81k and 147k) +15% CPI |
| rent | changed | 50–90k → **35–80k** | Zameen Index houses and flats, Aug 2026 (Lahore, Faisalabad, Karachi) |
| groceries | changed | 60–85k → **35–65k** | HIES 2024-25 per-capita consumption by quintile and food share |
| electricity | confirmed | 15–32k | NEPRA slab calculation, about 370–650 units |
| internet | confirmed | 4–8k | PTCL Flash Fiber prices plus mobile |
| fuel | confirmed | 18–28k | petrol price gives 46–72 litres |
| thresholds fuel / internet | confirmed | 28k / 8k | equal the top of the reviewed ranges |
| school | unverified | 20–50k | no official fee survey; Result.pk reports 25–50k per child at the big chains |
| waterGas | unverified | 3–8k | Dawn confirms only the gas fixed charge (Rs 1,500) |

## youngpro
| Field | Result | Old → new | Source |
|---|---|---|---|
| rent | changed | 40–75k → **45–95k** | Zameen Index flats, Aug 2026 (Karachi, Lahore, Islamabad mid-market areas) |
| income | confirmed | 150–300k | LFS 2024-25 wages for professionals and managers +15% CPI (two earners) |
| electricity | confirmed | 10–22k | NEPRA slab calculation, about 260–490 units |
| internet | confirmed | 4–7k | PTCL Flash Fiber prices |
| fuel | confirmed | 12–22k | petrol price gives 31–56 litres |
| groceries | confirmed | 25–38k | HIES top-quintile per-capita consumption and food share |
| thresholds fuel / internet | confirmed | 22k / 7k | equal the top of the reviewed ranges |

## Samples
All three samples were rebuilt so that every amount sits inside the new ranges, income is above spending, and the budget still saves money:

- **single:** pay 110k, rent 28k, yearly extras 130k.
- **suburban:** pay 280k, rent 50k, school 30k, groceries 48k, smaller debts and yearly costs, extras 420k a year.
- **youngpro:** pay 250k, rent 65k.

The subscription prices were not reviewed.

## Still unverified (verify: true) and why
- **homeIns, carIns, carLoan, transit, misc, medical, homeHelp, familySupport, giving, other** (all profiles), and **dining** and **school** for suburban and youngpro: no public survey gives these by household type. HIES only gives national spending shares, and most households in it own their home.
- **utilities thresholds:** these depend on waterGas, which is unverified.
- **school, carLoan, insurance, diningFloor and subsActive thresholds:** no source found.
- **categoryShare** (all): HIES shares cover mostly owner-occupier households (82% own their home), so they cannot be compared with take-home-pay shares for renters.
- **Not reviewed:** inflation, returns, defaults, costs, extraFields (generator and committee) and localTips.

## Example budget (lead review, 2026-10-20)
The suburban example spent about Rs 3,500 a month more than it earned once debts, subscriptions and yearly costs were counted. Lowered groceries 48,000 → 45,000, fuel 22,000 → 20,000, electricity 24,000 → 22,000 and home help 12,000 → 10,000, all inside the reviewed ranges; the example now leaves money over.
