# India (IN) benchmark review — 2026-10-20

Monthly INR. "Changed (still verify)" means the value moved but rests partly on estimate, so it stays flagged.
Main sources: MoSPI HCES 2023-24 and CMS: Education 2025, PLFS 2023-24, Indeed (class of 2025 offers), NoBroker H1 2025 and Magicbricks May 2025 rent data (via Outlook Money), KERC/BESCOM 2025-26 tariff, Delhi petrol price (Oct 2026), LPG ₹942 (Sep 2026), Jio/Airtel AirFiber prices. Full list is in `IN.json` → `sources`.

## single (person renting in a city)
| Field | Status | Old → New | Basis |
|---|---|---|---|
| income | Changed | 50,000–90,000 → 25,000–70,000 | PLFS urban salaried avg ₹24,434; Indeed avg starting offer ₹3.5 LPA. Upper end is judgement |
| rent | Changed (still verify) | 15,000–30,000 → 8,000–22,000 | ≈30% of new income; Magicbricks 1,000 sq ft rents scaled down. No 1BHK index |
| electricity | Changed | 1,000–2,500 → 800–2,200 | BESCOM tariff at 100–250 units (assumed use) |
| internet | Confirmed | 700–1,500 | AirFiber ₹599+GST plus mobile |
| fuel | Changed | 2,000–4,000 → 1,000–4,000 | Petrol ₹102.12/L × 10–40 L (assumed) |
| school | Confirmed | 0–0 | No children |
| groceries | Changed | 6,000–10,000 → 3,500–8,000 | HCES urban food ≈₹2,800/person, +~10% to 2026 |
| dining | Changed (still verify) | 3,000–7,000 → 1,500–6,000 | Scaled to new income; no survey |
| waterGas | Unverified | 800–1,500 kept | LPG cost sourced; water/PNG not |
| transit | Unverified | 1,500–4,000 kept | No commuting-spend survey by household type |

## suburban (family of four, suburb or second city)
| Field | Status | Old → New | Basis |
|---|---|---|---|
| income | Changed | 1,20,000–2,50,000 → 45,000–1,40,000 | HCES urban MPCE ₹6,996 (≈₹28k for 4); PLFS salaried avg. Old range was the top few percent |
| rent | Changed (still verify) | 25,000–50,000 → 12,000–35,000 | NoBroker 2BHK ₹20–30k outer Bengaluru; tier-2 floor is estimate |
| electricity | Changed | 2,500–6,000 → 2,000–5,000 | BESCOM tariff at 250–600 units (assumed use) |
| internet | Confirmed | 1,200–2,500 | AirFiber + 2–3 mobiles |
| fuel | Changed | 5,000–9,000 → 2,500–8,000 | Petrol ₹102.12/L × 25–80 L (assumed) |
| school | Changed | 10,000–30,000 → 5,000–20,000 | CMS: Education 2025 urban private unaided ≈₹35.8k/student/yr → ≈₹6k/month for two. Upper end judgement |
| groceries | Changed | 15,000–25,000 → 10,000–20,000 | HCES ≈₹12.3k for four at the urban average (2026) |
| dining | Changed (still verify) | 4,000–10,000 → 2,000–8,000 | Scaled to new income; no survey |
| waterGas | Unverified | 1,200–2,500 kept | ~1 LPG cylinder (₹942); water/PNG not sourced |

## youngpro (couple or higher earner, big city)
| Field | Status | Old → New | Basis |
|---|---|---|---|
| income | Changed | 80,000–1,60,000 → 60,000–1,60,000 | Two early-career earners at ≈₹27k in hand each; upper end judgement |
| rent | Changed | 20,000–40,000 → 18,000–40,000 | NoBroker H1 2025 2BHK: Bengaluru ₹20–45k, Pune Baner ₹30–38k, Hyderabad ₹25–33k |
| electricity | Confirmed | 1,500–3,500 | BESCOM tariff at 200–450 units |
| internet | Confirmed | 1,000–2,000 | AirFiber + two mobiles |
| fuel | Confirmed | 3,000–6,000 | Petrol ₹102.12/L × 30–60 L |
| groceries | Changed | 7,000–12,000 → 6,000–12,000 | HCES ≈₹6.2k for two (2026) |
| dining | Changed (still verify) | 6,000–15,000 → 4,000–12,000 | Scaled to new income; no survey |
| waterGas | Unverified | 800–1,500 kept | LPG sourced; water/PNG not |

## Samples
All three rewritten to match the new ranges. Single ₹45k take-home, suburban ₹1.1 lakh (two earners, car loan, two children in private school), youngpro ₹1 lakh. Spend comes to ≈93–98% of income once the society-maintenance and power-backup must-pay fields are counted. Debts, yearly costs and extras were scaled down to fit.

## Not reviewed (still verify)
Thresholds and categoryShare (no source clearly supports a change; `suburban.thresholds.utilities` and `homeHelp` are pinned by tests). Also not reviewed: homeIns, carIns, carLoan, misc, medical, homeHelp, familySupport, giving, other, youngpro school, costs, returns, extraFields and localTips. Note that the `misc` ranges (old income basis) now sit above the sample values for single and suburban.
