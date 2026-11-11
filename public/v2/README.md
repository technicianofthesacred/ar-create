# Version two: how a screen plugs in

Plain script files, no framework, no build step. `index.html` already lists every screen's two files; a screen piece
edits only `screens/<name>.js` and `screens/<name>.css`, never `index.html` or `shell/`. Every name below is pinned by
`tests/v2-shell.test.mjs`. The contract is `docs/plans/2026-11-11-version-two.md`.

**Register a screen** (in its own file, inside `(function(v2){ ... })(window.v2)`):

```js
v2.screen({id:'subject', route:'subject/:id', title:'Subject',
  render(ctx){ return '<div class="v2-page subject">…</div>'; },   // markup or a node for the main area
  async mount(el, ctx){ /* read records, fill in, add listeners */ },
  unmount(el, ctx){ /* optional */ },
  brand(ctx){ return 'teajia'; } });                            // a look id, or null
```

Routes: `''` Home, `subject/:id`, `slides/:id` (an Instagram plan), `looks`, `research`, `research/group/:id`,
`research/topic/:id`. Unknown addresses go Home; Back and Forward work. Links are ordinary `<a href>`:
`v2.href('subject/:id',{id})` gives `#/subject/<id>`; `v2.go(...)` moves. `ctx` holds `params`, `query`, `el`,
`signal` (aborted when the screen closes), `setTitle(text)` (the name in the thin phone header and the window
title), `setAdvanced({subject,piece,section})` (where the top bar's Advanced leads), and `on(filter, fn)`.

**Call a command**: `await v2.call(name, input)`, using the names in `/api/capabilities` (the same as the CLI's
`call`). It returns the answer's body. A write gets an `operationId` unless you give one; send what you read with
`...v2.expect(record)` (its `expectedRevision` and `expectedHash`). A refusal throws `v2.Error` with `.kind`:
`stale` (409), `held` (423, `.holder`), `consent` (423 consent hold, `.hold`), `owner-only` (403), `refused`,
`failed`. Its `.message` is plain words, ready to show with `v2.ui.say(error.message,{tone:'bad'})`. For a write
that may meet a newer version: `v2.call(name, input, {reread: () => v2.call(readName, …), merge: (fresh, error) =>
nextInput or null})`. The client re-reads on 409; your `merge` decides; `null` leaves `error.fresh` for the screen to
show. Never merge his words for him. `v2.actor()` and `v2.isHuman()` say who is acting. The shell reads
`?reviewActor=` from the page address (an assistant opens version two with it, as in the existing workspace) and
sends it with every call; a screen never reads or passes it.

**React to a change**: `ctx.on({kind:'needs-you', id}, fn)`, `ctx.on({kinds:['subject-places*']}, fn)`. `kind` and
`id` match the change's record (`event.scope`), `kinds` match command names (a trailing `*` matches the start).
`fn({reset:true})` means read everything again. `ctx.on` stops by itself when the screen closes; `v2.on` does not.

**Open Advanced**: `v2.advanced({subject, piece, section})` is the address of the same place in the existing
workspace. `section` is one of its names: home, subjects, library, material, source, research, direction, write,
read, check, media, arrange, audience, share, outputs. `piece` is an output id. An Instagram plan also opens there at
`/document-study/index.html?instagram=<plan id>`.

**Shared pieces** (`v2.ui`): `ring(p,{label})` the one progress ring, 0 to 1; `step(state)` a step's marker (done,
now, flag, todo, wait); `notBuilt(what,{advanced})` says plainly that a part is not built yet; `sheet({title, body})`
a dialog, returns `{el, body, close}`; `say(text,{tone})` the one message line; `undo(text, run)` the message with
Undo; `reorder(container,{item, onMove(from,to), label})` drag plus Move up and Move down (and Alt with an arrow key);
`icon(name)`; `esc(text)` (escape every record's text you put in markup). The frame also offers `v2.brand(lookId)`,
`v2.desk.refresh()` and `v2.desk.use(async () => [{id, title, short?, cover?}])` (the subjects on the desk, in the
top bar on a computer; on a phone the desk lives on Home, one tap away in the phone bar), and `v2.needs.refresh()`.

**Share helpers between screens** through `v2.shared`, the one part of `v2` a screen writes to: each screen may fill
`v2.shared.<its id>` (for example `v2.shared.subject = {formsOf}`) for the others to read. Read another screen's
helpers when you use them, not when your file loads (screens load in the order of `index.html`), and do without them
when they are missing.

**Styles**: the app's tokens only (`var(--ink)`, `--dim`, `--paper`, `--line`, `--warm`, `--c3-*`), sizes
`var(--v2-t12|13|14|15|18|22)` and no others, `var(--ar-ui)`, and `var(--v2-speech)` only for spoken words. A plain
`<button>` gets the Graphite look; `class="pri"` makes it the primary one; `class="v2-ghost"` a quiet one. Wrap your
screen in `.v2-page` (the page width and gutters) plus your own class, and start every rule with that class. For the
brand use `var(--v2-br)` and `.v2-current`.

**A screen must never**: call `fetch` for a command, or read or write a file or `localStorage` for a record (only the
commands); keep a private copy of a record past what it shows; show sample or invented words as if they were his;
decide what is his to decide (a human-only command answers 403: show the message, do not hide the control's reason);
scroll sideways at any width (check your screen alone with `node scripts/review-sideways.mjs --only=v2:<id>`, plain
and with `--stress`, in a minute or two); hard-code a
colour, a font or a size outside the six; use an em dash; change `index.html`, `shell/` or another screen's files.
