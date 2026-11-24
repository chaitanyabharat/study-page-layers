/* Skim mode: one switch shows only chapter openers, subheads, figures, stat
   bars, pull stats and profile titles, with the reading time it saves. The
   choice is remembered. Its switch goes in the contents rail and sheet (slot
   "contents-footer"); without the contents component it sits before the first
   chapter. Load it after the components whose output it keeps visible. */
StudyEnh.define('skim', {
  keep: '.enh-chart, .enh-pullstat, .enh-profiles, .enh-waffle, .enh-skim-inline, ul.enh-bars, ol',   // always kept
  keepLede: true,                               // the first paragraph of each chapter
  keepBoldLists: true,                          // lists where every item starts with a bold label
  keepProfileHeads: ':scope > b:first-child + i',
  wordsPerMinute: 230,
  storageKey: 'skim',                          // saved as 'enh-' + this, so a page can't reach other keys
}, (E, opt) => {
  const { el, tag, root } = E;
  const kids = E.blocks(), m = E.model();
  const isLede = (n) => { const p1 = n.previousElementSibling, p2 = p1 && p1.previousElementSibling; return n.tagName === 'P' && ((p1 && p1.tagName === 'H2') || (p1 && p1.tagName === 'H3' && p2 && p2.tagName === 'H2')); };
  const classify = () => {
    E.blocks().forEach((n) => {
      n.classList.remove('enh-skim-hide');
      if (E.inBackMatter(n) || E.inSummary(n) || n === m.summary || /^H[1-4]$/.test(n.tagName)) return;
      if (n.matches(opt.keep)) return;
      if (opt.keepBoldLists && n.tagName === 'UL' && Array.from(n.children).every((li) => li.firstElementChild && li.firstElementChild.tagName === 'B' && li.firstChild === li.firstElementChild)) return;
      if (n.tagName === 'P' && ((opt.keepLede && isLede(n)) || (opt.keepProfileHeads && n.querySelector(opt.keepProfileHeads)))) return;
      if (n.querySelector('iframe, .enh-video')) return;
      if (n.tagName === 'P' && !n.textContent.trim()) return;
      n.classList.add('enh-skim-hide');
    });
  };
  classify();
  const mins = (w) => Math.max(1, Math.round(w / opt.wordsPerMinute));
  const words = (nodes) => nodes.reduce((s, n) => s + n.textContent.trim().split(/\s+/).filter(Boolean).length, 0);
  const fullMin = mins(words(kids)), skimMin = mins(words(kids.filter((n) => !n.classList.contains('enh-skim-hide'))));

  const KEY = 'enh-' + String(opt.storageKey).replace(/[^a-z0-9-]/gi, '');
  let on = false; try { on = localStorage.getItem(KEY) === '1'; } catch (e) { /* storage blocked */ }
  const btns = [];
  const mk = (where) => {
    const b = tag(el('button', { type: 'button', class: 'enh-skim', 'aria-pressed': 'false' }, el('span', { class: 'enh-skim__track', 'aria-hidden': 'true' }), el('span', { class: 'enh-skim__label' })), 'skim_' + where);
    b.addEventListener('click', () => set(!on, true)); btns.push(b); return b;
  };
  const set = (v, user) => {
    const anchor = E.currentHeading(); const before = anchor ? anchor.getBoundingClientRect().top : 0;
    if (v) classify();
    on = v; root.classList.toggle('enh-skim', v);
    btns.forEach((b) => {
      b.setAttribute('aria-pressed', String(v));
      const l = b.querySelector('.enh-skim__label'); l.textContent = v ? 'Skim mode is on' : 'Skim mode';
      l.append(el('small', { text: v ? `About ${skimMin} min. Turn off for the full ${fullMin}-min read.` : `Openers, charts and key stats in about ${skimMin} min` }));
    });
    if (user) {
      try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* ignore */ }
      if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
      E.toast(v ? 'Skim mode: chapter openers, charts and key stats' : 'Showing everything');
    }
  };
  E.useSlot('contents-footer', (node, where) => { node.append(mk(where)); set(on, false); });
  if (!E.hasSlot('contents-footer')) {
    const host = el('div', { class: 'enh-skim-inline' }, mk('inline'));
    (m.firstChapter || E.article.firstElementChild).before(host);
  }
  set(on, false);
});
