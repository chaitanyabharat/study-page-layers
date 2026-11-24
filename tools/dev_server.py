"""Local test server. Nothing here is published.

  python build.py --dev
  python tools/dev_server.py            then open:
    http://127.0.0.1:8800/admin/?local        the dashboard, reading and writing the files on disk
    http://127.0.0.1:8800/resources/state-of-ai-jobs-and-skills.html
                                              a saved copy of the article, with the CMS8 Embed line
                                              pointing at this server, to test pl.js end to end

In ?local mode "Save as draft" writes to tools/.drafts/<n>/, "Publish" copies the files into the repo,
runs the checks and rebuilds dist/ (with --dev). Discard deletes the draft.
"""
import http.server, json, shutil, subprocess, sys, functools, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "dist" / "site"
DRAFTS = ROOT / "tools" / ".drafts"
FIXTURES = ROOT / "tools" / "fixtures"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8800


def safe(rel):
    p = (ROOT / rel.lstrip("/")).resolve()
    if ROOT not in p.parents and p != ROOT:
        raise ValueError("outside the repo")
    if ".git" in p.parts or "dist" in p.relative_to(ROOT).parts[:1]:
        raise ValueError("not editable")
    return p


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def reply(self, code, body, ctype="application/json"):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(data)))
        self.end_headers(); self.wfile.write(data)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        try:
            if u.path == "/local/read":
                p = safe(q["path"][0])
                return self.reply(200, p.read_bytes(), "text/plain; charset=utf-8") if p.is_file() else self.reply(404, "not found", "text/plain")
            if u.path == "/local/list":
                p = safe(q["path"][0])
                return self.reply(200, json.dumps([{"name": c.name, "type": "dir" if c.is_dir() else "file"} for c in sorted(p.iterdir())]))
            if u.path == "/local/drafts":
                out = []
                for d in sorted(DRAFTS.glob("*/draft.json")) if DRAFTS.exists() else []:
                    meta = json.loads(d.read_text(encoding="utf-8"))
                    out.append({"number": int(d.parent.name), "title": meta["title"], "url": "#", "state": "passed", "detail": "local: checks run on publish"})
                return self.reply(200, json.dumps(out))
            if u.path.startswith("/resources/") or u.path.startswith("/college/"):
                f = FIXTURES / Path(u.path).name
                if f.exists():
                    html = f.read_text(encoding="utf-8")
                    embed = f'<!-- CMS8 Embed (test) --><script src="http://127.0.0.1:{PORT}/pl.js"></script>'
                    html = html.replace('<div id="hub-content" itemprop="articleBody">', '<div id="hub-content" itemprop="articleBody">' + embed, 1)
                    html = html.replace("data-lazy-src=\"/", "src=\"https://study.com/")
                    return self.reply(200, html, "text/html; charset=utf-8")
        except (KeyError, ValueError) as e:
            return self.reply(400, str(e), "text/plain")
        return super().do_GET()

    def do_POST(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/local/save":
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            DRAFTS.mkdir(parents=True, exist_ok=True)
            n = max([int(p.name) for p in DRAFTS.iterdir() if p.name.isdigit()] + [0]) + 1
            (DRAFTS / str(n)).mkdir()
            for f in body["files"]:
                safe(f["path"])
            (DRAFTS / str(n) / "draft.json").write_text(json.dumps(body, indent=2), encoding="utf-8")
            return self.reply(200, json.dumps({"number": n, "url": "#"}))
        if u.path == "/local/publish":
            d = DRAFTS / q["n"][0]
            body = json.loads((d / "draft.json").read_text(encoding="utf-8"))
            backup = {}
            for f in body["files"]:
                p = safe(f["path"]); backup[p] = p.read_bytes() if p.exists() else None
                p.parent.mkdir(parents=True, exist_ok=True); p.write_text(f["content"], encoding="utf-8", newline="\n")
            chk = subprocess.run([sys.executable, "-I", str(ROOT / "page-layers" / "tools" / "cli.py"), "check"], capture_output=True, text=True)
            if chk.returncode != 0 and "--allow-failing" not in sys.argv:
                for p, b in backup.items():
                    p.unlink() if b is None else p.write_bytes(b)
                return self.reply(409, "checks failed, nothing published:\n" + chk.stdout[-1500:], "text/plain")
            subprocess.run([sys.executable, "-I", str(ROOT / "build.py"), "--dev"], check=True, capture_output=True)
            shutil.rmtree(d)
            return self.reply(200, "{}")
        if u.path == "/local/discard":
            shutil.rmtree(DRAFTS / q["n"][0], ignore_errors=True)
            return self.reply(200, "{}")
        return self.reply(404, "no", "text/plain")


if __name__ == "__main__":
    if not SITE.exists():
        sys.exit("run python build.py --dev first")
    # /admin/ and pl.js come from dist/site, so the dashboard and lookup are tested as built
    handler = functools.partial(H, directory=str(SITE))
    print(f"http://127.0.0.1:{PORT}/admin/?local   and   http://127.0.0.1:{PORT}/resources/state-of-ai-jobs-and-skills.html")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
