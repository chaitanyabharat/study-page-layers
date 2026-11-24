/* =========================================================================
   Study.com "New look" loader and Display control (prototype)

   - The new look is the default. A reader can turn it off and gets the
     original page back. The choice is remembered on that device.
   - One rounded-square "Display" button sits beside the search box, in both
     looks, so the reader can always come back. It opens a small panel:
       New look   on / off  (Beta)
       Theme      System / Light / Dark   (new look only; System is the default)
     On phones the panel opens as a bottom sheet.
   - Switching the look reloads the page in the other look and returns the
     reader to the section they were reading. A reload is used on purpose: the
     classic page is then exactly what is live today, with no leftover changes.
     Changing the theme is instant, with no reload. The classic page is always light.
   - ?ui=classic|new and ?theme=system|light|dark in the address set the
     choices (handy for QA and support links).
   - Load this file in <head>. The look and the theme are set before the page
     paints, so there is no flash; scripts and the button wait for the page.
   - Assets come from window.STUDY_NEW_UI: either { css: [urls], js: [urls] }
     in production, or { inline: { css: [text], js: [text] } } in previews.
   ========================================================================= */
(() => {
  'use strict';
  const doc = document, root = doc.documentElement;
  if (root.hasAttribute('data-ui')) return;               // already ran
  const KEY = 'study-new-ui', ANCHOR = 'study-new-ui-anchor', HINT = 'study-new-ui-hint';
  /* The section to return to is kept for a few seconds in local storage. It is
     the only store that survives a reload in every context, including local
     file previews where browsers clear session storage and window.name. */
  const takeAnchor = () => {
    const raw = store.get(ANCHOR); store.del(ANCHOR);
    try { const a = JSON.parse(raw); return a && Date.now() - a.t < 15000 ? a.id : ''; } catch (e) { return ''; }
  };
  const leaveAnchor = (id) => { if (id) store.set(ANCHOR, JSON.stringify({ id, t: Date.now() })); else store.del(ANCHOR); };
  const cfg = window.STUDY_NEW_UI || {};
  const ready = (fn) => (doc.readyState === 'loading' ? doc.addEventListener('DOMContentLoaded', fn, { once: true }) : fn());
  const store = {
    get(k, s = localStorage) { try { return s.getItem(k); } catch (e) { return null; } },
    set(k, v, s = localStorage) { try { s.setItem(k, v); } catch (e) { /* storage blocked */ } },
    del(k, s = localStorage) { try { s.removeItem(k); } catch (e) { /* ignore */ } },
  };

  /* 1. Decide the look */
  const q = new URLSearchParams(location.search).get('ui');
  if (q === 'classic' || q === 'new') store.set(KEY, q === 'new' ? 'on' : 'off');
  const isNew = store.get(KEY) !== 'off';
  root.setAttribute('data-ui', isNew ? 'new' : 'classic');   // also useful for analytics segments

  /* 1b. Decide the color theme, before anything paints. data-theme is the
     theme in effect; data-theme-pref is what the reader picked. */
  const TKEY = 'study-theme', THEMES = ['system', 'light', 'dark'];
  const tq = new URLSearchParams(location.search).get('theme');
  if (THEMES.includes(tq)) store.set(TKEY, tq);
  let pref = THEMES.includes(store.get(TKEY)) ? store.get(TKEY) : 'system';
  const sysDark = matchMedia('(prefers-color-scheme: dark)');
  const effective = () => (pref === 'system' ? (sysDark.matches ? 'dark' : 'light') : pref);
  const applyTheme = () => {
    if (!isNew) { root.removeAttribute('data-theme'); root.removeAttribute('data-theme-pref'); return; }
    root.setAttribute('data-theme', effective()); root.setAttribute('data-theme-pref', pref);
  };
  applyTheme();
  /* reading option from the page settings: Literata for long reads */
  const rf = window.STUDY_PAGE && window.STUDY_PAGE.readingFont;
  if (isNew && (rf === 'serif' || rf === 'sans')) root.setAttribute('data-reading-font', rf);

  /* 2. Apply the new look */
  if (isNew) {
    const inline = cfg.inline || {};
    (inline.css || []).forEach((text, i) => { const s = doc.createElement('style'); s.id = 'nu-css-' + i; s.textContent = text; doc.head.appendChild(s); });
    /* files are URLs, or [url, integrity hash] pairs from the page-layers manifest */
    const early = doc.readyState === 'loading';
    const fileAttrs = (n, f) => {
      if (Array.isArray(f) && f[1]) { n.integrity = f[1]; n.crossOrigin = 'anonymous'; }
      return Array.isArray(f) ? f[0] : f;
    };
    (cfg.css || []).forEach((f) => {
      const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = fileAttrs(l, f);
      if (early) l.setAttribute('blocking', 'render');        // no flash of the classic styles
      doc.head.appendChild(l);
    });
    ready(() => {                                          // scripts run in the listed order, once the page is parsed
      (inline.js || []).forEach((text) => { const s = doc.createElement('script'); s.textContent = text; doc.body.appendChild(s); });
      (cfg.js || []).forEach((f) => { const s = doc.createElement('script'); s.src = fileAttrs(s, f); s.async = false; doc.body.appendChild(s); });
    });
  }

  /* 3. The Display control. Its styles are self-contained, so it looks right
     in both looks and in both themes. */
  const css = doc.createElement('style');
  css.id = 'nu-switch-css';
  css.textContent = `
    .nu-slot, .nu-panel, .nu-scrim { --nu-fg: #072435; --nu-mut: #4a5a62; --nu-bg: #fff; --nu-field: #f1f4f5; --nu-line: #d0dee4; --nu-hov: #eef3f5;
      --nu-acc: #007bba; --nu-on: #007bba; --nu-knob: #fff; --nu-seg: #eef2f4; --nu-segon: #fff; --nu-shadow: 0 18px 44px -12px rgb(7 36 48 / .35);
      font-family: "Inter", "Open Sans", Arial, sans-serif; color: var(--nu-fg); }
    .nu-panel *, .nu-slot * { font-family: inherit; }
    html[data-theme="dark"] :is(.nu-slot, .nu-panel) { --nu-fg: #eaf2f4; --nu-mut: #a9bac1; --nu-bg: #0c2631; --nu-field: #0a2029; --nu-line: #2a4855; --nu-hov: #143644;
      --nu-acc: #5cb8ec; --nu-on: #5cb8ec; --nu-knob: #072435; --nu-seg: #081d26; --nu-segon: #1a3d4b; --nu-shadow: 0 18px 44px -12px rgb(0 0 0 / .7); }
    .nu-slot, .nu-slot * { box-sizing: border-box; }
    .nu-slot--header { position: relative; display: flex; align-items: center; margin: 0 8px; align-self: center; }
    .nu-slot--strip { position: relative; display: flex; justify-content: flex-end; align-items: center; gap: 10px; min-height: 48px;
      padding: 4px 16px; background: var(--nu-bg); border-bottom: 1px solid var(--nu-line); }
    .nu-note { font-weight: 500; font-size: 12.5px; line-height: 1.3; color: var(--nu-mut); }
    .nu-slot--header .nu-note { display: none; }
    @media (max-width: 400px) { .nu-note { display: none; } }

    /* the button: a 40px rounded square */
    .nu-display { position: relative; display: inline-grid; place-items: center; width: 40px; height: 40px; padding: 0; margin: 0;
      color: var(--nu-fg); background: var(--nu-field); border: 1px solid var(--nu-line); border-radius: 8px; cursor: pointer; }
    .nu-display:hover { border-color: var(--nu-acc); }
    .nu-display[aria-expanded="true"] { outline: 2px solid var(--nu-acc); outline-offset: 2px; }
    .nu-display svg { width: 20px; height: 20px; display: block; }
    .nu-display__dot { position: absolute; top: -3px; right: -3px; width: 11px; height: 11px; border-radius: 50%; background: #ffc340; border: 2px solid var(--nu-bg); }
    .nu-display__dot[hidden] { display: none; }
    :is(.nu-display, .nu-switch, .nu-seg__opt, .nu-hint__x):focus-visible { outline: 2px solid var(--nu-acc); outline-offset: 2px; }

    /* the panel */
    .nu-panel { position: absolute; top: calc(100% + 10px); right: 0; z-index: 1001; width: 304px; padding: 14px; margin: 0;
      color: var(--nu-fg); background: var(--nu-bg); border: 1px solid var(--nu-line); border-radius: 16px; box-shadow: var(--nu-shadow); text-align: left; }
    .nu-panel[hidden], .nu-scrim[hidden] { display: none; }
    .nu-panel__h { margin: 0 0 6px; font-weight: 700; font-size: 12px; line-height: 1; letter-spacing: .06em; text-transform: uppercase; color: var(--nu-mut); }
    .nu-row { display: flex; align-items: center; gap: 12px; padding: 8px 0 12px; }
    .nu-row + .nu-panel__h { padding-top: 12px; border-top: 1px solid var(--nu-line); }
    .nu-row__t { font-weight: 650; font-size: 15px; line-height: 1.2; }
    .nu-row__s { display: block; margin-top: 3px; font-weight: 400; font-size: 12.5px; line-height: 1.35; color: var(--nu-mut); }
    .nu-badge { display: inline-block; margin-left: 6px; padding: 3px 5px; border-radius: 4px; vertical-align: 2px;
      font-weight: 700; font-size: 10px; line-height: 1; letter-spacing: .06em; text-transform: uppercase; color: #072435; background: #ffc340; }
    .nu-switch { flex: none; margin: 0 0 0 auto; padding: 0; width: 44px; height: 26px; border: 0; border-radius: 999px; background: #8a979e; position: relative; cursor: pointer; transition: background-color .2s; }
    .nu-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 2px rgb(0 0 0 / .3); transition: translate .2s; }
    .nu-switch[aria-checked="true"] { background: var(--nu-on); }
    .nu-switch[aria-checked="true"]::after { translate: 18px 0; background: var(--nu-knob); }
    .nu-seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; margin-top: 8px; border-radius: 12px; background: var(--nu-seg); }
    .nu-seg__opt { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 9px 4px 8px; margin: 0; border: 0; border-radius: 9px;
      font-weight: 600; font-size: 12.5px; line-height: 1; color: var(--nu-mut); background: none; cursor: pointer; }
    .nu-seg__opt:hover { color: var(--nu-fg); }
    .nu-seg__opt[aria-checked="true"] { background: var(--nu-segon); color: var(--nu-fg); box-shadow: 0 1px 3px rgb(7 36 48 / .14); }
    .nu-seg__opt svg { width: 19px; height: 19px; }
    .nu-panel__note { margin: 10px 0 0; font-weight: 400; font-size: 12px; line-height: 1.4; color: var(--nu-mut); }

    /* first-visit hint */
    .nu-hint { position: absolute; top: calc(100% + 12px); right: -6px; z-index: 1000; display: flex; align-items: flex-start; gap: 8px; width: 236px;
      padding: 10px 10px 10px 12px; border-radius: 12px; background: #072435; color: #fff; font-weight: 500; font-size: 13px; line-height: 1.35;
      box-shadow: 0 10px 26px -8px rgb(7 36 48 / .5); }
    .nu-hint::before { content: ""; position: absolute; top: -6px; right: 20px; width: 12px; height: 12px; background: inherit; rotate: 45deg; border-radius: 2px; }
    html[data-theme="dark"] .nu-hint { background: #eaf2f4; color: #072435; }
    .nu-hint[hidden] { display: none; }
    .nu-hint__x { flex: none; margin: -2px -2px 0 auto; padding: 2px; border: 0; background: none; color: inherit; opacity: .8; cursor: pointer; font-weight: 600; font-size: 16px; line-height: 1; }

    /* phones: the panel is a bottom sheet */
    @media (max-width: 767.9px) {
      .nu-slot--header { margin: 0 4px; }
      .nu-display { width: 38px; height: 38px; }
      .nu-panel { position: fixed; top: auto; left: 0; right: 0; bottom: 0; width: auto; padding: 10px 18px calc(22px + env(safe-area-inset-bottom));
        border-radius: 22px 22px 0 0; border-width: 1px 0 0; z-index: 2147483001; }
      .nu-panel::before { content: ""; display: block; width: 40px; height: 4px; margin: 0 auto 14px; border-radius: 4px; background: var(--nu-line); }
      .nu-scrim { position: fixed; inset: 0; z-index: 2147483000; background: rgb(4 22 30 / .45); }
      .nu-hint { right: -44px; }
      .nu-hint::before { right: 58px; }
    }
    html.nu-switching body { opacity: .35; transition: opacity .18s ease; }
    @media (prefers-reduced-motion: reduce) { .nu-switch, .nu-switch::after, html.nu-switching body { transition: none; } }
    @media (forced-colors: active) { .nu-display, .nu-panel, .nu-seg__opt[aria-checked="true"] { border: 1px solid CanvasText; } .nu-switch { border: 1px solid CanvasText; } }
    @media print { .nu-slot, .nu-scrim { display: none !important; } }`;
  doc.head.appendChild(css);

  ready(() => {
    const ICON = {
      system: '<circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" stroke-width="1.8"/>'
        + '<path d="M12 7.6a4.4 4.4 0 0 1 0 8.8z" fill="currentColor"/>'
        + '<path d="M12 2.6v2.1M12 19.3v2.1M5.4 5.4l1.5 1.5M2.6 12h2.1M5.4 18.6l1.5-1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      light: '<circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/>'
        + '<path d="M12 2.6v2.1M12 19.3v2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M2.6 12h2.1M19.3 12h2.1M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      dark: '<path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.2 8.2 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="15" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="9" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.9"/>',
    };
    const svg = (name) => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON[name] + '</svg>';
    const LABEL = { system: 'System', light: 'Light', dark: 'Dark' };
    const el = (tag, cls, html) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

    /* --- build --- */
    const slotEl = el('div');
    const note = el('span', 'nu-note'); note.textContent = isNew ? 'You’re viewing the new design.' : 'You’re viewing the classic design.';
    const btn = el('button', 'nu-display');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'nu-panel');
    btn.setAttribute('data-cname', 'display_menu');
    const dot = el('span', 'nu-display__dot'); dot.hidden = true;

    const panel = el('div', 'nu-panel'); panel.id = 'nu-panel'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Display settings');
    panel.appendChild(el('p', 'nu-panel__h', 'Display'));
    const row = el('div', 'nu-row');
    row.innerHTML = '<div><span class="nu-row__t" id="nu-newlook-t">New look<span class="nu-badge" aria-hidden="true">Beta</span></span>'
      + '<span class="nu-row__s">' + (isNew ? 'Turn off for the classic page' : 'Turn on for the new design and dark mode') + '</span></div>';
    const sw = el('button', 'nu-switch');                    // keeps the class name the tests and analytics use
    sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(isNew));
    sw.setAttribute('aria-labelledby', 'nu-newlook-t');
    sw.setAttribute('data-cname', isNew ? 'new_ui_turn_off' : 'new_ui_turn_on');
    row.appendChild(sw); panel.appendChild(row);

    let seg = null, panelNote = null;
    if (isNew) {
      panel.appendChild(el('p', 'nu-panel__h', 'Theme'));
      seg = el('div', 'nu-seg'); seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', 'Color theme');
      THEMES.forEach((t) => {
        const o = el('button', 'nu-seg__opt', svg(t) + '<span>' + LABEL[t] + '</span>');
        o.type = 'button'; o.dataset.theme = t; o.setAttribute('role', 'radio'); o.setAttribute('data-cname', 'theme_' + t);
        seg.appendChild(o);
      });
      panel.appendChild(seg);
      panelNote = el('p', 'nu-panel__note'); panel.appendChild(panelNote);
    } else {
      panel.appendChild(el('p', 'nu-panel__note', 'Dark mode comes with the new look.'));
    }
    const scrim = el('div', 'nu-scrim'); scrim.hidden = true;
    const wrap = el('div', 'nu-wrap'); wrap.style.position = 'relative'; wrap.style.display = 'flex';
    wrap.append(btn, panel);
    slotEl.append(note, wrap);

    const update = () => {
      btn.innerHTML = svg(isNew ? pref : 'sliders'); btn.appendChild(dot);
      const now = effective();
      const label = isNew ? 'Display settings: new look, ' + LABEL[pref] + ' theme' + (pref === 'system' ? ' (now ' + now + ')' : '') : 'Display settings: classic look';
      btn.setAttribute('aria-label', label); btn.title = label;
      if (seg) {
        seg.querySelectorAll('.nu-seg__opt').forEach((o) => {
          const on = o.dataset.theme === pref; o.setAttribute('aria-checked', String(on)); o.tabIndex = on ? 0 : -1;
        });
        panelNote.textContent = pref === 'system' ? 'System follows your device. It’s ' + now + ' right now.' : pref === 'dark' ? 'Dark mode is in beta.' : 'Always light, whatever the device.';
      }
    };
    update();

    /* --- placement: beside the search box, measured so the header never wraps --- */
    /* where the button goes: settings for the site header, overridable per page (STUDY_PAGE.newLook) */
    /* Defaults cover the older study-nav and the Eureka 2 nav (.cx-navigation, shown to signed-in
       readers, drawn by script after load); a page can override them. */
    const NL = Object.assign({
      header: '.cx-navigation, nav.study-nav',    // the site header (the first one found)
      group: '.cx-navigation__right, .study-nav__main-actions',   // the header's right-hand group (a list: the first one on screen)
      before: ':scope > .cx-navigation__study-ai, :scope > #searchBarDesktop, :scope > .search-form, :scope > .searchTrigger',   // the button goes just before this
      sections: '#hub-content > h2[id], #hub-content > h3[id]',   // headings used to return to the same place after switching
    }, (window.STUDY_PAGE && window.STUDY_PAGE.newLook) || {});
    let nav = doc.querySelector(NL.header);
    const place = () => {
      slotEl.remove();
      nav = doc.querySelector(NL.header);
      if (!nav) { slotEl.className = 'nu-slot nu-slot--strip'; doc.body.prepend(slotEl); return; }
      /* group may name several (a desktop and a phone row): the one on screen at this width */
      const actions = Array.from(nav.querySelectorAll(NL.group)).find((g) => g.getClientRects().length) || null;
      const h0 = nav.offsetHeight;
      if (actions) {
        slotEl.className = 'nu-slot nu-slot--header';
        const search = NL.before ? actions.querySelector(NL.before) : null;
        actions.insertBefore(slotEl, search || null);
        if (nav.offsetHeight <= h0 + 1) return;
        slotEl.remove();
      }
      slotEl.className = 'nu-slot nu-slot--strip';
      nav.after(slotEl);
      /* a header drawn by script may not be styled yet (it looks taller than it will be): try again shortly */
      if (actions && tries < 6) { tries++; setTimeout(() => { if (panel.hidden && slotEl.classList.contains('nu-slot--strip')) place(); }, 400); }
    };
    let tries = 0;
    place();
    let rz;
    addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (panel.hidden) place(); }, 150); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { if (panel.hidden) place(); });
    /* A header drawn by script (the Eureka 2 nav) can arrive after us, or redraw and drop the
       button: watch for that for a while and put the button back. */
    if ('MutationObserver' in window) {
      let queued = false;
      const mo = new MutationObserver(() => {
        if (queued || !panel.hidden) return;
        /* fine if it's on the page and inside the current header, or in the strip right after it */
        const want = doc.querySelector(NL.header);
        const ok = slotEl.isConnected && (!want || want.contains(slotEl) || (want === nav && slotEl.previousElementSibling === nav));
        if (ok) return;
        queued = true; requestAnimationFrame(() => { queued = false; place(); });
      });
      mo.observe(doc.body, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 20000);
    }

    /* --- open and close --- */
    const sheet = () => matchMedia('(max-width: 767.9px)').matches;
    let lastFocus = null;
    const focusables = () => Array.from(panel.querySelectorAll('button')).filter((b) => b.tabIndex !== -1);
    const open = () => {
      hideHint(true);
      lastFocus = doc.activeElement;
      panel.hidden = false; btn.setAttribute('aria-expanded', 'true');
      if (sheet()) { panel.setAttribute('aria-modal', 'true'); doc.body.appendChild(scrim); doc.body.appendChild(panel); scrim.hidden = false; }
      else panel.removeAttribute('aria-modal');
      sw.focus();
    };
    const close = (refocus) => {
      if (panel.hidden) return;
      panel.hidden = true; scrim.hidden = true; btn.setAttribute('aria-expanded', 'false');
      if (panel.parentNode !== wrap) wrap.appendChild(panel);
      if (refocus) btn.focus();
    };
    btn.addEventListener('click', () => (panel.hidden ? open() : close(false)));
    scrim.addEventListener('click', () => close(true));
    doc.addEventListener('pointerdown', (e) => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target) && e.target !== scrim) close(false); });
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (sheet()) {                                        // the sheet is modal: keep focus inside
          if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
        } else if (!e.shiftKey && doc.activeElement === last) close(false);
      }
    });

    /* --- theme: a radio group, arrow keys move and choose --- */
    const choose = (t, focus) => {
      pref = t; store.set(TKEY, t); applyTheme(); update();
      if (focus) seg.querySelector('[data-theme="' + t + '"]').focus();
      try { window.dispatchEvent(new CustomEvent('study-theme-change', { detail: { pref, theme: effective() } })); } catch (e) { /* old browser */ }
    };
    if (seg) {
      seg.addEventListener('click', (e) => { const o = e.target.closest('.nu-seg__opt'); if (o) choose(o.dataset.theme, true); });
      seg.addEventListener('keydown', (e) => {
        const i = THEMES.indexOf(pref);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); choose(THEMES[(i + 1) % 3], true); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); choose(THEMES[(i + 2) % 3], true); }
      });
      const onSys = () => { if (pref === 'system') applyTheme(); update(); };
      if (sysDark.addEventListener) sysDark.addEventListener('change', onSys); else if (sysDark.addListener) sysDark.addListener(onSys);
    }

    /* --- first-visit hint: shown on the first two new-look visits, until the panel is opened --- */
    let hint = null;
    function hideHint(forever) { if (hint) { hint.hidden = true; } dot.hidden = true; if (forever) store.set(HINT, 'done'); }
    const seen = store.get(HINT);
    if (isNew && seen !== 'done' && slotEl.classList.contains('nu-slot--header')) {
      const n = Number(seen) || 0;
      if (n < 2) {
        store.set(HINT, String(n + 1));
        hint = el('div', 'nu-hint'); hint.setAttribute('role', 'status');
        hint.innerHTML = '<span>New design. Switch back or try dark mode here.</span>';
        const x = el('button', 'nu-hint__x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.setAttribute('data-cname', 'display_hint_dismiss');
        x.addEventListener('click', () => hideHint(true));
        hint.appendChild(x); wrap.appendChild(hint); dot.hidden = false;
        setTimeout(() => { if (hint) hint.hidden = true; }, 12000);
      }
    }

    /* --- switching the look: remember the section being read --- */
    const currentSection = () => {
      const heads = Array.from(doc.querySelectorAll(NL.sections));
      let best = null;
      for (const h of heads) { const r = h.getBoundingClientRect(); if (r.height && r.top <= 140) best = h; }
      return best ? best.id : '';
    };
    sw.addEventListener('click', () => {
      const next = !isNew;
      sw.setAttribute('aria-checked', String(next));         // move the knob before the reload
      store.set(KEY, next ? 'on' : 'off');
      leaveAnchor(currentSection());
      root.classList.add('nu-switching');
      const go = () => {
        const url = new URL(location.href);
        url.searchParams.delete('ui');                        // a stale ?ui= would override the new choice
        if (url.href !== location.href) location.replace(url.href); else location.reload();
      };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) go(); else setTimeout(go, 200);
    });

    /* After a switch, return to the section the reader was on. Images above it
       may still be loading and pushing it down, so keep it pinned until the page
       settles, and stop the moment the reader scrolls themselves. */
    const anchor = takeAnchor();
    if (anchor) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      let pinned = true;
      const stop = () => { pinned = false; };
      ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((ev) => addEventListener(ev, stop, { once: true, passive: true }));
      const pin = () => { if (!pinned) return; const t = doc.getElementById(anchor); if (t) t.scrollIntoView({ block: 'start', behavior: 'instant' }); };
      pin();
      if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(() => requestAnimationFrame(pin));
        ro.observe(doc.body);
        setTimeout(() => { ro.disconnect(); pinned = false; }, 6000);
      }
      addEventListener('load', () => { pin(); setTimeout(pin, 300); });
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => requestAnimationFrame(pin));
    }
  });
})();
