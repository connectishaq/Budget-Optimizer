# Household Budget Optimizer & Savings Simulator

A fast, private, static budgeting tool. All calculations run in the browser; nothing is sent to a server.

## Run it

```bash
npm install
npm run dev      # local dev server with hot reload (http://localhost:5173)
npm test         # Vitest: engine, projection, debt math and saved-data checks
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
src/state.js            single source of truth, validation, localStorage persistence
src/engine/profiles.js  profile benchmarks, typical ranges, sample data, currency scaling
src/engine/rules.js     savings rule dictionary (18 rules)
src/engine/calculate.js pure math: totals, rules, health score, 50/30/20, projection, debt, goals
src/ui/*.js             inputs, plan cards, dashboard, SVG growth chart, goals, history/sharing
src/ads.js              AdSense loader (idle-time, env-configured)
src/styles.css          Tailwind v4 + small component layer, lite mode, print stylesheet
public/                 icons, share image, web app manifest, offline service worker (sw.js), robots.txt, sitemap.xml template
```
