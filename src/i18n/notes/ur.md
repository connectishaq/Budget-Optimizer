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

## Not translated in this pass
The 4 `layout.locale.*` keys were added to en.json after the snapshot, so they are not in ur.json yet. They need a follow-up pass.
