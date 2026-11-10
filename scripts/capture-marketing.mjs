// node scripts/capture-marketing.mjs [only=name,name,...]
// Marketing screenshots of the LIVE site (https://spendmath.com) for Behance,
// Product Hunt and LinkedIn, plus the logo as 1200 px PNGs and a 1270x760
// Product Hunt cover. Everything goes to marketing-assets/ (git-ignored).
// Each shot uses a fresh browser (no saved data), with Cloudflare Web
// Analytics blocked and toasts hidden. The history shots (desktop-05*) load
// demo-backup-6-months.json from the project root and are skipped without it.
// Pass shot names (or "shots", "logos", "cover") to redo only some, e.g.
//   node scripts/capture-marketing.mjs mobile-09-results-dark,cover
// The cover reuses desktop-01-home-light.png, so take that shot first.
// Playwright is not a project dependency (deploys don't need it); see README.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error([
    'Playwright is not installed. Run once:',
    '  npm install --no-save playwright@1.65.0',
    '  npx playwright install chromium'
  ].join('\n'));
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'marketing-assets');
const backup = path.join(root, 'demo-backup-6-months.json');
const brandDir = path.join(root, 'public/brand');
const onlyArg = process.argv[2];
const only = onlyArg ? onlyArg.split(',') : null;
const SITE = 'https://spendmath.com';
fs.mkdirSync(outDir, { recursive: true });

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

const browser = await chromium.launch();

async function page(device, theme, locale = 'en-US') {
  const ctx = await browser.newContext({ ...device, colorScheme: theme, locale, timezoneId: 'America/New_York', reducedMotion: 'reduce' });
  // No analytics (Cloudflare Web Analytics beacon) and nothing remembered from earlier visits
  await ctx.route(/cloudflareinsights\.com|\/cdn-cgi\/rum/, (r) => r.abort());
  await ctx.addInitScript((t) => { try { localStorage.setItem('hbo:theme', t); } catch {} }, theme);
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  return p;
}

async function settle(p) {
  await p.waitForLoadState('networkidle');
  await p.evaluate(() => document.fonts.ready);
  // Hide caret and scrollbars
  await p.addStyleTag({ content: '*{caret-color:transparent!important} ::-webkit-scrollbar{display:none} html{scrollbar-width:none}' });
  await p.waitForTimeout(600);
}

async function sample(p) {
  await p.locator('[data-action="sample"]:visible').first().click();
  await p.locator('#resultsView').waitFor({ state: 'visible' });
  await settle(p);
  // No "Example budget loaded" toast in the shots
  await p.addStyleTag({ content: '.toast-enter,.toast-leave,[class*="toast"]{display:none!important}' });
}

async function scrollTo(p, selector, offset = 0) {
  await p.evaluate(([s, o]) => {
    const el = document.querySelector(s);
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o);
  }, [selector, offset]);
  await p.waitForTimeout(500);
}

const shots = {
  'desktop-01-home-light': async () => {
    const p = await page(DESKTOP, 'light');
    await p.goto(`${SITE}/`); await settle(p);
    return p;
  },
  'desktop-02-home-dark': async () => {
    const p = await page(DESKTOP, 'dark');
    await p.goto(`${SITE}/`); await settle(p);
    return p;
  },
  'desktop-03a-results-summary-light': async () => {
    const p = await page(DESKTOP, 'light');
    await p.goto(`${SITE}/`); await settle(p); await sample(p);
    await scrollTo(p, '#resultsView', 72);
    return p;
  },
  'desktop-03b-results-savings-ideas-light': async () => {
    const p = await page(DESKTOP, 'light');
    await p.goto(`${SITE}/`); await settle(p); await sample(p);
    await scrollTo(p, '#plan', 90);
    return p;
  },
  'desktop-03c-results-health-score-light': async () => {
    const p = await page(DESKTOP, 'light');
    await p.goto(`${SITE}/`); await settle(p); await sample(p);
    await scrollTo(p, '#health', 90);
    return p;
  },
  'desktop-04-savings-idea-explained-light': async () => {
    const p = await page(DESKTOP, 'light');
    await p.goto(`${SITE}/`); await settle(p); await sample(p);
    // A savings idea (not a whole-bill row): its Details has "How did we get this?"
    const row = p.locator('#plan article[id^="plan-"]:not([id^="plan-bill-"])').first();
    await row.locator('button[aria-expanded]').last().click();
    await p.waitForTimeout(400);
    await scrollTo(p, `#${await row.getAttribute('id')}`, 200);
    return p;
  },
  'desktop-05-month-by-month-light': async () => {
    const p = await page(DESKTOP, 'light');
    await p.goto(`${SITE}/`); await settle(p);
    await p.locator('#importFile').setInputFiles(backup);
    await p.getByRole('button', { name: 'Replace', exact: true }).click();
    await p.waitForTimeout(1500); await settle(p);
    await p.addStyleTag({ content: '[class*="toast"]{display:none!important}' });
    await p.evaluate(() => { for (const id of ['compareRow']) document.getElementById(id).open = true; });
    await p.waitForTimeout(500);
    await scrollTo(p, '#months', 100);
    return p;
  },
  'desktop-05b-compare-two-months-light': async () => {
    const p = await page(DESKTOP, 'light');
    await p.goto(`${SITE}/`); await settle(p);
    await p.locator('#importFile').setInputFiles(backup);
    await p.getByRole('button', { name: 'Replace', exact: true }).click();
    await p.waitForTimeout(1500); await settle(p);
    await p.addStyleTag({ content: '[class*="toast"]{display:none!important}' });
    await p.evaluate(() => { document.getElementById('alertsRow').open = true; document.getElementById('compareRow').open = true; });
    await p.waitForTimeout(600);
    await scrollTo(p, '#alertsRow', 200);
    return p;
  },
  'desktop-06-guide-uk-groceries-table-light': async () => {
    const p = await page(DESKTOP, 'light');
    await p.goto(`${SITE}/guides/grocery-budget-uk/`); await settle(p);
    // The ONS summary table ("UK grocery spending at a glance"), heading included
    await p.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find((x) => /at a glance/i.test(x.textContent));
      window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 130);
    });
    await p.waitForTimeout(500);
    return p;
  },
  'desktop-07-urdu-ur-pk-light': async () => {
    const p = await page(DESKTOP, 'light', 'ur-PK');
    await p.goto(`${SITE}/ur-pk/`); await settle(p);
    return p;
  },
  'mobile-08-home-light': async () => {
    const p = await page(MOBILE, 'light');
    await p.goto(`${SITE}/`); await settle(p);
    return p;
  },
  'mobile-09-results-dark': async () => {
    const p = await page(MOBILE, 'dark');
    await p.goto(`${SITE}/`); await settle(p); await sample(p);
    await scrollTo(p, '#summary', 128);
    return p;
  },
  'mobile-10-urdu-guide-light': async () => {
    const p = await page(MOBILE, 'light', 'ur-PK');
    await p.goto(`${SITE}/ur-pk/guides/monthly-budget-plan-pakistan/`); await settle(p);
    return p;
  }
};

for (const [name, run] of Object.entries(shots)) {
  if (only && !only.includes(name) && !only.includes('shots')) continue;
  if (name.startsWith('desktop-05') && !fs.existsSync(backup)) { console.warn(`- ${name} skipped: demo-backup-6-months.json not found`); continue; }
  const p = await run();
  await p.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log('✓', name);
  await p.context().close();
}

// Logos at 1200 px wide, transparent background
if (!only || only.includes('logos')) {
  for (const [file, out] of [['logo-horizontal.svg', 'logo-spendmath-light-1200.png'], ['logo-horizontal-dark.svg', 'logo-spendmath-dark-1200.png']]) {
    const svg = fs.readFileSync(path.join(brandDir, file), 'utf8');
    const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const H = Math.round(1200 * h / w);
    const ctx = await browser.newContext({ viewport: { width: 1200, height: H }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="[^"]+" height="[^"]+"/, 'width="1200" height="' + H + '"')}</body></html>`);
    await p.screenshot({ path: path.join(outDir, out), omitBackground: true, clip: { x: 0, y: 0, width: 1200, height: H } });
    console.log('✓', out, `1200×${H}`);
    await ctx.close();
  }
}

// Product Hunt cover 1270×760 (and @2x): desktop light screenshot on a soft background with the logo
if (!only || only.includes('cover')) {
  const shot = fs.readFileSync(path.join(outDir, 'desktop-01-home-light.png')).toString('base64');
  const logo = fs.readFileSync(path.join(brandDir, 'logo-horizontal.svg'), 'utf8').replace(/width="[^"]+" height="[^"]+"/, 'height="44" width="234"');
  const html = `<html><body style="margin:0">
  <div style="width:1270px;height:760px;position:relative;overflow:hidden;font-family:system-ui,'Segoe UI',sans-serif;
    background:radial-gradient(1000px 600px at 15% 0%,#d1fae5 0%,transparent 60%),radial-gradient(900px 600px at 100% 100%,#e0e7ff 0%,transparent 60%),#f8fafc">
    <div style="position:absolute;left:64px;top:52px;display:flex;align-items:center;gap:24px">${logo}
      <span style="font-size:22px;color:#334155;letter-spacing:-0.01em">Free budget calculator · private, no sign-up</span></div>
    <div style="position:absolute;left:64px;right:64px;top:140px;border-radius:18px;overflow:hidden;
      box-shadow:0 30px 70px -20px rgba(15,23,42,.35),0 0 0 1px rgba(15,23,42,.08);background:#fff">
      <div style="height:34px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;padding:0 16px">
        <i style="width:11px;height:11px;border-radius:50%;background:#f87171"></i><i style="width:11px;height:11px;border-radius:50%;background:#fbbf24"></i><i style="width:11px;height:11px;border-radius:50%;background:#34d399"></i>
        <span style="margin-left:16px;font-size:13px;color:#64748b">spendmath.com</span></div>
      <img src="data:image/png;base64,${shot}" style="display:block;width:100%">
    </div>
  </div></body></html>`;
  for (const [scale, out] of [[1, 'producthunt-cover-1270x760.png'], [2, 'producthunt-cover-1270x760@2x.png']]) {
    const ctx = await browser.newContext({ viewport: { width: 1270, height: 760 }, deviceScaleFactor: scale });
    const p = await ctx.newPage();
    await p.setContent(html); await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(outDir, out) });
    console.log('✓', out);
    await ctx.close();
  }
}

await browser.close();
