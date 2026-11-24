/* Stat bars: a list whose items each lead with a percentage gets a bar per
   item, drawn to a 0-100 scale; the largest is highlighted. Values are read
   from the list text. */
StudyEnh.define('stat-bars', {
  lead: '^(?:only|nearly|about|almost|around|a further|just|over|under)?\\s*(\\d{1,3}(?:\\.\\d+)?)%',
  labelled: '^[^:]{2,60}:\\s*(\\d{1,3}(?:\\.\\d+)?)%',
  skip: 'p:has(> b:first-child + i) + ul',     // lists that belong to another component (profile facts)
  skipSummary: true,
  minItems: 2,
}, (E, opt) => {
  const lead = E.rx(opt.lead), labelled = E.rx(opt.labelled);
  E.blocks().filter((n) => n.tagName === 'UL' && !(opt.skipSummary && E.inSummary(n))).forEach((ul) => {
    if (getComputedStyle(ul).display === 'grid') return;               // the page already styles it as a stat strip
    try { if (opt.skip && ul.matches(opt.skip)) return; } catch (e) { /* :has() unsupported */ }
    const items = Array.from(ul.children).filter((li) => li.tagName === 'LI');
    if (items.length < opt.minItems) return;
    const vals = items.map((li) => { const t = E.clean(li.textContent); const m = t.match(lead) || t.match(labelled); return m ? Number(m[1]) : NaN; });
    if (vals.some((v) => !(v >= 0 && v <= 100))) return;
    ul.classList.add('enh-bars');
    const max = Math.max(...vals);
    items.forEach((li, i) => li.append(E.el('span', { class: 'enh-bar' + (vals[i] === max ? ' is-max' : ''), 'aria-hidden': 'true', style: `--v:${vals[i] / 100}` }, E.el('span', { class: 'enh-bar__fill' }))));
  });
  const lists = E.$$('ul.enh-bars', E.article);
  if (!lists.length) return;
  if (E.reduceMotion() || !('IntersectionObserver' in window)) { lists.forEach((l) => l.classList.add('is-in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.35 });
  lists.forEach((l) => io.observe(l));
});
