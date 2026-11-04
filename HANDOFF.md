# Where we left off (20 October 2026)

Handoff notes for the next work session on the Household Budget Optimizer.

## Status in one line
All 8 launch-prep phases are done and **pushed** to `main` (`d4bb30f`, pushed 21 October 2026).

## Hosting (since 4 November 2026)
- spendmath.com is hosted on **Cloudflare Workers** (Worker `spendmath`, static assets only, set up
  in `wrangler.jsonc`). Netlify is no longer used and isn't linked to the repo.
- **Automatic deploys from `main`**: every push to `main` builds (`npm run build`) and deploys
  (`npx wrangler deploy`). See builds in Cloudflare → Workers & Pages → spendmath → Deployments.
- Build variables (`SITE_URL`, `VITE_CONTACT_FORM_ENDPOINT`, `VITE_CONTACT_FORM_KEY`,
  `VITE_CONTACT_EMAIL`) are in Workers & Pages → spendmath → Settings → Build variables. After a
  change, push a commit to rebuild. Local builds use your own `.env` (not committed).
- www → https://spendmath.com is a Redirect Rule ("Redirect www to apex"); http → https is
  "Always Use HTTPS". Both are in the Cloudflare dashboard for spendmath.com.

## Branches
- `main`: all current work. Cloudflare deploys automatically from `main`.
- `i18n`: older copy of the i18n work (kept, not needed for deploys).
- `review-improvements`: older branch (kept; its local copy has 1 unpushed commit, left as is).
- Uncommitted on purpose: `demo-backup-6-months.json` (your demo backup; commit or delete as you like).

## What was done (commits on main, oldest first)
| Commit | What |
|---|---|
| `221c8a5` | `.gitattributes`: LF line endings everywhere (the "23 modified files" were only CRLF noise). Pushed. |
| `b62d911` | Contact form never pretends to send; shows "Messages can't be sent from here yet" until a form service is set; build warning; README setup steps. |
| `df0e43b` | New `/about/` page (generic text, 9 languages, country sources table built from the data files). |
| `569a3a0` | SEO: new H1s ("Household Budget Calculator & Savings Planner"; "…for Pakistan" on language pages), neutral home article, real example figures in the static HTML, `npm run seo:check`. |
| `cfb5199` | Language switch `src/i18n/enabled.js`: en, ur, hi, ar, es live; fr, pt, de, id off (13 language pages built). |
| `2042867` | Fix: language pages showed "{step}"/"{total}" before scripts loaded. |
| `0c80014` | `/guides/` with 10 English guides + all 10 in Urdu at `/ur-pk/guides/`; Article/FAQ JSON-LD; checked by `articles:check`. |
| `1f0adc1` | Benchmark review for PK, IN, US, GB, AE (sources added; incomes for PK/IN corrected to realistic urban households; US thresholds fixed; US/PK example budgets fixed). Details: `src/data/countries/review-<CC>.md`. |
| `dad8c81` | Home page header now matches other pages: Calculator · Guides · About · Contact. |
| `d4bb30f` | Translation review fixes (ur ~40, hi 20, ar 8, es 30) and `REVIEW_URDU.md`. |

Earlier the same day (already in `main`): the i18n phases 6–9, the review fixes (404 page, flags on
Windows, lighter English bundle), and the currency picker inside the income box.

## Your to-do list
1. ~~Push `main`~~ Done 21 October 2026.
2. **About page**: replace the generic text, especially "Who runs it". Edit `about/index.html` and
   `about.*` in `src/i18n/locales/en.json` together (`npm run i18n:check` checks they match), then
   get the translations updated.
3. **Contact form**: create a free Formspree form or Web3Forms key (README → "Contact form").
4. **Cloudflare build variables**: the contact form and `SITE_URL` are set. Later add
   `VITE_ADSENSE_CLIENT` + slot IDs the same way, then push a commit to rebuild.
5. **AdSense**: publish the European consent message (Privacy & messaging → European regulations).
   An `ads.txt` file is still missing; add it once you have your publisher ID.
6. **Reviews**: give `REVIEW_URDU.md` to a native Urdu speaker; legal review of privacy policy and
   terms in every live language.
7. **Benchmarks still unverified**: PK 101, IN 108, US 4, GB 108, AE 100 values (mostly insurance,
   medical, misc, subscriptions, returns). UAE utilities rest mainly on a real-estate company guide.
   Full list: `REVIEW_BENCHMARKS.md`.

## Domain phase
1. ~~Domain, HTTPS, `SITE_URL`, sitemap~~ Done: https://spendmath.com on Cloudflare, `sitemap.xml`
   and `robots.txt` checked live on 4 November 2026.
2. Google Search Console: add the domain, verify by DNS, submit `sitemap.xml`.

## Useful commands
```bash
npm run dev               # local site
npm test                  # 172 tests
npm run build             # production build -> dist/
npm run i18n:check        # translations
npm run articles:check    # country articles + guides
npm run seo:check         # after a build: H1s, titles, placeholders
npm run benchmarks:review # rebuild REVIEW_BENCHMARKS.md
```

## Key files
- `README.md`: setup, contact form, ad consent, languages/countries/guides how-tos
- `src/i18n/enabled.js`: which languages are live
- `src/i18n/guide-langs.js`, `src/i18n/guides/`: guides
- `src/data/countries/`: country data + `review-<CC>.md`
- `REVIEW_BENCHMARKS.md`, `TRANSLATION_NOTES.md`, `REVIEW_URDU.md`: review lists

To resume, open this folder in Claude Code and say "continue from HANDOFF.md".
