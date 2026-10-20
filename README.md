# Household Budget Optimizer & Savings Simulator

A fast, private, static budgeting tool. All calculations run in the browser; nothing is sent to a server.

## Run it

```bash
npm install
npm run dev      # local dev server with hot reload (http://localhost:5173)
npm test         # Vitest: engine, projection, debt math, month history and saved-data checks
npm run build    # production build -> ./dist (upload this folder to any static host)
npm run preview  # serve ./dist locally to check the production build

npm run i18n:check          # missing/unused translation keys, placeholder and plural errors
npm run i18n:missing -- de  # the English messages a language still lacks, ready to translate
npm run i18n:notes          # rebuild TRANSLATION_NOTES.md from src/i18n/notes/
npm run articles:check      # the per-country articles: keys, markup, length, title/description
npm run benchmarks:review   # rebuild REVIEW_BENCHMARKS.md (country numbers marked "verify")
```

## Configure before deploying

Copy `.env.example` to `.env`, fill it in, then run `npm run build`:

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Your live domain, e.g. `https://www.example.com`. Adds the canonical tag, the hreflang links between the language/country pages, `og:url` and the social share image (`og-image.png`), writes `sitemap.xml` (with every page's alternates) and the `Sitemap:` line in `robots.txt`. Without it these are skipped (the build warns you). |
| `VITE_ADSENSE_CLIENT` | Your AdSense publisher ID (`ca-pub-…`). Leave empty and all ad slots stay hidden. |
| `VITE_ADSENSE_SLOT_TOP` / `_SIDEBAR` / `_INARTICLE` / `_BOTTOM` | Optional ad-unit IDs for each slot. |
| `VITE_CMP_SRC` | Optional. Script URL of a Google-certified consent tool (IAB TCF v2.2) for visitors in the EEA, UK and Switzerland. Leave empty if you use Google's own consent message (see below). |
| `VITE_CONTACT_EMAIL` | Public email shown in the footer Contact section. |

**Contact form.** The contact page sends messages through a free form service, so no server code
is needed. Until one is set up (and no `VITE_CONTACT_EMAIL` either), the page shows "Messages can't
be sent from here yet" instead of the form and the build prints a warning. Pick one service:

- *Formspree:* sign up at formspree.io and confirm your email address. Choose **New form**, give it
  a name and copy its endpoint (it looks like `https://formspree.io/f/abcdwxyz`).
  Netlify variables: `VITE_CONTACT_FORM_ENDPOINT` = that endpoint.
- *Web3Forms:* on web3forms.com enter the email address that should receive messages and press
  **Create Access Key**; the key arrives by email. Netlify variables:
  `VITE_CONTACT_FORM_ENDPOINT` = `https://api.web3forms.com/submit` and
  `VITE_CONTACT_FORM_KEY` = your access key (it's meant to be public).

Optionally also set `VITE_CONTACT_EMAIL` (shown under the form as a second way to write to you).
In Netlify: **Site configuration → Environment variables → Add a variable** for each one, then
**Deploys → Trigger deploy → Deploy site**. `VITE_` values are read when the site is built, so a new
deploy is needed after every change. Send yourself a test message afterwards. The form already
has a hidden spam trap, checks the fields, can't be sent twice, and shows clear sent / failed /
offline messages.

**Ad consent (EEA, UK, Switzerland).** AdSense requires a Google-certified consent tool there. The simplest is Google's own: in AdSense open *Privacy & messaging → European regulations*, create and publish the message; it needs no code. Either way, `src/ads.js` sets Google Consent Mode v2 defaults before any Google script, so ads stay non-personalised in those regions until the visitor agrees. The slot is marked in `index.html` with `CONSENT (CMP) SLOT`.

Ad slots are marked in `index.html` with `<!-- ===== ADSENSE: … START/END ===== -->` comments and reserve their height to prevent layout shift. The sidebar slot is desktop-only, so on phones no ad sits between the inputs and the results.

## Project structure

```
index.html              page markup, SEO article, FAQ, JSON-LD, inline SVG icon sprite
404.html                "page not found" page; static hosts (Netlify, Cloudflare Pages, GitHub Pages) serve it for missing addresses
src/main.js             bootstrap: compute -> render loop (typing debounced 150 ms)
src/state.js            single source of truth, validation, localStorage persistence ('hbo:v3')
src/history-store.js    month-by-month history in localStorage ('hbo:history', versioned)
src/engine/profiles.js  household types; benchmarks, typical ranges and examples from the country's data
src/engine/countries.js loads one country's data file at a time (GLOBAL is always there)
src/engine/rules.js     savings rule dictionary, plus each country's own ideas (localTips)
src/data/countries/     one JSON file per country + GLOBAL (see SCHEMA.md)
src/i18n/               t() helper, language/country picker, message files (locales/), per-country
                        articles (articles/), translator notes (notes/), locale-pages.js (the /xx-yy/ pages)
scripts/                i18n and article checks, benchmark review, pre-rendering of the /xx-yy/ pages
src/engine/calculate.js pure math: totals, rules, health score, 50/30/20, projection, debt, goals
src/engine/history.js   pure history maths: month entries, migration, comparison, streaks, alerts, backups
src/ui/*.js             inputs, plan cards, dashboard, charts (svg-chart.js lines, svg-bar-chart.js bars), goals, months (history panel),
                        history (backup, share, print), reset (start over)
src/ads.js              AdSense loader (idle-time, env-configured, consent defaults)
src/styles.css          Tailwind v4 + small component layer, lite mode, print stylesheet
public/                 favicon, iPhone bookmark icon, social share image, robots.txt
```

## Languages and countries

Language and country are separate settings. The language decides the words; the country decides the
currency, pay frequency, typical amounts, local bills and local savings ideas. The build also writes
one static page per language + country (`/en-gb/`, `/ar-ae/` … listed in `src/i18n/locale-pages.js`),
each with its own title, description, JSON-LD and country article. `/` stays the English page and is
the `x-default`. The site never redirects; a small banner suggests the visitor's browser language
when there is a page for it.

### Switch a language on or off
`src/i18n/enabled.js` lists the live languages (now: English, Urdu, Hindi, Arabic, Spanish;
French, Portuguese, German and Indonesian are off until they're reviewed). A switched-off language
is hidden from the language picker, never picked from the browser or a saved choice, gets no
/xx-yy/ pages, hreflang links or sitemap entries, and is never suggested by the banner. Its
translation file stays in `src/i18n/locales/`. To switch it back on, add its code to
`ENABLED_LANGUAGES` and rebuild; nothing else needs changing.

### Add a language
1. Add it to `LANGUAGES` in `src/i18n/index.js` (code, name in its own script, `dir`) and to
   `ENABLED_LANGUAGES` in `src/i18n/enabled.js` (the pages' early language check is filled in from
   there at build time).
2. Copy `src/i18n/locales/en.json` to `<code>.json` and translate it, following
   `src/i18n/TRANSLATING.md`. `npm run i18n:missing -- <code>` shows what's left; `npm run i18n:check`
   must report no errors. Put uncertain phrases in `src/i18n/notes/<code>.md` and run `npm run i18n:notes`.
3. Right-to-left script: set `dir: 'rtl'`; the layout mirrors by itself (logical CSS). If it needs a
   font the current one lacks, load it the way `src/fonts/arabic.css` is loaded in `startI18n()`.
4. Add the banner sentence to `TEXT` in `src/i18n/suggest.js`.
5. For a pre-rendered page, add `{ path: '<code>-<cc>', lang, country }` to `LOCALE_PAGES` and write
   `src/i18n/articles/<code>-<cc>.json` (`npm run articles:check`).

### Add a country
1. Add `src/data/countries/<CC>.json` following `src/data/countries/SCHEMA.md` (start from a
   similar country). Mark every number you are not sure of with `"verify": true` and run
   `npm run benchmarks:review`.
2. Add the code to `COUNTRY_CODES` in `src/i18n/countries.js` (and to `COUNTRY_FOR_CURRENCY` if its
   currency is new; a new currency also goes in `CURRENCIES` in `src/utils/format.js`).
3. Copy the English text of its `extraFields` into `countryFields.<CC>` and of its `localTips` into
   `localTips.<id>` in `en.json` (label, noun, title, why, evidence, tips), then translate them.
4. Optional: a pre-rendered page in `LOCALE_PAGES` with its article, as above.

## Month-by-month history

Everything stays in the browser. The current month saves itself (keyed `YYYY-MM`) a moment after each change, replacing that month's entry; "Save this month" does the same and confirms it. Each month keeps every input, the plan choices, the totals, the health score and the 50/30/20 split, so any month can be compared or opened again. Up to 60 months are kept, and the page asks before the oldest one would be removed. Snapshots saved by older versions move into history automatically as "totals only" months.

Backups (`budget-backup-YYYY-MM.json`) hold every month plus the settings. Opening one shows what it contains and offers Merge (the more recently saved copy of a month wins) or Replace. Older backup files still open.
