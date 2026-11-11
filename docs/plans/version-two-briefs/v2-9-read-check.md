# Stage 2: Read and Check inside version two

Two builders, each in its own git worktree on its own branch, never the same file. Do not push. Commit your work in
your worktree when you finish (one commit, plain message, no model name) so the director can take it.

## Read first (both builders)

1. `CLAUDE.md`, `docs/plans/2026-11-11-version-two.md` (all of it), "Rules for every worker" in
   `docs/plans/2026-11-11-direction-d-build.md`, `docs/plans/version-two-briefs/v2-common.md`, `public/v2/README.md`.
2. The finished Write screen, which is your pattern: `public/v2/screens/write.js`, `write.css`,
   `tests/v2-write.test.mjs`, and its brief `docs/plans/version-two-briefs/v2-7-write.md` (the numbered corrections
   at its end are faults a reviewer found; do not repeat them).
3. The sample Adrian approved by eye is checked out at `/tmp/wt-sample/design/2026-11-better-interface/d-four-stations/`
   (read only). It draws only Write, with a "Write | Read | Check" segment in the sub bar. Read and Check take the
   same frame: the same sub bar, the same page, the same widths, so moving between the three feels like one place.
4. What Read and Check do today in the existing workspace (read only, never change it):
   - Read: `public/document-study/draft-flow.js` (`setWriteView('preview')`), `draft-flow.css`.
   - Check: `public/document-study/draft-check-flow.js`, `check-decision-coverage.js`, `stage-work-surfaces.js`,
     `runtime/services/study-draft-checks.mjs`, and the pure `public/lib/decision-coverage.js`.

## What is shared, and who owns it

The sub bar and the finding of the piece's words belong to Write. The Read builder adds two helpers to
`v2.shared.write` and the Check builder uses them at use time (not at load time). Signatures are fixed here so both
can work at once:

- `v2.shared.write.locate(id, pieceId)` resolves to `{standing, forms, form, piece, bindingId, native}`: exactly what
  Write's own `locate()` works out today. `native` is false when the piece's words are owned elsewhere (a Magazine
  story, a Carousel), in which case the screen says so and offers Open in Advanced, as Write does.
- `v2.shared.write.bar({id, forms, form, piece, mode, right})` returns the sub bar's markup. `mode` is `'write'`,
  `'read'` or `'check'`: the open one is a `<span aria-current="true">`, the other two are links to
  `#/write/<id>?piece=`, `#/read/<id>?piece=` and `#/check/<id>?piece=`. The piece tabs keep him in the same mode.
  `right` is markup for the bar's right side (Write's saved line; a word count for Read; nothing or a status for Check).
- Read and Check wrap their page in `class="v2-page wr rd"` and `class="v2-page wr ck"`, so Write's `.wr` rules for
  the bar and the page apply. Their own rules start with `.rd` or `.ck`.
- Routes: `read/:id` and `check/:id`, each with `?piece=<output id>`, the same shape as `write/:id`.

On a phone the segment is hidden today (`write.css` near line 134). With three real screens he must be able to move
between them on a phone too: the Read builder makes the segment visible at 390 without making anything scroll
sideways, keeping the bar the sample's height.

## Rules that decide the hard cases

- Only real records, through `v2.call`. No `fetch`, no document-study globals, no copy of a record kept.
- The sample wins on what he sees, except: "Advanced" stays in the top bar; a part with no command behind it sits in
  place and says it is not built yet (`v2.ui.notBuilt`, with Open in Advanced where the existing workspace has it);
  only the six type sizes; no em dash.
- His words are his. Read and Check never change the draft. Human-only commands stay human-only; an assistant's page
  (`?reviewActor=agent:...`) shows a refusal's message plainly.
- A command you call for the first time must be tried against the real demo server, not only a stub.
- No speech or audio.
- Phone first, both themes, keyboard reachable. Run `node scripts/review-sideways.mjs --only=v2:<your screen>` plain
  and with `--stress`, with `SIDEWAYS_V2_IDS` naming a subject and piece that has words.
- Tests: your own test file, `tests/v2-write.test.mjs`, `tests/v2-subject.test.mjs` and `tests/v2-shell.test.mjs`
  only. The director runs the whole suite. Never weaken a test.
- Pictures: one contact sheet for your screen (1440 and 390, dark and light, four panes on one small image, at most
  1600 pixels wide), saved where your task says. Beside each pane put the same view of the existing workspace's
  section, so the old screen sits beside the new one.

## Builder A: Read (and the shared bar)

Files you may touch: `public/v2/screens/write.js`, `write.css`, `tests/v2-write.test.mjs`; new
`public/v2/screens/read.js`, `read.css`, `tests/v2-read.test.mjs`; `public/v2/index.html` (the lines that load
`read` and `check`, in that order after `write`; `check.js` and `check.css` arrive from builder B, so add empty
placeholder files only if a test needs them to exist and say so); `public/v2/README.md` (the two routes);
`tests/v2-shell.test.mjs` (only the lists of screens and routes); `scripts/review-sideways.mjs` (only teaching it a
subject and piece for write, read and check). Nothing else.

Build:
1. The two helpers above, by moving Write's own code, not copying it. Write must behave exactly as before; its
   segment now links to the two new screens.
2. The Read screen: the saved words of the piece, set as the approved page sets them (the same face, measure and
   spacing as Write's page), with nothing to edit, no margin, no suggestions, no Undo. A word count in the bar. One
   plain way back to Write ("Edit words"), and on to Check. If he has unsaved words in Write on this device, Read
   says so plainly rather than silently showing older words. When the saved draft changes while Read is open, it
   shows the new words (the change stream, `ctx.on`). An empty draft says so and leads to Write.
3. "Earlier original draft" has no command: say it is not built yet with Open in Advanced, only if the existing
   workspace would show it for this piece; otherwise leave it out.

## Builder B: Check

Files you may touch: new `public/v2/screens/check.js`, `check.css`, `tests/v2-check.test.mjs`;
`public/v2/screens/subject.js` and `tests/v2-subject.test.mjs` (only where an Article's Read and Check steps lead:
they open the new screens; a Carousel's stay on Advanced); `scripts/demo-fill.mjs` and its test if it has one (see
4). Nothing else. If `v2.shared.write.bar` or `locate` is missing at use time (it lands from builder A), show a plain
fallback and do not fail; test against small stand-ins of the fixed signatures above.

Build:
1. The Check screen: on a computer the read-only words on the left and the findings on the right; on a phone the
   findings first, then the words. Same sub bar, `mode:'check'`.
2. The check itself, on `study-draft.check.get` and `study-draft.check.post` (the post carries `expected` from
   `study-draft.read` and an operation id): "Check saved draft" or "Check saved draft again", its state in the
   existing workspace's own words (No saved check, Outdated check, Mechanical checks complete, Review needed, Held and
   why), and each finding with its title, the quoted words and what to do. Pressing a finding brings its words into
   view on the page when they can be found there. "View source" has no command: not built yet, with Open in Advanced.
3. "Decisions in this piece", on `current-work.read` and `study-ai.read` with `import('/lib/decision-coverage.js')`,
   rewritten over `v2.call`. Comparing versions is not built yet.
4. The demo has no check findings today. Add to `scripts/demo-fill.mjs` one invented subject (or extend one) with a
   captured source and Article words that quote it, one quote exact and one altered, so the check shows a real
   finding and a real pass on the demo. Invented content only, made through the commands as the rest of that script does.
5. `scripts/demo-fill.mjs` ignores `AR_CREATE_PORT`; give it `AR_CREATE_URL` for your port.

## Report (under 250 words)

What now works on screen and through which commands; files changed; what says "not built yet" and why; your test
counts with the names of any failures; where the contact sheet is; anything you were unsure of or left undone.
