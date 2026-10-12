// Google AdSense loader. Configured entirely through .env:
//   VITE_ADSENSE_CLIENT=ca-pub-xxxxxxxxxxxxxxxx
//   VITE_ADSENSE_SLOT_TOP / _SIDEBAR / _INARTICLE / _BOTTOM (optional unit IDs)
// Slots reserve their height in CSS (min-h-*) so ads never shift the layout.
// The AdSense script is injected after the page is idle so it never competes
// with the calculator for the main thread on first load.

const client = import.meta.env.VITE_ADSENSE_CLIENT;
const SLOTS = {
  top: import.meta.env.VITE_ADSENSE_SLOT_TOP,
  sidebar: import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR,
  inarticle: import.meta.env.VITE_ADSENSE_SLOT_INARTICLE,
  bottom: import.meta.env.VITE_ADSENSE_SLOT_BOTTOM
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

  const load = () => {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    s.crossOrigin = 'anonymous';
    s.onload = fill;
    document.head.append(s);
  };

  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
  if (document.readyState === 'complete') idle(load);
  else window.addEventListener('load', () => idle(load), { once: true });
}
