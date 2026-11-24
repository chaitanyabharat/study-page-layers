/* =========================================================================
   Dark mode for images (prototype)

   Runs only while the page is dark (html[data-theme="dark"]). In light mode
   it does nothing beyond one attribute check, so light readers pay nothing.

   For each image, in this order, the first rule that applies wins:
   1. The page says what to use: a data-dark-src attribute on the image, or a
      --dark-src custom property set on it in CSS.
   2. The dark-image manifest (prepared at build time) lists the file: use its
      dark version, or put it on a light mat if the manifest says so.
   3. The file name follows the light/dark naming convention (logos):
      "...text-dark.svg" has a "...text-light.svg" twin.
   4. A chart with no prepared version: recolor it in a background worker,
      once, and cache the result. Skipped on low-memory devices and when the
      reader has data saver on; those charts get the light mat.
   5. Anything else (quote cards, unrecognised images): the light mat, which
      is always safe.

   Readers can turn recoloring off per chart ("Original colors"). Print and
   Windows high-contrast mode always use the original files.

   Work is lazy: an image is only looked at when it comes within ~800px of
   the screen, and the dark file is only swapped in once it has loaded.
   ========================================================================= */
(() => {
  'use strict';
  const doc = document, root = doc.documentElement;
  if (window.StudyDark) return;
  const cfg = window.STUDY_NEW_UI || {};
  const manifest = cfg.darkManifest || { version: '', images: {} };
  const base = (() => { try { return new URL(cfg.darkBase || '', location.href).href; } catch (e) { return location.href; } })();
  const R = window.StudyRecolor;                      // optional: needed for the fallback only
  const forced = matchMedia('(forced-colors: active)');
  const isDark = () => root.getAttribute('data-theme') === 'dark' && !forced.matches && !printing;
  let printing = false;

  /* ---------- settings: which images, and what kind ----------
     Defaults describe the research-hub template; a page overrides any of them
     in window.STUDY_PAGE.darkImages (page.json). */
  const S = Object.assign({
    scope: '#hub-content img, nav.study-nav img.breakthrough-logo, .cx-navigation__logo img',   // images to look at
    block: 'table.imageplugin--align',          // the element that holds one image (gets the mat)
    logo: 'nav img, .cx-navigation__logo',      // images inside this are logos
    photo: '.enh-video, .enh-video__poster',    // images inside this are photos: left alone
    chart: 'fig\\d{1,3}-',                     // file-name pattern for charts
    quote: '_quote',                            // file-name pattern for quote cards
    caption: '.enh-cap',                        // where the "colors adjusted" note goes
    fileKeyStrip: '^[0-9a-f]{8}-',              // removed from file names before the manifest lookup (local copies)
    textBoundary: 'H2,H3',                      // nearby text for the color check runs between these headings
    surface: '', ink: '',                       // dark-theme colors for in-browser recolor (default: Study.com's)
  }, (window.STUDY_PAGE && window.STUDY_PAGE.darkImages) || {});
  const rx = (v) => (v ? new RegExp(v, 'i') : null);
  const CHART = rx(S.chart), QUOTE = rx(S.quote), STRIP = rx(S.fileKeyStrip);
  const BOUND = S.textBoundary.split(',').map((t) => t.trim().toUpperCase());
  const SCOPE = S.scope;
  const fileName = (src) => { try { const f = decodeURIComponent(new URL(src, location.href).pathname.split('/').pop()); return STRIP ? f.replace(STRIP, '') : f; } catch (e) { return ''; } };
  const kind = (img) => {
    const src = img.getAttribute('src') || '';
    if (S.logo && img.closest(S.logo)) return 'logo';
    if (S.photo && img.closest(S.photo)) return 'photo';
    if (QUOTE && QUOTE.test(src)) return 'quote';
    if (CHART && CHART.test(src)) return 'chart';
    return 'unknown';
  };

  /* Article text around a chart: from the heading before it to the heading after it */
  const nearbyText = (img) => {
    const t = (S.block && img.closest(S.block)) || img; const parts = [];
    let a = t; while ((a = a.previousElementSibling) && !BOUND.includes(a.tagName)) parts.unshift(a.textContent);
    let z = t; while ((z = z.nextElementSibling) && !BOUND.includes(z.tagName)) parts.push(z.textContent);
    return parts.join(' ');
  };

  /* ---------- decide, per image ---------- */
  /* returns { mode: 'swap', url, recolored } | { mode: 'mat' } | { mode: 'recolor' } | { mode: 'none' } */
  function decide(img) {
    const k = kind(img);
    if (k === 'photo') return { mode: 'none' };
    const attr = img.getAttribute('data-dark-src');
    if (attr) return { mode: 'swap', url: new URL(attr, location.href).href, recolored: false };
    const prop = getComputedStyle(img).getPropertyValue('--dark-src').trim();
    if (prop && prop !== 'none') {
      const m = prop.match(/^url\((['"]?)(.*)\1\)$/) || prop.match(/^(['"])(.*)\1$/);
      return { mode: 'swap', url: new URL(m ? m[2] : prop, location.href).href, recolored: false };
    }
    const entry = manifest.images[fileName(img.getAttribute('src'))];
    if (entry) {
      if (entry.dark) return { mode: 'swap', url: new URL(entry.dark, base).href, recolored: entry.policy === 'recolor' };
      if (entry.policy === 'mat') return { mode: 'mat' };
    }
    const src = img.getAttribute('src') || '';
    if (k === 'logo') return /text-dark/.test(src) ? { mode: 'swap', url: new URL(src.replace('text-dark', 'text-light'), location.href).href, recolored: false } : { mode: 'none' };
    if (k === 'chart') return canRecolor() && !(R && R.textRefersToColor(nearbyText(img))) ? { mode: 'recolor' } : { mode: 'mat' };
    return { mode: 'mat' };
  }

  /* ---------- the background worker (fallback only) ---------- */
  const canRecolor = () => {
    if (!R || !cfg.recolorSrc && !cfg.recolorUrl) return false;
    if (!('OffscreenCanvas' in window) || !('createImageBitmap' in window) || !('Worker' in window)) return false;
    const c = navigator.connection; if (c && c.saveData) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
    return true;
  };
  const WORKER = `
    self.onmessage = async (e) => {
      const { id, url, colors } = e.data;
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('http ' + res.status);
        const bmp = await createImageBitmap(await res.blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(bmp, 0, 0);
        const data = g.getImageData(0, 0, c.width, c.height);
        const check = StudyRecolor.recolor(data, colors);
        if (!check.ok) { self.postMessage({ id, ok: false, check }); return; }
        g.putImageData(data, 0, 0);
        const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.9 });
        self.postMessage({ id, ok: true, blob, check });
      } catch (err) { self.postMessage({ id, ok: false, error: String(err) }); }
    };`;
  let worker, seq = 0; const waiting = new Map();
  async function getWorker() {
    if (worker) return worker;
    const src = cfg.recolorSrc || await (await fetch(cfg.recolorUrl)).text();
    worker = new Worker(URL.createObjectURL(new Blob([src, WORKER], { type: 'text/javascript' })));
    worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (w) { waiting.delete(e.data.id); w(e.data); } };
    return worker;
  }
  const CACHE = 'study-dark-' + (R ? R.VERSION : 'x');
  const memo = new Map();                                // src -> Promise<objectURL | null>
  function recolorUrl(src) {
    if (memo.has(src)) return memo.get(src);
    const key = new URL('/__study-dark__/' + encodeURIComponent(src), location.origin).href;
    const p = (async () => {
      try {                                              // a result from an earlier visit
        if ('caches' in window) { const hit = await (await caches.open(CACHE)).match(key); if (hit) return URL.createObjectURL(await hit.blob()); }
      } catch (e) { /* cache unavailable (file://, private mode) */ }
      const w = await getWorker(); const id = ++seq;
      const out = await new Promise((resolve) => { waiting.set(id, resolve); w.postMessage({ id, url: src, colors: { surface: S.surface, ink: S.ink } }); });
      if (!out.ok) return null;
      try { if ('caches' in window) await (await caches.open(CACHE)).put(key, new Response(out.blob, { headers: { 'content-type': 'image/webp' } })); } catch (e) { /* ignore */ }
      return URL.createObjectURL(out.blob);
    })().catch(() => null);
    memo.set(src, p); return p;
  }

  /* ---------- applying and undoing ---------- */
  const state = new WeakMap();                           // img -> { light, dark, recolored, mat, original }
  const listeners = new Set();
  const notify = (img) => listeners.forEach((f) => { try { f(img); } catch (e) { /* ignore */ } });
  const holder = (img) => (S.block && img.closest(S.block)) || img.parentElement;

  function setMat(img, on) { holder(img).classList.toggle('dk-mat', on); }
  function show(img) {                                   // put the right file in, for the current theme and choice
    const s = state.get(img); if (!s) return;
    const want = isDark() && s.dark && !s.original ? s.dark : s.light;
    if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    if (img.srcset && s.srcset !== undefined) img.srcset = want === s.light ? s.srcset : '';
    const darkShown = want !== s.light;
    holder(img).classList.toggle('dk-recolored', darkShown && s.recolored);
    setMat(img, isDark() && (s.mat || (s.recolored && s.original)));
    caption(img, s);
    notify(img);
  }
  function caption(img, s) {
    if (!s.recolored) return;
    const cap = S.caption && holder(img).querySelector(S.caption); if (!cap) return;
    let box = cap.querySelector('.dk-note');
    if (!box) {
      const btn = doc.createElement('button');
      btn.type = 'button'; btn.className = 'dk-note__btn'; btn.setAttribute('data-cname', 'dark_show_original');
      btn.addEventListener('click', () => setOriginal(img, !state.get(img).original));
      const txt = doc.createElement('span'); txt.className = 'dk-note__t';
      box = doc.createElement('span'); box.className = 'dk-note'; box.append(txt, btn);
      cap.append(box);
    }
    box.hidden = !isDark();
    box.firstChild.textContent = s.original ? 'Original colors' : 'Colors adjusted for dark mode';
    const btn = box.lastChild;
    btn.textContent = s.original ? 'Use dark colors' : 'Show original';
    btn.setAttribute('aria-pressed', String(!!s.original));
    btn.setAttribute('aria-label', (s.original ? 'Use dark-mode colors for ' : 'Show original colors of ') + (img.alt ? img.alt.split(':')[0] : 'this chart'));
  }
  async function prepare(img) {
    if (state.has(img)) { show(img); return; }
    const light = img.getAttribute('src'); if (!light) return;
    const s = { light, dark: '', recolored: false, mat: false, original: false, srcset: img.getAttribute('srcset') || undefined };
    state.set(img, s);
    try {
      const d = decide(img);
      if (d.mode === 'mat') s.mat = true;
      else if (d.mode === 'swap') { s.dark = await preload(d.url); s.recolored = d.recolored; if (!s.dark) s.mat = kind(img) !== 'logo'; }
      else if (d.mode === 'recolor') { const u = await recolorUrl(new URL(light, location.href).href); if (u) { s.dark = u; s.recolored = true; } else s.mat = true; }
    } catch (e) {                                        // anything unexpected: the safe treatment
      s.dark = ''; s.recolored = false; s.mat = kind(img) !== 'logo';
    }
    show(img);
  }
  const preload = (url) => new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(url); i.onerror = () => resolve(''); i.src = url; });

  function setOriginal(img, on) { const s = state.get(img); if (!s) return; s.original = !!on; show(img); }

  /* ---------- watching ---------- */
  let io;
  function start() {
    const imgs = Array.from(doc.querySelectorAll(SCOPE));
    if (!io && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); prepare(e.target); } }), { rootMargin: '800px 0px' });
    }
    imgs.forEach((img) => { if (state.has(img)) show(img); else if (io && kind(img) !== 'logo') io.observe(img); else prepare(img); });
  }
  function refresh() {
    if (isDark()) start();
    else doc.querySelectorAll(SCOPE).forEach((img) => { if (state.has(img)) show(img); });
  }
  new MutationObserver(refresh).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  forced.addEventListener && forced.addEventListener('change', refresh);
  addEventListener('beforeprint', () => { printing = true; refresh(); });
  addEventListener('afterprint', () => { printing = false; refresh(); });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', refresh); else refresh();
  /* images added by script after load (the Eureka 2 nav's logo): look again for a while */
  let later = 0;
  const added = new MutationObserver(() => { if (!later) later = setTimeout(() => { later = 0; if (isDark()) start(); }, 120); });
  added.observe(doc.documentElement, { childList: true, subtree: true });
  setTimeout(() => added.disconnect(), 20000);

  window.StudyDark = {
    /* is this image currently able to show recolored (dark) colors? */
    isRecolored: (img) => { const s = state.get(img); return !!(s && s.recolored && s.dark && isDark()); },
    isOriginal: (img) => { const s = state.get(img); return !!(s && s.original); },
    darkSrc: (img) => { const s = state.get(img); return s && isDark() && !s.original ? s.dark || s.light : img.getAttribute('src'); },
    setOriginal,
    onChange: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
})();
