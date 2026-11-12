# Write, Read and Check: from what is on main to the look Adrian approved

Written 12 November 2026 by the architect thread, for the director. It replaces no earlier record; it is the plan for
the next build. The approved look is the clickable mock-up in `design/2026-11-write/` (index.html, app.css, app.js,
NOTES.md). A designer is making one more pass on its styling only; builders take styles from the mock-up's files as
they stand on the day they start. Adrian's words on approving: "Okay, let's go. Do all this; as I start using it, I can
always adjust it."

## Where main stands

Main already has Write, Read and Check inside version two (pull requests 237 to 241). `public/v2/screens/write.js`
(94 KB) reads the draft with `study-draft.read` and saves with `study-draft.save`, one plain textarea per paragraph,
with splits and joins sent as the server's own operations, autosave after 1.5 seconds, Undo by operation, his unsaved
words kept on the device under `ar-v2-write:<bindingId>` with the operations still in flight, an assistant's page read
only, suggestions decided with `study-ai.accept`, `study-ai.reject` and `study-ai.finish`, and an Article made from his
first saved words (`study.outputs.create`). `read.js` shows the saved words with nothing to edit. `check.js` runs and
shows `study-draft.check`, decisions in the piece, and truth and consent, all read only. The slide studio
(`slides.js`) shows an Instagram plan's slides with words read only, and older Outputs carousels wholly read only.
Write for a Magazine story is built but switched off (`STORY_EDITING`) until four faults are corrected.

How far from the approved look (see the contact sheet `main-vs-approved.png` in the architect's scratchpad): the
frame is close (top bar, piece bar, Article and Carousel tabs, Write, Read, Check), but the page and the margin are
not. Main's page has no title of the piece, no quote rings, no kept-phrase hairline, no wash on words a proposal is
about, and suggestions show as text with buttons, not as before and after with a count. Read has no pictures and no
"Check it". Check lists findings as messages, not as his sentence beside the source's sentence with one-press actions.
Earlier versions, the sources column with Play and Quote, Start from your own words, selection choices in the margin,
the conflict paragraph by paragraph, the recovered view, Finished and the Carousel written on its slides are absent.

**Recommendation in one sentence:** apply the approved look to main's three screens and the studio, keeping main's
saving machinery where it is sound, changing its editing element and its conflict handling, and adding what the
approved design asks for, never a second set of screens beside it.

## Part by part: kept, kept with changes, or replaced

- **Editing surface: replaced, the element only.** A textarea cannot carry a ring after a closing quote mark, a hairline
  under a kept phrase or a wash on a proposal's words, and rule 4 forbids anything inside his prose but his words. Each
  paragraph becomes one `contenteditable="plaintext-only"` element; the hairline and the wash are drawn with the
  browser's Highlight API (`::highlight`), which adds nothing to the text; the ring is one non-editable node after
  the closing mark that the reader of the paragraph's text skips. One editable element per paragraph, not one for the
  page, because main's paragraph model (row ids, `minimalDiff`, `buildOps`, sent tracking, `adopt`) is sound and tested,
  every selection choice in the mock-up acts within one paragraph (as the existing exact-wording rule already requires),
  and a phone keyboard behaves better in a small element. `beforeinput` with `insertParagraph` also cures the open
  fault that Android's Enter becomes a space. Where the Highlight API is missing the marks are simply not drawn.
- **Saving: kept.** The 1.5 second autosave, the revision sent with every save, operation ids kept across a reload and
  replayed, never treating his own committed save as newer. Kept with two changes: the open "jjoinedoined" fault (hold
  the paragraph until its split is saved, then place the caret from the saved answer), and the failed-save bar of the
  mock-up ("Not saved since 14:06", Try again on the same line, the times tried, "Copy all my words").
- **Conflict: replaced.** Main offers "Keep my words" for the whole piece, which writes his paragraphs over the other
  version's, or "Use the saved version", which throws his unsaved words away. Both break "both versions kept". New
  rule, per paragraph: a paragraph changed only on one side takes that side, with a quiet line saying so; a paragraph
  changed on both sides shows both, differences marked, "Keep this one" on each; the version he does not keep, if it
  is his unsaved one, is stored on the server by a new human-only command before it leaves the page. Nothing is mixed
  inside a paragraph. The saved version he does not keep stays in Earlier versions as it already is.
- **Recovery on the device: kept with changes.** Keep main's store and its own prefix, separate from the old
  workspace's `ar-document-study-owned-drafts-v1` keys and locks, so the two doors never share or fight over a record.
  Change: one key per tab (`ar-v2-write:<bindingId>:<tab id>`, the old single key still read), held by a Web Lock for
  the tab's life, because two version two tabs on one piece today write one key and the later write replaces the
  earlier tab's unsaved words. A key whose lock is free after a reload is a closed or crashed tab's: if its in-flight
  operation committed (`study-draft.inspect`) or its words equal the saved ones, it is dropped silently; otherwise it
  is shown once, as the mock-up's "recovered" view (Saved beside Kept on this device, with the count), and it is
  dropped only after he puts it in (a save that commits) or keeps what is saved (the device words go to the server's
  set-aside store first). The adopting tab takes the old key's lock, so two tabs never show the same words. When the
  old workspace holds unsaved words for the same piece on this device, version two says so in one quiet line with
  "Open in Advanced" and does not adopt them; the old workspace keeps recovering its own, as its tests prove.
- **Starting from nothing: kept, and extended.** Main's empty page that makes the Article from his first saved words
  stays. Added: the mock-up's start view with his own sentences gathered and "Start from your own words", Type, Speak.
- **Proposals: kept with changes.** Same commands. The margin shows before and after with the plain count; "Edit it
  first" is `study-ai.accept` with his `replacements`, as main already does for "Rewrite it as mine"; Undo undoes that
  accept by its own operation (main already does). Changed on the server: today an accept is refused when anything in
  the draft changed since the request was prepared, so with autosave every proposal goes stale as soon as he types
  anywhere. It must be refused only when a paragraph the proposal touches changed.
- **Earlier versions: new.** Nothing on main. Built on `study-draft.read`'s history rows (operation, kind, actor,
  time), `study-draft.history-preview` and `study-draft.history-restore`.
- **Check's findings with evidence: kept with changes.** The check run and its receipt stay. Each finding is shown as
  the mock-up shows it, with his sentence beside the source's and one or two actions; kinds that need an engine say
  they are not built yet.
- **The Carousel on its slides: replaced in the studio's middle and right column, kept underneath.** The studio's
  plan reading, layouts, looks, accounts and templates stay; the slide in the middle becomes editable.
- **Dictation: new, to its edge.** The quiet Speak control and the editor's way of placing words at the caret; no
  engine, and it says so.
- **Finished: new.**
- **The way back: kept with a change.** The bar's back link names the subject and returns to `subject/:id` with the
  form and step open, as the subject page's own address already allows.
- **Addresses: kept.** `#/write/<subject>?piece=<id>`, `#/read/...`, `#/check/...` and `#/slides/<plan>` stay; added
  are `&panel=versions`, `&view=start` and, for the studio, `?subject=<id>` so the back link and tabs know the subject.
  The subject page's Write already opens the piece he came from for an Article; for a Carousel it will open the studio
  as Write; for a subject with nothing written it opens Write's start view (main's `start=article`).

## What binds, whatever the piece

His exact words are never changed or lost; never last-write-wins; an assistant proposes and never writes prose (an
agent actor gets 403); every write names its author; version two keeps no private copy of a record except unsaved
words on the device; every ability is a command in `runtime/commands.mjs`; old records work without migration; no
test is skipped or weakened. Tests stand in for Adrian with the header `X-AR-Actor: human:adrian` and prove the 403
for an agent. Parts needing an engine not yet chosen are built to their edge and say "not built yet".

## Commands, changed and new

Changed: `study-ai.accept` and `study-ai.finish` check freshness per touched paragraph (the paragraph hashes the
proposal was made against), then apply against the current revision; all else refuses as today.

New (registry style, each with its store under the home's `data/` through the existing helpers):

- `study-draft.set-aside` (human, write) and `study-draft.set-aside.list` (any, read): words of his kept off the page
  (from a conflict, a recovery or a failed save), with the paragraph id, the hashes they were based on, reason, actor
  and time. Shown in Earlier versions. Never written into the draft by itself.
- `study-draft.history-summary` (any, read): per saved operation, the paragraphs changed, words added and taken away,
  the nearest heading, actor and time, so each version reads "Two sentences typed in The straw".
- `study-draft.history-name` (human, write): a name for one version, kept for good.
- `study-draft.note` (human, write, undo `study-draft.note.undo`): "Add a note for myself", anchored to a paragraph
  and its words, kept beside the draft, never in the prose.
- `study-draft.quote-link` (any, write): a quote's words in a paragraph tied to its source and line, so the ring opens
  her exact line; an assistant may link, since a link is evidence, not prose.
- `study-draft.authorship` (any, read): spans still exactly an assistant's accepted words, from the accept decisions
  and the current paragraphs.
- `study-draft.check.answer` (human, write, undo): his answer to a finding ("Keep it: I know this myself").
- `study.own-words` (any, read): his sentences from transcripts whose speaker is confirmed as him, his captured
  contributions and his named dish, each with source, line and time; unconfirmed speakers left out and counted.
- `study.outputs.mark-finished` (human, write, undo `study.outputs.unmark-finished`): records the Article finished
  with the hash of its words, after `study.outputs.refresh`.
- `instagram.words` (human, write): his own typed words on one slide, allowed only for a human; an assistant's words
  on a slide must still be exact slices of what was said. Words longer than the layout holds are saved and marked as
  not fitting; `instagram.ready` refuses while any slide does not fit.
- `instagram.fit` (any, read): per slide, characters and lines against what the layout holds and where the renderer
  cuts, from the real renderer (`runtime/services/carousel-fit.mjs`).
- `instagram.caption.save` (human, write, undo `instagram.caption.undo`): his post text as a draft with revision
  checks, so it is no longer kept only on `instagram.ready`.
- Conditional: `study-draft.capture-sources` (human, write) exactly as proposed in the open corrections file, only if
  Adrian says yes.

## The old workspace

Its Write, Read and Check and their tests stay as they are; nothing under `public/document-study/` changes except the
landing work below. They are retired later only when Adrian has written in version two for a while and says so, and
every old page test that guards his words has a version two test for the same promise, listed in a table in this
file. Not in this build.

The sturdy way to open one exact piece in the old workspace is not on main. The two commits on
`claude/v2-write-read-check` after `b7d8c75` (`846483b`, `2a19de8`: `openPlace` in
`public/document-study/version-two.js`, `tests/v2-advanced-landing.test.mjs`, `scripts/review-advanced-addresses.mjs`)
apply cleanly to main and should be carried across. The small fixes of `b7d8c75` are already on main in substance,
through `claude/v2-small-fixes`; do not carry that commit.

## The five blockers from his real records

1. His Magazine work is not on Home: stage 4 made his stories subjects; editing a story stays off. Piece 13 turns it
   on, which is what lets him actually work on his stories here.
2. Raw machine text in a subject's header: done in stage 4, to be checked on his Mac. Not this build.
3. Nothing he would make can be made inside version two: this build removes it for an Article and an Instagram
   Carousel. Older Outputs carousels stay read only.
4. Research empty and The facts says more than it shows: not this build.
5. Slower with real records: not this build; Write must add no read on load beyond main's.

## The pieces, in order

Each piece: one worker, a second model reviews. Sonnet unless named. Every visible piece ends with pictures of the
demo at 1440 and 390, dark and light, beside the mock-up, and the sideways check plain and with `--stress`. Every
piece keeps green `tests/v2-write.test.mjs`, `v2-write-start.test.mjs`, `v2-read.test.mjs`, `v2-check.test.mjs`,
`v2-shell.test.mjs`, `v2-subject.test.mjs`, `v2-slides-looks.test.mjs`, `v2-slides-outputs.test.mjs`,
`v2-story-words.test.mjs`, the whole `npm test`, and `node --test public/document-study/*.test.mjs` with only its
three known failures.

0. **Carry the Advanced landing across.** Not visible. Files: the three above. Small. Sonnet, Opus reviews. Runs
   alongside anything.
1. **Split Write into files.** Not visible. `write.js` becomes `write.js` (screen, bars, address), `write-page.js`
   (paragraphs, saving, device keeping), `write-margin.js` (suggestions, selection, notes), `write-versions.js`, each
   registered through `v2.shared.write`; `index.html` lists them. No behaviour changes; every existing test passes
   unchanged. Small. Sonnet, Opus reviews. Everything after depends on it.
2. **Write in the approved look, with the new editing element.** Visible. Files: `write.js`, `write-page.js`,
   `write.css`, `tests/v2-write.test.mjs`; read the mock-up's `article()`, `pbar()`, `status()`, `saveItem()`. The
   piece title, the page, the piece bar with one status place, Undo, Versions (opening "not built yet" until piece 6),
   Sources, Focus, the failed-save bar and Copy all my words, the hold during a split, Android Enter. Tests: typing,
   pasting and composing (IME) keep exact words; a ring node never enters saved words; Enter during a save keeps
   letter order; Copy all my words copies unsaved words. Large. **Opus**, because the element changes under a live
   save loop; Sonnet reviews.
3. **Conflict per paragraph, per-tab keeping, recovered view, set-aside.** Visible. Files: `write-page.js`,
   `write.css`, `runtime/services/study-draft-copies.mjs` (or a small new store beside it), `runtime/commands.mjs`,
   new `tests/v2-write-conflict.test.mjs`, `tests/study-draft-set-aside.test.mjs`. Tests: two doors change different
   paragraphs and both survive; both change one paragraph and both are shown, the unkept one is in set-aside; two v2
   tabs on one piece both keep their unsaved words; a crashed tab's words shown once, in one tab only, and not again
   after keeping; an old-workspace key is never written or deleted; set-aside refuses an agent. Medium to large.
   **Opus**; Sonnet reviews. Can run beside piece 4.
4. **Read in the approved look.** Visible. Files: `read.js`, `read.css`, `tests/v2-read.test.mjs`. Pictures, rings,
   "Change this paragraph" and "Add a note for myself" on a paragraph, "Check it", Claude checking with Stop
   (`study-ai.cancel`). Small to medium.
5. **Proposals with before and after, and the selection margin.** Visible. 5a server (**Opus**, small to medium):
   paragraph-scoped freshness in `runtime/services/study-mcp-bridge.mjs`; tests that a proposal is accepted after he
   typed elsewhere and refused after he changed its paragraph. 5b screen: `write-margin.js`, `write.css`; the count,
   Edit it first, Keep my words, Undo; selection gives Keep these words exactly (`study-ai.human-contract`), Ask Claude
   for another way (`study-ai.prepare`, then `study-ai.run` where an engine is connected, else it waits for an
   assistant and says so), Add a note (`study-draft.note`). Medium.
6. **Quotes and the sources column.** Visible. `write-margin.js` or a new `write-sources.js`, `study-draft.quote-link`,
   `study.source-context`, `study-originals.audio`. Transcript lines with Play and Quote; a quote put in at the caret
   with its ring; the ring opens her line under the paragraph. Medium.
7. **Start from your own words.** Visible. `write-page.js`, `study.own-words`. Gathered in the order of his plan where
   a sentence names a part, else in time order; no engine. Medium. Opus reviews.
8. **Earlier versions.** Visible. `write-versions.js`, `study-draft.history-summary`, `study-draft.history-name`,
   set-aside words listed. Restore makes his current words a version too. Medium.
9. **Check in the approved look.** Visible. `check.js`, `check.css`, `study-draft.authorship`,
   `study-draft.check.answer`. Computed now: a quote that differs from its source (the existing check), a sentence still
   Claude's (authorship), a part not written (the plan's parts against the headings, once the record holding his plan
   is confirmed). Waiting for an engine, shown as not built yet: a note that disagrees, a claim nothing supports.
   "Change the page to ..." is a save by him. Medium. **Opus**, for what counts as still Claude's.
10. **The Carousel written on its slides.** Visible. 10a server (**Opus**, medium): `instagram.words`,
    `instagram.fit`, `instagram.caption.save` and undo in `runtime/services/instagram-studio.mjs`; tests that an
    agent's typed slide words still answer 403 and that ready refuses a slide that does not fit. 10b studio (large):
    `slides.js`, `slides.css`; the slide edited in place, the meter, the layout part with "Change the layout", the
    photograph part, proposals on the slide, the post text under the post with where "more" falls; slide words and
    post text kept on the device like Write's. Subject's "The slides" and "The post text" open it.
11. **Speak, to its edge.** Visible. Quiet Speak at the caret, in the bar, in each part to write; pressing it says not
    built yet; the page's place-at-caret path tested with invented words. Small.
12. **Finished.** Visible. `check.js`, `study.outputs.mark-finished` and its undo; then Go to Share. Small.
13. **Write for a Magazine story switched on.** Visible. The four faults in the open corrections file, on the new
    element. Large. **Opus**, reviewed twice.

At the same time: 0 with anything; after 1, pieces 2 and 5a and 10a; after 2, pieces 3 and 4; then 5b, 6, 8 and 9 in
any order (separate files); 10b after 10a; 11 and 12 last. Server pieces all touch `runtime/commands.mjs`; run them one
after another or let the director join the registry lines.

## Where his words are most at risk

1. **Pieces 2 and 3, the new element under the save loop and the paragraph conflict.** A word lost to a caret race or
   carried onto the wrong paragraph. Review: a fault-injecting run against the real server (answers held back, lost,
   reordered, a 409 mid-typing, a tab killed mid-save) and typing in a real browser at 390, plus a second reviewer who
   tries to break it.
2. **Piece 5a, accepting a proposal after other typing.** An assistant's words could land on a paragraph he changed.
   Review by a second model reading only the freshness rule, with tests for each refused case.
3. **Piece 10a, his typed words on a slide.** The rule that an assistant's slide words are exactly what was said must
   still hold. Review: every existing Instagram exact-words test unchanged and green, and new 403 tests.

## Not in this build

Speech to text; an AI engine for checking claims and notes; Research looking for a source; Read and Check for a
Carousel (the mock-up shows them only as notes); editing older Outputs carousels; retiring the old workspace; type
outside the six sizes on the page unless Adrian approves it (the mock-up's 32 pixel title).

## What I am least sure of

- That `plaintext-only` editing and the Highlight API behave on his phone's keyboards; it has to be tried on a real
  iPhone before piece 2 counts as done.
- Whether Adrian accepts that a paragraph changed on only one side is taken without asking him.
- Which record holds "the order of his plan" for Start and "a part not written" for Check.
- Whether allowing his own typed words on a slide changes what a Carousel promises him.
- Whether the story faults (piece 13) can be fixed in `mag-edit.mjs` or need paragraphs with marks kept read only.
