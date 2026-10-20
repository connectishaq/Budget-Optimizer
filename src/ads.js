// Google AdSense loader. Configured entirely through .env:
//   VITE_ADSENSE_CLIENT=ca-pub-xxxxxxxxxxxxxxxx
//   VITE_ADSENSE_SLOT_TOP / _SIDEBAR / _INARTICLE / _BOTTOM (optional unit IDs)
//   VITE_CMP_SRC (optional, see "Consent" below)
// Slots reserve their height in CSS (min-h-*) so ads never shift the layout.
// The AdSense script is injected after the page is idle so it never competes
// with the calculator for the main thread on first load.
//
// ---------------- Consent (EEA, UK, Switzerland) ----------------
// AdSense requires a Google-certified consent management platform (CMP) for
// visitors in the EEA, the UK and Switzerland. Two ways to meet that:
//  1. Google's own CMP: AdSense > Privacy & messaging > European regulations,
//     create and publish the message. It's served by the AdSense tag itself;
//     leave VITE_CMP_SRC empty.
//  2. Another Google-certified CMP (IAB TCF v2.2): put its script URL in
//     VITE_CMP_SRC. It's loaded first, and AdSense only after it.
// Either way, Google Consent Mode v2 defaults below keep ads non-personalised
// in those regions until the visitor agrees; the CMP updates the choice.
// Nothing here detects the visitor's location: Google applies the region list.

const client = import.meta.env.VITE_ADSENSE_CLIENT;
const cmpSrc = import.meta.env.VITE_CMP_SRC;
const SLOTS = {
  top: import.meta.env.VITE_ADSENSE_SLOT_TOP,
  sidebar: import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR,
  inarticle: import.meta.env.VITE_ADSENSE_SLOT_INARTICLE,
  bottom: import.meta.env.VITE_ADSENSE_SLOT_BOTTOM
};

// EU/EEA countries, the UK and Switzerland: consent needed before personalised ads
export const CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH'
];

/** Consent Mode v2 defaults, set before any Google tag loads. */
export function setConsentDefaults(w = window) {
  w.dataLayer = w.dataLayer || [];
  // gtag() must push the arguments object, as Google's snippet does
  w.gtag = w.gtag || function gtag() { w.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
  w.gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
    region: CONSENT_REGIONS,
    wait_for_update: 500 // give the consent message time to load
  });
  w.gtag('consent', 'default', {
    ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'denied'
  });
  w.gtag('set', 'ads_data_redaction', true);
}

/** Footer "Privacy choices" link: shown once Google's consent message is available. */
function initPrivacyChoices() {
  const link = document.querySelector('[data-privacy-choices]');
  if (!link) return;
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  window.googlefc.callbackQueue.push({
    CONSENT_API_READY: () => {
      link.closest('li').hidden = false;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.googlefc.showRevocationMessage?.();
      });
    }
  });
}

const addScript = (src, onload) => {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  s.crossOrigin = 'anonymous';
  if (onload) s.onload = onload;
  s.onerror = onload || null;
  document.head.append(s);
};

export function initAds() {
  const root = document.documentElement;
  if (!client) {
    // Show labelled placeholders while developing so the layout can be reviewed.
    if (import.meta.env.DEV) {
      root.classList.add('ads-preview');
      document.querySelectorAll('[data-ad]').forEach((el) => { el.textContent = `Ad slot · ${el.dataset.ad}`; });
    }
    return;
  }

  const fill = () => {
    document.querySelectorAll('[data-ad]').forEach((el) => {
      // Skip slots hidden at this breakpoint (e.g. the desktop-only sidebar on phones)
      if (!el.offsetParent) return;
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.style.width = '100%';
      ins.dataset.adClient = client;
      const slot = SLOTS[el.dataset.ad];
      if (slot) ins.dataset.adSlot = slot;
      if (el.dataset.ad === 'inarticle') {
        ins.dataset.adFormat = 'fluid';
        ins.dataset.adLayout = 'in-article';
        ins.style.textAlign = 'center';
      } else {
        ins.dataset.adFormat = 'auto';
        ins.dataset.fullWidthResponsive = 'true';
      }
      el.append(ins);
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  };

  const loadAdSense = () => addScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`, fill);
  const load = () => {
    setConsentDefaults();
    initPrivacyChoices();
    // A third-party CMP goes first so it can answer before ads are requested
    if (cmpSrc) addScript(cmpSrc, loadAdSense);
    else loadAdSense();
  };

  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
  if (document.readyState === 'complete') idle(load);
  else window.addEventListener('load', () => idle(load), { once: true });
}
