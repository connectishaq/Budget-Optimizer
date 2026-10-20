# German (de-DE) translation notes

Source: frozen English snapshot `en-snapshot-p1.json` (1,507 messages); keys added to en.json since then were
translated in later passes.

## Form of address
- **"du"** throughout (lowercase), including the privacy policy and terms, so the site has one voice.
  Imperatives use the short du-form ("Trag … ein", "Prüf …", "Leg … zurück").
- Plurals use German `one` / `other`. English messages that only had `other` (for example
  `calc.health.tip.*`, `months.banners.cap`, `months.bars.fit`, `months.stats.sinceCurrencies`,
  `backup.openDialog.overflow`) now have both forms.

## Terms chosen (keep consistent)
| English | German |
|---|---|
| take-home pay | Nettoeinkommen / Netto |
| emergency fund | Notgroschen |
| nice-to-haves / wants | Extras |
| must-pay bills / needs | Pflichtausgaben |
| health score | Finanz-Punktzahl (section heading: "Budget-Gesundheit") |
| subscriptions | Abos |
| backup | Sicherung |
| APR | effektiver Jahreszins |
| rent or mortgage | Miete oder Kreditrate |
| once-a-year costs | jährliche Kosten |
| fuel | Sprit (alternative: Kraftstoff, more formal) |
| payday | Zahltag |
| balance transfer | Saldoübertragung |
| home insurance | Hausratversicherung (field label says "Hausrat- oder Gebäudeversicherung") |
| excess / deductible | Selbstbeteiligung |
| product name "Household Budget Optimizer & Savings Simulator" | "Haushaltsbudget-Optimierer & Sparrechner" in titles/SEO/legal; header brand "Budget Optimizer" left in English. Please confirm whether the product name should be translated. |

## Phrases worth a second look
- `rules.*.evidence`: these are sentence starts that get "{words}" and "dieser Ausgaben/Zinsen" added after them
  (`plan.explain.evidence*`). Each one ends in "spart meist" / "vermeidet meist" so the sentence works, e.g.
  "Wer jedes Jahr Angebote vergleicht, spart meist etwa ein Viertel (25 %) dieser Ausgaben." Please check a few in the app.
- `rules.*.noun` goes into "…gibst du {amount} im Monat für {noun} aus", so nouns are in the accusative
  (e.g. `carRefinance.noun` = "die Rate für deinen Autokredit").
- `profiles.*.group` goes into "üblich für {group}": "Stadtmieter", "Familien", "junge Berufstätige".
  "Stadtmieter" is the generic masculine; a gender-neutral alternative would be "Mietende in der Stadt".
- `historyEngine.alerts.*Singular/*Plural`: English changes the verb by label number. German uses one neutral
  pattern for both ("{label}: 3 Monate in Folge gestiegen."), so Singular and Plural are the same text.
- `dashboard.summary.easyTips`: written in the accusative ("1 einfachen Tipp" / "3 einfache Tipps"), because it only
  appears inside "Wenn du {tips} befolgst, …".
- `plan.costPayback`: "Kostet einmalig {amount}, hat sich bezahlt gemacht nach: {time}." The colon avoids a case
  clash with `format.duration` ("3 Monate" vs "nach 3 Monaten"). Same idea in `goals.status.progress`
  ("Dauer: {time}") and `goals.summary.emergencyIn` ("3 Monate: noch etwa {time}").
- `payday.dayOfMonth` / `payday.ordinal.*`: every ordinal suffix is "." → "15. des Monats". `payday.lastDay` =
  "Letzten Tag des Monats" so it reads after "Mein Gehalt kommt am"; as a standalone option it looks slightly odd.
- `months.goals.savedIn`: "Gespeichert in {month}" assumes {month} is "Oktober 2026"; "im Oktober 2026" would
  read better if {month} is never a bare year.
- `help.text.other`: "committee payment" (a rotating savings group common in South Asia) is translated as
  "Beiträge zu einem Sparzirkel".
- `rules.electricitySlab`: tiered electricity pricing doesn't exist in Germany, but the rule only shows for INR/PKR.
  "price slab" became "Tarifstufe".
- `rules.transitPass.tips.tollTag` → "Maut-Box"; I added "(z. B. Jobticket)" to the employer tip, which is a
  common German example. Remove it if no additions are wanted.
- `rules.rentBurden.tips.ownerInsurance`: US-style mortgage insurance (PMI) doesn't really exist in Germany;
  translated loosely as "Zusatzversicherungen zum Kredit". Please review.
- `rules.rentBurden.evidenceOwner` / `ownerTax`: "appealing your property tax" → "Einspruch gegen die Grundsteuer";
  this is rare in Germany.
- Guide article (`page.guide.*`): the dollar figures are kept as US-dollar amounts in German format
  ("50–150 $", "3.000 $", "46.000 $"). Temperatures are given as °C first, then °F. A German editor may prefer
  euro examples, but the numbers have not been changed.
- `page.guide.leak5.title_html`: "High-Interest Debt" → "teure Schulden".
- `page.wealth.p1_html`: "high-yield savings account" → "gut verzinstes Tagesgeldkonto", "checking account" →
  "Girokonto", "index fund" → "Indexfonds (ETF)".

## Labels much longer than English (could overflow small buttons or chips)
- `profiles.single.name` / `page.inputs.profiles.single`: "Single zur Miete in der Stadt" (English: "Single City Renter")
- `profiles.suburban.name`: "Vierköpfige Familie am Stadtrand"
- `inputs.chips.tapToAdd`: "Zum Hinzufügen tippen"
- `backup.openDialog.merge`: "Zusammenführen" (dialog button)
- `plan.notAdded`: "Nicht hinzugefügt"; `plan.added`: "Hinzugefügt ✓"
- `payday.steps.yearlyAdd.action`: "Jährliche Kosten eintragen"
- `profiles.sample.gymMembership`: "Fitnessstudio-Mitgliedschaft" (long single word, can't wrap)
- `subs.kinds.membership.label`: "Mitgliedschaften & Lieferdienste"
- `calc.health.labels.needsAttention`: "Braucht Aufmerksamkeit"
- `page.results.nav.*` tabs are short (Überblick, Ideen, Zahltag, Gesundheit, Ausgaben, Wachstum, Vorplanen, Verlauf),
  but "Gesundheit" is wider than "Health".
- `inputs.fields.homeHelp.label`: "Haushaltshilfe (Putzhilfe, Koch, Fahrer)"

## Regional notes
- Written for Germany. Austria/Switzerland would mostly work; Swiss German spelling uses "ss" instead of "ß".
- "Sprit" is informal; "Kraftstoff" or "Benzin" are alternatives. "Handy" is the everyday German word for mobile phone.

## Legal text: needs professional review
`privacy.*`, `terms.*` and `layout.footer.disclaimer.*` are faithful plain-language translations, **not legally
reviewed**. A German lawyer should check them before launch, in particular:
- whether "du" is acceptable in the legal pages, or whether "Sie" is preferred there;
- GDPR is given as "Datenschutz-Grundverordnung … (DSGVO/GDPR)"; the CCPA/CPRA and India's DPDP Act keep their
  English names;
- `privacy.sections.rights.p3_html` names the UK ICO as its example authority, as in the English. A German version
  may want to name the competent German supervisory authority (Landesdatenschutzbehörde) instead;
- the German legal terms used: "berechtigtes Interesse", "Standardvertragsklauseln", "Gewährleistung", "Haftungsbeschränkung";
- German sites usually also need an Impressum, which the English source doesn't have.

## Phase 6 additions
- The four `layout.locale.*` keys mentioned at the top are now translated ("Sprache", "Land", "Anderes Land").
- `inputs.payFrequency.options.semimonthly`: "2× im Monat" to fit the narrow dropdown; "Zweimal monatlich" if there is room.
- `inputs.payFrequency.label`: "Wie oft du Geld bekommst" (more neutral than "Gehalt", covers wages and benefits).
- `inputs.custom.need` / `want`: singular forms "Pflichtausgabe" / "Extra" of the existing 50/30/20 terms; `help.text.customAmount` quotes them.
- `inputs.typical.approximate` and `dashboard.categories.basisIncomeApprox`: "grober Richtwert" for "rough guide"; alternative "grobe Schätzung".
- `page.hero.note`: "Ohne Anmeldung" for "No sign-up"; "Keine Registrierung" is a common alternative. Note: the older `page.*` feature list still says "Acht Währungen …" from the English source of that time.
- Rotating savings groups (Arisan, Chit Fund/Kitty, Ajo/Esusu, Committee/BC) are all "Sparzirkel", matching `help.text.other`.
- `countryFields.*` "Building fee" for BR/ES/MX → "Hausgeld" (German term for owners' service charge); "Nebenkosten" would be the tenant's view.
- `countryFields.MX.gastosMedicos.label`: shortened to "Private Krankenvers. (gastos médicos mayores)"; still long, may wrap.
- `countryFields.IN.societyMaintenance.label`: "Society-Instandhaltung" keeps the Indian term "society"; alternative "Instandhaltung Wohnanlage".
- `countryFields.AE.chillerFee.label`: "Fernkälte" is the technical German term for district cooling; may be unfamiliar to many readers.
- UPS → "USV" (German abbreviation); "Load-Shedding" kept in English in brackets after "Stromabschaltungen".
- `countryFields.GB.*`: "Council Tax" and "TV Licence" kept as proper nouns, explained in the help text.
- `countryFields.SA.dependentFee.help`: "saudischer Staatsbürger" is the generic masculine; neutral alternative "wenn du die saudische Staatsbürgerschaft hast".
- `format.currencies.NGN`: "Nigerianischer Naira" (masculine, per Duden); "Naira" is sometimes used as feminine.

## Phase 7 additions (country savings ideas)
- `localTips.*.evidence`: same pattern as `rules.*.evidence`, ending in "spart meist/oft" or "vermeidet meist" (credit-card ideas), so "{evidence} {words} dieser Ausgaben/Zinsen." reads as a sentence.
- `ae-rent-cheques` / `sa-rent-instalments` evidence: English "lowers the yearly rent by" became "spart bei der Jahresmiete oft" so it fits "… etwa ein Zehntel dieser Ausgaben".
- `localTips.*.noun`: accusative after "für" ("für Strom", "für die Kfz-Versicherung", "für die Council Tax", "für Beiträge zur Krankenversicherung").
- Local names kept, with a short German gloss in brackets on first use: DEWA, Salik, Nol, Default Market Offer, Rotativo, consignado, bandeira vermelha, Tarifa Social, PVPC, potencia, CNMC, TAE, pago aplazado, prime transport, forfait mobilités durables, TRV/heures creuses, chèque énergie, loi Hamon, Ofgem price cap, Direct Debit, single person discount, PLN, KRL, Ojek, PDAM, PM Surya Ghar, DISCOM, Aadhaar, PNG, NCMC, MSI/Quincena, CFE/DAC, Gas LP, DisCo/MAP/NERC, Band A, Geyser, Ejar, SEC, Majlis, Open Enrollment, Marketplace, deductible.
- `gb-council-tax-discount`: council tax "band" → "Band (Steuerstufe)"; German has no equivalent.
- `in-rooftop-solar`: "net meter" → "Zweirichtungszähler (Net Meter)".
- `pk-*`: "geyser" kept as "Geyser (Warmwasserboiler)"; "instant geyser" → "Durchlauferhitzer".
- `ng-meter-band`: "crazy billing" → "verrückte" Abrechnungen in quotes; a Nigerian colloquialism, may read oddly.
- `ng-solar-inverter` label/noun "Sprit für den Generator" (matches `countryFields.NG.generatorFuel`); `pk-solar-ups` "Generator & USV".
- `sa-bnpl`: "buy now, pay later" → „Jetzt kaufen, später zahlen“; "BNPL"/"Ratenkauf" are alternatives.
- `de-jobticket`: uses the official name "Deutschlandticket Job"; check the 63 € price is still current at launch.
- `fr-prime-transport`: "transit pass" → "Zeitkarte" (covers monthly and yearly passes).
