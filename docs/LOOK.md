# AR Create look (C3 "Home and tabs")

The interface look chosen by the author on the C3 board. Function work and look work happen in parallel; this page tells a function builder how to add a feature so it already looks right, and what not to break.

## How the look is built

The look is a set of add-on modules loaded last in `public/document-study/index.html`. They never edit the markup that `study.js` and its wrapper scripts produce: they decorate the page after each render and move or restyle existing elements. Behaviour, handlers, saves, Undo and recovery stay with their owners.

| Module | What it does |
|---|---|
| `home-tabs.*` | Tab strip (Home, Research, open pieces/outputs) and Home (the project library, full screen) |
| `checkpoint-rail.*` | Compact grouped list of the twelve checkpoints |
| `surface-bar.*` | One bar above the work; every control presses the real one underneath |
| `canvas-c3.*`, `source-c3.css` | Per-checkpoint heading line, grouping and the inspector column |
| `inspector.*` | Margin / Decisions / Readiness tabs in Write |
| `research-tab.*` | Research across pieces (read-only; decisions open the piece's own Research) |
| `waiting-band.*` | "Waiting on you" band on Home, from recorded output statuses |
| `empty-states.*` | What every empty step shows: the shape of what comes, the real next step, how it fills |
| `c3-defaults.css` | Default look for any plain new button, field, disclosure or heading |
| `c3-theme.css` | Palette, Plus Jakarta Sans (local files), scrollbars, dark default. Loaded last. |

## Adding a function so it looks right

1. **Use plain elements and the existing tokens.** A new `<button>`, `<input>`, `<select>`, `<details>/<summary>`, `<h2>`/`<h3>` already gets the look from `c3-defaults.css`. Colours: `var(--ink)`, `var(--dim)`, `var(--paper)`, `var(--line)`, `var(--warm)`, `var(--c3-lift)`, `var(--c3-line2)`, `var(--c3-good)`, `var(--c3-warn)`, `var(--c3-bad)`. Interface text: `var(--ar-ui)` at `var(--c3-t1)` (13px) or `var(--c3-t2)` (15px). Long-form prose keeps the Atlas fonts.
2. **No hard-coded colours or fonts.** They break dark/light and drift from the board.
3. **One primary action per surface.** Mark the real button with a stable `data-*` attribute; ask the look side to add it to the bar's primary map (`OWN` in `surface-bar.js`).
4. **Design the empty state.** If the new surface can be empty, add an entry to `STEPS` in `empty-states.js` (or tell the look side): when it is empty, what it is for, the real next action, how it fills. Never a bare "nothing here".
5. **Keep stable hooks.** The look finds things by `id`, `data-*` and the `.workflowStep` buttons. Renaming those, or the exact text that wrapper scripts replace, silently drops the look on that surface.
6. **Check it by eye**, dark and light, desktop and 390px phone, filled and empty.

## Rules the look keeps

- Nothing is saved, approved, sent or exported by a look module; every action presses an existing owner's control.
- A disabled real control stays disabled, with its own reason.
- Not-connected tools are shown as not connected, never faked.
- Dark is the default only when no theme was ever chosen.
