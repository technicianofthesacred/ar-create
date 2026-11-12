# Write, Read and Check: version three beside version two, in the look Adrian approved

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

**Recommendation in one sentence (amended 12 November):** build the approved look as version three, starting from
copies of main's Write, Read and Check and keeping their saving machinery where it is sound, while version two stays
as main has it, reachable and working, with only three fixes that protect his words.

## Version three beside version two (amended 12 November)

Adrian decided on 12 November: "Yes, everything needs to be the new. But there needs to be a way to access all the
old so that when things are going I can pull from the old as well if I need to, let's call it version two." and
"Version three works for the new one. Version three opens by default on every level." So there are three fronts on
one back end: **Advanced** (`public/document-study/`, untouched apart from its links), **version two** (`public/v2/`
exactly as on main, pull requests 236 to 241), and **version three** (the approved design, in time the whole app). The
approved look is never applied in place to `public/v2/`. This build's stage is Write, Read and Check in version three,
as the pattern; a later director takes Home, the subject page, Research, Capture, the studio and Looks across.

**1. Folder, address and serving.** Version three lives in `public/v3/` and is served at `/v3/index.html` by the same
static server that serves `/v2/index.html` today. In `runtime/server.mjs` the app's own address (`/`) redirects to
`/v2/index.html`, keeping the query; that is how version two took the default from Advanced, while every Advanced
address kept working. Version three takes the default the same way: `/` and `/v3` redirect to `/v3/index.html` with
the query, and `/v2` and `/v2/index.html` keep opening version two. Assistants keep the addresses they are given: the
Advanced address with `?reviewActor=` is unchanged, version two's still works, and version three reads `?reviewActor=`
through the same command client. `docs/START.md` and `AGENTS.md` gain one line naming version three's address.

**How "opens by default on every level" works while version three has few screens: version two's screen modules run
inside version three's frame.** Version two is built so this is possible: its command client (`shell/client.js`), its
shared parts (`shell/parts.js`), Capture (`shell/capture.js`) and the standing rule are separate files, and every
screen only calls the screen contract (`v2.screen`, `v2.call`, `v2.ui`, `v2.shared`, `ctx`), pinned by
`tests/v2-shell.test.mjs`. Version three's own frame (`public/v3/shell/frame.js`) implements that same contract (the
global keeps the name `v2`, as the contract's name, so no version two file changes), loads version two's client,
parts and Capture files unchanged from `/v2/shell/`, then loads version two's screen files from `/v2/screens/` for
every screen version three has not built, and its own files for those it has. A route belongs to whichever file
registered it; version three's file list in `public/v3/index.html` is the route table, and a screen takes over its
address by being swapped in that list. Because routes are hash routes (`#/subject/<id>`, `#/write/<id>?piece=`), a
link drawn by version two's subject page to Write lands on version three's Write, and Write's back link lands on
version two's subject page, all inside version three's frame. A plain line under the bar on a borrowed screen is not
needed; the bar's "Version two" link (point 3) is the way to the old frame.

Weighed against navigating away (a route table that redirects an unbuilt address to `/v2/index.html#<same route>`):
navigating is simpler but takes him out of version three on almost every click today, and once he is in version
two its subject page opens version two's Write, not the approved one, so version three would not be the default on
any level he actually uses. Loading the screens inside one frame keeps him in version three throughout. The danger of
"two shells fighting" is avoided by loading exactly one shell: version two's `shell.js` and its top bar are never
loaded in version three. What must be watched: version two's screens rely on version two's `shell.css` classes and
tokens (the frame stylesheet must supply them, or load `shell.css` before the frame's own styles and override only the
frame); version two's `subject.js` loads the standing rule by a relative `import()` (the build must also copy
`standing.mjs` to `public/v3/shell/`); and two files must never register the same route (the frame refuses it, as
version two's router already does).

**2. Shared or copied, and the saving machinery.** Both fronts use the same commands and records and neither keeps a
private copy of a draft. The command client, parts and Capture are shared files (loaded, not copied), so a fix to
how a command is called lands in both. **The saving machinery is copied**, from the piece 2 tree into
`public/v3/screens/write-page.js`, on purpose: version two is his fallback, and a fallback that changes whenever
version three's saving changes is no fallback; and version three's saving is about to change a great deal (new
element, per-paragraph conflict, recovered view). The risk of the copy drifting on a promise about his words is met by
one shared test suite of those promises (`tests/words-promises.test.mjs`), written once and run against both fronts'
Write against the real in-process server: no word lost through slow, lost or reordered answers, a reload mid-save, a
closed tab, typing during a split, an assistant's words never kept. A fault found in one is tested in both.

Version two gets exactly three fixes, each the smallest change, in `public/v2/screens/write.js` (main's single file):
"Use the saved version" first stores his unsaved paragraphs through `study-draft.set-aside` and only then shows the
saved words; "Keep my words" applies his words only to paragraphs that changed on his side alone, and for a paragraph
changed on both sides shows "Keep yours" and "Keep the saved one" on that pair in the box he already sees; and the
device key becomes one per tab (`ar-v2-write:<bindingId>:<tab id>` under a Web Lock, the old single key still read
and adopted once). Everything else in version two stays byte for byte.

**Version two and version three open on one piece in two tabs.** Their device keys never meet: `ar-v3-write:` against
`ar-v2-write:`, each per tab, each with its own lock, and neither ever writes, adopts or deletes the other's (nor the
Advanced keys). Each says, in one quiet line, when the other front holds unsaved words for this piece on this device,
with a link to it. Saving meets on the server only: both send the revision they read, and a 409 is settled by each
front's own rule (per paragraph in version three, per pair in version two after its fix), with the unkept unsaved
words set aside on the server, so either front can see them in Earlier versions (version three) or through the CLI.
Both post presence, so an assistant sees unsaved words open in either.

**3. Links each way.** In version three's top bar, at the far right where version two has "Advanced", two quiet
links: "Version two" and "Advanced". "Version two" opens `/v2/index.html#<the same route>`, so subject, piece and
section carry (both fronts share the routes). "Advanced" uses the same `advanced({subject, piece, section})` mapping
version two uses. In version two's top bar, beside "Advanced", one new quiet link "Version three" to
`/v3/index.html#<the same route>` (a one-line change in `public/v2/shell/shell.js`, the only version two change beyond
the three fixes). Advanced's existing quiet link, today "Version two", is renamed "Version three" and leads to the
default (`public/document-study/version-two.js`); version two is one more click from there.

**4. When the default switches.** In the same change that adds version three's frame (piece V3-a), because with every
unbuilt screen borrowed from version two nothing is lost: on the day it switches, version three shows version two's
screens, including version two's Write, inside the new frame, and the first screen of its own (Write in the approved
look) arrives in V3-b. Merging to main and releasing need his word anyway; he must be told, before that release, three
things: the app opens version three; screens not yet redone look as they did, inside the new frame; and "Version two"
in the bar opens the old frame at the same place, with Advanced unchanged. If he prefers to wait, the switch is one
line in `runtime/server.mjs` and can be held to the release that brings Write, Read and Check.

**5. How pieces 1 and 2 move across.** Piece 1 (the split into `write.js`, `write-page.js`, `write-margin.js`,
`write-versions.js`) is merged on `claude/v2-write-read-check`; piece 2 (the approved look, the plaintext-only
paragraph element, Enter during a save, Android's newline, the failed-save panel, Focus, the phone bar) sits
uncommitted in `/tmp/wt-build`, under review. Its review goes on; its findings are applied in version three. Then:
restore `public/v2/` and every `tests/v2-*.test.mjs` from `origin/main` (one command, checked by a diff that must be
empty); copy the piece 2 tree's `write.js`, `write-page.js`, `write-margin.js`, `write-versions.js` and `write.css`
into `public/v3/screens/`, and its Read and Check bar changes into copies of `read.js` and `check.js` there; move
piece 2's new tests to `tests/v3-write.test.mjs` and `tests/v3-write-editing.browser.mjs`, pointed at `public/v3/`.
The tests that pin version two's Write, Read and Check stay, unchanged, against version two.

## Part by part: kept, kept with changes, or replaced

Read this section as describing version three's copies of main's screens. Version two keeps main's behaviour apart
from the three fixes above.

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


## The old workspace and version two

Advanced's Write, Read and Check and their tests stay as they are; nothing under `public/document-study/` changes
except the landing work below and its one link, renamed "Version three". Version two stays as on main apart from the
three fixes and its "Version three" link. Neither is retired in this build. Advanced is retired only when Adrian says
so after writing in version three for a while, and every old page test that guards his words has a version three test
for the same promise, listed in a table in this file. Version two stays as long as he wants something to pull from.

The sturdy way to open one exact piece in Advanced is not on main. The two commits `846483b` and `2a19de8` (`openPlace`
in `public/document-study/version-two.js`, `tests/v2-advanced-landing.test.mjs`,
`scripts/review-advanced-addresses.mjs`) are on `claude/v2-write-read-check`, apply cleanly to main, and reach it with
this branch. The small fixes of `b7d8c75` are already on main in substance, through `claude/v2-small-fixes`; when
`public/v2/` is restored from main they must not come back in.

## The five blockers from his real records

1. His Magazine work is not on Home: stage 4 made his stories subjects; editing a story stays off. Piece V3-12 turns
   it on in version three, which is what lets him actually work on his stories.
2. Raw machine text in a subject's header: done in stage 4, to be checked on his Mac. Not this build.
3. Nothing he would make can be made in the new front: this build removes it for an Article and an Instagram
   Carousel, in version three. Older Outputs carousels stay read only.
4. Research empty and The facts says more than it shows: not this build.
5. Slower with real records: not this build; version three's frame must add no read on load beyond version two's,
   and must keep the shell's warmed reads (`?only=commands`, the first standing read).

## The pieces, in order

Each piece: one worker, a second model reviews. Sonnet unless named. Every visible piece ends with pictures of the
demo at 1440 and 390, dark and light, beside the mock-up, and the sideways check plain and with `--stress` (taught to
visit version three in V3-a). Every piece keeps green: the whole `npm test`, every `tests/v2-*.test.mjs` unchanged,
`tests/words-promises.test.mjs` against both fronts once it exists, and `node --test public/document-study/*.test.mjs`
with only its three known failures. "Version two gets" names the only change a piece may make under `public/v2/`.

- **V3-a. Version three's frame, the default, the fallbacks and the links each way.** Visible (a new frame around
  version two's screens). Files: `public/v3/index.html`, `public/v3/shell/frame.js`, `public/v3/shell/frame.css`,
  `public/v3/README.md`, `runtime/server.mjs` (the redirects), the build's copy of `standing.mjs`,
  `scripts/review-sideways.mjs` (`--v3`), new `tests/v3-shell.test.mjs`; one line in `public/v2/shell/shell.js` (the
  "Version three" link) and the renamed link in `public/document-study/version-two.js`. Must read: version two's
  `shell/*.js`, `README.md`, `tests/v2-shell.test.mjs`, `runtime/server.mjs` near the redirect, the mock-up's `top()`
  and its header band. Tests: `/` and `/v3` open version three with the query kept; `/v2` and every Advanced address
  open as before; each of version two's screens registers and renders inside the frame against the real server; a
  link from a borrowed subject page reaches a version three route; two files claiming one route are refused; the
  "Version two" and "Advanced" links keep subject, piece and section; an assistant's `?reviewActor=` is carried. Medium
  to large. **Opus**, because the frame must honour every promise of version two's contract; Sonnet reviews.
- **V3-b. Write in the approved look moves into version three, and version two is restored.** Visible. As in point 5
  above. Files: `public/v2/` and `tests/v2-*.test.mjs` restored from main; `public/v3/screens/write*.js`,
  `write.css`, `read.js`, `read.css`, `check.js`, `check.css` (copies); `public/v3/index.html` (swap in these routes);
  `tests/v3-write.test.mjs`, `tests/v3-write-editing.browser.mjs`. Version two gets: nothing (restored exactly). Proof:
  `git diff origin/main -- public/v2 tests/v2-*` is empty apart from V3-a's one link line. Medium. Sonnet, Opus
  reviews. Runs after V3-a; piece 2's review findings are applied here.
- **V3-0. The Advanced landing.** Already on the branch; check it still passes after V3-b. Not visible. Small.
- **V3-1. Words promises and the three fixes in both fronts.** Visible. Per-paragraph conflict, per-tab keys, the
  recovered view and set-aside in version three (`public/v3/screens/write-page.js`, `write.css`); the
  `study-draft.set-aside` commands (`runtime/services/`, `runtime/commands.mjs`); `tests/words-promises.test.mjs`,
  `tests/study-draft-set-aside.test.mjs`. Version two gets: the three fixes in `public/v2/screens/write.js` and tests
  for them added beside, not in place of, its own. Tests: two doors change different paragraphs and both survive; both change one paragraph and both are shown, the unkept one in set-aside; two tabs of one front both keep their unsaved words; a crashed tab's words shown once, in one tab only; an Advanced key is never written or deleted; set-aside refuses an agent; and the two-front case: version
  two and version three open on one piece, both type, neither's words are lost, adopted twice or deleted by the other.
  Large. **Opus**; Sonnet reviews.
- **V3-2. Read in the approved look** (former 4). `public/v3/screens/read.js`, `read.css`. Visible. Small to medium.
  Version two gets nothing.
- **V3-3. Proposals with before and after, and the selection margin** (former 5). 3a server, **Opus**, small to
  medium (paragraph-scoped freshness in `runtime/services/study-mcp-bridge.mjs`; this changes behaviour for every
  front, harmlessly: it accepts more and refuses the same changed paragraphs). 3b `public/v3/screens/write-margin.js`,
  `write.css`, `study-draft.note`. Visible. Medium. Version two gets nothing.
- **V3-4. Quotes and the sources column** (former 6). `public/v3/screens/write-sources.js` (new, listed in
  `public/v3/index.html`), `study-draft.quote-link`. Visible. Medium.
- **V3-5. Start from your own words** (former 7). `public/v3/screens/write-page.js`, `study.own-words`. Visible.
  Medium. Opus reviews.
- **V3-6. Earlier versions** (former 8). `public/v3/screens/write-versions.js`, `study-draft.history-summary`,
  `study-draft.history-name`. Visible. Medium.
- **V3-7. Check in the approved look** (former 9). `public/v3/screens/check.js`, `check.css`,
  `study-draft.authorship`, `study-draft.check.answer`. Visible. Medium. **Opus**.
- **V3-8. The Carousel written on its slides** (former 10). 8a server, **Opus**, medium (`instagram.words`,
  `instagram.fit`, `instagram.caption.save` and undo). 8b `public/v3/screens/slides.js` and `slides.css`, a copy of
  version two's studio whose middle and right column become Write for a Carousel; its Layout, Photographs, Add and
  Words tabs, looks, accounts and templates carry over as they are. Large. Visible. Version two's studio is unchanged
  and its words stay read only there. This is the first piece of the studio in version three; the later director
  builds the rest on it rather than beside it.
- **V3-9. Speak, to its edge** (former 11). `public/v3/screens/write-page.js`. Small. Visible.
- **V3-10. Finished** (former 12). `public/v3/screens/check.js`, `study.outputs.mark-finished` and its undo. Small.
  Visible.
- **V3-11. Write for a Magazine story switched on** (former 13), in version three only; version two's
  `STORY_EDITING` stays false. Large. **Opus**, reviewed twice.

At the same time: V3-a first, alone, since every later piece loads through its frame; V3-3a and V3-8a (server only)
may run beside it. After V3-b: V3-1 and V3-2 together; then V3-3b, V3-4, V3-6 and V3-7 in any order (separate files);
V3-5 after V3-1 (both in `write-page.js`); V3-8b after V3-8a; V3-9 and V3-10 last. Server pieces all touch
`runtime/commands.mjs`; run them one after another or let the director join the registry lines.

## Where his words are most at risk

1. **V3-1 in both fronts, and V3-b's move.** The new element under the save loop, the per-paragraph conflict, and
   two fronts with two device stores on one piece; and, in V3-b, a restore that must not drop a fix version two
   needs. Review: the shared promise suite against the real server with answers held back, lost and reordered, a tab
   killed mid-save, both fronts typing on one piece; typing in a real browser at 390; a second reviewer who tries to
   break it; and an empty diff of `public/v2/` against main apart from the named lines.
2. **V3-3a, accepting a proposal after other typing.** An assistant's words could land on a paragraph he changed. A
   second model reads only the freshness rule, with a test for each refused case.
3. **V3-8a, his typed words on a slide.** An assistant's slide words must still be exactly what was said: every
   existing Instagram exact-words test unchanged, and new 403 tests.

## Not in this build

Home, the subject page, Research, Capture, Looks and the rest of the studio in version three (a later director, with
this stage as the pattern; until then they are version two's screens in version three's frame); speech to text; an AI
engine for checking claims and notes; Research looking for a source; Read and Check for a Carousel; editing older
Outputs carousels; retiring Advanced or version two; type outside the six sizes on the page unless Adrian approves it.

## What I am least sure of

- That version two's screens look and behave exactly as at home inside version three's frame: their styles depend
  on `shell.css`, and anything they read from version two's own shell beyond the documented contract will break there.
  V3-a must prove each screen, not just the router.
- Whether Adrian is content that the day version three becomes the default, most of what he sees is version two
  inside a new header.
- Whether a copied saving machine and one shared test suite keep the two fronts honest, or whether a later fault is
  fixed in one and missed in the other.
- That `plaintext-only` editing and the Highlight API behave on his phone's keyboards; a real iPhone before V3-b
  counts as done.
- Whether a paragraph changed on only one side may be taken without asking him.
- Which record holds "the order of his plan" for Start and "a part not written" for Check.
- Whether his own typed words on a slide change what a Carousel promises him, and whether the later director will
  accept taking the studio over from V3-8 rather than whole.
