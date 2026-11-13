// Shared JSON-LD pieces for the built pages (guides, language/country pages).
// The hand-written blocks in index.html, about/, methodology/, contact/ and the
// legal pages use the same values; scripts/jsonld-check.mjs checks all of them
// after the build.

/** The guides' author, as on the About page (about/index.html). */
export const AUTHOR_NAME = 'Muhammad Ishaq';
export const AUTHOR_JOB_TITLE = 'UI/UX Designer';
export const SITE_EMAIL = 'hello@spendmath.com';

/** The site as publisher: name, home page, logo and email (absolute URLs need SITE_URL). */
export function publisher(siteUrl) {
  return {
    '@type': 'Organization',
    ...(siteUrl ? { '@id': `${siteUrl}/#organization` } : {}),
    name: 'SpendMath',
    ...(siteUrl ? { url: `${siteUrl}/`, logo: { '@type': 'ImageObject', url: `${siteUrl}/brand/logo-icon.svg` } } : {}),
    email: SITE_EMAIL
  };
}

/** The guides' author: the Person on the About page (same @id), who works for the site. */
export function author(siteUrl) {
  return {
    '@type': 'Person',
    ...(siteUrl ? { '@id': `${siteUrl}/about/#person` } : {}),
    name: AUTHOR_NAME,
    jobTitle: AUTHOR_JOB_TITLE,
    ...(siteUrl ? { url: `${siteUrl}/about/`, worksFor: { '@id': `${siteUrl}/#organization` } } : {})
  };
}

/**
 * The home page article, "5 Hidden Household Expense Leaks" (index.html #guide,
 * page.guide.* in the locales): first published, and when its text last
 * changed. Change dateModified only when the article's text changes. The
 * language/country pages' own versions keep their dates in src/i18n/articles/.
 */
export const HOME_ARTICLE = { datePublished: '2026-10-12', dateModified: '2026-10-20' };

/**
 * og:locale for a page's hreflang/lang tag: "en-GB" -> "en_GB", "ur-PK" -> "ur_PK".
 * Open Graph needs a territory, so generic English ("en", the home page and the
 * English guides) is en_US, Open Graph's default, as on the home page.
 */
export const ogLocale = (tag) => (tag.includes('-') ? tag.replace('-', '_') : ({ en: 'en_US' }[tag] || tag));

/** Plain text from a message's HTML ("Most households <strong>…</strong>" -> "Most households …"). */
export const plainText = (html) => String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/**
 * Article JSON-LD for a guide or the home page article: the About page's Person
 * as author, the site as publisher. `mainEntity`: the article is the page's main
 * content (guides), not part of a page about something else (the calculator).
 */
export function articleLd({ siteUrl, path, headline, description, lang, datePublished, dateModified, mainEntity = true }) {
  const url = siteUrl ? `${siteUrl}${path}` : '';
  return {
    '@context': 'https://schema.org', '@type': 'Article', headline, description, inLanguage: lang,
    datePublished, dateModified, author: author(siteUrl), publisher: publisher(siteUrl),
    ...(url ? { url, ...(mainEntity ? { mainEntityOfPage: { '@type': 'WebPage', '@id': url } } : {}), image: `${siteUrl}/og-image.png` } : {})
  };
}

/** A JSON-LD script tag ("<" can't appear inside it). */
export const ldScript = (o) => `<script type="application/ld+json">\n  ${JSON.stringify(o, null, 2).replace(/</g, '\\u003c').replace(/\n/g, '\n  ')}\n  </script>`;

/** "Last updated" as on the guides: <time datetime="2026-10-20">20 October 2026</time> in the page's language. */
export function updatedTime(iso, locale = 'en-GB') {
  const shown = new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `<time datetime="${iso}">${shown}</time>`;
}

/**
 * The byline under a guide's or the home page article's title, in the page's
 * language: "By <a href="/about/">Muhammad Ishaq</a> · Last updated: <time>".
 * `t` reads that language's messages (guides.byline, guides.authorName,
 * guides.updated). index.html writes the same markup by hand for English.
 */
export function bylineHtml({ t, aboutHref = '/about/', dateHtml }) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const [by, byAfter = ''] = t('guides.byline').split('{name}');
  const [upd, updAfter = ''] = t('guides.updated').split('{date}');
  return `<span id="guideByline">${esc(by)}<a href="${aboutHref}" class="link">${esc(t('guides.authorName'))}</a>${esc(byAfter)}</span> · <span id="guideUpdated">${esc(upd)}${dateHtml}${esc(updAfter)}</span>`;
}

/**
 * Home pages: the WebSite and the Organization behind it, with the About page's
 * Person as founder (same @ids as everywhere else). Hand-written copy in index.html.
 */
export function siteGraph(siteUrl, lang) {
  const { worksFor, ...founder } = author(siteUrl); // eslint-disable-line no-unused-vars
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        ...(siteUrl ? { '@id': `${siteUrl}/#website`, url: `${siteUrl}/` } : {}),
        name: 'SpendMath',
        inLanguage: lang,
        publisher: siteUrl ? { '@id': `${siteUrl}/#organization` } : { '@type': 'Organization', name: 'SpendMath' }
      },
      { ...publisher(siteUrl), founder }
    ]
  };
}

/** BreadcrumbList from [{ name, href }]; every item gets its absolute URL when SITE_URL is set. */
export function breadcrumbList(siteUrl, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(siteUrl ? { item: `${siteUrl}${it.href}` } : {}) }))
  };
}
