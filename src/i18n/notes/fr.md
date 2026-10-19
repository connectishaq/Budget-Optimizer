# French (fr, France) translation notes

## General choices
- Market: France. Polite **vous** throughout, plain everyday words.
- Typography: non-breaking space (U+00A0) before `:` `;` `?` `!` `%` and `°`, inside `« »`, and as the
  thousands separator in numbers written in the text ("3 000 $"). Apostrophes are typographic (’).
- Plurals use the French categories `one`, `many`, `other` (`many` is for 1 000 000-style numbers;
  it uses the same wording as `other`). English messages that only had `other` got all three categories.
- `months.*`: French does not inflect "mois", so most month plurals look the same in each category.

## Terms and possible alternatives
- Emergency fund = « épargne de précaution » (alternative: « fonds d'urgence », used more in Canada).
- APR = « TAEG » (the legal French term; strictly it includes fees, so it is close to but not exactly APR).
- Take-home pay = « salaire net » (meaning after tax; in France "net" is often understood as *before*
  income tax since the 2019 withholding. « net après impôts » might be clearer).
- Health score = « note santé ». Nice-to-haves = « petits plaisirs ». Must-pay bills = « dépenses obligatoires ».
- Mortgage = « crédit immobilier ». "Mortgage insurance" (rules.rentBurden.tips.ownerInsurance) was
  translated literally as « assurance de prêt hypothécaire »; in France the usual product is
  « assurance emprunteur », which does not stop at 20 % equity. The tip is US-centric; needs review.
- Property tax appeal (rules.rentBurden.*) = « contester sa taxe foncière ». Also US-centric.
- Toll tag = « badge de télépéage ». Store brands = « marques distributeur ».
- "Committee payment" (help.text.other) = « tontine ».
- Brand: `page.header.brand` / `layout.brand` kept as "Budget Optimizer" (product name). The long
  title is translated as « Optimiseur de budget familial et simulateur d'épargne ».
- Profiles: « Célibataire locataire en ville », « Famille de 4 en périphérie », « Jeune actif ».
  Profile `group` values include the article (« les familles ») because they follow « pour ».

## Sentence assembly (please review in context)
- `rules.*.evidence` strings end with « permet généralement d'économiser » (or « d'éviter » for debt) so
  that `plan.explain.evidence` / `evidenceOfThis` read « … permet généralement d'économiser environ un
  quart (25 %) de cette dépense. ».
- `rules.*.noun` values include the article (« vos assurances habitation et auto », « l'électricité et
  le gaz ») because they follow « … par mois pour {noun} ».
- `historyEngine.alerts.*`: rewritten as « {label} : en hausse depuis {count} mois d'affilée. » to avoid
  gender/number agreement with the label. Singular and plural variants are the same.
- Toasts that started with `{month}` were rephrased (« Mois enregistré : {month} ») because month names
  are lowercase in French.
- `payday.dayOfMonth` / `payday.ordinal.*`: French ordinals can't be done with the English st/nd/rd/th
  split (1 → « 1er », 21 → « 21 »). Used `"Le {day} {suffix}"` with every ordinal = « du mois », so the
  options read « Le 1 du mois », « Le 21 du mois ». « Le 1 » (instead of « Le 1er ») is slightly off;
  will be fixed when these keys move to locale ordinals. `page.payday.dayLabel` became « Ma paie arrive : »
  so it does not repeat « le ».
- `charts.returns.*.label`: the live en.json now has `{pct}%:` in these labels (changed after the
  snapshot), so the French uses `{pct} % : …` to match the current source and keep `i18n:check` clean.

## Money tips article (page.guide.*)
- Kept the original numbers and dollar amounts ("50 à 150 $", "3 000 $", "46 000 $"), as instructed not
  to change numbers. For a French audience, these US-dollar examples may feel foreign; consider
  localising the examples to euros in a later edit. Temperatures are shown °C first, °F in brackets.

## Possibly long strings (watch small buttons)
- `seo.title`, `rules.transitPass.title` (« Prendre un abonnement mensuel ou un badge de télépéage »),
  `page.growth.colSavingExtra` (« En épargnant le supplément »), `page.wizard.steps.loans_html`,
  `page.inputs.profiles.single` / `profiles.single.name`, `inputs.fields.homeHelp`,
  `page.banners.startBlank`, `reset.deleteAll.backupFirst` (« Télécharger d'abord une sauvegarde »),
  `layout.footer.tips.subscriptions`. French runs roughly 15–25 % longer than English overall.

## Legal text
- `privacy.*`, `terms.*` and `layout.footer.disclaimer.*` are translated faithfully and plainly, with
  law names in local form plus the English name (« RGPD/GDPR », CCPA/CPRA, DPDP Act). The CNIL was
  added next to the ICO as an example supervisory authority for French readers.
  **These need a professional legal review before launch.**
- "Google Ads Settings" kept as the brand name, followed by a French gloss in brackets.

## Not translated yet
- `layout.locale.*` (4 keys) were added to en.json after the snapshot and are left for the later pass.
