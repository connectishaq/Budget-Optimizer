# Indonesian (id) translation notes

Translated from the English snapshot `en-snapshot-p1.json` (1,507 messages). Keys added to or changed in
`en.json` after that snapshot are not covered yet (see "Not yet translated" at the end).

## Tone and form of address
- Uses **"Anda"** (polite) throughout, with short, everyday sentences. Many Indonesian fintech apps use
  the more casual "kamu". Switching would mean replacing "Anda" in every message. "Anda" fits families
  and the legal pages better.
- Imperatives are kept friendly ("Isi…", "Pakai…", "Coba…"). "Mohon" is used for requests in forms and
  legal text.

## Terminology (used consistently)
| English | Indonesian | Note |
|---|---|---|
| take-home pay | gaji bersih | |
| bills | tagihan | |
| must-pay bills / nice-to-haves | tagihan wajib / keinginan | "needs/wants" = kebutuhan/keinginan |
| emergency fund | dana darurat | |
| goal | target | "tujuan" is an alternative |
| plan / add to my plan | rencana / masukkan ke rencana saya | |
| health score | skor kesehatan (anggaran) | |
| left over | sisa / sisa uang | |
| groceries | belanja dapur | "belanja bulanan" or "kebutuhan dapur" are alternatives |
| eating out and takeaways | makan di luar dan pesan antar | |
| rent or mortgage | sewa atau cicilan KPR | KPR = Kredit Pemilikan Rumah, the usual local term |
| car loan | cicilan / kredit mobil | |
| fuel | bensin | "BBM" is the more formal alternative |
| household help (maid, cook, driver) | asisten rumah tangga (ART, juru masak, sopir) | |
| charity and religious giving | sedekah, zakat, dan persembahan | Includes the Christian "persembahan" so it isn't only Muslim wording |
| festival bonus | THR / bonus hari raya | THR (Tunjangan Hari Raya) is the standard Indonesian festival bonus |
| Eid | Lebaran | |
| trips home | mudik | |
| school admission | uang pangkal | |
| committee payment (help.text.other) | arisan | Closest local equivalent of a rotating savings committee |
| backup | cadangan | |
| share link | tautan berbagi | |
| Undo | Urungkan | |
| deductible / excess (insurance) | risiko sendiri (deductible) | Local insurers use "risiko sendiri" or "OR (own risk)" |
| balance transfer | pindah saldo (balance transfer) | Rare in Indonesia; English term kept in brackets |
| toll tag | kartu tol elektronik | Indonesia uses e-toll cards rather than tags |
| price slab (electricity) | golongan tarif | Indonesian PLN tariffs work by connection class (golongan), not usage slabs. The wording is understandable but not an exact local fit |
| APR | bunga per tahun (APR) | |

## Things to check
- **Brand names:** the header brand "Budget Optimizer" and the brand in `privacy`/`terms`/`contact`
  SEO titles ("Household Budget Optimizer") are left in English as product names. The descriptive
  title on the home page (`page.hero.title_html`, `seo.*`, `layout.footer.copyright`) is translated as
  "Pengoptimal Anggaran Rumah Tangga & Simulator Tabungan". Decide which one you want to use and make
  it consistent.
- **Plurals:** Indonesian only has "other", so every plural has one form. Sentences like
  "{count} tips" read fine for 1 or more.
- **payday.dayOfMonth / ordinal:** written as "Tanggal {day}{suffix}" with every ordinal suffix as an
  empty string ("Tanggal 5", "Tanggal 21").
- **charts.year:** "Tahun ke-{n}" (the "Year 3" axis label).
- **Dollar amounts in the money-tips article (page.guide.*)** are kept as dollars with Indonesian
  thousand separators ($3.000, $46.000, $147.000). Only the separator changed, not the number. The
  Fahrenheit figures and their Celsius equivalents are unchanged.
- **rules.*.evidence** are sentence starts that end with a verb ("…biasanya memangkas") so that the
  percentage words ({words}, e.g. "sekitar 10%") follow naturally in `plan.explain.*`.
- **rules.utilitiesEfficiency.tips.night:** changed to "Naikkan suhu AC (atau kecilkan pemanas)…",
  because Indonesian homes cool rather than heat.
- **inputs.typical.tip** joins "{help} Untuk {group}, angka ini {range}{approx}." Check that it reads
  well with live data.
- **dashboard.categories.basisIncome:** "dibandingkan dengan {profile} pada umumnya". {profile} is the
  profile name (e.g. "Profesional Muda"), which reads fine.
- **inputs.toast.sampleLoaded:** "Contoh anggaran dimuat untuk profil {profile}". "profil" was added so
  that the profile name can follow.
- **Profile names:** "Lajang Penyewa di Kota" (Single City Renter) and "Keluarga Pinggiran Kota
  (4 Orang)" (Suburban Family of 4) are a little awkward. Alternatives: "Lajang, Ngekos/Sewa di Kota" and
  "Keluarga 4 Orang di Pinggir Kota".

## Possibly long for small buttons
- `wizard.showAllInputs` "Tampilkan semua isian", `page.wizard.skip` "Langsung ke hasil"
- `plan.addToPlan` "Masukkan ke rencana saya: {label}" (aria/visually short label?)
- `plan.notAdded` "Belum dimasukkan", `plan.added` "Dimasukkan ✓"
- `reset.deleteAll.backupFirst` "Unduh cadangan dulu"
- `months.banners.capConfirm` "Simpan dan hapus {month}"
- `page.results.nav.planAhead` "Rencana ke depan"
- `layout.footer.receipt.dataSent` "Data yang dikirim ke kami"
Indonesian usually runs about 15–30% longer than English. The money-tips article and the legal pages are
noticeably longer but are running text.

## Legal text (privacy.*, terms.*, layout.footer.disclaimer.*)
- Translated faithfully and plainly. **These need a professional legal review before launch.**
- Foreign law names are kept in English with their usual abbreviations (GDPR, CCPA/CPRA, DPDP Act
  2023). The English source does not mention Indonesia's own data protection law (UU No. 27 Tahun 2022
  tentang Pelindungan Data Pribadi, "UU PDP"), so it was **not added**. For an Indonesian launch, the
  legal reviewer should decide whether to name it in `privacy.sections.rights.p2` and `p3_html`.
- "European Economic Area" is "Wilayah Ekonomi Eropa", "UK" is "Inggris", and "standard contractual
  clauses" is "klausul kontrak standar".
- "as is" / "as available" are "sebagaimana adanya" / "sebagaimana tersedia".
- "plain English" (terms.lead and seo) became "bahasa yang sederhana".
- "Breadcrumb" (aria label) is "Navigasi jejak".

## Not yet translated (changed in en.json after the snapshot)
New keys: `format.currencies.SAR/BRL/MXN/IDR/NGN`, `layout.locale.*`.
Changed text: `inputs.debts.aprCapped` (now has {max}), `inputs.typical.approximate`,
`dashboard.categories.basisIncomeApprox`, `page.hero.note` (13 currencies), `page.faq.a8`,
`seo.faq.a8`, `seo.app.featureList[11]`, `charts.returns.*.label` (now "{pct}%: …").

## Phase 6 additions
- `inputs.payFrequency.options.semimonthly` "2x sebulan" is shortened for the narrow dropdown; "Dua kali sebulan" is the full form if space allows.
- `inputs.payFrequency.fieldLabel.semimonthly` "Gaji bersih per gajian": "per gajian" is informal but common; "per periode gaji" is the more formal alternative.
- `inputs.payFrequency.label` uses "gajian" (payday, everyday word); "Frekuensi gaji" is the more formal alternative.
- `inputs.custom.add` "Tambah pengeluaran lain" ("other expense") reads more naturally than "pengeluaran kustom"; may be long for a small button.
- `inputs.custom.need/want` reuse "Tagihan wajib" / "Keinginan" from the 50/30/20 split labels.
- `countryFields.ID.estateFees` label "Iuran lingkungan (IPL, iuran RT/RW)": "iuran warga" or "iuran bulanan" are regional alternatives; IPL = Iuran Pengelolaan Lingkungan (apartments/estates).
- `countryFields.ID.galon` "isi ulang galon": "air galon" is the everyday alternative.
- `countryFields.*` rotating-savings groups (chit fund, ajo/esusu, committee/BC) are explained as "mirip arisan" so Indonesian readers recognise them.
- `countryFields.GB.councilTax` "Pajak daerah (council tax)" and `IN.societyMaintenance` "Iuran pengelola" are approximations; local terms are kept in brackets.
- Generator/inverter fields use "genset" (common Indonesian word) and "BBM"/"solar" for fuel/diesel; "aki" for battery.
- Several country-field labels with a local term in brackets (e.g. MX gastosMedicos, BR planoSaude) may wrap above the input.

## Phase 7 additions (country savings ideas)
- `localTips.*.evidence` follow the `rules.*.evidence` pattern ("…biasanya memangkas"/"sering memangkas"); credit-card ideas (br-sair-do-rotativo, es-revolving) end in "menghindari" to fit `plan.explain.interest`.
- Rent ideas (ae-rent-cheques, sa-rent-instalments) end in "sering menurunkan sewa tahunan sebesar", so the sentence reads "…sebesar sekitar 10% dari pengeluaran ini". Please check this reads well with live {words}.
- Labels reuse earlier terms: "Listrik", "Air & gas", "Ongkos & tol", "Internet & telepon", "Sewa", "Kartu kredit", "Belanja & lain-lain", "Air minum", "BBM genset", "Genset & UPS", "Pajak daerah (council tax)".
- `id-va-power`: "daya VA PLN" and "token listrik"; the price is written Rp1.444,70 (Indonesian decimal comma). "Lampu neon" is used for fluorescent tubes ("lampu TL" is an alternative).
- `id-krl-tj`: "ride-hailing" is "ojek atau taksi online"; "first and last kilometre" is "jarak pertama dan terakhir ke stasiun atau halte".
- `id-galon-depot`: "depot air minum isi ulang" and "sertifikat laik higiene sanitasi" (the official name of the depot hygiene certificate). "PDAM water" is kept as "air PDAM".
- `in-metro-card`: "autos" (auto-rickshaws) is "bajaj", the nearest Indonesian equivalent.
- `sa-bnpl`: "buy-now-pay-later" is "paylater", the everyday Indonesian term.
- `ng-solar-inverter`/`pk-solar-ups`: "grid hours" is "jam listrik jaringan menyala"; "load-shedding" is "pemadaman bergilir".
- Foreign local terms are kept with a short explanation in brackets: DEWA, Salik, Nol, RERA, Default Market Offer, rotativo, consignado, bandeira vermelha, Grundversorgung, Abschlag, Deutschlandticket, PVPC, potencia, TAE, usura, prime transport, forfait mobilités durables, TRV, chèque énergie, loi Hamon, Ofgem price cap, Direct Debit, DISCOM, Aadhaar, PNG, NCMC, MSI/quincena, CFE/DAC, DisCo/NERC/MAP, Ejar, SEC, open enrollment, deductible.
- "excess"/"deductible" use "risiko sendiri", as in the terminology table.
- `es-revolving.tips.3`: "usurious" is "melanggar hukum (usura)"; "riba" was avoided because of its religious meaning.
- `pk-protected-slab`: "units" is kept in quotes because that is the word printed on Pakistani bills.
- Long titles that may wrap on small cards: `ae-dewa-slab.title`, `ae-salik-nol.title`, `id-krl-tj.title`.

## About page
- Nav "About" = "Tentang"; footer "About us" = "Tentang kami".
- `about.seo.*` keep the English brand "Household Budget Optimizer", consistent with the other id SEO titles.
- "Utilities" = "listrik dan air"; "plug the leaks" = "menambal kebocoran"; "Who runs it" = "Siapa pengelolanya".
- "shares of your own income" = "persentase dari pendapatan Anda" (porsi would be more literal).
