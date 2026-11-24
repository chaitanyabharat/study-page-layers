# Study.com Page Layers

New looks for Study.com articles, managed outside the site. CMS8 articles carry a single line, and everything else lives here.

```
CMS8 article ── Embed block: <script src="https://YOUR-DOMAIN/pl.js"></script>   (the same line on every page)
                    │
YOUR-DOMAIN/pl.js ──┤  "Is this page listed? Is the kill switch off?"
                    │   no  → nothing happens; the page looks exactly as it does today
                    │   yes → load pages/<page>.<version>.js
                    ▼
pages/<page>.js ──── applies the page's CSS at once, then runs its components when the page is ready
```

## Who does what

| Task | Where | Review |
|---|---|---|
| Turn a page's new look on or off, tick components, change settings or CSS | Dashboard: `YOUR-DOMAIN/admin/` | none; publishes once the automatic checks pass |
| Add a new page | Dashboard → **New page**, then paste the Embed line into the article in CMS8 (once) | none |
| Turn everything off | Dashboard → **Kill switch**, or set `"off": true` in `switch.json` | none |
| New or changed component code (JavaScript) | A pull request on GitHub | a code owner must approve |

Publishing takes a minute or two to deploy. Readers see the change within about 5 minutes, because `pl.js` is cached for 5 minutes.

## What's in the repo

| Path | What it is |
|---|---|
| `page-layers/pages/<id>/` | one folder per page: `page.json` (addresses, status, components, settings) and its CSS |
| `page-layers/components/registry.json` | the component library, with each approved version's fingerprint |
| `css-refresh/components/`, `newui/`, `theme/` | component code, the Display switch, and dark mode |
| `css-refresh/*.css`, `chrome/`, `enhance/` | shared stylesheets |
| `switch.json` | the kill switch |
| `layers.config.json` | your domain, the sites allowed to load the files, and this repo's name |
| `admin/` | the dashboard (one HTML file) |
| `build.py` | builds `dist/site/` (the website to publish) and `dist/cms8/` (the Embed blocks) |
| `.github/workflows/` | checks on every draft; deploys to GitHub Pages or your own server |
| `tools/dev_server.py` | local testing: the dashboard in `?local` mode and a saved copy of the AI report |
| `tools/cms8-update-bookmarklet.js` | one-click swap of the Page Layers block in a CMS8 article (for the no-host option) |

## Run it locally

```bash
pip install -r requirements.txt
python build.py --dev
python tools/dev_server.py
```

Then open http://127.0.0.1:8800/admin/?local for the dashboard. To test `pl.js` end to end, save a copy of an article's HTML as `tools/fixtures/<page-name>.html`, then open it at `http://127.0.0.1:8800/resources/<page-name>.html`. `tools/fixtures/` isn't in the repo, because the repo is public.

First-time setup is in [SETUP.md](SETUP.md).
