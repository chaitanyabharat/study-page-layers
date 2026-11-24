/* Contents: a sticky rail beside the article when there is room (measured,
   never assumed), otherwise a "Contents" button that opens a sheet.
   Each entry has a marker: the chapter number, or a mark for the parts that
   aren't chapters (summary, back matter, or any heading the page names). The
   current entry's marker is highlighted and a bar under it fills as you read;
   finished entries get a check. The head shows "3 of 8" and the time left.
   Offers the slot "contents-footer" (skim mode puts its switch there).
   Layout numbers come from CSS: --enh-rail-gap, --enh-rail-edge,
   --enh-rail-min, --enh-rail-max, --enh-scroll-offset.

   Settings (page.json, enhance.components.contents):
     labels: { "<heading id>": "Short label" }   shorter text for the list (the full heading stays as a tooltip)
     marks:  { "<heading id>": "?" }             a mark instead of a number, e.g. "?" for an FAQ
     summaryMark, backMatterMark                 defaults "—" and "§"
     cta: { text, label, href }                  an optional link under the list, e.g. a related course */
StudyEnh.define('contents', {
  label: 'Contents',
  ariaLabel: 'Contents',
  levels: 'H2',
  stripPrefix: '^Section\\s+\\d+\\s*:\\s*',    // removed from heading text in the list
  includeSummary: true, includeBackMatter: true,
  labels: {}, marks: {}, summaryMark: '—', backMatterMark: '§',
  cta: null,
  wordsPerMinute: 230,
  minEntries: 3,
}, (E, opt) => {
  const { el, tag, $, $$ } = E;
  const m = E.model(), kids = E.blocks(), levels = opt.levels.split(',').map((s) => s.trim().toUpperCase());
  const strip = E.rx(opt.stripPrefix), idx = (n) => kids.indexOf(n);
  const full = (h) => E.text(h).replace(strip || /$^/, '');
  const entry = (h, mark) => ({ h, mark, chapter: !mark, label: opt.labels[h.id] || full(h), title: full(h) });
  const targets = [];
  if (m.summary && opt.includeSummary) targets.push(entry(m.summary, opt.marks[m.summary.id] || opt.summaryMark));
  let k = 0;
  kids.filter((n) => levels.includes(n.tagName) && n.id && n !== m.summary && n !== m.backMatter && (!m.backMatter || idx(n) < idx(m.backMatter)))
    .forEach((h) => { const t = entry(h, opt.marks[h.id] || ''); if (t.chapter) t.n = ++k; targets.push(t); });
  if (m.backMatter && opt.includeBackMatter) targets.push(entry(m.backMatter, opt.marks[m.backMatter.id] || opt.backMatterMark));
  if (targets.length < opt.minEntries) return;
  const words = kids.reduce((s, n) => s + n.textContent.trim().split(/\s+/).filter(Boolean).length, 0);
  const fullMin = Math.max(1, Math.round(words / opt.wordsPerMinute));
  E.root.dataset.readMinutes = String(fullMin);

  let sheet;
  const mkList = (where) => el('ol', { class: 'enh-toc__list' }, targets.map((t, i) => {
    const a = tag(el('a', { href: E.hashUrl(t.h.id), 'data-i': i, title: t.label !== t.title ? t.title : null },
      el('span', { class: 'enh-toc__n', 'aria-hidden': 'true', text: t.chapter ? String(t.n) : t.mark }),
      el('span', { class: 'enh-toc__t', text: t.label }),
      el('span', { class: 'enh-toc__bar', 'aria-hidden': 'true' })), 'toc_' + where);
    a.addEventListener('click', (e) => { e.preventDefault(); if (where === 'sheet' && sheet.open) sheet.close(); E.smoothTo(t.h); E.setHash(t.h.id); });
    return el('li', {}, a);
  }));
  const counts = [], times = [];
  const head = () => {
    const c = el('span', { class: 'enh-toc__count' }), t = el('span', { class: 'enh-toc__time', text: `${fullMin} min read` });
    counts.push(c); times.push(t);
    return el('p', { class: 'enh-toc__label' }, el('span', {}, el('span', { text: opt.label }), c), t);
  };
  const cta = () => {
    const c = opt.cta; if (!c || !c.href || !c.label) return null;
    return el('div', { class: 'enh-toc__cta' }, c.text ? el('p', { text: c.text }) : null, tag(el('a', { href: c.href, text: c.label }), 'toc_cta'));
  };
  const railFoot = el('div', { class: 'enh-toc__foot' }), sheetFoot = el('div', { class: 'enh-toc__foot' });
  const rail = tag(el('nav', { class: 'enh-toc', 'aria-label': opt.ariaLabel }, head(), mkList('rail'), cta(), railFoot), 'toc', true);
  const fab = tag(el('button', { type: 'button', class: 'enh-fab', 'aria-haspopup': 'dialog' }, E.icon('list'), el('span', { class: 'enh-fab__t', text: opt.label }), el('span', { class: 'enh-fab__n' })), 'toc_open');
  const sheetClose = el('button', { type: 'button', class: 'enh-iconbtn', 'aria-label': 'Close ' + opt.label.toLowerCase() }, E.icon('close'));
  sheet = el('dialog', { class: 'enh-sheet', 'aria-label': opt.ariaLabel }, el('div', { class: 'enh-sheet__head' }, head(), sheetClose), mkList('sheet'), cta(), sheetFoot);
  sheetClose.onclick = () => sheet.close();
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
  fab.addEventListener('click', () => { E.root.classList.add('enh-lock'); sheet.showModal(); const cur = $('a[aria-current="true"]', sheet) || $('a', sheet); if (cur) cur.focus(); });
  sheet.addEventListener('close', () => E.root.classList.remove('enh-lock'));
  E.doc.body.append(rail, fab, sheet);
  E.offerSlot('contents-footer', railFoot, 'rail');
  E.offerSlot('contents-footer', sheetFoot, 'sheet');

  const links = $$('a[data-i]', rail).concat($$('a[data-i]', sheet));
  const heads = targets.map((t) => t.h);
  let ticking = false, lastTime = '';
  const update = () => {
    ticking = false;
    const off = E.cssNum('--enh-scroll-offset', 140);
    const h = E.currentHeading(heads), i = h ? heads.indexOf(h) : -1, a = targets[i];
    links.forEach((l) => {
      const j = Number(l.dataset.i);
      if (j === i) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
      l.classList.toggle('is-done', j < i);
    });
    let p = 0;
    if (a) {
      const nextT = targets[i + 1], top = a.h.getBoundingClientRect().top + scrollY;
      const end = nextT ? nextT.h.getBoundingClientRect().top + scrollY : E.article.getBoundingClientRect().bottom + scrollY;
      p = Math.min(1, Math.max(0, (scrollY + off - top) / Math.max(1, end - top)));
    }
    rail.style.setProperty('--p', p.toFixed(3)); sheet.style.setProperty('--p', p.toFixed(3));
    /* "3 of 8" while in a chapter; time left from how far through the article you are */
    const count = a && a.chapter ? ` · ${a.n} of ${k}` : '';
    counts.forEach((c) => { c.textContent = count; });
    const ar = E.article.getBoundingClientRect(), startY = (m.firstChapter || E.article).getBoundingClientRect().top;
    const span = Math.max(1, ar.bottom - startY), done = Math.min(1, Math.max(0, (off - startY) / span));
    const left = Math.ceil(fullMin * (1 - done));
    const time = done <= 0 ? `${fullMin} min read` : `${Math.max(1, left)} min left`;
    if (time !== lastTime) { times.forEach((t) => { t.textContent = time; }); lastTime = time; }
    $('.enh-fab__n', fab).textContent = a && a.chapter ? `${a.n}/${k}` : '';
    /* the rail scrolls itself so the current entry is in view (it never moves the page) */
    const cur = $('a[aria-current="true"]', rail);
    if (cur && rail.scrollHeight > rail.clientHeight + 1) {
      const r = cur.getBoundingClientRect(), box = rail.getBoundingClientRect(), pad = 48;
      if (r.top < box.top + pad || r.bottom > box.bottom - pad) rail.scrollTop += (r.top + r.height / 2) - (box.top + box.height / 2);
    }
    edges();
    const stop = m.backMatter ? m.backMatter.getBoundingClientRect().top : ar.bottom;
    rail.classList.toggle('is-visible', startY < innerHeight * 0.6 && stop > innerHeight * 0.4);
    fab.classList.toggle('is-visible', ar.top < innerHeight * 0.5 && ar.bottom > innerHeight * 0.6);
  };
  /* faded edges where the rail has more to scroll */
  const edges = () => {
    rail.classList.toggle('has-more-above', rail.scrollTop > 2);
    rail.classList.toggle('has-more-below', rail.scrollTop + rail.clientHeight < rail.scrollHeight - 2);
  };
  rail.addEventListener('scroll', edges, { passive: true });
  /* the rail sits a fixed gap left of the article's real column, and only when it fits */
  const placeRail = () => {
    const gap = E.cssNum('--enh-rail-gap', 40), edge = E.cssNum('--enh-rail-edge', 16), min = E.cssNum('--enh-rail-min', 196), max = E.cssNum('--enh-rail-max', 232);
    const left = (m.firstChapter || E.article).getBoundingClientRect().left;
    const room = left - gap - edge, fits = room >= min;
    E.root.classList.toggle('enh-rail', fits);
    if (fits) { const w = Math.min(max, room); rail.style.setProperty('--rail-w', w + 'px'); rail.style.setProperty('--rail-l', Math.round(left - gap - w) + 'px'); }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', () => { placeRail(); update(); });
  if (E.doc.fonts && E.doc.fonts.ready) E.doc.fonts.ready.then(() => { placeRail(); update(); });
  placeRail(); update();
});
