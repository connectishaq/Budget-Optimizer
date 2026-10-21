// The header menu on phones (src/partials/nav-menu.html): on narrow screens the
// Calculator, Guides, About and Contact links fold into this menu.

export function initNavMenu() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const panel = document.querySelector('[data-nav-menu]');
  if (!toggle || !panel) return;
  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  const setOpen = (open) => {
    panel.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!isOpen()));
  // Close after picking a link (it may only scroll this page), on a click outside, or on Escape
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('click', (e) => {
    if (isOpen() && !panel.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { setOpen(false); toggle.focus(); }
  });
}
