# Household Budget Optimizer & Savings Simulator

A fast, private, static budgeting tool. All calculations run in the browser; nothing is sent to a server.

## Run it

```bash
npm install
npm run dev      # local dev server with hot reload (http://localhost:5173)
npm test         # Vitest: engine, projection, debt math, month history and saved-data checks
npm run build    # production build -> ./dist (upload this folder to any static host)
npm run preview  # serve ./dist locally to check the production build
```

## Configure before deploying

Copy `.env.example` to `.env`, fill it in, then run `npm run build`:

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Your live domain, e.g. `https://www.example.com`. Adds the canonical tag, `og:url` and the social share image (`og-image.png`), writes `sitemap.xml` and the `Sitemap:` line in `robots.txt`. Without it these are skipped (the build warns you). |
| `VITE_ADSENSE_CLIENT` | Your AdSense publisher ID (`ca-pub-…`). Leave empty and all ad slots stay hidden. |
| `VITE_ADSENSE_SLOT_TOP` / `_SIDEBAR` / `_INARTICLE` / `_BOTTOM` | Optional ad-unit IDs for each slot. |
| `VITE_CONTACT_EMAIL` | Public email shown in the footer Contact section. |

Ad slots are marked in `index.html` with `<!-- ===== ADSENSE: … START/END ===== -->` comments and reserve their height to prevent layout shift. The sidebar slot is desktop-only, so on phones no ad sits between the inputs and the results.

## Project structure

```
index.html              page markup, SEO article, FAQ, JSON-LD, inline SVG icon sprite
src/main.js             bootstrap: compute -> render loop (typing debounced 150 ms)
src/state.js            single source of truth, validation, localStorage persistence ('hbo:v3')
src/history-store.js    month-by-month history in localStorage ('hbo:history', versioned)
src/engine/profiles.js  profile benchmarks, typical ranges, sample data, currency scaling
src/engine/rules.js     savings rule dictionary (18 rules)
src/engine/calculate.js pure math: totals, rules, health score, 50/30/20, projection, debt, goals
src/engine/history.js   pure history maths: month entries, migration, comparison, streaks, alerts, backups
src/ui/*.js             inputs, plan cards, dashboard, charts (svg-chart.js lines, svg-bar-chart.js bars), goals, months (history panel),
                        history (backup, share, print), reset (start over)
src/ads.js              AdSense loader (idle-time, env-configured)
src/styles.css          Tailwind v4 + small component layer, lite mode, print stylesheet
public/                 favicon, iPhone bookmark icon, social share image, robots.txt, sitemap.xml template
```

## Month-by-month history

Everything stays in the browser. The current month saves itself (keyed `YYYY-MM`) a moment after each change, replacing that month's entry; "Save this month" does the same and confirms it. Each month keeps every input, the plan choices, the totals, the health score and the 50/30/20 split, so any month can be compared or opened again. Up to 60 months are kept, and the page asks before the oldest one would be removed. Snapshots saved by older versions move into history automatically as "totals only" months.

Backups (`budget-backup-YYYY-MM.json`) hold every month plus the settings. Opening one shows what it contains and offers Merge (the more recently saved copy of a month wins) or Replace. Older backup files still open.
