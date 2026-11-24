# Page Layers and the Eureka rebrand

Page Layers is the Eureka rebrand for CMS8 pages, shipped without a deploy. It doesn't add a second design system. It uses Eureka's colours, type and breakpoints, measured on the live homepage (`eureka-lib.css`, `topNavRebrand.css`, `homepageV6.css`). It also adds what CMS8 pages need and the rebuild doesn't have yet: dark mode, reader controls, and publishing by the content team.

## What's aligned

| | Eureka (live homepage) | Page Layers |
|---|---|---|
| Colours | Navy `#072435`, text `#374f5c`, blue `#007bba`, rules `#d0dee4` / `#f1f1f1`, yellow `#ffc340` | The same values, as tokens. Dark mode is our extension, with the blue lifted to `#5cb8ec`. |
| Type | Poppins for titles, Inter for headings and interface | The same. Body text is Inter. Literata is a per-page reading option (`readingFont: "serif"`). |
| Breakpoints | `max-width: 767.9px`, `768px` to `1279.9px`, `min-width: 1280px` | The same for the article layout. The header keeps the site's 991/992px, as `topNavRebrand.css` does. |
| Controls | `e2-button`, 8px radius, outlined secondary, yellow primary | Log In outlined, Sign Up yellow, search, Display button and menus at 8px |
| Header | `topNavRebrand.css`, 77px, white with a `#f1f1f1` rule | Restyled to that look, also 77px. See "Header" below. |
| Motion | Entrance animation only when motion is allowed | Every animation and transition stops under `prefers-reduced-motion: reduce`. Card reveals are scroll-driven and never hide content. |

## Header

Research pages have the same header markup as the homepage, with the same `study-nav` classes. But they don't load `topNavRebrand.css`. In a live test, adding that one file to the article page broke the header into a stacked 180px block, so a stylesheet swap isn't enough.

- **The ask for engineering:** put research pages on the same header bundle as the homepage.
- **Until then:** Page Layers styles the existing header toward the rebrand look, so the eventual switch isn't a visible jump.

## Components as Eureka components

Each Page Layers component is already shaped like a Eureka React component:

- It has a name, as in `component="stat-waffle"`.
- It has props: its settings in `page.json`, which are plain JSON.
- It's mounted on part of the page and leaves the rest alone.

| Page Layers today | Eureka pattern |
|---|---|
| `StudyEnh.define('stat-waffle', defaults, fn)` | `<react-ssr module="@sites-study-com/page-layers" component="StatWaffle" props='{...}'>` |
| Settings in `page.json`, sent as `window.STUDY_PAGE` | Props, rendered on the server |
| Reads facts from the article HTML | The same, or receives them as props from CMS8 data |
| `core.js` helpers (page model, toast, copy, icons) | A shared module in the same package |

Moving a component into Eureka later means wrapping its function as a React component and passing its settings as props. The behaviour, settings and tests stay the same. Server rendering then removes the first-visit gap for that piece.

## First-visit flash: before launch, not later

The rebuilt pages are server-rendered, so they never show an old look. Page Layers on CMS8 behaves like this:

- **Returning readers:** no flash, from the cached manifest and render-blocking styles.
- **Brand-new readers:** a brief gap until the manifest arrives.

To match the rebuilt pages, the page lookup should run at the CDN edge (`edge/cloudflare-worker.js`) before launch. The edge adds the stylesheet links to the HTML itself.

## What it adds to a page

Measured on the live site in a real browser:

- **The article page** already loads 92 script files, about 4.1 MB uncompressed, including jQuery 1.11.1 and Angular 1.7.8.
- **The homepage** loads 102 script files, about 4.4 MB uncompressed: jQuery 1.11.1, Angular 1.7.8, Bootstrap and React.
- **Page Layers adds** about 22.5 KB of JavaScript and 14.6 KB of CSS on the AI report, and 19.8 KB and 11.0 KB on the College article (minified and gzipped, with dark mode and every component). It doesn't replace the site's scripts.

## Guarding against CMS8 changes

Page CSS and settings rely on CMS8's HTML. Each page now lists what it relies on (`expects` in `page.json`), and the markup check adds every label target and cover-chart sentence automatically.

- **Command:** `python tools/cli.py markup [page] [--url URL]` runs the check.
- **Daily job:** the GitHub workflow runs it every day against the live pages, so a renamed heading, re-exported chart or edited sentence fails the same day.
- **Pilot page:** all 24 checks pass on the live article today.
