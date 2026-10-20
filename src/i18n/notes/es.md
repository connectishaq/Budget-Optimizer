# Spanish (es): translation notes

Translated from the frozen English snapshot `en-snapshot-p1.json` (1,507 messages); keys added since then were
translated in later passes.

## Register and variety
- Informal **tú** throughout, as is usual for consumer apps. No *vosotros* forms. The contact FAQ uses
  "¿Pueden…?" (ustedes) when the user is addressing the team, which works in Spain and Latin America.
- Neutral Spanish written to be understood in Spain and Mexico. Where the two differ, the Spain form is used
  in most places. Regional alternatives:

| Used | Mexico / Latin America alternative | Where |
|---|---|---|
| coche | carro / auto | rules, inputs, help, guide |
| móvil | celular | help.text.internet, rules.internetRenegotiate tips, page.guide |
| alquiler | renta | everywhere (rent) |
| piso (in "compartir piso") | departamento / depa | rules.rentBurden |
| casero | arrendador / dueño | rules.rentBurden.tips.renterLease |
| ordenador (privacy: "ordenador compartido") | computadora | privacy.sections.device.p2_html |
| portátil | laptop / computadora portátil | inputs.sample.goalLaptop |
| luz (electricity bill) | electricidad / luz | fields, rules |
| franquicia (insurance excess/deductible) | deducible | rules.insuranceRequote, page.guide.leak4 |
| abono (transport pass) | pase / tarjeta mensual | rules.transitPass |
| telepeaje | TAG / tag de peaje (MX: "TAG", "IAVE") | rules.transitPass |
| canguro (babysitter) | niñera | help.text.school, help.text.homeHelp |
| nevera | refrigerador / refri | page.guide.leak3 |
| bombilla | foco | rules, page.guide |
| alcachofa de ducha | regadera | rules.utilitiesTuneup |
| marca blanca | marca propia / marca de la tienda | rules.groceriesPlan, guide |
| VTC | apps de transporte (Uber, DiDi) | help.text.transit |
| sueldo neto | salario neto | inputs, help |
| TAE | CAT (Mexico uses CAT / tasa anual) | inputs.debts.apr, glossary |
| pillarte por sorpresa (colloquial, Spain) | tomarte por sorpresa | wizard.billPages.yearly.sub |

## Decisions worth reviewing
- **Product name**: "Household Budget Optimizer & Savings Simulator" is translated as
  "Optimizador de presupuesto familiar y simulador de ahorro"; the short brand "Budget Optimizer" as
  "Optimizador de Presupuesto". If the brand should stay in English, change `layout.brand`, `page.header.brand`,
  `page.hero.title_html`, `seo.*`, `contact.mail.subject` and the `*.seo.*` titles.
- **Day-of-month picker** (`payday.dayOfMonth` + `payday.ordinal.*`): Spanish doesn't use st/nd/rd/th. Empty
  suffixes fail `i18n:check` (it treats "" as not-a-string), so the suffix carries the rest of the phrase:
  `dayOfMonth` = "Día {day}{suffix}", each ordinal = " de cada mes" → "Día 5 de cada mes". `page.payday.dayLabel`
  became "Día de cobro" so the label + option read naturally. If the code ever uses the ordinal keys elsewhere,
  revisit this.
- **Plurals**: Spanish categories are one, many, other. `many` (used by Intl for numbers like 1,000,000) uses
  "{count} de meses" etc. English messages with only `other` (e.g. `calc.health.tip.*`, `backup.openDialog.overflow`,
  `months.banners.cap`, `months.bars.fit`, `months.stats.sinceCurrencies`) got all three forms. The `one` form
  of `backup.openDialog.overflow` and `months.bars.fit` is written without `{count}`/`{shown}` ("el mes más reciente",
  "el último mes de {count}"). The placeholder union per key is unchanged.
- **Evidence fragments** (`rules.*.evidence*`) are sentence starts that the code completes with
  `format.pctWords.*` and "de este gasto" (`plan.explain.evidenceOfThis`), e.g. "Comparar precios cada año suele
  reducir" + "aproximadamente una décima parte (10%)" + "de este gasto." Check a few in the running app.
- **historyEngine.alerts.\*Singular / \*Plural**: the code picks singular/plural from the English label, but
  Spanish labels have their own number ("Suscripciones", "Agua y gas"). I used "{label}: ha subido…" /
  "{label}: han subido…" with a colon so agreement is less jarring, but some combinations may still read
  slightly off (e.g. "Supermercado: han subido" if English treats "Groceries" as plural). Ideally the code would
  pick the form from a per-language flag.
- **rules.*.why**: "superan lo habitual para {group}" vs "supera" was matched to each Spanish noun; the
  `{group}` values are written to fit "para …" ("quienes viven de alquiler en la ciudad", "familias",
  "jóvenes profesionales").
- **dashboard.categories.basisIncome**: "a typical {profile}" became "lo típico para el perfil «{profile}»"
  because the profile names don't fit after an article.
- **Percent spacing**: kept "{pct}%" without a space (RAE prefers "15 %"), to match the app's number formatting.
- **Numbers in the money-tips article and glossary** (`page.guide.*`, `page.glossary.apr`, `lakhCrore`) keep the
  English figures and separators as written ("$3,000", "100,000", "$46,000"). Mexico reads these naturally;
  Spain would write "3.000 $" / "100.000". °F/°C order was swapped to put Celsius first (values unchanged).
- **charts.on / off** are a state label for the inflation toggle: "Activado" / "Desactivado".
- "Nice-to-haves" is translated as "caprichos" throughout (needs = "facturas obligatorias").
- "Health score" = "puntuación de salud"; "Payday" = "día de cobro"; "Backup" = "copia de seguridad".

## Possibly too long for small buttons/labels
Spanish runs ~15–30% longer. Ones to check on a phone:
- `backup.share.dialog.confirm` "Cargar presupuesto compartido"
- `page.common.downloadBackup` "Descargar copia de seguridad" (was "Download backup")
- `reset.deleteAll.backupFirst` "Descargar antes una copia"
- `page.months.openBackup` "Abrir una copia de seguridad"
- `rules.transitPass.title` "Saca un abono mensual o un dispositivo de telepeaje"
- `page.share.makeLink` "Crear un enlace para compartir"
- `page.wizard.skip` "Ir a los resultados", `page.results.nav.planAhead` "Planifica"
- `plan.effort.medium` / `rules.effort.medium` "Requiere algo de esfuerzo"
- `months.banners.capConfirm` "Guardar y eliminar {month}"

## Legal text (needs professional review before launch)
`privacy.*`, `terms.*` and `layout.footer.disclaimer.*` were translated faithfully and plainly but **need review
by a qualified Spanish-speaking lawyer** before launch, for Spain and Mexico separately if both are targeted.
- Law names: "Reglamento General de Protección de Datos de la UE y del Reino Unido (RGPD/GDPR)", "Ley de
  Privacidad del Consumidor de California (CCPA/CPRA)", "Ley de Protección de Datos Personales Digitales de la
  India de 2023 (Digital Personal Data Protection Act, DPDP)".
- In `privacy.sections.rights.p3_html` I added "la AEPD en España" next to "la ICO en el Reino Unido" as an
  example of a local authority. Remove it if no additions are wanted. Mexico's equivalent would be the INAI (now
  being reorganised), so a Mexico version may need different wording.
- "Google Ads Settings" is kept as the link text, followed by "(Configuración de anuncios de Google)".
- `updated_html` dates: "19 de octubre de 2026"; the `datetime` attribute is unchanged.
- "Standard contractual clauses" = "cláusulas contractuales tipo" (official EU Spanish term).

## Phase 6 additions
- `inputs.payFrequency.options.semimonthly` = "Quincenal" (twice a month); natural in Mexico, where *quincena* is the usual pay period. In Spain "quincenal" is also understood but monthly pay is the norm.
- `inputs.payFrequency.options.biweekly` = "Cada 2 semanas"; Mexico also says "catorcenal" (paid every *catorcena*), which could replace it for a Mexico-only build.
- `inputs.payFrequency.fieldLabel.*` follow "Sueldo neto mensual": "Sueldo neto semanal", "Sueldo neto cada 2 semanas", "Sueldo neto de cada quincena" (MX alt.: "salario neto").
- `inputs.custom.add` = "Añadir otro gasto" (not "personalizado", which sounded technical); MX alt.: "Agregar otro gasto".
- `inputs.custom.need` / `want` = "Factura obligatoria" / "Capricho", singular of the existing 50/30/20 labels.
- `inputs.custom.placeholder` "p. ej., comida para la mascota"; Mexico would also say "alimento para mascota".
- `countryFields.ES.comunidad` label is just "Gastos de comunidad" (the Spanish term itself); `MX.mantenimiento` = "Cuota de mantenimiento", `MX.gastosMedicos` = "Seguro de gastos médicos mayores" (local terms used directly, MX help says "renta" and "fraccionamiento").
- Other countries' fields use "alquiler" (Spain form; MX: renta) and "nómina" for payslip (MX: recibo de nómina / talón de pago).
- `countryFields.IN.powerBackup`: "SAI (UPS)"; Spain says SAI, Mexico/Pakistan field says UPS / "no-break" (MX colloquial).
- `countryFields.NG.estateDues`: "urbanización" (Spain) for a gated estate; Mexico would say "fraccionamiento" or "privada".
- Long labels that may wrap above an input: "Cuotas del barrio o del edificio (IPL, iuran RT/RW)", "Impuesto sobre la propiedad (taxe foncière)", "Tasa de radiotelevisión (Rundfunkbeitrag)", "Seguro médico complementario (mutuelle)".
- `GB.councilTax` / `GB.tvLicence` keep the English name in brackets after a Spanish gloss; `ID.galon` "garrafas galon" keeps the Indonesian word.
- Currency names: "Riyal saudí", "Real brasileño", "Peso mexicano", "Rupia indonesia", "Naira nigeriana" (naira is feminine in RAE usage).
