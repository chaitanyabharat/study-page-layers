/* Reference links: plain-text web addresses in the references section become
   real links (opening in a new tab). */
StudyEnh.define('reference-links', {
  heading: { selector: '#section---ExternalResearchReferenced', text: '^(external )?(research )?(references|sources|works cited|bibliography)\\b' },
  levels: 'H2,H3',
}, (E, opt) => {
  const levels = opt.levels.split(',').map((s) => s.trim().toUpperCase());
  const re = E.rx(opt.heading.text);
  const h = (opt.heading.selector && E.$(opt.heading.selector, E.article)) || E.blocks().find((n) => levels.includes(n.tagName) && re && re.test(E.clean(n.textContent)));
  if (!h) return;
  for (let p = h.nextElementSibling; p && !levels.includes(p.tagName); p = p.nextElementSibling) {
    const walker = E.doc.createTreeWalker(p, NodeFilter.SHOW_TEXT); const ts = []; while (walker.nextNode()) ts.push(walker.currentNode);
    ts.forEach((t) => {
      const m = t.data.match(/https?:\/\/[^\s)]+[^\s).,]/); if (!m || t.parentElement.closest('a')) return;
      const a = E.tag(E.el('a', { href: m[0], target: '_blank', rel: 'noopener', text: m[0] }), 'reference_link');
      const after = t.splitText(m.index); after.data = after.data.slice(m[0].length); t.after(a);
    });
  }
});
