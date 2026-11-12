# Stage 7, piece 5: code review of the screen control (Sources list: Stop and Use again)

Reviewed 12 November 2026 on the merge commit "Merge branch 'claude/s7-screen'", by reading the commit "Sources list: Stop
using for Check, and Use for Check again" and by running it. No code was changed; this file is the only write.

What was run:

- `node --test tests/v2-subject.test.mjs tests/v2-check.test.mjs tests/v2-shell.test.mjs tests/v3-*.test.mjs`: 175 pass, 0 fail.
- The sideways check for `v2:subject,v2:check`, plain and with `--stress`, at four widths and both themes: nothing scrolls
  sideways (16 views each). That check opens the first demo subject, which shows no Sources block, so it does not reach the
  new controls; they were measured separately below.
- A fresh demo on 8864, `demo:fill`, then the walk (`scripts/review-journey.mjs`) twice, then Playwright probes on the
  walk's subjects, in version two and version three, as the owner and as `?reviewActor=agent:claude-code`, at 390 (dark)
  and 1440 (light). In every view with the block, the page was exactly as wide as the window and no element of the block
  ran past its right edge. Ports 8841 and 8854 were never used; the demo was stopped afterwards.

Proved by running:

- Subject page: a used row says "Used for Check" with one quiet "Stop using for Check"; pressing it sends one stop, says
  "Check no longer reads this." once, the row then says "Not used for Check. You stopped it." with "Use for Check again", and
  focus lands on that new control. Keyboard (Space) works the same. A double press sends one request.
- "Use for Check again" sends that one source with `again:true`; the row returns to "Used for Check" and focus moves to Stop.
- Check: after a stop of the only source, Check shows "Checks held", "No source to check against yet." with the Sources block
  in the main area, the bar agrees, and Check does not run by itself (no POST to the check). "Use for Check again" from
  there captures and Check runs by itself, as after any capture. Inside "Check details and saved proof" the block appears
  without the capture button, Stop works there, the details stay open, the block is drawn once, focus moves to "Use for
  Check again".
- The subject's Check step moves from done to waiting on the same page after a stop; the standing says "No source to check
  against yet" on the subject and on Home's row.
- An assistant's page shows Stop and "Use for Check again"; each press shows the server's sentence once ("Only Adrian can
  decide this. Claude can propose it, not do it."), the list is unchanged and focus stays on the control.
- A lost answer (server did the stop, the reply was cut): no spinner is left, the list is read again and shows the stop.
- A stale tab whose sourcesHash is out of date: 409, said once, and the list is read again and shows the server's truth.
- Pressing Stop and leaving the page at once: no error; the toast shows on Home; focus is not moved anywhere odd.
- Version three loads the same two files: the same rows, controls and held state appear there unchanged, nothing sideways.

## Must fix

1. **"Check can now read this" stays on screen after a stop, under "Not used for Check" and under "Checks held".**
   `public/v2/screens/subject.js` 398: the success path of `change('stop')` never clears `S.done`, which a capture or a
   "Use for Check again" set. Run: press "Use for Check again", then "Stop using for Check". The subject's block then
   reads "Not used for Check. You stopped it. Use for Check again. Check can now read this", and Check reads "Checks held.
   No source to check against yet." with "Check can now read this" in the same block (picture at 390 dark taken in the
   probe). The screen says the opposite of the record. Correction: in the stop branch set `S.done=false` before the
   refresh (for example `if(kind==='stop'){await v2.call(...);S.done=false;v2.ui.say(...)}`), and add an assertion to the
   two stop tests (start from a page where a capture or an again was just made, then stop, and assert `[data-cs-done]` is
   absent) in `tests/v2-subject.test.mjs` and `tests/v2-check.test.mjs`.

## Should fix

1. **Another tab's stop or capture is not shown until a reload.** Neither screen drops its copy of the list when a
   `study-draft.capture-sources*` change arrives: `subject.js` 503 (the `ctx.on({})` handler asks the standing again but
   never `cs.reset()` or `cs.load()`), `check.js` 361 (`soon()` reloads the draft and receipt, not the list). Run: tab B
   still showed "Used for Check" and Stop 2.5 seconds after tab A stopped it. On Check this also means `quoteGone()`
   (`check.js` 130) can read an old `hasQuoteSource:true` and show "Outdated check" instead of held after a stop made
   elsewhere while Check was open with the list already read. Pressing in the stale tab ends right (200 for the same copy,
   or 409 and a re-read), so nothing wrong is written, but the row is out of date. Correction: on a change whose kind
   starts with `study-draft.capture-sources`, call `cs.load()` (keep the old list on screen while it reads, as `refresh`
   does; expose `refresh` from `createCaptureSources`, `subject.js` 415) on both screens.
2. **A lost answer says "Nothing was changed." while the list then shows the stop.** `subject.js` 401 shows the client's
   failed sentence ("The app could not be reached. Nothing was changed."), but the server may have done it, and the refresh
   right after shows "You stopped it". Correction: for `error.kind==='failed'` say what is known, for example "The answer
   did not come back. The list shows what is on file now.", after the refresh. This is wording he sees: include it in the
   pictures.
3. **"No longer attached" is found by reading the server's sentence with a pattern.** `subject.js` 353 tests
   `/no longer attached/i` on `x.reason`. Any rewording on the server silently turns that row into a plain "Used for
   Check". The list already says it structurally: a detached captured row is the only one with `captured:true`,
   `capturedCurrent:false` and `changedSinceCapture:false`. Correction: use those fields, and add a test row for this
   state (the "other states" test in `tests/v2-subject.test.mjs` has none). The state itself is not in Decision 6's
   table: add "Used for Check. No longer attached to this subject." | "Stop using for Check" to the table and to his
   pictures.
4. **An unreadable captured source is labelled "Changed in the Library since".** For an attached row with `r.missing`, the
   server sets `changedSinceCapture:true` because `bodyHash` is absent (`runtime/services/study-draft-copies.mjs` 346), so
   `subject.js` 353 says "Used for Check. Changed in the Library since." when the truth is "This material could not be
   read." Correction: when the row's `reason` is the could-not-be-read sentence, show "Used for Check. " plus that reason
   (Check still reads the pinned copy), or have the list send `changedSinceCapture:false` when the material is missing.
5. **An assistant's Confirm test lost one assertion.** `tests/v2-subject.test.mjs` 826 to 839: the old test asserted
   `doc.querySelector('[data-cs-block]')===null` (no list offered while nothing is confirmed by him); the rewrite keeps
   only "no capture button". The rest of the rewrite follows the server's new 403 and is right. Correction: put back
   `assert.equal(doc.querySelector('[data-cs-block]'),null)` after the refusal.
6. **Focus can be moved on a page he has gone to.** `subject.js` 388: `focusRow` searches the whole `document`, and runs
   after the awaited refresh and callback. If he presses Stop and goes to Check for the same subject before the answer,
   the new page's matching row or first block button takes focus. Correction: skip `focusRow` when the scope is gone (the
   screens pass an aborted test, or check `ctx.signal.aborted` through a `live()` option) and search only inside the block
   the press came from.

## Notes

1. **The two edits outside the marked blocks are safe.** `subject.js` `keyOf` (line 540) adds `[data-src=...]` only when
   the focused control has `data-src`, and only the Stop and Use again buttons carry it, so every other key is unchanged.
   Source ids cannot repeat in one list: `added()` keeps a source either in `records` or in `stopped`, never both, and
   detached rows are only those not in the attached list. A row without an id would key on `[data-cs=stop]` alone and
   land on the first such button, which is harmless; the server always sends an id. `check.js` `keepFocus` (line 230)
   keeps its old path first (`data-ck`); the new branch runs only for a `[data-cs]` control with a source id, and the
   summary's new `data-ck="proof"` is ignored by `onClick` (no matching action), so the details still open and close
   natively and the focus returns to the summary after a repaint.
2. **Row words are consistent between the screens**, because both draw through the same `say()` in `subject.js`. Against
   Decision 6: "Used for Check", the set aside and changed lines, "Not used for Check. You stopped it.", "Use for Check
   again", the toast "Check no longer reads this." all match. "Already used for Check" no longer appears on either screen
   (the server's reason is replaced on used rows). The row loses the server's "and not reviewed again" for a source
   changed and not reviewed again; its row has no control to recapture it, so he does not learn why from the row.
3. **Tests were not otherwise weakened.** `/Already used for Check\./` became `/Used for Check/` with a `doesNotMatch
   /Already used/`; the pattern is case-sensitive, so it cannot match "Not used" or "Use it for Check". The added tests
   cover the press body, no automatic run after a stop, held after a stop elsewhere, a damaged record staying out of date,
   and an assistant's refusal on both screens. Missing: the done line after a stop (Must fix 1), a lost answer, a change
   from another tab, the detached row.
4. **Version three** (`public/v3/index.html` 38 and 47, and its stylesheets 16 and 22) loads both files unchanged, so every
   change here appears in the default front too, identically (run at 390 and 1440). Nothing in version three overrides
   them. His before and after pictures should be taken in version three as well as version two.
5. A stale press answers "This changed since it was opened here. Read it again before saving." The list has already been
   read again by then, and nothing is being saved. Minor; a screen-specific sentence would read better.
6. On opening Check with an out-of-date receipt, the first paint says "Outdated check" until the list arrives, then turns
   to held. It is a short flicker on a slow line, not a wrong end state.
7. `refresh()` and `load()` in `createCaptureSources` can overlap (refresh does not look at `S.loading`); the later answer
   wins. Not seen to matter.

## The walk's step 9 finding ("Home did not show the new subject"), settled

Not a fault of this stage, not the standing change and not the merge with main. It is the walk meeting Home's own cut.

- Home groups by folder by default; a new subject lands in "Not in a folder", sorted by hand order and then by title, and
  that group shows its first 8 (`public/v2/screens/home.js` 55 `CUT.folder=8`, 236 to 237, 367), with "Show all N".
- On a fresh demo after `demo:fill` the group holds five demo subjects plus the walk's four. "Journey walk 390 light <stamp>"
  is fifth by title, so it shows. First run here: no break.
- On a demo that has already been walked, the group holds eight walk subjects. The fourth walk's subject is then 8th or 9th
  by title, decided by its four-letter stamp (`scripts/review-journey.mjs` 35, the last four base-36 digits of the clock,
  which is not ordered across runs). When the new stamp sorts after the old one, it is 9th and hidden behind "Show all".
  Second run on the same demo, stamp "kjem" after "8q8r": exactly the reported break, "[09; 390 light] Home did not show
  the new subject among its subjects", and nothing else new. This also explains why it appeared with the screen files
  reverted (same demo) and not on main's walk (a fresh demo).
- Correction, in `scripts/review-journey.mjs` 502: before looking for the row, open its group (press the "Show all" button
  of the group that would hold it, or use Home's find box with the subject's name), or make every walk's subject sort first
  (for example a name starting with the width and an ordered stamp). Until then, run the walk only on a fresh demo.

## Can it ship

Yes, once Must fix 1 is in and its two assertions added. The should-fix items are worth doing in the same pass; none
writes anything wrong, and every press ends with the list showing what the server holds.

## Corrections made

All items above are corrected in `public/v2/screens/subject.js` and `public/v2/screens/check.js`, with tests in
`tests/v2-subject.test.mjs` and `tests/v2-check.test.mjs`, and the walk fixed in `scripts/review-journey.mjs`.

- Must fix 1: a successful Stop clears "Check can now read this" on the subject page and in Check (asserted in both test files).
- Should fix 1: both screens read the list again on a `study-draft.capture-sources*` change from another tab.
- Should fix 2: when the answer to a press never comes back, the screen reads the list again and says the new line below
  instead of "Nothing was changed."
- Should fix 3: "No longer attached" is recognised from the list's fields (`captured`, `capturedCurrent:false`,
  `changedSinceCapture:false`), not from the server's sentence.
- Should fix 4: a captured source that cannot be read says its own words, not "Changed in the Library since".
- Should fix 5: the assistant's Confirm test asserts again that no Sources list is shown.
- Should fix 6: focus never moves once the screen has closed or the page the press came from is gone, and only
  looks inside that page.
- Walk: step 9 opens every "Show all" on Home before looking for the new subject.

The exact words of every row state (no em dash):

| state | row says | control |
| --- | --- | --- |
| used | "Used for Check" | "Stop using for Check" |
| used, set aside since | "Used for Check. Set aside in the Library since." | "Stop using for Check" |
| used, changed since | "Used for Check. Changed in the Library since." | "Stop using for Check" |
| used, no longer attached (new in this table) | "Used for Check. No longer attached to this subject." | "Stop using for Check" |
| used, cannot be read (new) | "Used for Check. This material could not be read." | "Stop using for Check" |
| stopped | "Not used for Check. You stopped it." | "Use for Check again" |
| after Stop | toast "Check no longer reads this." | |
| answer lost (new) | toast "The answer did not come back. The list shows what is on file now." | the list shows what the server holds |
| assistant's page, any press | the client's 403 sentence | the same control, shown |

## Re-check of the corrections

Re-checked 12 November 2026 on the commit "Sources list: corrections after review, and the walk opens Show all before
looking on Home", by a different reviewer, by reading it and running it. No code was changed; this section is the only write.

What was run:

- `node --test tests/v2-subject.test.mjs tests/v2-check.test.mjs tests/v2-shell.test.mjs`: 104 pass, 0 fail.
- The same two test files run against the screen files of the commit before the corrections (in a scratch copy, not in
  this worktree): exactly the 7 new tests fail, the other 70 pass. So each new test catches the fault it names.
- A fresh demo on 8867, `demo:fill`, the walk twice on that one demo, then a Playwright probe as the owner and as
  `?reviewActor=agent:claude-code` on the walk's subjects, in version two at 1440. Ports 8841 and 8854 were never used; the
  demo was stopped by its process ids and 8867 answered nothing afterwards.

Each correction, seen in the browser:

- Must fix 1: on the subject page, Stop, then "Use for Check again", then Stop again. After the first Stop the row says
  "Not used for Check. You stopped it." with "Use for Check again" and the toast "Check no longer reads this."; after
  again, "Used for Check", "Stop using for Check" and "Check can now read this"; after the second Stop the block no longer
  says "Check can now read this", read at 0.3 and 2.8 seconds. In Check the same sequence ends at "Checks held. No source
  to check against yet." with the Sources block and no "Check can now read this"; no check was run by itself after either
  stop (no POST to the check), and one ran after "Use for Check again", as after any capture. Focus landed on the new
  control each time and stayed there after the change stream's repaint.
- Should fix 1: a stop made in a second tab reached the first tab's subject page in about a quarter of a second. With the
  first tab on Check, the second tab's again turned it to "Mechanical checks complete", and its stop back to "Checks held"
  with the stopped row, with no reload.
- Should fix 2: a Stop whose request reached the server (200) but whose answer was cut in the page ends with the row
  saying "Not used for Check. You stopped it." and one toast, "The answer did not come back. The list shows what is on file
  now."; no "Nothing was changed", nothing left disabled. A "Use for Check again" cut before reaching the server says the
  same sentence and the list still shows the stop, which is true.
- Should fix 3 and 4: covered by the widened test (detached row found from the fields, unreadable row says its own words,
  and four Stop controls for the four rows that name a copy). Not reproduced in the browser: the demo has no such rows.
- Should fix 5: the assertion is back.
- Should fix 6: covered by the new test; in the browser focus never moved anywhere odd.
- An assistant's page: Stop answers 403, the toast says "Only Adrian can decide this. Claude can propose it, not do it."
  once (once on the whole page), the list is unchanged and focus stays on "Stop using for Check".

Tests: none weakened. Nothing was removed; the one changed count (2 to 4 Stop controls) follows the two rows added.

The change stream refresh: it cannot loop. `refresh()` only reads the list, and reading writes nothing, so no change event
follows it; five idle seconds after the last press showed no list reads at all. It does not repaint over a press in flight:
the busy flag lives in the shared state and every repaint draws the controls disabled until the press ends, and the
press keeps the list it started from. One small edge remains and is not a fault seen: `refresh()` has no ordering, so an
older read answering last could briefly show an older list; his own press always causes a later change event and a later
read, so the screen settles on the server's truth.

The walk's step 9: run twice on the one demo (the second run on a demo already walked, so Home's group was past its cut).
"Home did not show the new subject" did not appear in either run, at any width or theme. Both runs exit 0 with only the
known "Not built yet" breaks at steps 6, 8 and 8b.

Pictures for him (version two, deviceScaleFactor 2, cropped to the Sources block, 390 light and 1440 dark: the row in use,
the stopped row, Check held after a stop) and a contact sheet were taken outside the repository.

Can it ship: yes. Nothing must still be fixed.
