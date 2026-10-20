# Arabic (ar): translation notes

Translated from the frozen English snapshot `en-snapshot-p1.json` (1,507 messages); keys added since then were
translated in later passes.

## Register and variety
- Modern Standard Arabic for the UAE and Saudi Arabia, kept plain and short.
- The user is addressed in the **masculine singular** (اختر، أضف، أنت), the usual default for Gulf consumer
  apps. If gender-neutral wording is wanted later, the imperatives would need a rewrite (e.g. plural forms or
  noun phrases like «إضافة»).
- Digits are left as Western digits (0–9) as in the English, matching common UAE/Saudi web usage. Currency
  codes, brand names (Netflix, Google Ads Settings, AdSense, iCloud, Google One, Claude, Safari, iPhone/iPad,
  Visa), "50/30/20", URLs and e-mail addresses are unchanged.
- Arrows in click paths (“Start over → Delete everything”) are written as `←` because the page reads right to
  left (privacy.sections.summary.item3_html, privacy.sections.device.p2_html, contact.faq.delete.a_html).

## Regional alternatives
| Used | Alternative | Where |
|---|---|---|
| الجوال (mobile phone) | الهاتف المحمول / الموبايل | help.text.internet, rules.internetRenegotiate |
| البقالة (groceries) | المقاضي (Saudi colloquial) / مشتريات البيت | everywhere |
| العمالة المنزلية / عاملة منزلية | خادمة (avoided as less respectful) | inputs.fields.homeHelp, help.text.homeHelp |
| القرض العقاري | التمويل العقاري (common in Saudi, Islamic-finance wording) | rent/mortgage everywhere |
| معدل الفائدة | معدل الربح / النسبة السنوية (Islamic banks avoid “فائدة”) | debts, APR, guide |
| بطاقة رسوم الطرق | Salik (Dubai) / Darb (Abu Dhabi) — kept generic | rules.transitPass |
| مبلغ التحمّل (insurance excess/deductible) | نسبة التحمّل | rules.insuranceRequote, guide leak4 |
| صافي الراتب (take-home pay) | الراتب الصافي | inputs, help |
| الكماليات (nice-to-haves / wants) | الرغبات | calc, help, glossary |

## Decisions worth reviewing
- **Product name**: "Household Budget Optimizer & Savings Simulator" → «مُحسِّن ميزانية الأسرة ومحاكي الادخار»;
  short brand "Budget Optimizer" → «مُحسِّن الميزانية». If the brand should stay in English, change
  `layout.brand`, `page.header.brand`, `page.hero.title_html`, `seo.*`, `contact.mail.subject` and `*.seo.*`.
- **Plurals**: all six categories are filled. `one` and `two` use the Arabic singular/dual words without the
  number (e.g. «شهر واحد», «شهران»/«شهرين» by case); `few` uses the plural (3–10), `many` the accusative
  singular (11–99, «شهرًا»), `zero`/`other` the genitive singular. Where English had only `other`
  (e.g. calc.health.tip.*, months.banners.cap) all six were still written.
- **Sentences with a number but no plural object** (e.g. `goals.summary.emergencyFull` "{months} months",
  `charts.yearsValueText` "{years} years", `goals.emergency.cover_html`) use the generic singular
  («{months} شهر», «{years} سنة») because the code doesn't pass a plural count. Grammatical for 11+ and
  acceptable, but «3 شهر» is slightly off; turning these into plural messages would fix it.
- **Day-of-month picker** (`payday.dayOfMonth` + `payday.ordinal.*`): Arabic has no st/nd/rd/th. The
  ordinal values are a single invisible right-to-left mark (U+200F) instead of empty strings, because
  `npm run i18n:check` reports an empty string as "must be a string" (`isPlural("")` returns `""`, not
  `false`). The visible result is «اليوم 5 من الشهر».
- **Sentence fragments joined in code**: `rules.*.evidence` + `format.pctWords.*` + `plan.explain.*` build
  the "How did we get this?" sentence. Arabic was written so the pieces read as one sentence
  ("… يخفّض عادةً نحو الخُمس (20%) من هذا الإنفاق."), but it should be checked on screen.
  `format.pctWords.all` is «المبلغ كله (100%)».
- `common.periodWord.*` is only used inside `page.summary.receiptTitle_html`; the title was rebuilt as
  «حصيلة <span>الشهر</span>» / «حصيلة السنة», so periodWord is «الشهر» / «السنة» (with the article).
- `rules.*.why` "higher than what's typical for {group}" → «أعلى من المعتاد لدى {group}»; `profiles.*.group`
  are written to fit after «لدى» (e.g. «المستأجرين في المدن»).
- `inputs.toast.sampleLoaded`, `dashboard.categories.basisIncome*`, `page.banners.sample_html` insert the
  profile name after «لملف:» to avoid gender/article agreement with the profile name.
- `historyEngine.alerts.*Singular/*Plural`: Arabic uses the same «{label}: في ارتفاع …» pattern for both,
  avoiding verb agreement with the label.
- Festival lists keep «العيد» first in the Arabic (English order kept for `festivalsDiwali` by putting
  ديوالي first). «الكريسماس» used for Christmas; «عيد الميلاد المجيد» is a more formal alternative.
- `help.text.giving` mentions zakat, tithes and church/temple offerings as in the English.
- The money-tips article (`page.guide.*`) keeps the US figures from the English ($, °F with °C), as
  instructed (numbers unchanged). It reads a little foreign for Gulf readers; consider localised examples.

## Possibly long strings (check small buttons)
- `page.hero.start` «ابدأ: نحو دقيقتين», `page.common.downloadBackup` «نزّل نسخة احتياطية»,
  `months.saveThisMonth`, `reset.deleteAll.backupFirst` «نزّل نسخة احتياطية أولًا»,
  `page.wizard.steps.loans_html` «القروض والاشتراكات», `inputs.debts.apr` «معدل الفائدة السنوي (APR) %»,
  `inputs.fields.transit` (longer than English), `layout.footer.legal.heading` «المساعدة والشؤون القانونية».
- Short labels often have more characters in Arabic because of the article and two-word terms (e.g. "Fuel" →
  «الوقود», "Rent / mortgage" → «الإيجار / القرض العقاري», "On/Off" → «تشغيل/إيقاف», "Work & AI tools" →
  «أدوات العمل والذكاء الاصطناعي»). Arabic glyphs are narrow, so on-screen width is usually close, but check
  chips, nav tabs (`page.results.nav.*`) and the mobile bar at phone width.

## Legal text — needs professional review before launch
`privacy.*`, `terms.*` and `layout.footer.disclaimer.*` were translated faithfully and plainly. Law names:
«اللائحة العامة لحماية البيانات … (GDPR)», «قانون خصوصية المستهلك في كاليفورنيا (CCPA/CPRA)»,
«قانون حماية البيانات الشخصية الرقمية في الهند لعام 2023 (DPDP Act)», «مكتب مفوّض المعلومات (ICO)».
UAE (PDPL, Federal Decree-Law 45/2021) and Saudi (PDPL) laws are not mentioned because the English doesn't
mention them; a lawyer should confirm whether they should be. These pages **need review by a qualified
Arabic legal translator/lawyer before launch**. The contact topic «طلب يتعلق بالخصوصية أو البيانات» is used
verbatim where the policy refers to it.

## Phase 6 additions
- `inputs.custom.need`/`want` reuse «فاتورة لا بد منها» (singular of the split label «فواتير لا بد منها») and «الكماليات»; «الكماليات» reads as a category in the dropdown — «من الكماليات» or «رغبة» are alternatives.
- `inputs.custom.add` «أضف مصروفًا خاصًا»: «مخصّص» is an alternative for "custom".
- `inputs.payFrequency.fieldLabel.semimonthly` «صافي الراتب في كل دفعة» ("each payday"); «في كل يوم صرف» is closer but less clear.
- `inputs.payFrequency.options.*`: «أسبوعيًا / كل أسبوعين / مرتين شهريًا / شهريًا» — short enough for the dropdown; check «مرتين شهريًا» at 140px.
- Lakh/crore written as «اللاك والكرور» (page.hero.note, page/seo.faq.a8) — unfamiliar to most Gulf readers but it names the Indian system; keep.
- `countryFields.AE.chillerFee` «فاتورة التبريد المركزي (التشيلر)»: «التشيلر» is how UAE residents commonly say it; drop it if the label is too long.
- `countryFields.AE.housingFee` «رسوم السكن البلدية»: in Dubai often called «رسوم البلدية» or «رسوم السكن» on the DEWA bill.
- `countryFields.SA.dependentFee` «رسوم المرافقين (للمقيمين)»: «المقابل المالي للمرافقين» is the official Saudi term; «للوافدين» is an alternative to «للمقيمين».
- `countryFields.PK.committee` «الكميتي (BC)», `IN.chitFund`, `ID.arisan`, `NG.esusu`: local savings-circle names kept in Latin script (except كميتي) and explained as «جمعية ادخار دوّارة»; Gulf readers know this as «الجمعية».
- `countryFields.IN.powerBackup` uses «إنفرتر» (transliteration); «محوّل كهربائي» is the formal alternative.
- `countryFields.GB.councilTax` / `tvLicence`, `FR.*`, `ES.*`, `MX.*`, `BR.*`, `DE.*`: Arabic description plus the local name in brackets; these labels are longer than the English — check width.
- `format.currencies.NGN` «نايرا نيجيرية» («نيرة» is also seen); `MXN` «بيزو مكسيكي».

## Phase 7 additions (country savings ideas)
- `localTips.*.evidence` is written to end in «يخفّض عادةً/غالبًا» (or «يجنّبك عادةً» for the credit-card ideas) like `rules.*.evidence`, so it reads «… يخفّض عادةً نحو العُشر (10%) من هذا الإنفاق.» — check on screen.
- `ae-rent-cheques` / `sa-rent-instalments` evidence: English "lowers the yearly rent by" shortened to «يخفّض غالبًا» because {words} is followed by «من هذا الإنفاق»; «يخفّض الإيجار السنوي غالبًا بمقدار» would double the object.
- `ae-*`: «سالك» and «بطاقة نول» in Arabic script; DEWA kept in Latin as elsewhere in the file, spelled out once as «هيئة كهرباء ومياه دبي (DEWA)»; RERA as «مؤسسة التنظيم العقاري (RERA)»; rent cheques «شيكات مؤجلة».
- `ae-salik-nol` / `sa-bnpl`: amounts kept with currency codes («6.30 AED», «500 SAR») per the guide; «درهم» / «ريال» would read more naturally.
- `sa-rent-instalments`: Ejar → «منصة إيجار» (the word also means "rent", so «منصة» is added to avoid ambiguity); `sa-6000-kwh`: «هللة», SEC → «الشركة السعودية للكهرباء (SEC)», «مكيّفات السبليت», «المجلس».
- `sa-bnpl` title «اشترِ الآن وادفع لاحقًا» in quotes; Gulf readers may know it as «تقسيط» or by brand (Tabby/Tamara), not mentioned since the English doesn't.
- Labels reuse existing terms: «الكهرباء», «الماء والغاز», «الأجرة ورسوم الطرق», «الإنترنت والهاتف», «تأمين السيارة», «وقود المولّد»; new: «التسوق والكماليات» (Shopping & extras), «بطاقات الائتمان», «مياه الشرب», «المولّد وUPS», «التأمين الصحي»/«التأمين الصحي الخاص», «ضريبة المجلس المحلي».
- Other countries' terms kept in Latin with a short Arabic gloss: rotativo, consignado, bandeira vermelha, Grundversorgung, Abschlag, Deutschlandticket, PVPC, potencia, revolving/TAE, pago aplazado, abono joven/único, prime transport, Navigo, forfait mobilités durables, TRV, chèque énergie, loi Hamon («قانون آمون»), Ofgem, Direct Debit, Council Tax Reduction, PLN/VA/token, ojek, KRL, galon, PDAM, DISCOM, net meter, LPG/PNG, Aadhaar, auto («الريكشا»), MSI/quincena, DAC/CFE, Band A/DisCo/MAP/NERC, geyser, load-shedding, open enrollment/tax credit.
- `es-revolving` tip 3: "usurious" → «فائدة فاحشة» (Spanish legal concept *usura*); «ربوية» avoided because in Arabic it implies any interest.
- `us-open-enrollment` tip 3: "tax credit" → «خصم ضريبي (tax credit)»; «إعفاء ضريبي» is a common but less exact alternative.
- `ng-meter-band` "crazy" billing → «الفواتير التقديرية («المجنونة»)», literal; «العشوائية» is an alternative.
- `pk-protected-slab`: "protected status" → «الشريحة المحمية» / «هذه الميزة».
- `ca-home-energy-rebates` title "rebates" → «دعم تحسينات طاقة المنزل»; «المبالغ المستردّة» is closer to "rebate" but less clear.

## About page
- `about.seo.*` keep the brand "Household Budget Optimizer" in Latin script (as requested), while `about.title` and `about.sections.who.p1` use «مُحسِّن الميزانية»; align if the brand decision changes.
- Nav and footer both use «من نحن» for "About" / "About us"; «عن الموقع» is an alternative for the nav.
- `about.sections.why.p1` / `how.item4_html` use «فوائد» for interest; Islamic-finance wording would be «أرباح» / «رسوم» (see regional table).
- `about.table.sourceCount`: `one` «مصدر واحد» and `two` «مصدران» omit the number, as elsewhere; `zero` «{count} مصدر».
- `about.sections.how.item1_html` utilities as «الخدمات» (could be «فواتير الخدمات» or «الكهرباء والماء»).
