# The parts page

`/ui/index.html` is the single page that shows every part AR Create builds with: buttons, fields, checkboxes,
switches, badges, alerts, cards, tabs, menus, dialogs, tables, progress, loading, avatars, breadcrumbs, empty states.

- **Shapes** come from coss ui (coss.com/ui, MIT, built by the Cal.com team), translated to plain CSS in `ui.css`
  so any screen can use them today without Tailwind or a build step. Every class starts with `ui-`, so nothing
  reaches an existing screen until that screen opts in.
- **Colours** live only in `tokens.css`. Dark is copied from coss ui's own dark mode (measured on coss.com/ui, 16 November 2026), keeping only AR Create's warm brand accent. They live, under coss ui's own names (background, foreground, primary, muted, border,
  input, ring, destructive, success, warning, info) plus two of AR Create's: `canvas` (the page) and `brand` (the
  warm accent, only for what needs Adrian). A brand or screen with different colours overrides these names and keeps
  every shape.
- Dark follows the app's `data-theme="dark"` and also coss's `.dark` class, so a coss part copied in later works.
- The page loads its script from `page.js`: the server's security rule blocks scripts written inside a page.

Open it on the demo: `npm run demo`, then http://127.0.0.1:8854/ui/index.html (add `?theme=dark` for dark).

Next steps, not done yet: move version three's screens onto these parts one screen at a time; add Tailwind and
the coss React parts only if a screen needs behaviour plain CSS cannot give (popups that position themselves,
combobox, date picker).
