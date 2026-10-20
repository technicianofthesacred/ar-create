# AR Create look (C3 "Home and tabs")

The interface look chosen by the author on the C3 board. Function work and look work happen in parallel; this page tells a function builder how to add a feature so it already looks right, and what not to break.

## How the look is built

The look is a set of add-on modules loaded last in `public/document-study/index.html`. They never edit the markup that `study.js` and its wrapper scripts produce: they decorate the page after each render and move or restyle existing elements. Behaviour, handlers, saves, Undo and recovery stay with their owners.

| Module | What it does |
|---|---|
| `home-tabs.*` | Tab strip (Home, Research, open pieces/outputs) and Home (the project library, full screen) |
| `checkpoint-rail.*` | Compact grouped list of the twelve checkpoints |
| `surface-bar.*` | Option A bars: checkpoint name and every command on one top line (each presses the real control underneath); a thin location bar at the bottom (piece › output › checkpoint, Read-only, save status). Titles past about 40 characters are trimmed in the middle; hover shows all |
| `canvas-c3.*`, `source-c3.css` | Per-checkpoint heading line, grouping and the inspector column. Write, Read and Check start with the page; owner status rows are hidden in place (`data-c3-mirrored`) and mirrored as quiet notes beside the page, never moved |
| `inspector.*` | Margin / Decisions / Readiness tabs in Write: tabs on top (quiet filled switch), tab content, then page info as a pinned footer labelled Status / File / Parts. Links out of the panel are sand text with an arrow |
| `research-tab.*` | Research across pieces as quote cards: speaker initial, the spoken words in serif, filled evidence chips, source (read-only; decisions open the piece's own Research) |
| `waiting-band.*` | "Waiting on you" band on Home, from recorded output statuses |
| `empty-states.*` | What every empty step shows: the shape of what comes (Arrange a filmstrip of 4:5 slide slots, Audience a phone frame), the real next step, how it fills |
| `c3-defaults.css` | Default look for any plain new button, field, disclosure or heading |
| `c3-theme.css` | Palette, Plus Jakarta Sans for the interface (local files), scrollbars, dark default. Loaded last. On screen, the manuscript in Write / Read / Check uses Notion-style system sans (16px / 1.5, 40px title, 24px sections, about 700px wide) on full-width paper; the reader's own size (A− / A+ in the bottom bar, 87.5–137.5%) is kept on this device. Templates and exports keep their own type. |

## Adding a function so it looks right

1. **Use plain elements and the existing tokens.** A new `<button>`, `<input>`, `<select>`, `<details>/<summary>`, `<h2>`/`<h3>` already gets the look from `c3-defaults.css`. Colours: `var(--ink)`, `var(--dim)`, `var(--paper)`, `var(--line)`, `var(--warm)`, `var(--c3-lift)`, `var(--c3-line2)`, `var(--c3-good)`, `var(--c3-warn)`, `var(--c3-bad)`. Interface text: `var(--ar-ui)` at `var(--c3-t1)` (13px) or `var(--c3-t2)` (15px). Long-form prose keeps the Atlas fonts.
2. **No hard-coded colours or fonts.** They break dark/light and drift from the board.
3. **One primary action per surface.** Mark the real button with a stable `data-*` attribute; ask the look side to add it to the bar's primary map (`OWN` in `surface-bar.js`).
4. **Design the empty state.** If the new surface can be empty, add an entry to `STEPS` in `empty-states.js` (or tell the look side): when it is empty, what it is for, the real next action, how it fills. Never a bare "nothing here".
5. **Keep stable hooks.** The look finds things by `id`, `data-*` and the `.workflowStep` buttons. Renaming those, or the exact text that wrapper scripts replace, silently drops the look on that surface.
6. **Pages run to the bottom.** Write, Read and Check use one paper colour and the sheet fills the desk; do not add a fixed height or a coloured strip under it.
7. **Messages go beside the page, not above it.** A new status line on Write/Read goes in the owner's row as usual; the look mirrors it into the notes column. Do not put it above the manuscript title.
8. **Phone (≤850px):** the notes column hides and the owner rows show again in place; Home is one column; bars scroll sideways instead of wrapping.
9. **Tools in Material and Source are rows** (`canvas-c3.js` `TOOLS`): icon, name, one-line purpose, chevron, two lines max. A new disclosure tool there gets an entry in `TOOLS`, and in `GO` if it has a "what works now" step.
10. **Not connected says so where you hit it.** A tool whose own text says "not connected", "not saved" or "preparation only" gets a red or amber dot on its icon, and a one-line strip at the top of its opened panel with the one real step that works now. Never a floating pop-up.
11. **Status lives in the bottom bar.** Save state, "Only in this browser · Save to the project" and text size sit there; panels don't repeat them.
12. **Check it by eye**, dark and light, desktop and 390px phone, filled and empty.

## Rules the look keeps

- Nothing is saved, approved, sent or exported by a look module; every action presses an existing owner's control.
- A disabled real control stays disabled, with its own reason.
- Not-connected tools are shown as not connected, never faked.
- Dark is the default only when no theme was ever chosen.
