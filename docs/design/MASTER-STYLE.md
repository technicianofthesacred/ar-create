# The master style file: change this, and this changes

All of AR Create's design lives in `public/ui/tokens.css`. Every front (version three, version two, Advanced) links it first. Other stylesheets name roles from it. They never name a raw size or colour, and the test `tests/master-style-file.test.mjs` stops new raw values from coming back.

The file has two layers:

- **Values:** the palette (light and dark), the type scale, spacing, corners, heights and shadows.
- **Roles:** what each section uses. A role points at a value.

To change one kind of thing, such as all card titles, change its role. To change everything that shares a value, such as every 14px interface text, change the value.

| Change this in the master file | And this changes |
|---|---|
| `--bg` | The page background behind every screen, in light mode. `[data-theme="dark"]` holds the dark one. |
| `--paper` | Cards, sheets, pop-ups and the writing page. |
| `--rail` | Side panels, rails and Advanced's left column. |
| `--ink` | Main text and the fill of every primary button. |
| `--dim` | Muted text everywhere: dates, counts, hints under titles. |
| `--warm` | The accent: links, the current place, focus rings, anything that needs Adrian. |
| `--line` / `--line-strong` | Every hairline border, and the borders that must be seen. |
| `--bad` / `--good` / `--warn` | Error, done and waiting colours. |
| `--font-ui` / `--font-words` | The interface face, and the face for Adrian's words. |
| `--t-ui` | Interface body text (14px today), plus the nav that reads it. |
| `--t-detail` | Buttons, tables and quiet text (13px). |
| `--t-small` | Captions and badges (12px). |
| `--t-body` / `--t-page` | Longer interface text (15px), and the writing page (16px). |
| `--t-title` / `--t-heading` / `--t-display` | Card titles (17), section headings (20), a screen's one heading (22). |
| `--size-card-title` (a role) | Only card titles; section headings are untouched. Every `--size-*` role works this way. |
| `--lh-ui` / `--lh-page` | Line height of interface text, and of reading text. |
| `--r-control` / `--r-surface` | The corner of every button, field and chip; the corner of every card and sheet. |
| `--h-control` / `--h-control-sm` / `--h-touch` | Button height on desktop (32), in dense Advanced (28), on touch screens (44). |
| `--shadow-1` / `--shadow-pop` / `--shadow-sheet` | Small lifts, pop-ups, full sheets. |
| `--dur-fast` / `--dur` | Hover speed and open/close speed. |
| `--s1` to `--s7` | The 4 / 8 / 12 / 16 / 24 / 32 / 48 spacing steps. |

Font-size roles: page title, section, card title, body, ui, nav, table, button, detail, caption, label, micro, reading, display, poster.

Text colour roles: main, soft, muted, hint, link, accent, good, warn, danger, on-ink, on-accent, on-dark.

Surface roles: page, band, card, panel, advanced, chosen, ink, good, warn, dark.

Border roles: edge, edge-strong, edge-accent, edge-ink.

## What still has its own values, and why

On 19 November 2026 the guard counts 676 written-out colours, 40 rgb() colours and 158 raw font sizes outside the master. Before, there were 1,164 written-out colours and about 2,100 raw font sizes. They fall into these groups:

1. **Published-piece renders** keep their brand's look whatever the app's theme. These are the Teajia conversation and byline pages, the magazine as published, the inline magazine document, carousel slide renders, Looks' brand swatches, and the cover titles that scale with the window (`clamp()` sizes). They show the piece as readers will see it, so they must not follow the app's theme.
2. **The dark workbenches** in `runtime/src/workspaces`: carousel, composition, the writing desk and the terminal. They were designed dark in both themes. Turning their colours into theme roles is a redesign of those screens, which needs its own look and approval. Their sizes and line heights already read the roles.
3. **The coss parts gallery** (`ui-kit/src/app.css`) is a separate reference page; the app never loads it. Its colours copy the master's. The coss buttons the app does use are drawn through `app-parts.css`, which reads the master.
4. **The transcript check page** (`public/transcript-check`) is a standalone page with its own dark palette. It doesn't load any of the three fronts.
5. **See-through overlays and one-off tints** in Advanced's oldest sheet (`study.css`): backdrops, insertion lines and hover washes written as see-through hex. Most are hidden by later sheets, so they are left until that sheet is retired.
6. **Approved reading typography**: the shared prose surfaces (Atlas 18px reading text and its heading sizes), the Research point sheet (16px Avenir) and the retained carousel reader. Earlier reviews fixed these exact measures and tests hold them, so they keep their own sizes.

The guard's ceilings sit at these counts, so each of these numbers can only go down.
