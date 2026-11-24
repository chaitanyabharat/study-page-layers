"""The automatic scanner for page-layer JavaScript.

It reads a component's script and reports findings by rule. Errors block review;
warnings are things a person must look at and acknowledge. A component can carry
named exceptions ("allow": {"rule": "reason"}) when it genuinely needs something,
like the New look loader adding scripts; exceptions need engineering sign-off.

It is a safety net, not a proof: it catches the dangerous patterns a reviewer
might miss, so the person reviewing can focus on what the code is for.
"""
import gzip, re

RULES = {
    # rule id: (level, what it means)
    "eval": ("error", "runs text as code (eval, new Function, or a string passed to setTimeout/setInterval)"),
    "cookie": ("error", "reads or writes cookies, where sign-in sessions live"),
    "document-write": ("error", "uses document.write"),
    "password": ("error", "touches password fields"),
    "form-submit": ("error", "listens to or triggers form submissions"),
    "host": ("error", "contacts or loads from a host that isn't on the allowed list"),
    "storage-key": ("error", "uses a browser-storage key outside the agreed prefixes"),
    "script-injection": ("error", "adds <script> elements to the page"),
    "postmessage-any": ("error", "sends messages to any window ('*')"),
    "size": ("error", "is over the size limit for one component"),
    "network-dynamic": ("warn", "makes a network request to an address built at run time; check where it can point"),
    "storage-dynamic": ("warn", "uses a browser-storage key built at run time; check it keeps the agreed prefix"),
    "html-dynamic": ("warn", "writes HTML built at run time (innerHTML); check no reader- or URL-supplied text reaches it"),
    "navigation": ("warn", "changes the page address or opens windows; check it only goes where intended"),
    "worker": ("warn", "starts a background worker; check what it runs"),
    "key-capture": ("warn", "listens to key presses page-wide; check it doesn't record what people type"),
}

def _strip_comments(js):
    """Remove comments but keep strings, so line numbers and string contents survive."""
    out, i, n, q = [], 0, len(js), None
    while i < n:
        c = js[i]
        if q:
            out.append(c)
            if c == "\\" and i + 1 < n: out.append(js[i + 1]); i += 2; continue
            if c == q: q = None
            i += 1; continue
        if c in "'\"`": q = c; out.append(c); i += 1; continue
        if js.startswith("//", i) and (i == 0 or js[i - 1] not in ":\\"):
            j = js.find("\n", i); i = n if j < 0 else j; continue
        if js.startswith("/*", i):
            j = js.find("*/", i + 2); seg = js[i:(n if j < 0 else j + 2)]
            out.append("\n" * seg.count("\n")); i = n if j < 0 else j + 2; continue
        out.append(c); i += 1
    return "".join(out)

def _host_ok(host, allowed):
    host = host.lower()
    return any(host == a or (a.startswith("*.") and (host == a[2:] or host.endswith(a[1:]))) for a in allowed)

def scan(js_text, policy_rules, allow=None):
    """Return [(level, rule, message, line)] for one script."""
    allow = allow or {}
    src = _strip_comments(js_text)
    lines = src.split("\n")
    found = []
    def add(rule, line, detail=""):
        level, meaning = RULES[rule]
        if rule in allow:
            found.append(("info", rule, f"line {line}: {meaning} - allowed by exception: {allow[rule]}", line))
        else:
            found.append((level, rule, f"line {line}: {meaning}" + (f" ({detail})" if detail else ""), line))
    hosts = policy_rules.get("allowed_hosts", [])
    prefixes = tuple(policy_rules.get("storage_prefixes", []))
    for no, ln in enumerate(lines, 1):
        if re.search(r"(?<![\w$.])eval\s*\(|new\s+Function\s*\(|set(?:Timeout|Interval)\s*\(\s*['\"`]", ln): add("eval", no)
        if re.search(r"document\s*\.\s*cookie", ln): add("cookie", no)
        if re.search(r"document\s*\.\s*write(?:ln)?\s*\(", ln): add("document-write", no)
        if re.search(r"type\s*=\s*\\?['\"]?password|\[type=['\"]?password|\.type\s*===?\s*['\"]password", ln, re.I): add("password", no)
        if re.search(r"addEventListener\s*\(\s*['\"]submit['\"]|\.\s*(?:submit|requestSubmit)\s*\(\s*\)", ln): add("form-submit", no)
        if re.search(r"createElement\s*\(\s*['\"]script['\"]", ln): add("script-injection", no)
        if re.search(r"postMessage\s*\([^)]*,\s*['\"]\*['\"]", ln): add("postmessage-any", no)
        for m in re.finditer(r"['\"`](?:https?:)?//([a-z0-9.-]+\.[a-z]{2,})", ln, re.I):
            if not _host_ok(m.group(1), hosts): add("host", no, m.group(1))
        for m in re.finditer(r"(?<![\w$])(?:fetch|navigator\s*\.\s*sendBeacon|new\s+(?:WebSocket|EventSource))\s*\(\s*([^,)]*)", ln):
            arg = m.group(1).strip()
            if not re.match(r"^(['\"`])[^'\"`]*\1$", arg) or "${" in arg: add("network-dynamic", no, arg[:40])   # only a single fixed string counts as fixed
        if re.search(r"new\s+XMLHttpRequest|(?<![\w$.])import\s*\(", ln): add("network-dynamic", no, "XMLHttpRequest / import()")
        for m in re.finditer(r"(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*([^,)]+)", ln):
            arg = m.group(1).strip()
            lit = re.match(r"^['\"`]([^'\"`$]*)['\"`]$", arg)
            if lit:
                if not lit.group(1).startswith(prefixes): add("storage-key", no, lit.group(1))
            else: add("storage-dynamic", no, arg[:40])
        for m in re.finditer(r"\.\s*(?:innerHTML|outerHTML)\s*\+?=\s*([^;]+)|insertAdjacentHTML\s*\(([^;]+)", ln):
            val = (m.group(1) or m.group(2) or "").strip()
            if not re.match(r"^(['\"])[^'\"]*\1\s*;?$", val): add("html-dynamic", no)
        if re.search(r"(?<![\w$])location\s*\.\s*(?:href\s*=(?!=)|assign\s*\(|replace\s*\()|(?<![\w$.])location\s*=(?!=)|window\s*\.\s*open\s*\(", ln): add("navigation", no)
        if re.search(r"new\s+(?:Shared)?Worker\s*\(", ln): add("worker", no)
        if re.search(r"(?:document|window|doc)\s*\.\s*addEventListener\s*\(\s*['\"]key(?:down|press|up)['\"]", ln): add("key-capture", no)
    kb = round(len(gzip.compress(js_text.encode("utf-8"), 9)) / 1024, 1)
    if kb > policy_rules.get("max_component_kb_gzip", 8): add("size", 1, f"{kb} KB gzipped, limit {policy_rules.get('max_component_kb_gzip')} KB")
    return found

def summary(found):
    return {lvl: sum(1 for f in found if f[0] == lvl) for lvl in ("error", "warn", "info")}
