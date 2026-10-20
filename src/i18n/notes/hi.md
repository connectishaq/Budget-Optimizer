# Hindi (hi) translation notes

Source: English snapshot `en-snapshot-p1.json` (1,507 messages). Market: India. Everyday Hindi in
Devanagari, using the English loan words people actually say (EMI, बिल, बजट, लोन, क्रेडिट कार्ड,
सब्सक्रिप्शन, बैकअप, सेव, ऐप). Polite "आप" form throughout, with imperative "-एँ" ("जोड़ें", "देखें").

## Updated to the current en.json
These 9 messages changed in en.json after the snapshot was taken. hi.json follows the **new** English
so `npm run i18n:check` has no placeholder errors: `inputs.debts.aprCapped` ({max}),
`charts.returns.*.label` ({pct}), `inputs.typical.approximate`, `dashboard.categories.basisIncomeApprox`,
`page.hero.note` (13 currencies), `page.faq.a8`, `seo.faq.a8`, `seo.app.featureList[11]`.
These were translated later, with the phase 6 keys: `format.currencies.SAR/BRL/MXN/IDR/NGN`, `layout.locale.*`.

## Sentences built from pieces (please review in the running app)
- **`rules.*.evidence`** + `plan.explain.evidence` / `evidenceOfThis` / `interest`: Hindi puts the verb
  last, so each `evidence` fragment is written as "X करने से आमतौर पर" ("by doing X, usually") and
  the templates finish the sentence: "{evidence} इस खर्च का {words} बच जाता है।". Result, e.g.:
  "ख़रीदने से पहले 24 घंटे रुकने से आमतौर पर इस खर्च का लगभग पाँचवाँ हिस्सा (20%) बच जाता है।"
  If a new rule is added, its evidence must follow the same "…से आमतौर पर" pattern.
- **`rules.*.noun`** is used after "पर" in `plan.explain.start` ("हर महीने {noun} पर {amount} खर्च"),
  so nouns are in the oblique form (e.g. "किराए या होम लोन", "डॉक्टर और दवाइयों").
- **`profiles.*.group`** is always followed by "के लिए/के", so groups are oblique plural
  ("शहर में किराए पर रहने वालों", "परिवारों").
- **`historyEngine.alerts.*`**: rewritten as "{label}: लगातार {count} महीने से बढ़ोतरी।" to avoid
  gender/number agreement with the label. Singular/plural variants are therefore identical.
- **`dashboard.summary.tips` / `easyTips`** ("other" form "सुझावों") are inserted into
  "{tips} पर चलकर…", which needs the oblique plural.
- **`plan.costPayback`** reads "…लागत वसूल होने का समय: {time}।" so that `format.duration.now`
  ("तुरंत") and `plan.longTime` ("लंबा समय") both fit.
- **`page.banners.sample_html`**: the profile name is inserted inside the span; "…परिवार के लिए" vs
  "…का परिवार के लिए" can read slightly off depending on the profile name.
- **`page.growth.extra_html`** + `charts.afterYears`: "आपके पास इतना अतिरिक्त पैसा होगा {N साल बाद}".

## Plurals
Hindi categories are `one`, `other` (Intl: "one" covers 0 and 1). Messages that had only `other` in
English (e.g. `calc.health.tip.*`, `months.banners.cap`, `backup.openDialog.overflow`) now have both.
Most Hindi nouns used here (साल, पॉइंट, दिन, लक्ष्य) don't change, so the two forms are often the same.
With count 0, "one" is used: "0 महीना" is acceptable but could be reviewed.

## payday.ordinal
All four suffixes are empty strings: "महीने की {day}{suffix} तारीख" → "महीने की 5 तारीख".

## Word choices / regional alternatives
- Groceries → "राशन" (common in North India); alternative "किराना".
- Fuel → "पेट्रोल-डीज़ल"; Fares & tolls → "किराया-भाड़ा और टोल" (note: "किराया" also means rent;
  context makes it clear, but "भाड़ा" alone is an alternative).
- Rent/mortgage → "किराया / होम लोन (की किस्त)"; "mortgage insurance" kept as "मॉर्गेज इंश्योरेंस"
  (not a common Indian product; the tip `rules.rentBurden.tips.ownerInsurance` is US-oriented).
- Excess/deductible → "डिडक्टिबल (excess)".
- Household help → "बाई, कुक, ड्राइवर"; "बाई" is common in Mumbai/West India; alternatives
  "कामवाली", "मेड".
- Toll tag → mentioned "FASTag जैसा टोल टैग" in the title of `rules.transitPass` (FASTag is the Indian
  system). Remove if the app should stay country-neutral.
- Generic medicine "active ingredient" → "साल्ट" (what pharmacists in India say).
- Committee payment → "कमेटी (चिट फ़ंड)".
- Nice-to-haves → "शौक़ की चीज़ें"; must-pay bills → "ज़रूरी बिल".
- Health score → kept as "हेल्थ स्कोर" (more natural in apps than "स्वास्थ्य अंक").
- Inflation → "महँगाई"; compound growth → "चक्रवृद्धि बढ़त (कंपाउंडिंग)".
- Payday → "सैलरी का दिन".
- Brand "Budget Optimizer" / "Household Budget Optimizer & Savings Simulator" translated as
  "बजट ऑप्टिमाइज़र" / "घरेलू बजट ऑप्टिमाइज़र और बचत सिम्युलेटर". Keep in English instead if the
  product name should not be localised (also in `contact.mail.subject` and SEO titles).
- `format.lakhShort` / `croreShort` use the full words "लाख" / "करोड़" (Hindi has no common
  abbreviation like "L"/"Cr"); slightly longer in charts.
- Gendered first-person phrases use "भरता/भरती", "करता/करती", "लूँगा/लूँगी", "होऊँगा/होऊँगी".
  These slashes are common in Hindi UI but longer; check `inputs.housing.no`, `inputs.subs.rarely`,
  `page.goals.debtTitle`, `subs.kinds.other.tip`, `page.faq.q8`.

## Money tips article (page.guide.*)
The article is US-oriented ($ amounts, °F, thermostats, toll transponders). Numbers and units were
kept as they are (not converted); "drain hundreds every month" is "हर महीने सैकड़ों निकाल ले जाते हैं"
in `page.guide.intro1_html` (for Indian readers "हज़ारों रुपये" would feel more natural, but that
would change the figure). `fix2_html` in leak1: "7–10°F (4–6°C) कम-ज़्यादा कर दें" (lower heating /
raise AC).

## Possibly long strings (small buttons)
- `plan.effort.medium` "थोड़ी मेहनत लगेगी", `plan.effort.purchase` "कुछ खरीदना होगा"
- `page.wizard.skip` "सीधे नतीजों पर जाएँ", `page.common.backToMonth` "इस महीने पर वापस जाएँ"
- `reset.deleteAll.backupFirst` "पहले बैकअप डाउनलोड करें"
- `page.share.printButton` "प्रिंट करें या PDF के रूप में सेव करें"
- `months.banners.capConfirm` "सेव करें और {month} हटाएँ"

## Legal text — needs professional review before launch
`privacy.*`, `terms.*` and `layout.footer.disclaimer.*` are translated faithfully in plain Hindi but
**need a professional legal review**. Law names: "GDPR (सामान्य डेटा संरक्षण विनियम)",
"कैलिफ़ोर्निया कंज़्यूमर प्राइवेसी एक्ट (CCPA/CPRA)", "डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023
(DPDP Act)" (official Hindi name of India's DPDP Act should be confirmed), "standard contractual
clauses" kept in English in brackets. "As is" / "as available" → "जैसी है" / "जैसी उपलब्ध है".
UI labels quoted in the legal pages (<em>…</em>) match the Hindi UI strings.

## Phase 6 additions
- `inputs.custom.need` / `want` reuse the 50/30/20 labels exactly ("ज़रूरी बिल" / "शौक़ की चीज़ें"); for a single row the singular "शौक़ की चीज़" may read better.
- `inputs.payFrequency.options.*`: "हर हफ़्ते", "हर 2 हफ़्ते", "महीने में 2 बार", "हर महीने" (short for the narrow dropdown); alternative "पाक्षिक" for every 2 weeks is too formal.
- `inputs.payFrequency.fieldLabel.semimonthly`: "हर सैलरी के दिन हाथ में आने वाली सैलरी" repeats "सैलरी"; alternative "हर बार हाथ में आने वाली सैलरी".
- `inputs.custom.add` "अपना खर्च जोड़ें" ("add your own expense") rather than a literal "custom"; alternative "दूसरा खर्च जोड़ें".
- `countryFields.IN.chitFund.label`: "चिट फ़ंड / कमेटी / किटी" — "कमेटी" (North India), "किटी" (urban women's groups), "चिट फ़ंड" (South India / formal); "बीसी" is another North-Indian term.
- `countryFields.IN.powerBackup`: "DG" kept as societies write it; "इन्वर्टर" and "UPS" used interchangeably in India.
- Rotating savings groups (arisan, ajo/esusu, BC) explained as "बारी-बारी वाला बचत ग्रुप"; contribution → "किस्त".
- Foreign proper nouns (Rundfunkbeitrag, condomínio, mutuelle, taxe foncière, iqama, IPL, iuran RT/RW, LAWMA, Medicare levy surcharge) kept in Latin script with a Hindi gloss.
- `countryFields.SA.dependentFee.label` "प्रवासियों" for expats; alternative "विदेशी कर्मचारियों".
- `format.currencies.BRL` "ब्राज़ीली रियाल" (alternative "ब्राज़ीलियाई रियल"); `IDR` "इंडोनेशियाई रुपिया".
