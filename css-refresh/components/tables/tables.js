/* Tables: data tables that are wider than the screen scroll sideways inside
   their own box (never the whole page), with a shadow on the side that has
   more, a "Swipe" hint, and the first column kept in view. The box is the
   page's own .tablesort-overflow wrapper when there is one, otherwise the
   table itself, so nothing is inserted between the article's blocks.
   Image holders (figures) and one-row pull-stat boxes are left alone. */
StudyEnh.define('tables', {
  skip: '.enh-chart, .enh-quote, .enh-pullstat, table.imageplugin--align',
  wrapper: '.tablesort-overflow',
  stickyFirst: 3,                               // keep the first column in view when the table has at least this many columns (0 = never)
  hint: 'Swipe',
}, (E, opt) => {
  const { el, tag } = E;
  const label = (t) => {
    const cap = t.querySelector('caption'); if (cap && E.text(cap)) return E.text(cap);
    let n = t.closest(opt.wrapper) || t;
    while (n && n.parentElement !== E.article) n = n.parentElement;
    for (let p = n && n.previousElementSibling; p; p = p.previousElementSibling) if (/^H[2-4]$/.test(p.tagName)) return E.text(p);
    return '';
  };
  const boxes = [];
  E.$$('table', E.article).forEach((t, i) => {
    if (t.closest(opt.skip) || t.rows.length < 2) return;
    /* the page's own wrapper (it can sit a level or two up), when it holds only this table */
    const near = t.closest(opt.wrapper), wrap = near && E.article.contains(near) && near.querySelectorAll('table').length === 1 ? near : null;
    const box = wrap || t;
    if (box.classList.contains('enh-table')) return;
    box.classList.add('enh-table'); if (!wrap) box.classList.add('enh-table--self');
    t.classList.add('enh-table__t');
    const cols = Math.max(...Array.from(t.rows).map((r) => r.cells.length));
    if (opt.stickyFirst && cols >= opt.stickyFirst) box.classList.add('enh-table--sticky');
    const name = label(t);
    box.setAttribute('role', 'region'); box.setAttribute('aria-label', name ? 'Table: ' + name : 'Table ' + (i + 1));
    tag(box, 'table');
    if (wrap && opt.hint) wrap.prepend(el('span', { class: 'enh-table__hint', 'aria-hidden': 'true', text: opt.hint }));
    boxes.push(box);
  });
  if (!boxes.length) return;
  const edges = (b) => {
    const more = b.scrollWidth > b.clientWidth + 1;
    b.classList.toggle('is-scrollable', more);
    if (more) b.setAttribute('tabindex', '0'); else b.removeAttribute('tabindex');
  };
  boxes.forEach((b) => {
    b.addEventListener('scroll', () => b.classList.add('was-scrolled'), { passive: true, once: true });
  });
  const all = () => boxes.forEach(edges);
  addEventListener('resize', all);
  if (E.doc.fonts && E.doc.fonts.ready) E.doc.fonts.ready.then(all);
  all();
});
