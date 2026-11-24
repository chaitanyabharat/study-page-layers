/* Heading links: a link icon on each section heading that copies a deep link. */
StudyEnh.define('heading-links', {
  levels: 'H2,H3',
  skipSummary: true,
}, (E, opt) => {
  const levels = opt.levels.split(',').map((s) => s.trim().toUpperCase());
  const m = E.model();
  E.blocks().filter((n) => levels.includes(n.tagName) && n.id && !(opt.skipSummary && (E.inSummary(n) || n === m.summary))).forEach((h) => {
    const a = E.tag(E.el('a', { class: 'enh-anchor', href: E.hashUrl(h.id), 'aria-label': 'Copy link to this section' }, E.icon('link')), 'copy_section_link');
    a.addEventListener('click', (e) => { e.preventDefault(); E.copyText(E.hashUrl(h.id), 'Link to this section copied'); E.setHash(h.id); });
    h.append(a);
  });
});
