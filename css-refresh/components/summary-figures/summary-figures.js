/* Summary figures: each finding in the summary section is led by a big figure,
   taken from its own text: the first percentage in the finding (heading, then
   its list; or the bullet itself when the summary is a list), where "9 in 10"
   counts as 90%. The figure is read from the page, never typed into CSS, so it
   can't drift from the article. It repeats a number that is already in the
   text, so screen readers skip it.

   Settings: pattern (first group = percent, second group = "N in 10"). */
StudyEnh.define('summary-figures', {
  pattern: '(\\d{1,3}(?:\\.\\d+)?)%|\\b(\\d{1,2}) in 10\\b',
}, (E, opt) => {
  const re = E.rx(opt.pattern);
  E.findings().forEach(({ node, list }) => {
    if (node.querySelector('.enh-figure')) return;
    const text = E.clean(node.textContent) + ' ' + (list ? E.clean(list.textContent) : '');
    const m = text.match(re); if (!m) return;
    const value = m[1] != null ? m[1] : String(Number(m[2]) * 10);
    node.prepend(E.el('span', { class: 'enh-figure', 'aria-hidden': 'true', text: value + '%' }));
  });
});
