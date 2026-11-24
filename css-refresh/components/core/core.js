/* =========================================================================
   Study enhancements: core (shared by every enhancement component)

   Components are small files that each add one feature, and register with
   StudyEnh.define(name, defaults, fn). The core gives them:
   - the page model: the article element, its blocks, the summary section,
     the back matter, the first chapter, and the figures
   - helpers: element builder, icons, toast, copy to clipboard, citations,
     smooth scrolling, deep links, analytics tags
   - per-page settings: window.STUDY_PAGE.enhance, merged over the defaults
   - slots, so one component can offer a place for another to add to

   Rules every component follows
   1. The page HTML is the source of truth. Facts are read from the page;
      settings only say where to look and what to call things.
   2. Components add, never remove. Hidden content stays in the page.
   3. Each component fails on its own; the rest still run.
   4. Nothing here knows about one particular page. The defaults describe
      Study.com's research-hub template; any other template sets its own.
   ========================================================================= */
(() => {
  'use strict';
  if (window.StudyEnh) return;
  const doc = document, root = doc.documentElement;

  /* Settings for the research-hub template. A page overrides any of them in
     window.STUDY_PAGE.enhance (from page.json, through the page-layers manifest). */
  const DEFAULTS = {
    when: 'body#promoArticleMain',              // run only on pages that match
    article: '#hub-content',                     // the element whose children are the article's blocks
    landmarkFor: '#hub',                         // gets role="main" if the template has no main landmark
    title: '.hub-content-container > h1, h1',
    summary: { selector: '#section---KeyFindings', text: '^(key findings|summary|at a glance)\\b' },
    backMatter: { selector: '#section---Methodology', text: '^(methodology|about (the|this) (data|research|survey))\\b' },
    figures: {
      block: 'table.imageplugin--align',         // the element that holds one image
      image: 'img',
      number: 'fig(\\d{1,3})-',                  // how to read a figure number from the image file name ('' = number in page order)
      caption: 'caption, figcaption',            // the page's own caption, used instead of the alt text when present
      exclude: '_quote',                         // images that are not figures (quote cards)
      altPrefix: '^Study\\.com\\s+[^:]{0,40}:\\s*', // removed from alt text before it is shown as a caption
      label: 'Fig.',
      idPrefix: 'fig-',
    },
    source: 'Study.com',                         // used in citations
  };

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const merge = (a, b) => { const o = { ...a }; if (isObj(b)) for (const k of Object.keys(b)) o[k] = isObj(a[k]) && isObj(b[k]) ? merge(a[k], b[k]) : b[k]; return o; };
  const page = () => (window.STUDY_PAGE && window.STUDY_PAGE.enhance) || {};
  const cfg = () => merge(DEFAULTS, page());
  const rx = (s, flags = 'i') => (s ? new RegExp(s, flags) : null);

  const $ = (s, r = doc) => r.querySelector(s);
  const $$ = (s, r = doc) => Array.from(r.querySelectorAll(s));
  const el = (tag, attrs = {}, ...kids) => {
    const n = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : doc.createTextNode(k));
    return n;
  };
  /* analytics: the site's own data-cname convention */
  const tag = (node, name, visible) => { node.setAttribute('data-cname', 'enh_' + name); if (visible) node.setAttribute('data-track-visible', 'true'); return node; };
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  /* an element's own text, without what the components added for decoration or controls */
  const text = (node) => {
    if (!node) return '';
    const c = node.cloneNode(true);
    c.querySelectorAll('[aria-hidden="true"], button, .enh-anchor, .enh-copy, .enh-l, .enh-figure').forEach((x) => x.remove());
    return clean(c.textContent);
  };
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* a number from a CSS custom property on <html>, so layout numbers live in CSS */
  const cssNum = (name, fallback) => { const v = parseFloat(getComputedStyle(root).getPropertyValue(name)); return Number.isFinite(v) ? v : fallback; };

  const ICONS = {
    play: '<path d="M8 5v14l11-7z"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" fill="none" stroke="currentColor" stroke-width="2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    prev: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    next: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    zoom: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    palette: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.5"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="4.5" cy="18" r="1.5"/>',
  };
  const icon = (name) => {
    const s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    s.setAttribute('class', 'enh-ico'); s.innerHTML = ICONS[name] || ''; return s;
  };

  let toastEl, toastTimer;
  const toast = (msg) => {
    if (!toastEl) { toastEl = el('div', { class: 'enh-toast', role: 'status', 'aria-live': 'polite' }); doc.body.append(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  };
  const copyText = async (text, okMsg) => {
    try { await navigator.clipboard.writeText(text); toast(okMsg); return; } catch (e) { /* fall through */ }
    const ta = el('textarea', { readonly: true, class: 'enh-sr' }); ta.value = text; doc.body.append(ta); ta.select();
    let ok = false; try { ok = doc.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove(); toast(ok ? okMsg : 'Copy was blocked. Select the text to copy it.');
  };
  const pageUrl = () => location.href.split('#')[0];
  /* links are built from the page's own address, never a bare "#id", so a <base> tag can't redirect them */
  const hashUrl = (id) => pageUrl() + '#' + id;
  const setHash = (id) => { try { history.replaceState(history.state, '', hashUrl(id)); } catch (e) { /* some contexts refuse */ } };
  const smoothTo = (node) => {
    node.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
    node.focus({ preventScroll: true });
  };
  const flash = (node) => { node.classList.remove('enh-flash'); void node.offsetWidth; node.classList.add('enh-flash'); };

  /* ---------- the page model ---------- */
  let article = null;
  const blocks = () => (article ? Array.from(article.children) : []);
  const findHeading = (spec) => {
    if (!spec) return null;
    const bySel = spec.selector && $(spec.selector, article);
    if (bySel) return bySel;
    const re = rx(spec.text);
    return re ? blocks().find((n) => n.tagName === 'H2' && re.test(clean(n.textContent))) || null : null;
  };
  let model = null;
  const pageModel = () => {
    if (model) return model;
    const c = cfg(), kids = blocks();
    const summary = findHeading(c.summary), back = findHeading(c.backMatter);
    const firstChapter = kids.find((n) => n.tagName === 'H2' && n !== summary) || null;
    const titleEl = $(c.title);
    model = { summary, backMatter: back, firstChapter, title: clean(titleEl ? titleEl.textContent : doc.title) };
    return model;
  };
  const indexOf = (n) => blocks().indexOf(n);
  const inSummary = (n) => { const m = pageModel(); return !!(m.summary && m.firstChapter && indexOf(n) > indexOf(m.summary) && indexOf(n) < indexOf(m.firstChapter)); };
  const inBackMatter = (n) => { const m = pageModel(); return !!(m.backMatter && indexOf(n) >= indexOf(m.backMatter)); };
  /* the summary's findings: its subheadings (each with the list after it), or, when the
     summary is a bulleted list instead, its list items. Each gets an id to link to. */
  const findings = () => {
    const inS = blocks().filter(inSummary), heads = inS.filter((n) => n.tagName === 'H3');
    if (heads.length) return heads.map((h) => ({ node: h, list: h.nextElementSibling && h.nextElementSibling.tagName === 'UL' ? h.nextElementSibling : null, id: h.id }));
    const items = inS.filter((n) => n.tagName === 'UL').flatMap((ul) => Array.from(ul.children).filter((li) => li.tagName === 'LI'));
    return items.map((li, i) => { if (!li.id) li.id = 'finding-' + (i + 1); return { node: li, list: null, id: li.id }; });
  };
  const cite = (sentence, id) => `${clean(sentence)} Source: ${cfg().source}, ${pageModel().title}. ${pageUrl()}${id ? '#' + id : ''}`;
  /* the heading nearest the top of the screen (offset from CSS: --enh-scroll-offset) */
  const currentHeading = (list) => {
    const off = cssNum('--enh-scroll-offset', 140); let a = null;
    for (const h of list || blocks().filter((n) => /^H[23]$/.test(n.tagName))) if (h.getBoundingClientRect().top <= off) a = h;
    return a;
  };

  /* figures: found once, given ids and classes, shared by every component */
  let figs = null;
  const figures = () => {
    if (figs) return figs;
    const f = cfg().figures, num = rx(f.number), skip = rx(f.exclude), pre = rx(f.altPrefix);
    figs = []; let order = 0;
    blocks().filter((n) => n.matches(f.block)).forEach((b) => {
      const img = $(f.image, b); if (!img) return;
      const src = img.getAttribute('src') || '';
      if (skip && skip.test(src)) { b.classList.add('enh-quote'); return; }
      /* the number comes from the file name; with no number pattern set, figures are numbered in page order */
      const m = num ? src.match(num) : [null, String(++order)];
      if (!m) { b.classList.add('enh-quote'); return; }
      const n = Number(m[1]);
      if (!b.id) b.id = f.idPrefix + n;
      b.classList.add('enh-chart');
      /* a caption the page already has wins over the alt text */
      const caption = f.caption ? $(f.caption, b) : null;
      const text = caption ? clean(caption.textContent) : clean(img.getAttribute('alt') || '').replace(pre || /$^/, '');
      figs.push({ n, img, text, caption, block: b, table: b, id: b.id });
    });
    figs.sort((a, b) => a.n - b.n);
    return figs;
  };

  /* slots: one component offers a place (e.g. the contents rail), another fills it */
  const slots = {}, slotFns = {};
  const offerSlot = (name, node, where) => { (slots[name] = slots[name] || []).push([node, where]); (slotFns[name] || []).forEach((fn) => fn(node, where)); };
  const useSlot = (name, fn) => { (slotFns[name] = slotFns[name] || []).push(fn); (slots[name] || []).forEach(([n, w]) => fn(n, w)); };
  const hasSlot = (name) => !!(slots[name] && slots[name].length);

  /* ---------- running components ---------- */
  const ran = new Set();
  let ready = false; const queue = [];
  const start = () => {
    const c = cfg();
    if (c.when && !doc.body.matches(c.when)) return false;
    article = $(c.article); if (!article) return false;
    root.classList.add('enh');
    try { if (!doc.querySelector('main, [role="main"]')) { const m = $(c.landmarkFor) || article; m.setAttribute('role', 'main'); } } catch (e) { /* ignore */ }
    return true;
  };
  const exec = ([name, defaults, fn]) => {
    if (ran.has(name)) return; ran.add(name);
    const own = merge(defaults || {}, (page().components || {})[name] || {});
    if (own.enabled === false) return;
    try { fn(api, own); } catch (e) { console.warn('[enhance] ' + name + ' skipped:', e); }
  };
  const boot = () => { ready = start(); if (ready) queue.splice(0).forEach(exec); };

  const api = {
    version: 2,
    doc, root, $, $$, el, tag, clean, text, icon, toast, copyText, cite, pageUrl, hashUrl, setHash, smoothTo, flash, reduceMotion, cssNum, rx,
    get article() { return article; }, blocks, config: cfg, model: pageModel, inSummary, inBackMatter, findings, figures, currentHeading,
    offerSlot, useSlot, hasSlot,
    define(name, defaults, fn) { const job = [name, defaults, fn]; if (ready) exec(job); else queue.push(job); },
  };
  window.StudyEnh = api;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
