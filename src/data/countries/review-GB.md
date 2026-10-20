# GB benchmark review (2026-10-20)

Monthly amounts in GBP. Sources are listed in `GB.json` → `sources`. Take-home pay uses 2026/27 tax and NI rates
with a 5% auto-enrolment pension. Energy uses the Ofgem cap for Oct–Dec 2026 at the 2026 typical-use values.

## Single (one person renting in a city)

| Field | Status | Old → new | Basis |
|---|---|---|---|
| income | changed | 2300–3400 → 2000–3200 | ONS ASHE 2025 median full-time £39,039 ≈ £2,500 take-home; ONS HFS one-adult median ≈ £2,190 |
| rent | changed | 900–1400 → 800–1250 | ONS PIPR Aug 2026 one-bed: UK £1,136, Leeds £782, Birmingham £830, Manchester £1,003, Bristol £1,225 |
| electricity | confirmed | 45–75 | Ofgem cap 26.32p/kWh + 54.83p/day; 1,300–2,500 kWh |
| waterGas | changed | 60–100 → 65–110 | Ofgem gas 7.97p/kWh + 29.68p/day; Water UK average £639/yr |
| fuel | confirmed | 60–120 | gov.uk petrol 174.6p/l (19 Oct 2026); DfT NTS0901 6,200 miles/yr; 45 mpg assumed |
| transit | changed | 80–160 → 80–175 | Bee Network 28-day £80; London Z1–2 monthly Travelcard £171.70 |
| school | confirmed | 0–0 | no children |
| groceries | confirmed | 180–280 | ONS Family Spending A57 (no children, bottom three fifths £41–64/wk) |
| dining | confirmed | 100–250 | ONS Family Spending A57 restaurants & hotels |
| councilTax | confirmed | 100–170 | gov.uk Band D £2,392; band ratios with 25% discount |
| internet | unverified | 35–60 | no source gives a household spend level for broadband + mobile |
| sample | changed | income 2800 → 2600, rent 1150 → 1000 | fits new ranges; income still above spending |

## Suburban (two adults, two children)

| Field | Status | Old → new | Basis |
|---|---|---|---|
| income | changed | 4500–7000 → 3600–6000 | ONS HFS FYE 2025 median £39,200 equivalised × 1.4 ≈ £4,570/month, so the old range began at the median |
| rent | changed | 1300–1900 → 1100–1600 | ONS PIPR Aug 2026 three-bed: UK £1,430, Birmingham £1,134, Leeds £1,138, Stockport £1,266, Manchester £1,433 |
| electricity | changed | 80–130 → 75–115 | Ofgem cap; 2,700–4,500 kWh |
| waterGas | changed | 110–170 → 120–175 | Ofgem gas 9,500–15,000 kWh + water £50–65 |
| fuel | confirmed | 150–250 | petrol 174.6p/l; two cars or one high-mileage car |
| school | confirmed | 100–600 | Coram 2026: after-school club ~£70/wk, holiday club ~£191/wk |
| groceries | changed | 550–800 → 420–650 | ONS Family Spending A56: households with children £88.80/wk ≈ £385/month |
| dining | confirmed | 150–350 | ONS Family Spending A56 restaurants & hotels |
| councilTax | confirmed | 160–260 | Bands B–E ≈ £155–244 |
| transit | unverified | 20–80 | no family figure available |
| internet | unverified | 50–90 | as above |
| sample | changed | income 5600 → 4800, rent 1600 → 1350, groceries 700 → 520, electricity 110 → 100, homeHelp 80 → 40, dining 240 → 200, carLoan 320 → 280, misc 160 → 140, other 80 → 60 | median-ish family; income still above spending |

## Young professional (couple or single higher earner, big city)

| Field | Status | Old → new | Basis |
|---|---|---|---|
| income | changed | 3400–5500 → 3000–5200 | one earner on £47k ≈ £2,950; two on £33k ≈ £4,300; two on median ≈ £5,000 |
| rent | changed | 1300–2000 → 1000–1800 | ONS PIPR two-bed: Birmingham £1,003, Manchester £1,233, England £1,335, Bristol £1,544; London one-bed £1,760 |
| electricity | confirmed | 55–90 | Ofgem cap; 1,800–3,300 kWh |
| waterGas | changed | 70–120 → 90–130 | Ofgem gas 6,000–10,000 kWh + water |
| fuel | confirmed | 80–160 | petrol 174.6p/l; one car |
| transit | confirmed | 100–200 | London Travelcard £171.70; two Bee Network tickets £160 |
| groceries | confirmed | 280–420 | ONS Family Spending A57 (top three fifths £64–85/wk) |
| dining | confirmed | 200–400 | ONS Family Spending A57 restaurants & hotels |
| councilTax | confirmed | 130–220 | Bands A–D ≈ £133–199 |
| school | unverified | 0–200 | no source for this household type |
| internet | unverified | 45–75 | as above |
| sample | changed | rent 1650 → 1400, waterGas 95 → 105 | fits new ranges |

## Not reviewed (still `verify: true`)
Returns, loanApr, one-off costs, homeIns, carIns, carLoan, misc, medical, homeHelp, familySupport, giving, other,
all thresholds and categoryShare, subscription prices and local tip percentages. No source clearly supported
changing them.

Assumptions: usage bands for energy, 45 mpg fuel economy, metered water for single people, and the food-price
uplift on the ONS 2023–25 grocery figures. Each is stated in the field's note. ASHE 2026 had not been published
by the review date.
