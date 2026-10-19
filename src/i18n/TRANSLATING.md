# Translating the site

Source: `src/i18n/locales/en.json` (nested JSON, ~1,500 messages). Each language has one file with
the same structure: `src/i18n/locales/<lang>.json`.

## Audience and tone
Families managing a household budget, many with no finance background. The English is deliberately
plain, warm and short. Translate the meaning naturally, not word for word: short sentences, everyday
words, the polite-but-friendly form usual for consumer apps in that language. Never add advice or
change numbers.

## Must keep exactly
- `{placeholders}`: same names, each one kept (order may change to suit grammar).
- Keys ending in `_html`: keep every tag and attribute exactly (`<strong>`, `<a href="…" class="…">`,
  `<span class="…" data-…>` etc.); translate only the text between tags. Don't add or remove tags.
- Plural messages (objects like `{ "one": "…", "other": "…" }`): output the categories your language
  uses, from `new Intl.PluralRules('<lang>').resolvedOptions().pluralCategories`
  (e.g. Arabic: zero, one, two, few, many, other; Indonesian: other only). Always include `other`.
- Brand and product names (Netflix, Spotify, Google Ads Settings, AdSense, Formspree), currency codes,
  "50/30/20", URLs, e-mail addresses, numbers.
- The structure: same keys, same nesting, no extra or missing keys. Arrays stay arrays of the same length.

## Regional wording
Write for the main market of the language and note regional alternatives in your notes file:
- `es`: neutral Spanish understood in Spain and Mexico; note words that differ (coche/carro,
  piso/departamento, móvil/celular, ordenador/computadora).
- `pt`: Brazilian Portuguese.
- `fr`: France.
- `de`: Germany (use "du" or "Sie" consistently — consumer finance apps in Germany commonly use "du";
  pick one and say which in the notes).
- `ar`: Modern Standard Arabic for the UAE and Saudi Arabia.
- `ur`: Pakistani Urdu; common English loan words people actually use (bill, EMI, budget) are fine.
- `hi`: everyday Hindi as used in India; common English loan words people actually use (EMI, bill,
  budget, credit card) are fine, in Devanagari.
- `id`: Indonesian.

## Legal text
`privacy.*`, `terms.*` and the disclaimer under `layout.footer.*` are legal pages. Translate them
faithfully and plainly. Keep law names in their usual local form with the English name where helpful
(e.g. "Reglamento General de Protección de Datos (RGPD/GDPR)"). These need a professional review
before launch; say so in the notes.

## Notes file
List anything uncertain in `src/i18n/notes/<lang>.md`: phrases you weren't sure about, terms with
regional alternatives, places where the English was ambiguous, and any message that is much longer
than the English (could overflow small buttons). These are collected into TRANSLATION_NOTES.md.

## Checking
`npm run i18n:check` must show no errors for your language (placeholders, plural shape, missing keys).
