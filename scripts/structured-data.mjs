// Shared JSON-LD pieces for the built pages (guides, language/country pages).
// The hand-written blocks in index.html, about/, contact/ and the legal pages
// use the same values; scripts/jsonld-check.mjs checks all of them after the build.

/** The guides' author. */
export const AUTHOR_NAME = 'Muhammad Ishaq';

/** The site as publisher: name, home page and logo (absolute URLs need SITE_URL). */
export function publisher(siteUrl) {
  return {
    '@type': 'Organization',
    name: 'SpendMath',
    ...(siteUrl ? { url: `${siteUrl}/`, logo: { '@type': 'ImageObject', url: `${siteUrl}/brand/logo-icon.svg` } } : {})
  };
}

/** The guides' author as a Person, linked to the About page. */
export function author(siteUrl) {
  return { '@type': 'Person', name: AUTHOR_NAME, ...(siteUrl ? { url: `${siteUrl}/about/` } : {}) };
}

/** BreadcrumbList from [{ name, href }]; every item gets its absolute URL when SITE_URL is set. */
export function breadcrumbList(siteUrl, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(siteUrl ? { item: `${siteUrl}${it.href}` } : {}) }))
  };
}
