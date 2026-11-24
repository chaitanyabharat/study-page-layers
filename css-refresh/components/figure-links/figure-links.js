/* Figure links: "(Fig. 3)" in the text becomes a link that jumps to Fig. 3
   and highlights it. The words it looks for are a setting. */
StudyEnh.define('figure-links', {
  pattern: '\\b(Fig\\.?\\s?|Figure\\s)(\\d{1,3})\\b',   // group 2 is the figure number
  skipInside: 'a, h1, h2, h3, table, button',
}, (E, opt) => {
  const byNum = new Map(E.figures().map((f) => [String(f.n), f.block]));
  if (!byNum.size) return;
  const re = new RegExp(opt.pattern, 'g');
  const walker = E.doc.createTreeWalker(E.article, NodeFilter.SHOW_TEXT, {
    acceptNode: (t) => { re.lastIndex = 0; return re.test(t.data) && !t.parentElement.closest(opt.skipInside) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; },
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((t) => {
    const frag = E.doc.createDocumentFragment(); let last = 0, m; re.lastIndex = 0;
    while ((m = re.exec(t.data))) {
      const target = byNum.get(m[2]); if (!target) continue;
      frag.append(t.data.slice(last, m.index));
      const a = E.tag(E.el('a', { class: 'enh-figref', href: E.hashUrl(target.id), text: m[0] }), 'figref');
      a.addEventListener('click', (e) => { e.preventDefault(); E.smoothTo(target); E.flash(target); E.setHash(target.id); });
      frag.append(a); last = m.index + m[0].length;
    }
    if (last) { frag.append(t.data.slice(last)); t.replaceWith(frag); }
  });
});
