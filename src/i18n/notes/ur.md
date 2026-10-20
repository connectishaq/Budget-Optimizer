# Urdu (ur) translation notes

Pakistani Urdu, written in Nastaliq/Arabic script and shown right-to-left. I used English loan words that people in Pakistan actually say (بل، بجٹ، بونس، سبسکرپشن، کریڈٹ کارڈ، پرسنل لون، ہوم لون، اسکور، بیک اپ، ڈیوائس، سیٹنگز). The tone uses the polite "آپ" form throughout. Numbers, `{placeholders}`, currency codes, brand names and URLs are unchanged. Western digits are kept as in the English.

## Legal text: needs professional review
`privacy.*`, `terms.*` and `layout.footer.disclaimer.*` are translated faithfully but **must be reviewed by a qualified legal translator before launch**. Laws are named in Urdu with the English abbreviation (GDPR, CCPA/CPRA, DPDP, ICO). "standard contractual clauses" also keeps the English term in brackets.

## Grammar built around sentence fragments
- `rules.*.evidence*` are sentence starts that `plan.explain.*` completes. English puts the verb first ("…usually cuts {words}"), but Urdu puts it last. So each Urdu `evidence` ends with "…سے عموماً" ("by doing X, usually"), and `plan.explain.evidence` / `evidenceOfThis` / `interest*` add the verb after `{words}` ("…بچ جاتا ہے"). **If anyone edits one side, check the other side still fits.**
- `profiles.*.group` is in the oblique plural (e.g. "شہر کے کرایہ داروں") because it is always followed by "کے" ("{group} کے عام خرچ"، "{group} کے لیے").
- `payday.dayOfMonth` is "مہینے کی {day}{suffix}". Every `payday.ordinal.*` is " تاریخ", so the result reads "مہینے کی 5 تاریخ". Urdu has no st/nd/rd/th suffixes.
- `historyEngine.alerts.*` is phrased as "{label} میں … اضافہ/کمی", so it works for any label regardless of gender or number. The Singular and Plural variants are therefore identical.
- `page.banners.sample_html` and `dashboard.categories.basisIncome` insert the profile name as it is (direct case, e.g. "…گھرانہ کے لیے"). A purist would use the oblique form ("گھرانے"), but that can't be done with a placeholder. It's acceptable but slightly unnatural.
- `inputs.housing.no` and `inputs.subs.rarely` use "دیتا/دیتی" and "کرتا/کرتی" to cover both genders, because first-person verbs in Urdu are gendered.
- `dashboard.split.ofIncome_html`: the tag order is fixed (`{pct}` first, then the text), so it reads "{pct} آمدنی کا". This is understandable but terse.
- `page.growth.extra_html`: the text now comes after the `<span id="fvYears">` (the span itself is unchanged) so the Urdu word order works.

## Plurals
Urdu uses `one` and `other`. English messages that had only `other` (e.g. `calc.health.tip.*`, `months.banners.cap`, `months.stats.sinceCurrencies`, `months.bars.fit`, `backup.openDialog.overflow`) now have both. "سال" (year) and "دن" (day) are the same in singular and plural.

## Word choices and regional alternatives
- Groceries → "راشن" (Pakistan). "سودا سلف" or "گروسری" are also used.
- Fuel → "پیٹرول". In the rules this means a car's fuel bill. Diesel users may prefer "ایندھن".
- Mortgage → "ہوم لون". Rent → "کرایہ".
- Household help → "گھریلو ملازم". The examples in the label are "ماسی، باورچی، ڈرائیور".
- Charity → "خیرات". The `inputs.fields.giving` label also adds "صدقہ اور زکوٰۃ" so it is recognisable in Pakistan.
- Nice-to-haves / wants → "شوق کی چیزیں". Must-pay bills → "لازمی بل".
- Emergency fund → "ایمرجنسی فنڈ" (loan word, widely understood).
- Thermostat, standby, excess and deductible are rare in Pakistan. I kept them as loan words ("تھرموسٹیٹ"، "ایکسیس"، "ڈیڈکٹیبل").
- Brand "Budget Optimizer" → "بجٹ آپٹیمائزر" (transliterated). The full title is "گھریلو بجٹ آپٹیمائزر اور بچت سمیولیٹر". Decide whether the brand should stay in Latin script.
- `format.lakhShort` / `croreShort` use the full words "لاکھ" / "کروڑ", because "L"/"Cr" are not Urdu abbreviations. These are slightly longer.
- The guide (`page.guide.*`) keeps the original $ amounts and °F/°C as instructed. Readers in Pakistan may find the $ amounts odd.

## Longer than English (possible overflow on small buttons)
- `plan.added` "شامل ہو گیا ✓", `plan.notAdded` "شامل نہیں"
- `page.wizard.skip` "سیدھا نتائج پر جائیں"
- `page.inputs.startOverLabel` / `page.wizard.startOver` "نئے سرے سے شروع کریں"
- `reset.startOver.clear` "میرے نمبر صاف کریں"
- `rules.groceriesPlan.title` "کھانوں کی منصوبہ بندی کریں اور اسٹور کا اپنا برانڈ لیں"
- `rules.*.effort.purchase` "کچھ خریدنا ہوگا"

## Phase 6 additions
- `inputs.payFrequency.options.semimonthly` "مہینے میں 2 بار" and `biweekly` "ہر 2 ہفتے": twice-monthly vs fortnightly pay is rare in Pakistan; check they fit the ~140px dropdown ("پندرہ روزہ" is an alternative for biweekly).
- `inputs.payFrequency.fieldLabel.semimonthly` "ہر تنخواہ والے دن ہاتھ میں آنے والی رقم" is much longer than the English; could wrap.
- `inputs.custom.need` / `want` reuse "لازمی بل" / "شوق کی چیزیں" from `dashboard.split`; `help.text.customAmount` quotes them the same way.
- `inputs.typical.approximate` / `dashboard.categories.basisIncomeApprox`: "موٹا اندازہ" for "rough guide"; "اندازاً" is a more formal alternative.
- `countryFields.PK.committee` "کمیٹی / BC کی قسط": "BC" (بیسی) is the Punjab/Karachi term; some say just "کمیٹی". `PK.generatorFuel` UPS upkeep rendered as battery care ("پانی ڈلوانا"), since that's the usual recurring cost.
- `countryFields.IN.chitFund` "چٹ فنڈ / کٹی": Indian terms kept; Pakistani readers know the idea as "کمیٹی". ID `arisan` and NG `ajo/esusu` help texts explain them as "کمیٹی جیسا" for Pakistani readers.
- Foreign proper nouns (DEWA, Empower, Rundfunkbeitrag, condomínio, mutuelle, taxe foncière, IPL, iuran RT/RW, LAWMA, Medicare levy surcharge, Marketplace) are kept in Latin script inside the Urdu; this mixes LTR runs into RTL text.
- `countryFields.SA.dependentFee` "ڈیپنڈنٹ فیس": Pakistanis in KSA also call it "مرافقین فیس" / "فیملی ٹیکس".
- `format.currencies.IDR` "انڈونیشین روپیہ" (rupiah); "روپیا" is a closer transliteration.

## Phase 7 additions (country savings ideas)
- `localTips.*.evidence` follow the `rules.*.evidence` pattern ("…سے عموماً" / "…سے اکثر"), so `plan.explain.*` adds "{words} بچ جاتا ہے" after them.
- `ae-rent-cheques` / `sa-rent-instalments` evidence "…سالانہ کرایے میں سے اکثر" + "اس خرچ کا {words}…" reads slightly doubled ("کرایے" then "اس خرچ"); acceptable, but check in context.
- `gb-council-tax-discount` evidence has no "عموماً" (English "cuts" is definite), like `subsCancelUnused`.
- Rent ideas use the oblique noun "کرایے" (and "پینے کے پانی"، "جنریٹر کے ایندھن"، "خریداری اور اضافی چیزوں"، "جنریٹر اور UPS کے خرچ") because `plan.explain.start` puts "پر" after `{noun}`.
- `pk-protected-slab`: "protected سلیب" kept in Latin as printed on bills/news; some say "محفوظ صارف". "یونٹس" in quotes matches the bill wording.
- `pk-solar-ups`: grid power called "واپڈا کی بجلی" (everyday term even though DISCOMs now bill); "لوڈشیڈنگ" used for load-shedding. Geyser electric element → "بجلی والا راڈ".
- `pk-gas-geyser`: tankless geyser → "انسٹنٹ (بغیر ٹینکی والا) گیزر".
- Foreign terms kept in Latin with a short Urdu gloss in brackets: Salik (ٹول)، rotativo، consignado، bandeira، revolving، pago aplazado، usurious، Grundversorgung، Abschlag، Deutschlandticket، PVPC، potencia، tarif réglementé (TRV)، chèque énergie، loi Hamon، Ofgem، price cap، band، KRL، ojek، galon، PDAM، DISCOM، Aadhaar، MSI/quincena، CFE، DAC، Gas LP، DisCo، Band A، Ejar، open enrollment. Mixed LTR runs in RTL text.
- `id-krl-tj`: "rupiah" rendered as "روپیہ" (as in `format.currencies.IDR`).
- `sa-6000-kwh`: "halalas" → "ہللہ"; "majlis" → "مجلس".
- `sa-bnpl` title quotes "ابھی خریدیں، بعد میں ادا کریں" for buy-now-pay-later; "BNPL" is not widely known in Pakistan.
- Longer than English: `ae-salik-nol.title`, `id-galon-depot.title`, `sa-rent-instalments.title` may wrap on small cards.

## About page
- `about.seo.*` keep the brand "Household Budget Optimizer" in Latin script (as requested), while `about.title` and `about.sections.who.p1` use "بجٹ آپٹیمائزر"; align if the brand decision changes.
- Nav and footer both use "ہمارے بارے میں" (English "About" / "About us").
- `about.toc.standards` "ادارتی اصول" (editorial standards) is formal; "ہمارے اصول" would be plainer.
- `about.table.sourceCount` uses "ذریعہ / ذرائع" for sources; "سورس" is a common loan word alternative.
- `about.sections.how.item1_html` utilities as "بجلی، گیس اور پانی".

## Neutral home article
- `page.guide.*` no longer uses $ or °F first; the guide note above about keeping $ amounts is superseded (plain "250"، "46,000"، Celsius first).
- `leak1.fix1_html` "سوئچ والے ایکسٹینشن بورڈ" for switched power strips (everyday Pakistani term).
- `leak1.fix2_html` / `wealth.p3` render "heating / air conditioning" as "ہیٹر / اے سی"; "اے سی اتنا ہی زیادہ کر دیں" means raise the AC temperature — could be misread as more cooling.
- `leak4.fix4_html` "زیادہ ایکسیس (ڈیڈکٹیبل)": rare concept in Pakistan, kept as loan words.
- `leak5.body_html` "کسی بھی کرنسی میں 3,000" and "تقریباً 60 ماہانہ" read bare without a currency word, like the English.
- `wealth.p1_html` "منافع دینے والے سیونگز اکاؤنٹ" (profit, as Pakistani banks say) for "pays interest".
