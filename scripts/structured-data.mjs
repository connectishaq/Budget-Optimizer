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

/** BreadcrumbList from [{ name, href }]; every item gets its absolute URL when SITE_URL is set. */
export function breadcrumbList(siteUrl, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(siteUrl ? { item: `${siteUrl}${it.href}` } : {}) }))
  };
}
