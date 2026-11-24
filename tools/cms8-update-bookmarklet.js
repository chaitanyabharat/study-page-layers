/* CMS8 "Update Page Layers block" bookmarklet (for the self-contained option, no host).
   1. Copy a block from dist/cms8/<page-id>-embed.txt (or dist/cms8/hosted-embed.txt).
   2. Open the article's edit screen in CMS8 and click the bookmarklet.
   3. It replaces the article's existing Page Layers block with the copied one (or adds it at the top),
      then you review and click Save yourself. It never saves on its own.
   Build the bookmark with: python tools/make_bookmarklet.py */
(async function () {
  var say = function (m) { window.alert('Page Layers: ' + m); };
  var areas = Array.prototype.slice.call(document.querySelectorAll('textarea.edit-content'));
  if (!areas.length) return say('open an article\'s edit screen in CMS8 first.');
  var ta = areas.sort(function (a, b) { return b.value.length - a.value.length; })[0];   // the article body
  var block;
  try { block = (await navigator.clipboard.readText()).replace(/\r\n?/g, '\n').trim(); }
  catch (e) { return say('allow clipboard access and try again.'); }
  if (block.indexOf('[{Embed') !== 0 || !/<!-- (Study\.com )?Page Layers/.test(block)) return say('the clipboard doesn\'t hold a Page Layers block. Copy one from dist/cms8/ first.');
  var v = ta.value, start = v.search(/\[\{Embed\s*<!-- (Study\.com )?Page Layers/), next, action;
  if (start >= 0) {
    next = v.indexOf('}]', start) + 2;
    v = v.slice(0, start) + block + v.slice(next);
    action = 'replaced the existing block';
  } else {
    v = block + '\n\n' + v.replace(/^\s+/, '');
    action = 'added the block at the top';
  }
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, v);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.dispatchEvent(new Event('change', { bubbles: true }));
  say(action + ' (' + Math.round(block.length / 1024) + ' KB). Check it, then click Save.');
})();
