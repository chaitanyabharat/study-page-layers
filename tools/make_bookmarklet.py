"""Print the CMS8 bookmarklet as a javascript: URL. Make a new bookmark and paste the output as its address.

  python tools/make_bookmarklet.py
"""
import sys, urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "page-layers" / "tools"))
import pl

src = (Path(__file__).resolve().parent / "cms8-update-bookmarklet.js").read_text(encoding="utf-8")
code = pl.minify_js(src)
print("javascript:" + urllib.parse.quote(code, safe="(){}[];,.=!:'\"+/?&|<>*-_$"))
