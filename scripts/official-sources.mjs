// Which source links are official (government, central banks, statistics
// offices, regulators, intergovernmental bodies). Those are linked without
// rel="nofollow" on the About page and in the guides; everything else (news,
// banks, comparison sites, blogs) keeps it. Used at build time.

// Government domains: .gov, .gov.uk, .gov.in…, .gob.mx, .gc.ca
const GOV = /(^|\.)(gov|gob)(\.[a-z]{2})?$|(^|\.)gc\.ca$/;

// Official bodies outside those domains
const OFFICIAL = new Set([
  'destatis.de', // Federal Statistical Office of Germany
  'insee.fr', // French national statistics institute
  'ine.es', // Spanish national statistics institute
  'inegi.org.mx', // Mexican national statistics institute
  'stlouisfed.org', // Federal Reserve Bank of St. Louis (FRED)
  'clevelandfed.org', // Federal Reserve Bank of Cleveland
  'centralbank.ae', // Central Bank of the UAE
  'nepra.org.pk', // Pakistan's electricity regulator
  'esmap.org' // World Bank energy programme
]);

/** True for links to official sources (see above). */
export function isOfficialSource(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
  if (GOV.test(host)) return true;
  return [...OFFICIAL].some((d) => host === d || host.endsWith(`.${d}`));
}

/** rel for an external source link: "noopener" for official sources, else "noopener nofollow". */
export const sourceRel = (url) => (isOfficialSource(url) ? 'noopener' : 'noopener nofollow');
