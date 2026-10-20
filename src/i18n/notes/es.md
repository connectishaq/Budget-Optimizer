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
| nevera | refrigerador / refri | page.guide.leak3 |
| bombilla | foco | rules, page.guide |
| marca blanca | marca propia / marca de la tienda | rules.groceriesPlan, guide |
| VTC | apps de transporte (Uber, DiDi) | help.text.transit |
| sueldo neto | salario neto | inputs, help |
| TAE | CAT (Mexico uses CAT / tasa anual) | inputs.debts.apr, glossary |

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
- (fixed, see Review pass) **Numbers in the money-tips article and glossary** (`page.guide.*`, `page.glossary.apr`, `lakhCrore`) keep the
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

## Phase 7 additions (country savings ideas)
- `localTips.*.label` / `noun` reuse the existing field names ("Luz", "Agua y gas", "Billetes y peajes", "Internet y teléfono", "Seguro del coche"); new ones: "Tarjetas de crédito" / "intereses de la tarjeta de crédito", "Compras y extras", "Agua potable", "Generador y UPS", "Impuesto municipal" (noun keeps "(council tax)").
- Evidence fragments follow `rules.*.evidence` ("… suele reducir" + {words} + "de este gasto"); credit-card ideas use "… evita" to fit `plan.explain.interest` ("… de esos intereses"). The rent ideas (`ae-rent-cheques`, `sa-rent-instalments`) read "suele rebajar el alquiler anual en aproximadamente una décima parte (10%) de este gasto", slightly clunky, like the English.
- Rent ideas for AE, SA and NG use the Spain forms "alquiler" / "casero" / "piso" (MX: renta / arrendador / departamento).
- `mx-*` ideas use Mexican wording: "quincena", "meses sin intereses (MSI)", "precio de contado", "recibo de la CFE", "tanque de gas" (Spain: bombona), "refrigeradores" and "minisplits", "boiler" (Spain: calentador / termo), "repartidor".
- `es-*` ideas use Spain wording: "potencia contratada", "te salta el automático", "horas valle", "abono joven / abono único", "tarjeta transporte", "tarjeta revolving", "pago aplazado", "usuraria".
- `es-pvpc-vs-libre.tips.3`: English says off-peak = 00:00–08:00 and weekends; in Spain that is the "periodo valle" of the 2.0TD tariff, so "horas valle" is used.
- `br-sair-do-rotativo`: "rotativo" kept as the Brazilian term ("el rotativo de la tarjeta"); "consignado" glossed as "préstamo con descuento en nómina".
- `br-bandeira-chuveiro`: "bandeira" kept, glossed once as "bandera roja (bandeira vermelha)"; "ducha eléctrica" for chuveiro elétrico.
- `pk-*`: "geyser" glossed as "calentador (geyser)"; load-shedding = "cortes programados (load-shedding)"; "units" kept in quotes as printed on Pakistani bills.
- `in-metro-card.why`: "autos" (auto-rickshaws) rendered as "autorickshaw" to avoid confusion with "auto" = car in Mexico.
- `in-lpg-subsidy`: LPG = "GLP", cylinder = "bombona" (Spain; MX: tanque / cilindro).
- `id-galon-depot`: "galones" for Indonesian galon water jugs (19 L), "depósito de recarga" for depot isi ulang; could also be "garrafas" as in `countryFields.ID.galon`.
- `ng-meter-band.why`: "crazy" billing = facturas «locas»; DisCo, NERC, MAP kept as acronyms.
- `gb-council-tax-discount`: council = "ayuntamiento (council)"; "single person discount" kept in brackets.
- `us-open-enrollment`: "inscripción abierta (open enrollment)" and "deducible" (the usual US Spanish term) rather than Spain "franquicia"; "Si los dos tienen seguro" uses ustedes, natural for the US market (Spain: "tenéis" would break the no-vosotros rule).
- `de-energy-switch.why`: "ct/kWh" written as "céntimos/kWh" (MX would say "centavos de euro").
- `sa-6000-kwh.why`: "villas" = "chalés" (Spain; MX: "casas grandes" / "residencias").
- Possibly long titles for cards: `ae-salik-nol.title`, `id-krl-tj.title`, `in-lpg-subsidy.title`, `sa-bnpl.title`.

## About page
- `about.seo.*` keep the brand "Household Budget Optimizer" in Latin script (as requested), while `about.title` and `about.sections.who.p1` use the translated brand "Optimizador de Presupuesto"; align if the brand decision changes.
- Nav "Acerca de" vs footer "Sobre nosotros" (English "About" / "About us"); either could be used in both places.
- `about.sections.standards.p1` "información general" for "general education" (literal "educación general" reads like schooling).
- `about.sections.how.item1_html` "suministros" for utilities; Mexico would say "servicios".
- `about.table.sourceCount.many` "{count} de fuentes" (only for millions), following the existing plural pattern.

## Neutral home article
- `page.guide.*` no longer uses $ or °F first; the older note about "$3,000"/"$46,000" above is superseded (Celsius first; figure grouping fixed in the review pass below).
- `leak1.fix1_html` "regletas con interruptor" for switched power strips; MX alt.: "multicontactos con apagador".
- `leak1.fix4` "calentador de agua o termo" (Spain); MX would say "boiler" / "calentador".
- `leak4.fix3` "dispositivos de telepeaje" for toll tags (MX: "TAG").
- `leak4.fix4_html` "franquicia (deducible)" gives both the Spain and Latin American term, mirroring the English "excess (deductible)".
- `leak5.body_html` "un saldo de 3,000 en cualquier moneda" and "60 al mes" read a little bare without a currency; the English is the same.
- `wealth.p1_html` "la cuenta que usas a diario" for "everyday bank account" (Spain would also say "cuenta corriente", MX "cuenta de débito").

## Review pass (2026-10-20)
- AC direction: `rules.utilitiesEfficiency.tips.night` now says heating a few degrees lower or AC a few degrees higher; `.evidence` says "usar menos" instead of the ambiguous "bajar ... el aire"; `page.guide.leak1.fix2_html` "sube la temperatura del aire acondicionado" (was "sube el aire acondicionado", which reads as more cooling).
- Must-pay bills: "facturas básicas" → "facturas obligatorias" in `calc.health.emergency.none/under3/under6/done` and `help.text.emergency`, matching the rest of the file.
- Store brand: `rules.groceriesPlan.tips.storeBrand` "marca de la tienda" → "marca blanca", as in its title and the guide.
- Wrong fact: `seo.app.featureList.11` said "Ocho monedas"; English says 13 → "13 monedas".
- Quotes: straight/curly quotes → «» in `rules.electricitySlab.tips.units`, `localTips.br-bandeira-chuveiro.tips.1`, `localTips.es-revolving.tips.1`, `localTips.mx-meses-sin-intereses.title`, `localTips.mx-tarifa-dac.tips.1`.
- Number grouping: "3,000", "46,000", "147,000", "100,000", "30,000", "10,000,000" (comma thousands read as decimals in Spain) and "1.300", "1.444,70", "3.500", "6.000" (period thousands read as decimals in Mexico) now use the RAE neutral form: no separator for 4 digits, non-breaking space from 5 digits ("46 000", "10 000 000"). Keys: `page.guide.leak5.body_html`, `page.guide.wealth.p2_html`, `page.glossary.apr` / `lakhCrore`, `localTips.id-va-power.why`, `localTips.id-krl-tj.why`, `localTips.sa-6000-kwh.*`. The es-es ("2.400 €") and es-mx ("$1,200") articles keep their country formats.
- Neutral wording: "pillarte por sorpresa" → "tomarte por sorpresa"; "alcachofa de ducha" → "cabezal de ducha" (×2); "canguro" → "niñera" in `help.text.school` / `help.text.homeHelp` (in Mexico "canguro" only means kangaroo).
- Left for a native reviewer: the other Spain-leaning words in the table above (coche, móvil, alquiler, piso, casero, ordenador, nevera, bombilla, franquicia, TAE, "Bonus"), decimal commas in country amounts ("18,36 €", "6,30 AED"), historyEngine singular/plural agreement, and the brand decision.
