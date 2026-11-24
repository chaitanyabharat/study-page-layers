/* Figures: a visible caption under every figure (its own caption, or its alt text), and a
   full-screen viewer with zoom, arrow keys between figures, and the dark-mode
   "original colors" switch. Which images count as figures is set in the core
   (enhance.figures). */
StudyEnh.define('figures', {
  enlarge: 'Enlarge',
  hint: 'Double-click or use the zoom button for full size. Arrow keys move between figures.',
}, (E, opt) => {
  const charts = E.figures(); if (!charts.length) return;
  const label = E.config().figures.label;
  charts.forEach((entry) => {
    const btn = E.tag(E.el('button', { type: 'button', class: 'enh-cap__btn', 'aria-label': `${opt.enlarge} figure ${entry.n}`, onclick: () => open(entry) }, E.icon('expand'), E.el('span', { text: opt.enlarge })), 'chart_enlarge');
    const cap = E.el('div', { class: 'enh-cap' }, E.el('span', { class: 'enh-cap__n', text: `${label} ${entry.n}` }), E.el('span', { class: 'enh-cap__t', text: entry.text }), btn);
    /* the page's own caption stays the caption (same element, same text), just laid out like ours */
    if (entry.caption) { entry.caption.classList.add('enh-cap-host'); entry.caption.replaceChildren(cap); } else entry.img.after(cap);
    entry.img.addEventListener('click', () => open(entry));
  });

  let viewer;
  function build() {
    const { el, icon, tag, root } = E;
    const img = el('img', { class: 'enh-viewer__img', alt: '' });
    const stage = el('div', { class: 'enh-viewer__stage', tabindex: '0' }, img);
    const num = el('span', { class: 'enh-viewer__n' });
    const title = el('p', { class: 'enh-viewer__t', id: 'enh-viewer-title' });
    const zoomBtn = tag(el('button', { type: 'button', class: 'enh-iconbtn', 'aria-pressed': 'false', 'aria-label': 'Zoom to full size' }, icon('zoom')), 'viewer_zoom');
    const prev = el('button', { type: 'button', class: 'enh-iconbtn', 'aria-label': 'Previous figure' }, icon('prev'));
    const next = el('button', { type: 'button', class: 'enh-iconbtn', 'aria-label': 'Next figure' }, icon('next'));
    const close = el('button', { type: 'button', class: 'enh-iconbtn', 'aria-label': 'Close' }, icon('close'));
    const origBtn = tag(el('button', { type: 'button', class: 'enh-iconbtn', 'aria-pressed': 'false', 'aria-label': 'Show original colors', hidden: true }, icon('palette')), 'viewer_original_colors');
    const dlg = el('dialog', { class: 'enh-viewer', 'aria-labelledby': 'enh-viewer-title' },
      el('div', { class: 'enh-viewer__bar' }, el('div', { class: 'enh-viewer__meta' }, num, title), el('div', { class: 'enh-viewer__tools' }, origBtn, prev, next, zoomBtn, close)),
      stage, el('p', { class: 'enh-viewer__hint', text: opt.hint }));
    E.doc.body.append(dlg);
    let cur = 0;
    const setZoom = (on) => { dlg.classList.toggle('is-zoomed', on); zoomBtn.setAttribute('aria-pressed', String(on)); zoomBtn.setAttribute('aria-label', on ? 'Fit to screen' : 'Zoom to full size'); };
    const syncDark = () => {
      const D = window.StudyDark, c = charts[cur]; if (!c) return;
      const can = !!D && (D.isRecolored(c.img) || D.isOriginal(c.img));
      origBtn.hidden = !can || root.getAttribute('data-theme') !== 'dark';
      const orig = !!D && D.isOriginal(c.img);
      origBtn.setAttribute('aria-pressed', String(orig));
      origBtn.setAttribute('aria-label', orig ? 'Use dark-mode colors' : 'Show original colors');
      origBtn.title = orig ? 'Showing original colors' : 'Colors adjusted for dark mode';
      dlg.classList.toggle('is-darkimg', can && !orig);
    };
    const show = (i) => {
      cur = (i + charts.length) % charts.length; const c = charts[cur];
      img.src = c.img.currentSrc || c.img.src; img.alt = c.img.alt || '';
      syncDark();
      num.textContent = `${label} ${c.n} of ${charts.length}`; title.textContent = c.text; setZoom(false); stage.scrollTo(0, 0);
    };
    origBtn.onclick = () => { const D = window.StudyDark, c = charts[cur]; if (D) D.setOriginal(c.img, !D.isOriginal(c.img)); };
    if (window.StudyDark) window.StudyDark.onChange((changed) => { const c = charts[cur]; if (dlg.open && c && changed === c.img) { img.src = c.img.currentSrc || c.img.src; syncDark(); } });
    prev.onclick = () => show(cur - 1); next.onclick = () => show(cur + 1);
    zoomBtn.onclick = () => setZoom(!dlg.classList.contains('is-zoomed'));
    img.addEventListener('dblclick', () => setZoom(!dlg.classList.contains('is-zoomed')));
    close.onclick = () => dlg.close();
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
      else if (e.key === '+' || e.key === '=') setZoom(true);
      else if (e.key === '-') setZoom(false);
    });
    let opener = null;
    dlg.addEventListener('close', () => { root.classList.remove('enh-lock'); if (opener) opener.focus({ preventScroll: true }); });
    return { open(entry) { opener = E.doc.activeElement; show(charts.indexOf(entry)); root.classList.add('enh-lock'); dlg.showModal(); close.focus(); } };
  }
  function open(entry) { if (!viewer) viewer = build(); viewer.open(entry); }
});
