/* Video on demand: a YouTube embed shows its poster with a play button; the
   player (and YouTube's ~1 MB of scripts) loads only when someone presses play.
   Works for every YouTube embed in the article. */
StudyEnh.define('video', {
  label: 'Play video',
  fallbackTitle: 'video',
  selector: 'iframe',
}, (E, opt) => {
  E.$$(opt.selector, E.article).forEach((iframe) => {
    const src = iframe.getAttribute('src') || iframe.dataset.src || '';
    const id = (src.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/) || [])[1];
    if (!id) return;
    const t = iframe.getAttribute('title');
    const title = t && !/^youtube video player$/i.test(t) ? t : opt.fallbackTitle;
    const poster = E.el('img', { class: 'enh-video__poster', alt: '', loading: 'lazy', src: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` });
    poster.addEventListener('error', () => { if (!/hqdefault/.test(poster.src)) poster.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }, { once: true });
    const btn = E.tag(E.el('button', { type: 'button', class: 'enh-video', 'aria-label': `Play the ${title} on YouTube` },
      poster, E.el('span', { class: 'enh-video__play' }, E.icon('play')), E.el('span', { class: 'enh-video__label', text: opt.label })), 'video_play', true);
    btn.addEventListener('click', () => {
      const sep = src.includes('?') ? '&' : '?';
      const player = E.el('iframe', { src: `${src}${sep}autoplay=1&rel=0`, title: t || 'YouTube video player', allow: iframe.getAttribute('allow') || 'autoplay; encrypted-media; picture-in-picture; web-share', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' });
      btn.replaceWith(player); player.focus();
    });
    iframe.replaceWith(btn);
  });
});
