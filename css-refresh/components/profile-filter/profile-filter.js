/* Profile filter: when the article describes several profiles (a bold name
   with an italic line, then a list), a row of buttons filters them. */
StudyEnh.define('profile-filter', {
  head: 'p',                                    // a profile starts with this element...
  headHas: ':scope > b:first-child + i',        // ...when it contains this (bold name, then italic)
  nameClean: ['^Profile\\s+\\d+\\s*:\\s*', '^The\\s+', ':\\s*$'],
  question: 'Which one sounds like you?',
  all: 'All {n}',                               // {n} becomes "four", "five"...
}, (E, opt) => {
  const kids = E.blocks();
  const heads = kids.filter((n) => n.matches(opt.head) && n.querySelector(opt.headHas) && n.nextElementSibling && n.nextElementSibling.tagName === 'UL');
  if (heads.length < 2) return;
  const groups = heads.map((h) => {
    const parts = [h]; let n = h.nextElementSibling;
    while (n && !heads.includes(n) && !/^H[23]$/.test(n.tagName)) { parts.push(n); n = n.nextElementSibling; }
    let name = E.clean((h.querySelector('b') || h).textContent);
    opt.nameClean.forEach((p) => { name = name.replace(E.rx(p), ''); });
    return { parts, name };
  });
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const allText = opt.all.replace('{n}', WORDS[groups.length] || String(groups.length));
  const status = E.el('span', { class: 'enh-sr', 'aria-live': 'polite' });
  const all = E.tag(E.el('button', { type: 'button', class: 'enh-chip', 'aria-pressed': 'true', text: allText }), 'profile_all');
  const btns = groups.map((g, i) => E.tag(E.el('button', { type: 'button', class: 'enh-chip', 'aria-pressed': 'false', text: g.name }), 'profile_' + (i + 1)));
  const set = (k) => {
    all.setAttribute('aria-pressed', String(k < 0));
    btns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === k)));
    groups.forEach((g, i) => g.parts.forEach((p) => p.classList.toggle('enh-off', k >= 0 && i !== k)));
    status.textContent = k < 0 ? `Showing ${allText.toLowerCase()}` : `Showing ${groups[k].name}`;
  };
  all.addEventListener('click', () => set(-1));
  btns.forEach((b, i) => b.addEventListener('click', () => set(i)));
  heads[0].before(E.tag(E.el('div', { class: 'enh-profiles', role: 'group', 'aria-label': 'Filter profiles' },
    E.el('span', { class: 'enh-profiles__q', text: opt.question }), E.el('div', { class: 'enh-profiles__chips' }, all, btns), status), 'profiles', true));
});
