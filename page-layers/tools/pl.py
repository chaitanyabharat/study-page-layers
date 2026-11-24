"""Page layers: checks, publishing, history. Shared by the dashboard, the command line and CI.

Layout (all paths relative to page-layers/):
  config.json                  CDN address, size budgets, allowed hosts
  components/registry.json     reviewed JavaScript, with approved hashes
  pages/<id>/page.json         one folder per page: settings plus its own CSS files
  dist/                        what gets uploaded to the CDN
    manifest.json              live pages (short cache)
    draft-manifest.json        live + draft pages, for ?layers=draft previews
    files/...                  content-addressed files (cache forever)
  history/                     every published manifest, for rollback, plus log.jsonl

File references in page.json: "/x/y.css" is relative to the repository root
(ai-jobs-report-share/), anything else is relative to the page's own folder.
"""
import base64, datetime, gzip, hashlib, json, re, shutil, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent          # page-layers/
REPO = HERE.parent                                      # ai-jobs-report-share/
PAGES, DIST, HIST, GOV = HERE / "pages", HERE / "dist", HERE / "history", HERE / "governance"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,80}$")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import scan as scanner
try:
    import rjsmin, rcssmin                               # pure-Python minifiers (pip install rjsmin rcssmin)
except ImportError:                                      # publishing still works, just unminified
    rjsmin = rcssmin = None


def load(p, default=None):
    try: return json.loads(Path(p).read_text(encoding="utf-8"))
    except FileNotFoundError: return default
def dump(p, data):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
def config(): return load(HERE / "config.json", {})
def registry(): return {k: v for k, v in load(HERE / "components" / "registry.json", {}).items() if not k.startswith("_")}

def component_list(page, reg=None):
    """The page's components plus everything they need, in the registry's load order.
    newui (the New look switch) is separate: the loader adds it for switch pages."""
    reg = reg if reg is not None else registry()
    want, todo = set(), list(page.get("components") or [])
    while todo:
        c = todo.pop()
        if c in want or c == "newui": continue
        want.add(c); todo += (reg.get(c) or {}).get("needs", [])
    return [c for c in reg if c in want] + sorted(c for c in want if c not in reg)

def component_bytes(meta):
    """The reviewed content of a component: its script, plus its stylesheet if it has one."""
    b = resolve(meta["file"]).read_bytes()
    if meta.get("css"): b += b"\n/*css*/\n" + resolve(meta["css"]).read_bytes()
    # Line endings don't count: a Windows checkout (\r\n) and a Linux one (\n) must give the same fingerprint.
    return b.replace(b"\r\n", b"\n")

def pages(): return {p.parent.name: load(p) for p in sorted(PAGES.glob("*/page.json"))}

def minify_js(text): return rjsmin.jsmin(text) if rjsmin and config().get("minify", True) else text
def minify_css(text): return rcssmin.cssmin(text) if rcssmin and config().get("minify", True) else text


# ---------------------------------------------------------------- governance
# The rules (governance/policy.json) are signed off once by engineering. People
# (governance/people.json) have roles: engineering, content-reviewer. A component
# goes proposed -> experiment -> reviewed, each step signed by someone who isn't
# its author, after the automatic scanner passes. Pages have a risk tier.
def policy(): return load(GOV / "policy.json", {"rules": {}, "approval": {}})
def people(): return {k: v for k, v in load(GOV / "people.json", {}).items() if not k.startswith("_")}
def roles_of(name): return [r for r, names in people().items() if name in names]
def policy_hash(p=None): return sha256(json.dumps((p or policy())["rules"], sort_keys=True).encode())
def policy_ok():
    a = policy().get("approval") or {}
    return a.get("sha256") == policy_hash() and "engineering" in roles_of(a.get("by", ""))
def approve_policy(by):
    if "engineering" not in roles_of(by): return False, f"{by or 'unknown'} isn't in engineering (governance/people.json)"
    data = policy(); data["approval"] = {"by": by, "on": now()[:10], "sha256": policy_hash(data)}
    dump(GOV / "policy.json", data); log("policy sign-off", by, "", None); return True, data["approval"]

def page_tier(page):
    """'high' if most readers are signed in (audience: members) or a path is in a member area."""
    if (page or {}).get("audience") == "members": return "high"
    pats = policy()["rules"].get("tiers", {}).get("high_paths", [])
    return "high" if any(re.search(p, path, re.I) for p in pats for path in (page or {}).get("paths") or []) else "low"

def scan_component(meta):
    return scanner.scan(resolve(meta["file"]).read_text(encoding="utf-8"), policy()["rules"], meta.get("allow"))

def _today(): return datetime.date.today()
def experiment_live(meta):
    until = (meta.get("experiment") or {}).get("until")
    return bool(until) and _today().isoformat() <= until

def propose(cid, file, by, about="", css=None, needs=None):
    """Add a new component to the library as 'proposed'. It does nothing until reviewed."""
    if not ID_RE.match(cid): return False, "component id: lowercase letters, digits and dashes"
    regf = HERE / "components" / "registry.json"; data = load(regf)
    if cid in data: return False, f"'{cid}' already exists"
    meta = {"file": file, "about": about, "author": by, "status": "proposed", "proposed_on": now()[:10]}
    if css: meta["css"] = css
    if needs: meta["needs"] = needs
    if not resolve(file).exists(): return False, f"file not found: {file}"
    data[cid] = meta; dump(regf, data); log("component proposed", by, about, None, cid)
    return True, {"scan": scan_component(meta)}

def approve(component, by, stage="reviewed", note=""):
    """Sign off a component at a stage: 'experiment' (runs for a sample of readers on
    low-risk pages until it expires) or 'reviewed' (available to everyone).
    Returns (ok, meta-or-reasons)."""
    if not policy_ok(): return False, ["the rules (governance/policy.json) changed without engineering sign-off"]
    regf = HERE / "components" / "registry.json"; data = load(regf)
    if component not in data: return False, [f"no component '{component}'"]
    meta = data[component]; roles = roles_of(by); rules = policy()["rules"]
    reasons = []
    if not roles: reasons.append(f"{by or 'unknown'} isn't a reviewer (governance/people.json)")
    if rules.get("review", {}).get("two_people", True) and meta.get("author") and meta.get("author") == by:
        reasons.append("the author can't review their own component; ask another reviewer")
    if meta.get("allow") and "engineering" not in roles:
        reasons.append("this component has exceptions to the rules (" + ", ".join(meta["allow"]) + "); exceptions need engineering")
    found = scan_component(meta)
    errs = [f for f in found if f[0] == "error"]
    reasons += [f"scanner: {m}" for _, _, m, _ in errs]
    if stage not in ("experiment", "reviewed"): reasons.append("stage must be 'experiment' or 'reviewed'")
    if reasons: return False, reasons
    b = component_bytes(meta)
    meta.update(sha256=sha256(b), reviewed_by=by, review_role="engineering" if "engineering" in roles else "content-reviewer",
                engineering="engineering" in roles, reviewed_on=now()[:10], size_kb_gzip=gz_kb(b), status=stage,
                scan=scanner.summary(found), acknowledged=[f"{r} line {ln}" for lvl, r, _, ln in found if lvl == "warn"])
    if note: meta["review_note"] = note
    if stage == "experiment":
        meta["experiment"] = {"until": (_today() + datetime.timedelta(days=int(rules.get("experiment", {}).get("max_days", 30)))).isoformat()}
    else:
        meta.pop("experiment", None)
    dump(regf, data); log(f"component {stage}", by, note, None, component)
    return True, meta
def now(): return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
def resolve(ref, page_id=None):
    return (REPO / ref.lstrip("/")) if ref.startswith("/") else (PAGES / page_id / ref)
def sha256(b): return hashlib.sha256(b).hexdigest()
def sri(b): return "sha384-" + base64.b64encode(hashlib.sha384(b).digest()).decode()
def gz_kb(b): return round(len(gzip.compress(b, 9)) / 1024, 1)


# ---------------------------------------------------------------- CSS lint
def _strip_comments(css): return re.sub(r"/\*.*?\*/", "", css, flags=re.S)

def css_rules(css):
    """Yield (selector_text, at_context, line) for every style rule, walking into @media/@supports/@layer/@container."""
    css = _strip_comments(css)
    out, i, n = [], 0, len(css)
    def walk(start, end, ctx):
        j = start
        while j < end:
            k = css.find("{", j, end)
            if k < 0: break
            head = css[j:k].strip()
            semi = head.rfind(";")                          # statements like @charset; before the block
            if semi >= 0:
                for stmt in head[:semi].split(";"):
                    if stmt.strip(): out.append((stmt.strip(), ctx + ["@stmt"], css.count("\n", 0, j) + 1))
                head = head[semi + 1:].strip()
            depth, m = 1, k + 1
            while m < end and depth:
                if css[m] == "{": depth += 1
                elif css[m] == "}": depth -= 1
                m += 1
            line = css.count("\n", 0, k) + 1
            if head.startswith("@"):
                name = head.split()[0].lower()
                if name in ("@media", "@supports", "@layer", "@container", "@scope", "@document"): walk(k + 1, m - 1, ctx + [head])
                else: out.append((head, ctx + [name], line))   # @keyframes, @font-face, @property, @page...
            else:
                out.append((head, ctx, line))
            j = m
        tail = css[j:end].strip()
        for stmt in tail.split(";"):
            if stmt.strip().startswith("@"): out.append((stmt.strip(), ctx + ["@stmt"], css.count("\n", 0, j) + 1))
    walk(0, n, [])
    return out

def split_selectors(sel):
    parts, depth, cur = [], 0, ""
    for ch in sel:
        if ch in "([": depth += 1
        elif ch in ")]": depth -= 1
        if ch == "," and depth == 0: parts.append(cur.strip()); cur = ""
        else: cur += ch
    if cur.strip(): parts.append(cur.strip())
    return parts

ROOT_ONLY = re.compile(r"^html(?:[.#\[:][^\s>+~]*)?$")    # html, html.x, html[data-x], html:has(...) with no descendant

def is_scoped(sel, scope):
    """The selector names the page scope: literally (body#x), or in a list of body ids shared by
    several templates, body:is(#x, #y). A page has one body id, so the list can only match this page."""
    if scope in sel: return True
    if not scope.startswith("body#"): return False
    for m in re.finditer(r"\bbody:is\(([^()]*)\)", sel):
        ids = [x.strip() for x in m.group(1).split(",")]
        if scope[4:] in ids and all(re.fullmatch(r"#[\w-]+", x) for x in ids): return True
    return False

def lint_css(text, scope, cfg, name):
    issues = []
    hosts = set(cfg.get("allowed_url_hosts", []))
    for head, ctx, line in css_rules(text):
        if "@stmt" in ctx:
            if head.lower().startswith("@import"):
                m = re.search(r"(?:url\(\s*)?['\"]?((?:https?:)?//[^'\")\s]+)", head)
                host = re.sub(r"^(https?:)?//", "", m.group(1)).split("/")[0].lower() if m else ""
                if host not in hosts: issues.append(("error", f"{name}:{line} @import of {m.group(1)[:60] if m else 'a relative file'} isn't allowed. Only allowed hosts (fonts) may be imported; paste other CSS in instead."))
            continue
        if any(c in ("@keyframes", "@-webkit-keyframes", "@font-face", "@property", "@counter-style", "@page", "@font-feature-values") for c in ctx[-1:]):
            continue
        for s in split_selectors(head):
            if is_scoped(s, scope): continue
            if ROOT_ONLY.match(s):
                issues.append(("warn", f"{name}:{line} '{s}' styles the page root without the page scope. Fine for page states (classes set by the page's own scripts); check it can't affect other pages."))
                continue
            issues.append(("error", f"{name}:{line} '{s[:80]}' is not scoped. Every selector must include {scope}, so the CSS can't change other pages or the site header elsewhere."))
    body = _strip_comments(text)
    for m in re.finditer(r"url\(\s*['\"]?([^'\")]+)", body):
        u = m.group(1).strip()
        if u.startswith(("data:", "#")) or not re.match(r"^(https?:)?//", u): continue
        host = re.sub(r"^(https?:)?//", "", u).split("/")[0].lower()
        if host not in hosts: issues.append(("error", f"{name}: url({u[:60]}) loads from {host}, which isn't on the allowed list"))
    if re.search(r"expression\s*\(|javascript:|(?<![-\w])behavior\s*:|-moz-binding", body, re.I): issues.append(("error", f"{name}: contains script-like CSS (expression(), javascript: or behavior:)"))
    imp = body.count("!important")
    if imp > cfg.get("max_important", 40): issues.append(("warn", f"{name}: {imp} uses of !important; above {cfg.get('max_important', 40)} usually means the CSS is fighting itself"))
    return issues


# ---------------------------------------------------------------- page checks
def check_page(pid, page=None, all_pages=None):
    """Return a list of (level, message). Any 'error' blocks publishing."""
    cfg, reg = config(), registry()
    page = page if page is not None else load(PAGES / pid / "page.json")
    all_pages = all_pages if all_pages is not None else pages()
    out = []
    if not page: return [("error", f"page {pid} not found")]
    if not ID_RE.match(page.get("id", "")) or page.get("id") != pid: out.append(("error", "id must be lowercase letters, digits and dashes, and match the folder name"))
    paths = page.get("paths") or []
    if not paths: out.append(("error", "add at least one page address, like /resources/my-article.html"))
    for p in paths:
        if not re.match(r"^/[^\s?#]*$", p): out.append(("error", f"'{p}' should be a path only, starting with / (no domain, no ?query)"))
        if re.search(cfg.get("exclude_paths", "$^"), p, re.I): out.append(("error", f"'{p}' is a sign-in, checkout or account page; layers never run there"))
        for oid, op in all_pages.items():
            if oid != pid and op and op.get("status") != "off" and p in (op.get("paths") or []):
                out.append(("error", f"'{p}' is already used by page '{oid}'"))
    scope = (page.get("scope") or "").strip()
    if not scope: out.append(("error", "set a scope selector, like body#promoArticleMain or body.page-my-article"))
    css_bytes = b""
    for ref in page.get("css") or []:
        f = resolve(ref, pid)
        if not f.exists(): out.append(("error", f"CSS file not found: {ref}")); continue
        b = f.read_bytes(); css_bytes += b
        if scope: out += lint_css(b.decode("utf-8", "replace"), scope, cfg, f.name)
    comps = component_list(page, reg)
    if page.get("newLookSwitch"): comps = ["newui"] + comps
    if not policy_ok(): out.append(("error", "the rules (governance/policy.json) changed without engineering sign-off; nothing can publish until they're signed off"))
    tier, exp_rules = page_tier(page), policy()["rules"].get("experiment", {})
    out.append(("info", f"risk tier: {tier}" + (" (members, or a member-area address): only engineering-signed components" if tier == "high" else "")))
    js_text, css_text = "", ""
    for c in comps:
        meta = reg.get(c)
        if not meta: out.append(("error", f"component '{c}' isn't in the library")); continue
        missing = [k for k in ("file", "css") if meta.get(k) and not resolve(meta[k]).exists()]
        if missing: out.append(("error", f"component '{c}' file missing: {', '.join(meta[k] for k in missing)}")); continue
        js_text += minify_js(resolve(meta["file"]).read_text(encoding="utf-8")) + "\n"
        if meta.get("css"): css_text += minify_css(resolve(meta["css"]).read_text(encoding="utf-8")) + "\n"
        st = meta.get("status", "reviewed")
        if not meta.get("sha256") or st == "proposed": out.append(("error", f"component '{c}' hasn't been reviewed yet")); continue
        if sha256(component_bytes(meta)) != meta["sha256"]: out.append(("error", f"component '{c}' changed since it was reviewed; it needs a new review"))
        if tier == "high" and not meta.get("engineering"): out.append(("error", f"component '{c}' isn't signed off by engineering, which high-risk pages need"))
        if st == "experiment":
            until = (meta.get("experiment") or {}).get("until", "")
            if tier not in exp_rules.get("tiers", ["low"]): out.append(("error", f"component '{c}' is an experiment; experiments don't run on {tier}-risk pages"))
            elif not experiment_live(meta): out.append(("error", f"the experiment for '{c}' ended on {until}: promote it (review it as 'reviewed') or switch it off"))
            else: out.append(("info", f"'{c}' runs as an experiment for {round(experiment_share(page) * 100)}% of readers until {until}"))
            for other in comps:
                if c in (reg.get(other) or {}).get("needs", []) and (reg.get(other) or {}).get("status", "reviewed") != "experiment":
                    out.append(("error", f"'{other}' needs '{c}', which is still an experiment"))
    css_bytes = minify_css(css_bytes.decode("utf-8", "replace")).encode() + css_text.encode()
    js_bytes = js_text.encode()
    st = page.get("settings")
    if st is not None and not isinstance(st, dict): out.append(("error", "settings must be an object"))
    elif st and len(json.dumps(st)) > 8000: out.append(("warn", "settings are large; they travel in the manifest, so keep them short"))
    di = page.get("darkImages")
    if di:
        if not resolve(di["manifest"], pid).exists(): out.append(("error", f"dark-image manifest not found: {di['manifest']}"))
        if "dark-images" not in comps: out.append(("warn", "dark images are set up but the dark-images component is off"))
    b = cfg.get("budgets_kb_gzip", {})
    ck, jk = gz_kb(css_bytes) if css_bytes else 0, gz_kb(js_bytes) if js_bytes else 0
    if ck > b.get("css", 24): out.append(("error", f"CSS is {ck} KB gzipped; the budget is {b.get('css')} KB"))
    if jk > b.get("js", 30): out.append(("error", f"JavaScript is {jk} KB gzipped; the budget is {b.get('js')} KB"))
    out.append(("info", f"size: CSS {ck} KB, JavaScript {jk} KB (minified, gzipped)"))
    return out

def experiment_share(page):
    cap = float(policy()["rules"].get("experiment", {}).get("max_share", 0.2))
    return min(cap, float((page or {}).get("experimentShare", cap)))

def has_errors(issues): return any(l == "error" for l, _ in issues)


# ---------------------------------------------------------------- publishing
def _put(data, name, files_dir, cdn):
    """Store a file under its content hash; return [url, integrity]."""
    h = sha256(data)[:12]
    stem, dot, ext = name.rpartition(".")
    fn = f"{stem or name}.{h}.{ext}" if dot else f"{name}.{h}"
    (files_dir / fn).write_bytes(data)
    return [cdn + "files/" + fn, sri(data)]

def _wrap(name, code):
    """One component inside a bundle: a failure at load time stops only that component."""
    return f"/* {name} */\ntry{{\n{code}\n}}catch(e){{console.warn('[page-layers] {name} failed:',e)}}\n"

def build_entry(pid, page, files_dir, cdn, version):
    cfg, reg = config(), registry()
    bundle = cfg.get("bundle", True)
    comps = component_list(page, reg)
    main = [c for c in comps if reg[c].get("status", "reviewed") == "reviewed"]
    exp = [c for c in comps if reg[c].get("status") == "experiment" and experiment_live(reg[c]) and page_tier(page) == "low"]
    text = lambda ref: resolve(ref, pid).read_text(encoding="utf-8")
    def css_files(names):
        parts = [minify_css(text(reg[c]["css"])) for c in names if reg[c].get("css")]
        if not parts: return []
        if bundle: return [_put("\n".join(parts).encode(), "components.css", files_dir, cdn)]
        return [_put(minify_css(text(reg[c]["css"])).encode(), resolve(reg[c]["css"]).name, files_dir, cdn) for c in names if reg[c].get("css")]
    def js_files(names):
        if not names: return []
        if bundle: return [_put("".join(_wrap(c, minify_js(text(reg[c]["file"]))) for c in names).encode(), "components.js", files_dir, cdn)]
        return [_put(minify_js(text(reg[c]["file"])).encode(), resolve(reg[c]["file"]).name, files_dir, cdn) for c in names]
    # component styles first, so the page's own CSS can refine them
    css = css_files(main) + [_put(minify_css(text(r)).encode(), resolve(r, pid).name, files_dir, cdn) for r in page.get("css") or []]
    js = []
    di = page.get("darkImages")
    if di:                                               # dark images: a small config script, plus the prepared files
        dm = load(resolve(di["manifest"], pid), {"images": {}})
        dm.setdefault("images", {}).update(di.get("extra") or {})
        folder = resolve(di.get("folder", ""), pid) if di.get("folder") else None
        dark_base = ""
        if folder and folder.is_dir():
            digest = sha256(b"".join(sorted(f.read_bytes() for f in folder.iterdir() if f.is_file())))[:12]
            target = files_dir / f"{pid}-dark-{digest}" / "assets" / "dark"
            if not target.exists():
                target.mkdir(parents=True)
                for f in folder.iterdir():
                    if f.is_file(): shutil.copy2(f, target / f.name)
            dark_base = cdn + "files/" + f"{pid}-dark-{digest}/"
        recolor = reg.get("recolor")
        worker_src = _put(minify_js(text(recolor["file"])).encode(), resolve(recolor["file"]).name, files_dir, cdn)[0] if recolor else None
        cfg_js = ("(function(c){c.darkManifest=%s;c.darkBase=%s;%s})(window.STUDY_NEW_UI=window.STUDY_NEW_UI||{});"
                  % (json.dumps(dm, separators=(",", ":")), json.dumps(dark_base), ("c.recolorUrl=%s;" % json.dumps(worker_src)) if worker_src else ""))
        js.append(_put(cfg_js.encode(), f"{pid}-config.js", files_dir, cdn))
    js += js_files(main)
    entry = {"i": pid, "v": version, "s": 1 if page.get("newLookSwitch") else 0, "c": css, "j": js}
    if page.get("settings"): entry["g"] = page["settings"]          # becomes window.STUDY_PAGE, before anything runs
    if exp:                                                          # experiments: a sample of readers, until the earliest end date
        entry["x"] = {"id": "+".join(exp), "until": min(reg[c]["experiment"]["until"] for c in exp), "share": experiment_share(page),
                      "c": css_files(exp), "j": js_files(exp)}
    if page.get("newLookSwitch"):
        entry["u"] = _put(minify_js(text(reg["newui"]["file"])).encode(), resolve(reg["newui"]["file"]).name, files_dir, cdn)
    return entry

def publish(by="", note="", action="publish", page_id=""):
    """Check every live or draft page, then write dist/. Returns (ok, report)."""
    cfg, allp = config(), pages()
    cdn = cfg.get("cdn_base", "/cdn/")
    report, blocked = {}, False
    for pid, page in allp.items():
        if page.get("status") in ("live", "draft"):
            issues = check_page(pid, page, allp); report[pid] = issues
            if has_errors(issues) and page.get("status") == "live": blocked = True
    if blocked: return False, report
    prev = load(DIST / "manifest.json", {"v": 0})
    version = int(prev.get("v", 0)) + 1
    files_dir = DIST / "files"; files_dir.mkdir(parents=True, exist_ok=True)
    live, draft = {}, {}
    for pid, page in allp.items():
        st = page.get("status")
        if st not in ("live", "draft") or has_errors(report.get(pid, [])): continue
        entry = build_entry(pid, page, files_dir, cdn, version)
        for p in page.get("paths") or []:
            draft[p] = entry
            if st == "live": live[p] = entry
    kill = load(DIST / "manifest.json", {}).get("off", False)
    man = {"v": version, "built": now(), "off": kill, "pages": live}
    dump(DIST / "manifest.json", man)
    dump(DIST / "draft-manifest.json", {"v": version, "built": man["built"], "off": False, "pages": draft})
    dump(HIST / f"{version:05d}.json", man)
    log(action, by, note, version, page_id)
    return True, report

def rollback(version, by="", note=""):
    old = load(HIST / f"{int(version):05d}.json")
    if not old: return False, f"version {version} not found"
    cur = load(DIST / "manifest.json", {"v": 0})
    v = int(cur.get("v", 0)) + 1
    man = dict(old, v=v, built=now(), off=cur.get("off", False))
    dump(DIST / "manifest.json", man); dump(HIST / f"{v:05d}.json", man)
    log("rollback", by, note or f"back to version {version}", v)
    return True, v

def set_kill(off, by="", note=""):
    man = load(DIST / "manifest.json", {"v": 0, "pages": {}})
    man["off"] = bool(off); man["v"] = int(man.get("v", 0)) + 1; man["built"] = now()
    dump(DIST / "manifest.json", man); dump(HIST / f"{man['v']:05d}.json", man)
    log("kill switch on" if off else "kill switch off", by, note, man["v"])
    return man["v"]

def log(action, by, note, version, page_id=""):
    HIST.mkdir(parents=True, exist_ok=True)
    with open(HIST / "log.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps({"at": now(), "action": action, "by": by or "unknown", "page": page_id, "version": version, "note": note}) + "\n")

def history(limit=50):
    f = HIST / "log.jsonl"
    if not f.exists(): return []
    return [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()][-limit:][::-1]



def snippet():
    cfg = config()
    src = (HERE / "loader" / "loader.min.js").read_text(encoding="utf-8")
    conf = {"manifest": cfg.get("cdn_base", "/cdn/") + "manifest.json", "ttl": cfg.get("manifest_ttl_seconds", 300), "exclude": cfg.get("exclude_paths")}
    return f"<script>window.PAGE_LAYERS={json.dumps(conf, separators=(',', ':'))};{src}</script>"
