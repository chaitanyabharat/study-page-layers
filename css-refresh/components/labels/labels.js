/* Labels: short labels and lines the design adds around the article ("Summary",
   "Video summary", a byline), set in page settings instead of being written
   into CSS. Real text in the page: translatable, visible to crawlers that run
   scripts, and it fails visibly (the label is missing) rather than silently.

   "labels": { "items": [
     { "at": "#section---KeyFindings", "where": "prepend", "text": "Summary", "class": "kicker", "decorative": true },
     { "at": "p.description", "where": "append", "parts": ["Study.com Research with Candova", "Two surveys, ~2,000 employees"], "class": "byline" }
   ] }
   at          where it goes (a selector; the first match, or every match with "all": true)
   where       prepend | append (inside the element). Labels never become new
               siblings of the article's blocks, so page CSS keeps working.
   text        the label; "{count:SELECTOR}" becomes a number word ("Five")
   parts       several pieces, shown on one line with separators or stacked on phones
   class       added as enh-l-<class>, for styling
   decorative  hidden from screen readers when it only repeats the heading's meaning */
StudyEnh.define('labels', { items: [] }, (E, opt) => {
  const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
  const fill = (t) => String(t || '').replace(/\{count:([^}]+)\}/g, (_, sel) => {
    let n = 0; try { n = E.$$(sel.trim()).length; } catch (e) { /* bad selector: zero */ }
    return WORDS[n] || String(n);
  });
  (opt.items || []).forEach((it, i) => {
    let targets = [];
    try { targets = it.all ? E.$$(it.at) : [E.$(it.at)].filter(Boolean); } catch (e) { console.warn('[labels] bad selector', it.at); return; }
    targets.forEach((t) => {
      if (t.querySelector(':scope > .enh-l-' + (it.class || 'label'))) return;
      const span = E.el('span', { class: 'enh-l enh-l-' + (it.class || 'label'), 'aria-hidden': it.decorative ? 'true' : null });
      if (Array.isArray(it.parts)) it.parts.forEach((p) => span.append(E.el('span', { class: 'enh-l-part', text: fill(p) })));
      else span.textContent = fill(it.text);
      if (it.where === 'append') t.append(span); else t.prepend(span);
    });
    if (!targets.length) console.warn('[labels] nothing matches', it.at);
  });
});
