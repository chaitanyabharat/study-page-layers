/* Stat waffle: an interactive "Of every 100 ..." chart. Each view is a
   number found in the article's own text, and quotes the sentence it comes
   from with a link to where it sits. Nothing shows unless the page sets it up:

   "stat-waffle": {
     "title": "Of every 100 employees",
     "after": ".hub-content-container > p.description",   // where the chart goes
     "views": [ { "label": "Use AI", "tone": "data",        // tone: data | ink | signal | risk
                  "find": "\\b(\\d+) in 10 employees use AI", "scale": 10 } ]
   }
   "find" is a pattern with one number in it; "scale" multiplies that number
   (10 for "9 in 10"). A view whose sentence isn't found is left out.
   linkFindings (default on): when a view's sentence is in one of the summary's
   findings, pointing at or tabbing into that finding shows its view, and the
   finding gets the class enh-waffle-link (is-shown while its view is on show),
   with data-tone set, so page CSS can tie the two together. */
StudyEnh.define('stat-waffle', {
  title: '', after: '', views: [], of: 100, minViews: 2, sourceLabel: 'Where this is in the report', linkFindings: true,
}, (E, opt) => {
  if (!opt.views.length || !opt.after) return;
  const anchor = E.$(opt.after); if (!anchor) return;
  const textNodes = E.$$('li, p', E.article);
  const find = (re, scale) => {
    for (const n of textNodes) {
      /* the element's own text (not figures other components added), split into sentences;
         a lead-in ending in a colon ("Math is the hardest: 46% of ...") is its own piece */
      for (const sent of E.text(n).split(/(?<=[.!?:])\s+/)) {
        const m = sent.match(re);
        if (m) return { value: Math.round(Number(m[1]) * (scale || 1)), sentence: sent.replace(/\s*\((Fig\.?|Figure)\s?\d+\)/i, '').replace(/([^.!?])$/, '$1.'), node: n };
      }
    }
    return {};
  };
  const views = opt.views.map((v, i) => ({ key: v.key || 'v' + i, label: v.label, tone: v.tone || 'data', ...find(E.rx(v.find), v.scale) }))
    .filter((v) => Number.isFinite(v.value) && v.value >= 0 && v.value <= opt.of);
  if (views.length < opt.minViews) return;
  const { el, tag } = E;
  const cells = Array.from({ length: opt.of }, () => el('i'));
  const grid = el('div', { class: 'enh-waffle__grid', role: 'img' }, cells);
  const num = el('span', { class: 'enh-waffle__num', 'data-of': String(opt.of) });
  const sent = el('span', { class: 'enh-waffle__sent' });
  const src = tag(el('a', { class: 'enh-waffle__src', href: E.pageUrl() }, opt.sourceLabel), 'waffle_source');
  const note = el('p', { class: 'enh-waffle__note', 'aria-live': 'polite' }, num, sent, src);
  const chips = views.map((v) => tag(el('button', { type: 'button', class: 'enh-chip', 'data-tone': v.tone, 'aria-pressed': 'false', text: v.label }), 'waffle_' + v.key));
  /* .enh-waffle__in groups the parts; it is display: contents unless a page lays it out (e.g. a sticky card) */
  const fig = tag(el('figure', { class: 'enh-waffle', 'aria-label': opt.title || null }, el('div', { class: 'enh-waffle__in' },
    el('div', { class: 'enh-waffle__head', 'aria-hidden': 'true' }, el('span', { text: opt.title })),
    grid, el('div', { class: 'enh-waffle__chips', role: 'group', 'aria-label': 'Show' }, chips), note)), 'waffle', true);
  let current = null;
  /* the summary finding (heading, or bullet) that holds each view's sentence */
  const findings = opt.linkFindings ? E.findings() : [];
  const linked = views.map((v) => { const f = findings.find((x) => x.node === v.node || x.node.contains(v.node) || (x.list && x.list.contains(v.node))); return f ? f.node : null; });
  const show = (i) => {
    const v = views[i]; current = v;
    linked.forEach((n, j) => { if (n) n.classList.toggle('is-shown', j === i); });
    chips.forEach((c, j) => c.setAttribute('aria-pressed', String(i === j)));
    fig.dataset.tone = v.tone;
    cells.forEach((c, j) => { c.className = j < v.value ? 'on' : ''; c.style.transitionDelay = E.reduceMotion() ? '0ms' : `${Math.min(j, v.value) * 6}ms`; });
    grid.setAttribute('aria-label', `${v.value} of ${opt.of}: ${v.label.toLowerCase()}`);
    num.textContent = String(v.value); sent.textContent = v.sentence;
  };
  chips.forEach((c, i) => c.addEventListener('click', () => show(i)));
  linked.forEach((n, i) => {
    if (!n) return;
    n.classList.add('enh-waffle-link'); n.dataset.tone = views[i].tone;
    /* pointing or tabbing changes the chart quietly: the note isn't announced for these */
    const go = () => { if (current === views[i]) return; note.setAttribute('aria-live', 'off'); show(i); setTimeout(() => note.setAttribute('aria-live', 'polite'), 0); };
    n.addEventListener('mouseenter', go); n.addEventListener('focusin', go);
  });
  src.addEventListener('click', (e) => { e.preventDefault(); if (!current) return; E.smoothTo(current.node); E.flash(current.node); });
  anchor.after(fig);
  E.root.classList.add('enh-has-waffle');
  show(0);
});
