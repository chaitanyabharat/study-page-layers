/* Footer links: a compact two-line footer.
   Line 1: logo, the most-used links, an "All links" button that shows the full
   list in place, social icons. Line 2 (the site's own bottom bar): legal links,
   copyright, app badges, BBB.

   Adds and moves; never removes. The top-line links are copies of links already
   in the footer (same address, own analytics name), the full list stays in the
   page for search engines and is only hidden from view, and print shows
   everything. Without this script the footer is shown in full.

   Settings (window.STUDY_PAGE.footer); the defaults describe Study.com's footer:
     top      link texts for the top line, in order (from click data)
     label    the button text
     logo     light logo image; by default the header logo's "text-light" twin */
(() => {
  'use strict';
  const doc = document;
  const S = Object.assign({
    footer: 'footer#footer',
    groups: ':scope > .container-fluid:not(.copyright)',      // the full list of link groups
    bottom: ':scope > .container-fluid.copyright',            // the bottom bar
    top: ['Plans', 'Blog', 'Careers', 'Teach For Us', 'Scholarships', 'Contact Support', 'FAQ'],
    social: '.footer__connect__container .footer__connect__social',   // moved to the top line
    toBottom: ['.appDownloads.hidden-xs', ':scope > .bbbLogo'],  // moved to the bottom bar, in this order
    label: 'All links',
    logo: '',
    logoHref: '/',
  }, (window.STUDY_PAGE && window.STUDY_PAGE.footer) || {});
  const run = () => {
    const f = doc.querySelector(S.footer); if (!f || f.classList.contains('ftl')) return;
    const groups = f.querySelector(S.groups), bottom = f.querySelector(S.bottom);
    if (!groups || !bottom) return;
    const clean = (s) => s.replace(/\s+/g, ' ').trim();
    const el = (t, a = {}) => { const n = doc.createElement(t); for (const k in a) n.setAttribute(k, a[k]); return n; };

    const top = el('div', { class: 'ftl-top' });
    let src = S.logo;
    if (!src) { const navLogo = doc.querySelector('nav img[src*="text-dark"]'); if (navLogo) src = navLogo.getAttribute('src').replace('text-dark', 'text-light'); }
    if (src) {
      const a = el('a', { class: 'ftl-logo', href: S.logoHref, 'data-cname': 'enh_footer_logo' });
      const img = el('img', { src, alt: 'Study.com home', width: '120', height: '30' });
      img.addEventListener('error', () => a.remove(), { once: true });
      a.append(img); top.append(a);
    }
    const nav = el('nav', { class: 'ftl-nav', 'aria-label': 'Popular links' });
    const links = Array.from(groups.querySelectorAll('a[href]'));
    S.top.forEach((label) => {
      const orig = links.find((l) => clean(l.textContent).toLowerCase() === label.toLowerCase()); if (!orig) return;
      const a = orig.cloneNode(true);
      a.removeAttribute('id'); a.className = 'ftl-link';
      a.setAttribute('data-cname', 'enh_footer_top_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
      a.removeAttribute('test-id');
      nav.append(a);
    });
    top.append(nav);
    if (!groups.id) groups.id = 'ftl-all';
    const btn = el('button', { type: 'button', class: 'ftl-more', 'aria-expanded': 'false', 'aria-controls': groups.id, 'data-cname': 'enh_footer_all_links' });
    btn.innerHTML = '<span></span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.firstChild.textContent = S.label;
    top.append(btn);
    const social = f.querySelector(S.social);
    if (social) top.append(social);
    f.insertBefore(top, groups);
    S.toBottom.forEach((sel) => { const n = f.querySelector(sel); if (n) bottom.append(n); });
    groups.setAttribute('role', 'region'); groups.setAttribute('aria-label', 'All footer links');

    const set = (open) => {
      f.classList.toggle('ftl-open', open); btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true'; set(open);
      if (open) { const first = Array.from(groups.querySelectorAll('a[href]')).find((a) => a.textContent.trim() && a.getClientRects().length); if (first) first.focus({ preventScroll: true }); groups.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
    });
    groups.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); btn.focus(); } });
    f.classList.add('ftl');
    set(false);
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run, { once: true }); else run();
})();
