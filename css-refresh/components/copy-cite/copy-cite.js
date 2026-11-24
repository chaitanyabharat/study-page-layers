/* Copy and cite: "Copy" on each summary finding and each pull stat. It copies
   the sentence, a source line (core setting: source) and a link to that spot. */
StudyEnh.define('copy-cite', {
  findings: true,                               // the summary's findings: headings with their first bullet, or its bullets
  pullStats: '.tablesort-overflow',             // one-row tables used as pull stats (the wiki's shaded box); '' = none
  copyLabel: 'Copy', statLabel: 'Copy stat',
}, (E, opt) => {
  if (opt.findings) {
    E.findings().forEach(({ node, list, id }, i) => {
      const first = list && list.querySelector('li');
      const sentence = E.text(node) + (first ? ' ' + E.text(first).replace(/\.?$/, '.') : '');
      const b = E.tag(E.el('button', { type: 'button', class: 'enh-copy', 'aria-label': `Copy finding ${i + 1} with a link` }, E.icon('copy'), E.el('span', { text: opt.copyLabel })), 'copy_finding');
      b.addEventListener('click', () => E.copyText(E.cite(sentence, id), 'Finding copied with a link to it'));
      node.classList.add('enh-finding');
      node.append(b);
    });
  }
  if (opt.pullStats) {
    E.blocks().filter((n) => n.matches(opt.pullStats) && n.querySelectorAll('tr').length === 1).forEach((box, i) => {
      const td = E.$('td', box); if (!td) return;
      if (!box.id) box.id = 'stat-' + (i + 1);
      box.classList.add('enh-pullstat');
      const b = E.tag(E.el('button', { type: 'button', class: 'enh-copy enh-copy--stat', 'aria-label': 'Copy this stat with a link' }, E.icon('copy'), E.el('span', { text: opt.statLabel })), 'copy_stat');
      b.addEventListener('click', () => E.copyText(E.cite(td.textContent, box.id), 'Stat copied with a link to it'));
      td.append(b);
    });
  }
});
