"""Build a self-contained CMS8 Embed block that turns on Page Layers for one page, with no engineering.

  python tools/build_cms8_embed.py [page-id]          (default: state-of-ai-jobs-and-skills)

Reads the same sources as build.py (the page's page.json, the component registry, newui.js),
minifies them, compresses the bundle (raw DEFLATE) and wraps it as base64 with a tiny loader.
Base64 and the loader avoid every character CMS8 mangles inside an Embed block: < > & in scripts
(read as tags), | [ ] '' !!! (CMS8 markup) and blank lines (turned into paragraphs).

Output: cms8-embed/<page-id>-embed.txt   paste it at the TOP of the article body in CMS8.
To turn the layers off, delete that one Embed block and save.

For the hosted version (one short line per page, files on an external host) see build_remote.py.
"""
import base64, datetime, json, sys, zlib
from pathlib import Path
R = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(R.parent / "page-layers" / "tools"))
import pl


def make_bundle(pid):
    """The page's whole new look as one minified script: settings, CSS, components, and the Display switch."""
    page = pl.load(pl.PAGES / pid / "page.json")
    reg = pl.registry()
    comps = pl.component_list(page, reg)
    text = lambda ref: pl.resolve(ref, pid).read_text(encoding="utf-8")
    css = [pl.minify_css(text(reg[c]["css"])) for c in comps if reg[c].get("css")] + [pl.minify_css(text(r)) for r in page["css"]]
    js = [pl.minify_js(text(reg[c]["file"])) for c in comps]
    newui = pl.minify_js((R / "newui" / "newui.js").read_text(encoding="utf-8"))
    recolor = pl.minify_js((R / "theme" / "recolor.js").read_text(encoding="utf-8"))
    cfg = {"inline": {"css": css, "js": js}, "recolorSrc": recolor}
    return ("window.STUDY_PAGE=" + json.dumps(page.get("settings") or {}, separators=(",", ":")) +
            ";window.STUDY_NEW_UI=" + json.dumps(cfg, separators=(",", ":")) + ";" + newui), page


def main():
    pid = sys.argv[1] if len(sys.argv) > 1 else "state-of-ai-jobs-and-skills"
    bundle, _ = make_bundle(pid)
    b64 = lambda data: base64.b64encode(data).decode("ascii")
    c = zlib.compressobj(9, zlib.DEFLATED, -15, 9)
    z = b64(c.compress(bundle.encode("utf-8")) + c.flush())
    # A ~2 KB synchronous inflater (tools/inflate.js). The browser's DecompressionStream is asynchronous,
    # which made the layers land after the first paint. Decoding synchronously applies the CSS while the
    # page is still being read. Its code has < and &, so it travels as base64 too.
    inflate = b64(pl.minify_js((R / "tools" / "inflate.js").read_text(encoding="utf-8")).encode("utf-8"))

    # The loader: no < > & | [ ] anywhere, so CMS8 passes it through untouched. A script element added
    # with textContent runs at once, so everything here happens before the parser moves on.
    loader = ('(function(){var el=document.getElementById("pl-layers-data");if(!el)return;'
              'function run(code){var s=document.createElement("script");s.textContent=code;document.head.appendChild(s)}'
              'function bytes(b){b=atob(b);return Uint8Array.from(b,function(c){return c.charCodeAt(0)})}'
              'var td=new TextDecoder();'
              'try{run(td.decode(bytes(el.getAttribute("data-inflate"))));'
              'run(td.decode(window.plInflate(bytes(el.getAttribute("data-z")))));'
              'el.setAttribute("data-applied",String(Math.round(performance.now())))}'
              'catch(e){el.setAttribute("data-error",String(e))}})();')
    bad = [ch for ch in "<>&|[]" if ch in loader]
    assert not bad, f"loader contains characters CMS8 mangles: {bad}"

    built = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    block = ("[{Embed\n\n"
             f"<!-- Page Layers for {pid}, built {built}. Keep this block at the top of the article body. Delete it to turn the new look off. -->\n"
             f'<div id="pl-layers-data" hidden data-page="{pid}" data-inflate="{inflate}" data-z="{z}"></div>\n'
             f"<script>{loader}</script>\n\n}}]\n")
    out = R / "cms8-embed" / f"{pid}-embed.txt"
    out.parent.mkdir(exist_ok=True)
    out.write_text(block, encoding="utf-8", newline="\n")
    print(f"{out.name}: {len(block):,} chars in the Embed block "
          f"(bundle {len(bundle):,} chars minified, {len(z):,} compressed as base64)")


if __name__ == "__main__":
    main()
