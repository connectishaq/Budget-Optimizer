// Checks the money guides in src/i18n/guides/<lang>/<slug>.json (run by
// `npm run articles:check`). English: 1,000–1,500 words, one H1 and no H1/H2
// inside the body, allowed tags only, 3+ FAQ entries, 2–3 related guides that
// exist, title/description lengths. Translations: the same structure as the
// English. When dist/ exists, every built guide page must carry FAQPage and
// Article JSON-LD matching its FAQ. Returns { errors, report }.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'node-html-parser';
import { GUIDE_SLUGS, GUIDE_BASES } from '../src/i18n/guide-langs.js';

const ALLOWED = new Set(['p', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'a']);
const strip = (s) => s.replace(/<[^>]+>/g, ' ');
const words = (s) => strip(s).split(/\s+/).filter(Boolean).length;

export function checkGuides(root) {
  const errors = [];
  const report = [];
  const dir = (lang) => path.join(root, 'src/i18n/guides', lang);
  const load = (lang, slug) => {
    const f = path.join(dir(lang), `${slug}.json`);
    if (!fs.existsSync(f)) return null;
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { errors.push(`guides/${lang}/${slug}: invalid JSON (${e.message})`); return undefined; }
  };

  for (const lang of Object.keys(GUIDE_BASES)) {
    const base = GUIDE_BASES[lang];
    const files = fs.existsSync(dir(lang)) ? fs.readdirSync(dir(lang)).filter((f) => f.endsWith('.json')) : [];
    for (const f of files) if (!GUIDE_SLUGS.includes(path.basename(f, '.json'))) errors.push(`guides/${lang}/${f}: not in GUIDE_SLUGS (src/i18n/guide-langs.js)`);

    for (const slug of GUIDE_SLUGS) {
      const id = `guides/${lang}/${slug}`;
      const g = load(lang, slug);
      if (g === undefined) continue;
      if (g === null) { if (lang === 'en') errors.push(`${id}: missing`); continue; }
      const en = lang === 'en' ? g : load('en', slug);

      if (g.slug !== slug) errors.push(`${id}: slug is "${g.slug}"`);
      for (const k of ['h1', 'summary', 'intro_html']) if (typeof g[k] !== 'string' || !g[k].trim()) errors.push(`${id}: ${k} missing`);
      if (!g.seo?.title || g.seo.title.length > 70) errors.push(`${id}: seo.title must be 1–70 characters (is ${g.seo?.title?.length || 0})`);
      if (!g.seo?.description || g.seo.description.length > 160) errors.push(`${id}: seo.description must be 1–160 characters (is ${g.seo?.description?.length || 0})`);
      if (!Array.isArray(g.sections) || g.sections.length < 3) errors.push(`${id}: needs at least 3 sections`);
      if (!Array.isArray(g.faq) || g.faq.length < 3) errors.push(`${id}: needs at least 3 FAQ entries (for the FAQ schema)`);
      for (const [i, f] of (g.faq || []).entries()) if (!f.q?.trim() || !f.a?.trim()) errors.push(`${id}: faq[${i}] needs q and a`);
      const related = g.related || [];
      if (related.length < 2 || related.length > 3) errors.push(`${id}: needs 2–3 related guides`);
      for (const r of related) if (!GUIDE_SLUGS.includes(r) || r === slug) errors.push(`${id}: related "${r}" isn't another guide`);

      const html = [g.intro_html, ...(g.sections || []).map((s) => s.body_html)].join('\n');
      for (const s of g.sections || []) if (!s.h2?.trim()) errors.push(`${id}: a section has no h2`);
      for (const m of html.matchAll(/<\/?([a-zA-Z0-9]+)/g)) {
        const tag = m[1].toLowerCase();
        if (!ALLOWED.has(tag)) errors.push(`${id}: <${tag}> isn't allowed in the guide body (one H1 per page; sections use h2 from the file)`);
      }
      for (const a of parse(html).querySelectorAll('a')) {
        const href = a.getAttribute('href') || '';
        if (/^https?:/.test(href)) continue;
        const home = lang === 'en' ? '/' : base.replace(/guides\/$/, '');
        const guide = href.startsWith(base) ? href.slice(base.length).replace(/\/$/, '') : null;
        if (guide !== null) { if (!GUIDE_SLUGS.includes(guide)) errors.push(`${id}: link to unknown guide ${href}`); }
        else if (!href.startsWith(`${home}#`) && href !== home) errors.push(`${id}: link ${href} should stay in this language (${base}… or ${home}#app)`);
      }

      const n = words(html) + (g.sections || []).reduce((a, s) => a + words(s.h2 || ''), 0) + (g.faq || []).reduce((a, f) => a + words(`${f.q} ${f.a}`), 0);
      if (lang === 'en') {
        if (n < 1000 || n > 1500) errors.push(`${id}: ${n} words; aim for 1,000–1,500`);
        if (!g.h1.toLowerCase().includes((g.keyword || '').toLowerCase().split(' ')[0])) errors.push(`${id}: the H1 doesn't contain the keyword "${g.keyword}"`);
      } else if (en) {
        // A translation keeps the English structure
        if (g.sections?.length !== en.sections?.length) errors.push(`${id}: ${g.sections?.length} sections, English has ${en.sections?.length}`);
        if (g.faq?.length !== en.faq?.length) errors.push(`${id}: ${g.faq?.length} FAQ entries, English has ${en.faq?.length}`);
        if (JSON.stringify(g.related) !== JSON.stringify(en.related)) errors.push(`${id}: related guides differ from the English`);
      }
      report.push(`  ${id}: ${n} words, ${g.sections?.length} sections, ${g.faq?.length} FAQ`);
    }
  }

  // Built pages: FAQPage and Article JSON-LD on every guide (only when dist/ exists)
  const dist = path.join(root, 'dist');
  if (fs.existsSync(path.join(dist, 'guides'))) {
    for (const [lang, base] of Object.entries(GUIDE_BASES)) {
      for (const slug of GUIDE_SLUGS) {
        const g = load(lang, slug);
        if (!g) continue;
        const file = path.join(dist, ...base.split('/').filter(Boolean), slug, 'index.html');
        if (!fs.existsSync(file)) { errors.push(`dist${base}${slug}/: not built (run npm run build)`); continue; }
        const doc = parse(fs.readFileSync(file, 'utf8'));
        const ld = doc.querySelectorAll('script[type="application/ld+json"]').map((s) => JSON.parse(s.text));
        const faq = ld.find((x) => x['@type'] === 'FAQPage');
        if (!faq || faq.mainEntity?.length !== g.faq.length) errors.push(`dist${base}${slug}/: FAQPage JSON-LD missing or doesn't match the FAQ`);
        if (!ld.some((x) => x['@type'] === 'Article' && x.headline === g.h1)) errors.push(`dist${base}${slug}/: Article JSON-LD missing`);
        if (doc.querySelectorAll('h1').length !== 1) errors.push(`dist${base}${slug}/: needs exactly one H1`);
      }
    }
  }
  return { errors, report };
}
