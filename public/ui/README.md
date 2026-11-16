# The parts page

`/ui/index.html` shows every coss ui part and all 530 of its examples, rendered from coss's own code, in AR Create's
colours. Open it on the demo: `npm run demo`, then http://127.0.0.1:8854/ui/index.html (`?theme=dark` for dark,
`#/<part>` for one part, for example `#/button`).

## How it is put together, following coss ui's docs (coss.com/ui/docs)

- **The code** lives in `ui-kit/`, a small React and Tailwind 4 project, the setup coss's Get Started asks for.
  Everything in `ui-kit/src/components` was installed with coss's own command, never typed by hand:
  `npx shadcn@latest add @coss/style` (all 56 parts, colours, fonts) and `npx shadcn@latest add @coss/p-<name>`
  for the 530 examples. To update or add one, run the same command again in `ui-kit/`.
- **Colours** follow coss's Styling guide: set the same names in the global stylesheet. `ui-kit/src/styles.css` is
  exactly what coss's install wrote; AR Create's changes live only in `ui-kit/src/app.css`. Dark is coss's dark in the
  "Sencha" tea tone (same colours, one step quieter and warmer; the three tones compared are in
  `docs/design/tea-tones.html`), plus AR Create's warm `brand`. Light is AR Create's paper palette written with coss's formulas.
- **Base UI setup** from the Styling guide: the body is positioned and the app root isolates, so popups sit on top.
- **Fonts**: coss's install wires Inter; AR Create's face is Plus Jakarta Sans. The page has a switch to compare
  them.
- **Outside Next.js**: coss's examples are written for Next.js. Two small bridges, both in the build: `next/link`
  becomes a plain link (16 examples use it), and the Geist Mono font comes from its plain package instead of the
  Next-only one.

## Building

`npm run setup:ui` once, then `npm run build:ui`. The build writes `public/ui/kit/` (the page, one small file per
example loaded only when its part is opened, the stylesheet and the fonts), which is committed so the app serves the
page without building.

## Not yet

- No app screen uses these parts yet; version three's screens are plain JavaScript and move over one at a time.
- coss's agent guide (`npx skills add cosscom/ui`) is not installed yet; it teaches assistants to use the parts as
  coss intends.
- Examples whose sample pictures come from the web show initials instead: the app only loads its own pictures.
