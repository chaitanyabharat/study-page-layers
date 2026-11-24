# Setup

Allow about an hour. Steps 1–3 are needed whichever host you pick. Then do **4A** (GitHub Pages) or **4B** (your own server), followed by 5–7.

## 1. Put the repo on GitHub

1. Create an **empty** repository on GitHub, for example `study-page-layers`. Ideally create it under a Study.com organization; otherwise add a teammate as a co-owner. Private is fine.
2. Edit these two files:
   - **`layers.config.json`:** set `host` to your domain (no `https://`) and `repo` to `your-account/study-page-layers`.
   - **`.github/CODEOWNERS`:** replace `@OWNER` with your GitHub username (and any other reviewers).
3. Push the folder:

   ```bash
   git init -b main
   git add .
   git commit -m "Page Layers: first version"
   git remote add origin https://github.com/YOUR-ACCOUNT/study-page-layers.git
   git push -u origin main
   ```

## 2. Re-approve the Display switch (one time)

`css-refresh/newui/newui.js` changed after its last review, so the checks block publishing until someone re-approves it. Every other component's approval carried over.

1. Add the reviewer's name under `engineering` in `page-layers/governance/people.json`. It has to be `engineering`, because `newui` has approved exceptions to the rules. Replace the placeholder names in that file while you're there.
2. Approve `newui`. Either:
   - **Without Python:** Actions → **approve component** → Run workflow, with component `newui` and your name. Only repo admins can run it. It opens a pull request with the approval; merge it to publish.
   - **Locally:** run `python page-layers/tools/cli.py approve newui --by "Your Name"`, then `python page-layers/tools/cli.py check`. Commit and push.

The approver can't be the component's author; `cli.py` enforces this. The rules file (`governance/policy.json`) is already signed and doesn't need re-approving.

## 3. Branch rules (so only code needs review)

In the repo, go to **Settings → Rules → Rulesets → New branch ruleset** and target `main`. Turn on:

- **Require a pull request before merging**
  - Required approvals: **0**
  - **Require review from Code Owners**: on. This only applies when a change touches a file listed in `CODEOWNERS`, which is the code, not the pages.
- **Require status checks to pass**: add `checks`
- **Block force pushes**

Result: page settings, CSS and the kill switch publish as soon as the checks pass, and code changes wait for an owner. Check this by trying both kinds of change once.

## Which host?

| | GitHub Pages | Your own server |
|---|---|---|
| Repo | **must be public** on a free GitHub account. Private needs GitHub Pro or Team. | can stay private (Actions is free up to 2,000 minutes a month) |
| What's public | all the code and the governance files | only `dist/site`: the dashboard and the built files, which browsers download anyway |
| Uptime and speed | GitHub's CDN | as good as your hosting |

If the repo is public, don't put anything private in it, including saved copies of Study.com pages (`tools/fixtures/`). Otherwise, use your own server (4B). Cloudflare Pages is another free option that works with private repos.

## 4A. Host on GitHub Pages

1. Go to **Settings → Pages → Build and deployment**, and set the source to **GitHub Actions**.
2. Go to **Actions**, run **deploy (GitHub Pages)**, and wait for it to finish.
3. Go back to **Settings → Pages → Custom domain**, enter your domain, then tick **Enforce HTTPS** once it's offered.
4. At your DNS provider, add a `CNAME` record from your subdomain (for example `study-enhance`) to `YOUR-ACCOUNT.github.io`.
5. If your DNS is on Cloudflare, set the record to **DNS only** (grey cloud) until GitHub has issued the HTTPS certificate. After that you can switch on the proxy.

## 4B. Host on your own server

1. Point your domain or subdomain at a folder on your server, with HTTPS on.
2. In the repo, go to **Settings → Secrets and variables → Actions**:
   - **Variables:** `DEPLOY_TARGET` = `server`, and `DEPLOY_METHOD` = `ssh` or `ftp`
   - **Secrets:**
     - `DEPLOY_HOST`
     - `DEPLOY_USER`
     - `DEPLOY_PATH`: the folder the domain serves
     - `DEPLOY_SSH_KEY` (for ssh) or `DEPLOY_PASSWORD` (for ftp)
3. Run **deploy (own server)** from **Actions**.

The `.htaccess` file in the upload sets the caching rules on Apache.

Without GitHub Actions, you can deploy by hand: run `python build.py` and upload `dist/site/`. Upload `pl.js` last.

## 5. Check the host

- `https://YOUR-DOMAIN/pl.js` should show the lookup file, listing two pages.
- `https://YOUR-DOMAIN/admin/` should show the dashboard's sign-in screen.

## 6. Dashboard sign-in

Each editor creates a **fine-grained token**: GitHub → Settings → Developer settings → Fine-grained tokens. Give it:

- access to this repo only
- **Contents**: read and write
- **Pull requests**: read and write

They paste it into the dashboard. It's stored only in their browser and sent only to `api.github.com`.

## 7. Turn it on in CMS8

1. Copy `dist/cms8/hosted-embed.txt`. It's the same for every page.
2. In CMS8, open the article and paste it at the **very top** of the body.
   - If the article already has a self-contained Page Layers block, replace it. The bookmarklet does this; see below.
3. Save, then check the page on stage-study.com first.
4. Pages without a listing in the dashboard ignore the line, so it's harmless to add it early.

### No host at all: self-contained blocks

`dist/cms8/<page-id>-embed.txt` holds the whole new look for one page, with nothing to host. Paste it at the top of that article, and re-paste it after each change.

To make re-pasting a one-click job, use the bookmarklet:

1. Run `python tools/make_bookmarklet.py`.
2. Make a new bookmark and paste the output as its address.
3. Then:
   - copy a block from `dist/cms8/`
   - open the article's edit screen in CMS8
   - click the bookmark
   - check the change, then click **Save**

## Not tested yet

- **The dashboard's GitHub mode.** It needs the real repo. The same screens and flow were tested in local mode: edit, draft, failed checks blocked publishing, publish rebuilt the page file, and the kill switch worked.
- **The GitHub Actions workflows.** They run for the first time on GitHub.
- **The bookmarklet.** It uses the same editing method that was tested by hand in CMS8 staging.
