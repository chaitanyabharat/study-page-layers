> **In this repository:** the publishing flow is the top-level `README.md` and `SETUP.md`: the dashboard is `admin/`, the build is `build.py`, and the checks run in GitHub Actions. The governance rules below (reviews, scanner, budgets, risk tiers) still apply through `page-layers/tools/cli.py`. The local web dashboard, loader and CDN steps described below belong to the original prototype and aren't included here.

# Page layers: page-level CSS and JavaScript the content team can publish

This prototype lets the content team give any page a "fresh coat of paint" without a site deploy.

- **Engineering, once:** one snippet in the site template's `<head>`, a CDN folder, and the CDN host allowed in the site's security policy (CSP).
- **Content team, every time:** pick a page, upload its CSS, switch on reviewed components, preview, publish, roll back.

## How it works

1. Every page carries a tiny inline loader (`loader/loader.min.js`, 2.6 KB, 1.3 KB gzipped).
2. The loader looks up the page's path in one cached manifest file.
3. If the page is listed, the loader adds that page's stylesheets and scripts from the CDN. Each file carries an integrity hash.
4. If the page isn't listed, nothing else happens.

**Speed for readers:**
- **Returning readers** use the manifest kept from their last visit, so the styles apply before the first paint, with no flash. A fresh copy is fetched in the background at most every 5 minutes.
- **First visit:** the manifest is fetched. If it hasn't arrived within 1.5 seconds, the page stays as it is.
- **File caching:** every file name contains its content hash, so files are cached for a year and shared between pages.

**Safety:**
- **Integrity hashes:** the browser refuses any file that was altered.
- **Never on sensitive pages:** layers never run on sign-in, checkout or account pages.
- **Off switches:** `?layers=off` turns layers off for one page view. The dashboard's kill switch turns them off everywhere within 5 minutes.
- **CSS must be scoped:** every rule has to include the page's scope selector (for example `body#promoArticleMain`), so it can't change other pages.
- **JavaScript comes only from a reviewed library** (`components/registry.json`), pinned to approved hashes. Changing a component file blocks publishing until it's approved again.
- **Size budgets** per page: 24 KB of CSS and 30 KB of JavaScript, gzipped.

## Components and page settings

The reviewed library has 15 components: the New look switch, chart recolor, dark images, a shared core, and 11 small enhancement components. They're listed in `components/registry.json`; the table in `css-refresh/README.md` ("Reusable components") covers what each does and its settings.

- **One switch per component.** A page turns on the components it wants. Anything they need, such as the core, is added automatically, in the right order.
- **One approval covers both files.** Each component's approved hash covers its script and its stylesheet.
- **Page settings.** Anything page-specific goes in `settings` in `page.json`: which heading is the summary, what the cover chart shows, a label. It travels in the manifest and becomes `window.STUDY_PAGE` before any component runs. The content team edits settings, not code.
- **Shared caching.** Component files are content-hashed and shared, so a reader who visits several pages downloads each component once.

## Who can publish what (governance)

| What | Who | How |
|---|---|---|
| CSS, settings, which components a page uses, previews, publishing, rollback, kill switch | Content team | Dashboard, with the checks |
| New JavaScript | Proposed by anyone in the content team; signed off by a different person | Scanner, then a reviewer: experiment, then reviewed |
| Exceptions to the rules; components for high-risk pages | Engineering | Same flow, signed by engineering |
| The rules themselves (`governance/policy.json`) and who can review (`governance/people.json`) | Engineering, once | `cli.py policy-approve`. Any change to the rules without a new sign-off stops all approvals and publishing. |

- **The scanner** (`tools/scan.py`) blocks:
  - code that runs text as code
  - reading cookies
  - password fields
  - form submissions
  - hosts that aren't allowed
  - storage keys outside the agreed prefixes
  - adding scripts
  - messages to any window
  - `document.write`
  - components over 8 KB

  It also flags, for a person to check, HTML, addresses or storage keys built at run time, plus navigation, workers and page-wide key listeners.
- **Risk tiers:**
  - **High:** a page whose audience is "members", or whose address is in a member area (`tiers.high_paths`). It only uses components engineering has signed off, and experiments never run there.
  - **Low:** everything else.
- **Experiments:**
  - **Who gets them:** a fixed random share of readers, up to 20%, on low-risk pages. Each reader's random number is kept in local storage. `?layers=exp` shows the experiment for QA.
  - **When they stop:** at their end date, at most 30 days after approval, even from a cached manifest. An ended experiment blocks publishing until it's promoted or switched off.
  - **In production,** the remspect assignment can replace the random number.
- **Reviewer checklist:** `governance/REVIEW.md`.
- **Published files are minified and bundled.** Each page gets one stylesheet and one script for its components, plus its own CSS. A failure in one component doesn't stop the others. The pilot page went from 29.1 KB to 20.9 KB of JavaScript (gzipped).

## Run it

```bash
python dashboard/server.py
```

Then open http://localhost:8790/ for the dashboard. It also serves two demo pages:
- `/resources/state-of-ai-jobs-and-skills.html`, which has layers (the pilot)
- `/resources/another-article.html`, which has none (the regular page)

```bash
python tests/test_e2e.py
```

`tests/test_governance.py` covers the review flow (31 checks). The end-to-end test covers 26 checks: loader, first and returning visits, no flash, opted-out readers, a slow or unreachable CDN, tampered files, the kill switch, drafts, the checks blocking a bad publish, rollback, and the dashboard.

Command line (the same actions the dashboard uses; CI runs these):

```bash
python tools/cli.py check
```

Other commands: `publish --by NAME`, `approve COMPONENT --by NAME` (engineering), `rollback VERSION`, `kill on|off`, `history`, and `snippet`, which prints the `<head>` snippet for the template.

## Files

| Path | What |
|---|---|
| `loader/loader.js` | The loader source, fully commented. `tools/minify_loader.py` makes `loader.min.js`. |
| `pages/<id>/page.json` | One page: addresses, scope, status (draft, live or off), CSS files, components, dark-image setup. |
| `components/registry.json` | The reviewed JavaScript library with approved hashes. Owned by engineering. |
| `tools/pl.py` | Checks, publishing, history, rollback and the kill switch. |
| `dashboard/` | The content dashboard (Python standard library plus one HTML file). |
| `dist/` | What gets uploaded to the CDN: `manifest.json`, `draft-manifest.json`, `files/`. |
| `history/` | Every published manifest, plus `log.jsonl` (who did what, and when). |
| `github/page-layers.yml` | The GitHub version: checks on every pull request, publishing on merge. |
| `edge/cloudflare-worker.js` | Phase 2: the same lookup done at the CDN edge. |

## Two ways to run the dashboard

- **A small web app** (this prototype). Production would add company sign-in, with an editor role for publishing and an engineering role for approving components.
- **A GitHub repository.** Pages are folders, the checks run on each pull request, and merging publishes. `CODEOWNERS` keeps `components/` with engineering. GitHub's web editor is the dashboard.

## Later

- **CDN edge (option 1).** The edge adds the tags to the HTML, which removes the first-visit gap and lets crawlers see the stylesheet links. The manifest and the dashboard stay the same.
- **A CMS8 field (option 4).** A "page layers" field on each asset that the template renders server-side, with this same manifest format behind it.

## Prototype limits

- **No sign-in.** Changes are saved to files here rather than committed to GitHub.
- **Rollback only changes what readers get.** It doesn't change each page's saved status, so the next publish brings the page back unless its status is changed too.
- **The pilot page references `css-refresh/` files**, so there's one copy of each. Pages made in the dashboard keep their CSS in their own folder.
