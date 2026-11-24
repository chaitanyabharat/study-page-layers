"""Markup check: does the page's HTML still have everything its CSS and settings rely on?

CMS8 can change a page's HTML (a renamed heading, a re-exported chart, a template
update). Page CSS and settings point at that HTML, so a change would make the
refresh quietly lose a style or a label. This check makes it fail loudly instead.

What it checks, for one page:
- every entry in the page's "expects" list (selector + how many), with the reason
- every label target in settings (enhance.components.labels.items[].at)
- every stat-waffle sentence pattern (enhance.components.stat-waffle.views[].find)

  python tools/cli.py markup [page-id] [--html FILE | --url URL]

Run it on the saved copy in tests, and on the live page on a schedule (see the
GitHub workflow), so a CMS8 change is caught the day it happens.
"""
import json, re
from pathlib import Path

def expectations(page):
    out = [dict(e) for e in page.get("expects") or []]
    enh = ((page.get("settings") or {}).get("enhance") or {}).get("components") or {}
    for it in (enh.get("labels") or {}).get("items", []):
        out.append({"selector": it["at"], "min": 1, "why": f"label \"{it.get('text') or ' / '.join(it.get('parts', []))}\" is placed here"[:120]})
    for v in (enh.get("stat-waffle") or {}).get("views", []):
        out.append({"text": v["find"], "why": f"cover chart view \"{v.get('label')}\" reads its number from this sentence"})
    return out

JS = r"""(exp) => exp.map((e) => {
  if (e.text) {
    const re = new RegExp(e.text, 'i');
    const hit = [...document.querySelectorAll('li, p')].some((n) => n.textContent.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).some((s) => re.test(s)));
    return { ...e, found: hit ? 1 : 0, ok: hit };
  }
  let n = 0; try { n = document.querySelectorAll(e.selector).length; } catch (err) { return { ...e, found: -1, ok: false, error: 'bad selector' }; }
  const ok = (e.count != null ? n === e.count : n >= (e.min ?? 1));
  return { ...e, found: n, ok };
})"""

def check(page, html=None, url=None):
    """Return a list of results: {selector|text, found, ok, why}."""
    from playwright.sync_api import sync_playwright
    exp = expectations(page)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page()
        if url:
            pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        else:
            pg.route("**/*", lambda r: r.abort() if r.request.url.startswith("http") else r.continue_())
            pg.set_content(Path(html).read_text(encoding="utf-8"), wait_until="domcontentloaded")
        res = pg.evaluate(JS, exp)
        b.close()
    return res

def report(res):
    lines = []
    for r in res:
        what = r.get("selector") or f"text /{r.get('text')}/"
        want = f"exactly {r['count']}" if r.get("count") is not None else (f"at least {r.get('min', 1)}" if r.get("selector") else "present")
        lines.append(("PASS " if r["ok"] else "FAIL ") + f"{what[:90]}  (found {r['found']}, want {want})" + ("" if r["ok"] else f"\n       why it matters: {r.get('why', '')}"))
    return lines
