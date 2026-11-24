"""Page layers from the command line (the same actions as the dashboard; CI uses these).

Pages
  python tools/cli.py check [page-id]               run the checks (all pages if no id); exit 1 on errors
  python tools/cli.py publish --by NAME [--note TEXT]
  python tools/cli.py rollback VERSION --by NAME
  python tools/cli.py kill on|off --by NAME
  python tools/cli.py history
  python tools/cli.py snippet                       print the <head> snippet for the site template
  python tools/cli.py markup [page-id] [--html FILE | --url URL]
                                                    does the page's HTML still have what its CSS and settings rely on?

Components (governance/REVIEW.md explains the process)
  python tools/cli.py scan COMPONENT                run the automatic scanner and show every finding
  python tools/cli.py propose ID --file /path.js [--css /path.css] [--needs a,b] --by AUTHOR --note "what it does"
  python tools/cli.py approve ID --stage experiment|reviewed --by REVIEWER [--note TEXT]
  python tools/cli.py components                    the library: status, who reviewed, experiments and their end dates
  python tools/cli.py policy-approve --by ENGINEER  sign off the rules in governance/policy.json
"""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pl

def show(pid, issues):
    print(f"\n{pid}")
    for lvl, msg in issues: print(f"  {lvl.upper():5} {msg}")

a = argparse.ArgumentParser(); sub = a.add_subparsers(dest="cmd", required=True)
c = sub.add_parser("check"); c.add_argument("page", nargs="?")
for name in ("publish", "approve", "rollback", "kill", "propose", "policy-approve"):
    s = sub.add_parser(name); s.add_argument("--by", default=""); s.add_argument("--note", default="")
    if name in ("approve", "propose"): s.add_argument("component")
    if name == "approve": s.add_argument("--stage", default="reviewed", choices=["experiment", "reviewed"])
    if name == "propose": s.add_argument("--file", required=True); s.add_argument("--css"); s.add_argument("--needs", default="")
    if name == "rollback": s.add_argument("version", type=int)
    if name == "kill": s.add_argument("state", choices=["on", "off"])
s = sub.add_parser("scan"); s.add_argument("component")
s = sub.add_parser("markup"); s.add_argument("page", nargs="?"); s.add_argument("--html"); s.add_argument("--url")
sub.add_parser("history"); sub.add_parser("snippet"); sub.add_parser("components")
o = a.parse_args()

if o.cmd == "check":
    allp = pl.pages(); bad = False
    for pid in ([o.page] if o.page else allp):
        issues = pl.check_page(pid, allp.get(pid), allp); show(pid, issues); bad |= pl.has_errors(issues)
    sys.exit(1 if bad else 0)
elif o.cmd == "publish":
    ok, rep = pl.publish(o.by, o.note)
    for pid, issues in rep.items(): show(pid, issues)
    print("\npublished" if ok else "\nnot published: fix the errors above"); sys.exit(0 if ok else 1)
elif o.cmd == "scan":
    meta = pl.registry().get(o.component)
    if not meta: sys.exit(f"no component '{o.component}'")
    found = pl.scan_component(meta)
    for lvl, rule, msg, _ in found: print(f"  {lvl.upper():5} [{rule}] {msg}")
    print(" ", pl.scanner.summary(found)); sys.exit(1 if any(f[0] == "error" for f in found) else 0)
elif o.cmd == "propose":
    ok, res = pl.propose(o.component, o.file, o.by, o.note, o.css, [n for n in o.needs.split(",") if n])
    if not ok: sys.exit(res)
    for lvl, rule, msg, _ in res["scan"]: print(f"  {lvl.upper():5} [{rule}] {msg}")
    print(f"proposed '{o.component}'. Next: a reviewer who isn't {o.by} runs: approve {o.component} --stage experiment --by NAME")
elif o.cmd == "approve":
    ok, res = pl.approve(o.component, o.by, o.stage, o.note)
    if not ok: print("not approved:"); [print("  -", r) for r in res]; sys.exit(1)
    print(f"'{o.component}' is now {res['status']}" + (f" until {res['experiment']['until']}" if res.get("experiment") else "") + f" (signed by {res['reviewed_by']}, {res['review_role']})")
    if res.get("acknowledged"): print("  warnings acknowledged:", ", ".join(res["acknowledged"]))
elif o.cmd == "components":
    for cid, m in pl.registry().items():
        exp = f" until {m['experiment']['until']}" if m.get("experiment") else ""
        print(f"  {cid:16} {m.get('status', 'reviewed'):10}{exp:17} {'engineering' if m.get('engineering') else (m.get('review_role') or '-'):16} {m.get('reviewed_by', '-')}")
elif o.cmd == "policy-approve":
    ok, res = pl.approve_policy(o.by); print(res if ok else f"not signed: {res}"); sys.exit(0 if ok else 1)
elif o.cmd == "rollback":
    print(pl.rollback(o.version, o.by, o.note))
elif o.cmd == "kill":
    print("version", pl.set_kill(o.state == "on", o.by, o.note))
elif o.cmd == "history":
    for h in pl.history(): print(h)
elif o.cmd == "markup":
    import markup
    bad = False
    for pid, page in pl.pages().items():
        if o.page and pid != o.page: continue
        if not page.get("expects") and not o.page: continue
        src = o.html or (str(pl.REPO / "css-refresh" / "preview" / "site" / "page.html") if not o.url else None)
        res = markup.check(page, html=src, url=o.url)
        print(f"\n{pid}  ({o.url or src})"); [print("  " + l) for l in markup.report(res)]
        bad |= not all(r["ok"] for r in res)
    print("\nmarkup check: " + ("FAILED - the page's HTML changed; update the page CSS or settings" if bad else "all expectations met")); sys.exit(1 if bad else 0)
elif o.cmd == "snippet":
    print(pl.snippet())
