# Urdu (ur): open questions for a native reviewer

**The legal pages (privacy policy, terms, the footer disclaimer) need a professional legal review whatever you decide below.** This list only covers wording a native Pakistani Urdu speaker should settle.

Already fixed on 2026-10-20 (no need to re-check): which way the AC setting goes, "AC" spelled the same way everywhere, "لازمی بل" used for must-pay bills, "نمونے کا بجٹ" for "example budget" (it used to say "مثالی", which means "ideal"), grammar around the profile name, English words left in by mistake, and "بے سوچے خریداری" used for impulse spending in every guide. The full list is in `src/i18n/notes/ur.md` under "Review pass (2026-10-20)".

Each item gives the key or file, the current Urdu, the English, and the question to decide.

## Calculator (inputs and wizard)

- **Brand name**, `page.header.brand`, `layout.brand`, `seo.title`: "بجٹ آپٹیمائزر" / "گھریلو بجٹ آپٹیمائزر اور بچت سمیولیٹر" (English: Budget Optimizer / Household Budget Optimizer & Savings Simulator). Should the brand be written in Urdu letters or kept in Latin script? `about.seo.*` keeps it in Latin on purpose in every language, so it is mixed today.
- `inputs.fields.groceries.label`: "راشن" (Groceries). Is "راشن" right for all your readers, or is "سودا سلف" or "گروسری" more natural in cities?
- `inputs.payFrequency.options.biweekly` / `semimonthly`: "ہر 2 ہفتے" / "مہینے میں 2 بار" (Every 2 weeks / Twice a month). Are these clear to people who are paid this way? Would "پندرہ روزہ" be better? They also need to fit a narrow dropdown.
- `inputs.payFrequency.fieldLabel.semimonthly`: "ہر تنخواہ والے دن ہاتھ میں آنے والی رقم" (Take-home pay each payday). Can it be shorter? It may wrap onto two lines.
- `inputs.housing.no`, `inputs.subs.rarely`: "دیتا/دیتی ہوں"، "کرتا/کرتی ہوں" (I pay… / I rarely use…). Is the slash form OK, or should these be reworded so the verb isn't gendered?
- `inputs.typical.approximate`: "ایک موٹا اندازہ" (a rough guide). Is this too casual? "اندازاً" is the more formal option.
- `countryFields.PK.committee.label`: "کمیٹی / BC کی قسط" (Committee / BC payment). Is "BC" understood outside Punjab and Karachi, or should it just say "کمیٹی"?
- `inputs.fields.misc.label`: "بے سوچے خریداری اور اضافی چیزیں" (Impulse shopping and extras). This is now the site-wide term. Does it sound natural, or would "فضول خرچی" be better? (The stop-impulse-spending guide uses "فضول خرچی" as its search keyword.)
- Buttons that are longer than the English: `page.wizard.skip` "سیدھا نتائج پر جائیں"، `page.inputs.startOverLabel` "نئے سرے سے شروع کریں"، `reset.startOver.clear` "میرے نمبر صاف کریں". Are there shorter versions?

## Results (summary, ideas, payday, health, spending, growth, plan ahead)

- **Nice-to-haves**, `dashboard.split.wants` and others: "شوق کی چیزیں". Does this cover eating out and subscriptions, or does it sound like "hobbies" only? It is used 15 times, so any change has to be made everywhere.
- **Sample budget**, `page.banners.sample_html`, `inputs.toast.sampleLoaded`: "نمونے کا بجٹ" (example budget; replaced "مثالی بجٹ" in this pass). Is "نمونے کا بجٹ" natural, or would "مثال کے طور پر ایک بجٹ" read better?
- `dashboard.split.ofIncome_html`: "{pct} آمدنی کا" (e.g. "45% of income"). The HTML tag order can't change. Does this read too clipped?
- `calc.health.*`, "ہیلتھ اسکور" (health score). Should this stay a loan word, or should it be Urdu, e.g. "مالی صحت کا اسکور"?
- `payday.dayOfMonth`: "مہینے کی 5 تاریخ" (the 5th of the month). Please confirm this reads naturally in the payday list.
- `rules.groceriesPlan.title`: "کھانوں کی منصوبہ بندی کریں اور اسٹور کا اپنا برانڈ لیں" (Plan meals and buy store brands). Is "store brand" meaningful in Pakistan? The title is also long for a card.
- `localTips.pk-protected-slab.*`: "protected سلیب" (protected 200-unit slab). Keep the Latin word as it is printed on bills, or use "محفوظ صارف"?
- `localTips.sa-bnpl.title`: "ابھی خریدیں، بعد میں ادا کریں" (buy now, pay later). Is the long phrase clear, or is a short term like "قسطوں پر خریداری" better?
- `rules.smartThermostat.*`, `rules.insuranceRequote.tips.excess`: "تھرموسٹیٹ"، "ایکسیس" (thermostat, excess). These are rare in Pakistan. Keep the loan words, or add a short explanation in brackets?
- Foreign-country tips (`localTips.gb-*`, `au-*`, `us-*`): "price cap", "time-of-use", "standard variable", "open enrollment" are still in Latin script. Is that acceptable, given that only expats in those countries will see them?

## History and backups

- `page.months.title` and the `months.*` keys: "ہسٹری"، "مہینہ بہ مہینہ" (history, month by month). Is the loan word "ہسٹری" fine, or is "ریکارڈ" more natural?
- `historyEngine.alerts.*`: "{label} میں مسلسل {count} مہینوں سے اضافہ ہو رہا ہے" (e.g. "Groceries has risen for 3 months in a row"). Please check that this reads well with a few real labels (راشن، بجلی اور گیس، کرایہ).
- `backup.*`: "بیک اپ کھولیں" / "ملانے" (open / merge a backup). Is "ملانا" clear for "merge", or is "یکجا کرنا" better?

## Legal pages (privacy, terms, disclaimer, contact, about)

(These still need the professional legal review mentioned at the top.)

- `layout.footer.disclaimer.title`: "مالی دستبرداری" (Financial disclaimer). "دستبرداری" usually means giving up a right. Would "ڈس کلیمر" or "اعلانِ لاتعلقی" be clearer?
- `terms.sections.warranty.p1`: "“جیسی ہے” اور “جیسی دستیاب ہے”" ("as is" and "as available"). What are the standard Urdu legal equivalents?
- `privacy.sections.transfers.p1`: "معیاری معاہداتی شقیں (standard contractual clauses)". Is this the right legal term?
- `privacy.sections.rights.p2`: the GDPR, CCPA/CPRA and DPDP names are in Urdu with the English abbreviations. Is this the usual form?
- `about.toc.standards`: "ادارتی اصول" (Editorial standards). Is this too formal? "ہمارے اصول" is plainer.
- `about.table.sourceCount`: "ذریعہ / ذرائع" (source/sources), or the loan word "سورس"?
- Contact page: no open wording questions.

## Guides (/ur-pk/guides/ and the /ur-pk/ article)

Guides that have a translator notes file (`src/i18n/notes/guide-ur-*.md`):
- 50-30-20-rule: "حل شدہ مثالیں" (worked examples) sounds like a school textbook. Is "عملی مثالیں" better? Also, "needs" is "لازمی خرچ" in this guide but "لازمی بل" on the site. Is that difference acceptable?
- emergency-fund: "festival money" is "عیدی" and "festivals" is "عید". Is that too narrow? Also, is "گِگ" (gig work) understood?
- cut-electricity-bill: "پانی پورا رکھیں" (topping up UPS batteries) only applies to lead-acid batteries. Should the guide say so?
- student-budget: "صابن شیمپو جیسی چیزیں" here, but family-grocery-budget says "ٹوائلٹری" for toiletries. Which one should both use?
- first-salary-budget: is "آہستہ آہستہ بڑھتا رہن سہن" (lifestyle creep) understood?

Guides with no notes file (read in this pass):
- **stop-impulse-spending**: the `keyword` is "فضول خرچی کیسے روکیں", but the title says "بے سوچے خریداری". Which term do people actually search for? Also, is "جیب خرچ" (pocket money) right for adults' "guilt-free fun money", or does it sound like a child's allowance?
- **subscription-audit**: the `keyword` is "فالتو سبسکرپشنز کیسے کینسل کریں" while the title says "سبسکرپشن آڈٹ". Is "آڈٹ" understood? The email search words ("receipt", "renewal" and so on) are left in English on purpose, because the emails are in English. Please confirm that is right.
- **pay-off-credit-card-debt**: "ایولانچ" / "اسنو بال" are transliterated. Should they get an Urdu explanation in brackets the first time they appear? Also, does "کریڈٹ اسکور" make sense to Pakistani readers (the system there is eCIB)?
- **family-grocery-budget**: "ٹوائلٹری" (see student-budget above), and is "ٹیک اوے" the everyday word, or is it "باہر کا کھانا"?
- **irregular-income**: "بکری" (sales) in "ہر بکری کا ایک چھوٹا حصہ". Without diacritics it can be misread as "goat". Use "فروخت" or "سیل" instead? Also, is "جمع کرنے والا ڈبہ" (a holding "bucket" for income) a natural metaphor?

The /ur-pk/ article (`src/i18n/articles/ur-pk.json`): the wording looks fine. Its notes file (`src/i18n/notes/article-ur-pk.md`) lists facts to confirm (the protected 200-unit rule, how often petrol prices are revised, card interest rates). Those are facts for the site owner to check, not wording questions. The one wording point: the quote "“آج کے پیسوں میں دکھائیں”" must stay identical to the calculator toggle if either one changes.

## New since the first review (21 October 2026)

Strings added or changed after this list was first written. They were written by Claude, not checked by a native speaker:
- `layout.header.menu`: "مینو" (the menu button on phones).
- `layout.footer.tips.heading`: now "گائیڈز", the same word as the header link. `layout.footer.ctaTips`: "گائیڈز پڑھیں" (Read the guides).
- `page.summary.saveMonth`: "ہر مہینے آپ مزید کتنا بچا سکتے ہیں" (Extra you could save each month). `dashboard.mobile.saveMonth` / `saveYear`: "آپ ہر مہینے/سال اتنا مزید بچا سکتے ہیں". Does "مزید" make it clear this is on top of what is already left over?
- `dashboard.summary.noTipsLeft`: "بلوں کے بعد {left} پہلے ہی بچ جاتے ہیں۔ مزید بچت کے لیے نیچے چند تجاویز آن کریں۔" ({left} is already left over after your bills. Switch on a few ideas below to save even more.)
