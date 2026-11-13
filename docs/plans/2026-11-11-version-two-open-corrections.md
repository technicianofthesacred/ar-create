# Version two: what is open

Brought up to date 11 November 2026 by the director thread that took the build over from the design-round thread.
The contract and the record are `2026-11-11-version-two.md`. The builders' briefs are in `version-two-briefs/`.

## Where each piece is

Everything below is merged into `claude/direction-d-build`. The four work-in-progress branches
(`claude/v2-wip-home`, `-subject`, `-research`, `-advanced-link`) are spent; nothing more is to be taken from them.

| Piece | State |
|---|---|
| Shell, fuller demo, slide studio, Looks | In, reviewed |
| Where a subject stands (`subject.standing`, `subjects.standing`) | In, reviewed twice |
| Home | In, reviewed, corrections made |
| Subject | In, reviewed, corrections made |
| Research (list, group, topic) | In, reviewed, corrections made; re-check of the four that mattered was running at the time of writing |
| Advanced lands on the right section | In, reviewed |
| Write inside version two (stage 1) | In, reviewed three times, corrections made |
| Read and Check inside version two (stage 2) | In, reviewed twice, corrections made |
| Capture inside version two (stage 3) | In, reviewed three times, corrections made |
| What stands between him and starting (stage 4) | In, each piece reviewed, the dangerous ones twice; see "Stage 4" below |
| The whole journey walked (stage 5) | In; see "Stage 5" below |
| Check can read a new subject's sources (stage 6) | In, the command reviewed three times and the screens twice; see "Stage 6" below |
| Confirming is his alone, and stopping a captured source (stage 7) | In, the design reviewed once, the commands three times (once as an assistant), the screens twice; see "Stage 7" below |

Adrian has seen four pictures of Home and has been given a demo to click through and one page of pictures of every
screen. He has not yet said yes to any screen. On 11 November he asked that every screen be checked against the sample he approved and, once it matches and
works, that it be shipped without asking again (a pull request merged into main). The release to his installed app is
run on his Mac.

## First look with his real records, 12 November: the five that stand between Adrian and using it

Version two was installed on his Mac on 12 November and walked as an assistant with his real records (8 subjects,
one open question, the Teajia look). These come before everything below, in this order.

1. **His magazine work is not on Home.** Home shows 8 subjects, three of them test stand-ins ("Hong Kong Day 1 ·
   structure test", "Fresh Article", "Hong Kong Day 1 · New Article"). The nine active Magazine stories (Tea Teacher,
   Yixing Masters, Wood-Fired Potter, Lu Zhaokai, An Cha Master, Taiwan Tea Philosopher, Hong Kong Day 1, Teaware
   Collector, Shanyin Qiwu) are not subjects at all, so `standing all` and Home never list them. Until his real
   stories are subjects, there is nothing for him to work on here.
2. **Raw machine text where his direction should be.** A subject's header shows the stored direction record as
   written: on "Hong Kong Day 1 · structure test" the direction-choices comment and its JSON, on "2019 Liubao ·
   Golden Flower" the markdown headings of the concept ("# Concept ## Author thoughts..."). On a phone the JSON fills
   the whole first screen and pushes the page 7 pixels sideways.
3. **Nothing he would make can be made inside version two.** Every Create step opens Advanced. His three Carousels
   on "Let the good tea find you" are older Outputs carousels, and there are no Instagram plans at all, so the slide
   studio has nothing real to open. The three Carousels carry the same name and cannot be told apart. Piece 7 (Write,
   Read, Check) and a way to open an existing Carousel in the studio are the work.
4. **Research is empty and The facts says more than it shows.** Research has two topics, both "Study photographs",
   0 sources each. On a subject, "The facts: Findings to read" shows only the question that was asked and no findings.
   On a Carousel, "The words on the slides: 1428 words" is the whole article's count, the same on every form.
5. **Slower with 8 real subjects than the demo was with 150.** The first `standing all` after a restart took 6.2
   seconds (1.4 the second time). Every page waits about 1.2 seconds on `/api/capabilities` before anything shows;
   the Hong Kong subject takes 5.7 seconds to settle at 1440.

Not seen, because his records hold none: photographs on desk cards or rows (nothing is on the desk; no subject has
a photograph), the tint under the bar on a subject (no subject has a look; the tint does show on Looks), a topic's
Decide count, findings and "What people say". What held: Home's stations, counts and next steps match the CLI for
all 8; the Hong Kong subject's eight steps match `standing subject`; Needs you shows his one real question with its
link; Looks shows the real Teajia look; no other page scrolls sideways at 390.

The automatic check, found the same night: the package check fails because three test servers orphaned by earlier
runs (started 13:24, 14:40 and 15:12 on 11 November, synthetic magazine fixtures, random ports) keep rewriting
`.scratch/magazine-fixtures` on the runner after checkout wipes it; deleting the folder does not last until they are
stopped, and the fixture helper should not leave them. The photo inspect test is not slow: the workspace page
mounts in 18.4, 19.1 and 19.7 seconds on the Mac; it fails because the photo details panel never opens (no caption
box), first at the Screens stage A merge (PR 235). Likely its new keyboard aid, which walks computed styles of every
focusable control, under jsdom. Version two was released with `--no-ci-check` naming this.
Both were confirmed and corrected on 12 November (the guess about the keyboard aid was right); the detail is under
"Things to know before trusting a green run".

## Stage 5, 12 November: the whole journey walked

The walk is `scripts/review-journey.mjs` (brief: `version-two-briefs/v2-11-journey.md`): New subject, Capture Speak,
Use the transcript, Write, Read, Check, back to the subject and Home, at 1440 and 390, dark and light, with the old
screen photographed beside each step. Run it with `AR_CREATE_URL=http://127.0.0.1:<port> node
scripts/review-journey.mjs --out <folder>` on a fresh `npm run demo` after `npm run demo:fill`; it puts a finished
transcription job into the demo's own temporary data, presses the real buttons, and prints every break. Adrian was
sent one page of pictures, each step beside the old screen (https://claude.ai/artifact/N7gC9TnyAyeqJ99puWctHD). He
has not yet said yes to any of it.

**The one break left, for Adrian to decide: a subject begun from New subject can never be checked, in either
front.** Check reads only the sources captured into the draft when the draft is made (`context.records`, written
once and locked: `runtime/services/study-draft-copies.mjs` `finishCopy`; read by `study-draft-checks.mjs` near 26
and 181). Only a draft opened from a vault original (`study-draft.open`), or made from another draft's sources
(`study-draft.create-collection` with `sourceBindingId`), has any. Attaching material (`study.material.attach`,
`first-flow.attach`, `recordings.source`) adds to the subject's material list and never reaches the draft, so Check
ends "Checks held: Capture the source transcript before checking." Tried on the demo as Adrian: held with a real
attached transcript; "checked" for the hk original and for a collection given `sourceBindingId`. Proposed, not
built, because it changes what Check trusts: a human-only command (for example `study-draft.capture-sources`:
bindingId, parentStudyId, operationId, expected, sourceIds) that copies attached, reviewed, not-set-aside materials
into the draft's capture folder, records them in a separate append-only hash-pinned file (the locked record
untouched, so old records still validate) and merges it into `context.records`; the subject page calls it after
"Use the transcript" and Check's held state offers it. Risks: it must never touch his words; consent holds on other
people's speech; earlier forks and structure tests keep their old seeds; old check receipts turn stale. He was asked
on 12 November and answered "Proceed". **Built as stage 6; see just below for what was built and how it differs.**

### Stage 6, done 12 November: Check can read a new subject's sources

Design, the three reviews of the command and the two of the screens: `version-two-briefs/v2-12-capture-sources.md`.
The walk (`scripts/review-journey.mjs`) now confirms the transcript, presses "Use it for Check" and ends step 8 in a
real check result at 1440 and 390, dark and light.

**What is in**

- `study-draft.capture-sources` (human only; an assistant gets 403) copies the sources named in the press into the
  draft's own added-sources record. The locked capture record is untouched and only Check reads the added sources,
  because the editorial plan reader refuses extra records on a new subject and Research would see the material twice.
  `study-draft.capture-sources.list` (any actor) says what can be captured and, in plain words, why anything cannot.
- Who confirmed a source is now recorded (`reviewedBy` on the flow file; `metadata.review.by` on a recording's
  transcript). Only a source a person confirmed, on the same bytes, can be captured, and only a confirmed recording
  transcript counts as the source for quotes; anything else is context. An assistant can still mark material reviewed
  (no command was made human-only); it does not count for capture and does not replace his stamp.
- A quote cannot be supported across the join of two captured files; a check run that does not finish reads held,
  never checked; words inside `%%` comments in a captured file do not support a quote; a check made before a capture
  reads stale.
- `GET /transcription/{id}/look`: a read of a transcript's words, speakers and review stamp that takes no lock and
  writes nothing.
- The subject page: "Confirm this transcript" (the words, a name for each unnamed speaker, Confirm), then a "Sources"
  list and "Use it for Check". Check's held state shows the same list and button and runs again after the press. The
  row says "Confirmed by you" only for his own confirmation; an assistant's review reads "Reviewed, not confirmed by
  you yet". The shared block is `v2.shared.subject`; Check does without it when missing.

### Stage 7, done 12 November: confirming is his alone, and a captured source can be stopped

Design, its review, the code reviews, the review made as an assistant and every correction:
`version-two-briefs/v2-13-confirm-and-stop.md`; the screens' review and re-check:
`version-two-briefs/v2-13-screen-review.md`. Adrian said yes to both changes on 12 November.

**What is in**

- Marking material or a transcript reviewed is his alone, by every path: `first-flow.source-review` with
  `reviewed:true`, a `first-flow.prepare` whose `sourceReviews` would add a review not on file (the whole call is
  refused, nothing dropped silently), and `POST /transcription/{id}/review` (its own human-only registry entry, and
  refused again inside the service). An assistant gets 403 and the plain reason; odd spellings of the path are
  refused at the gate. Assistants keep the rest: an ordinary prepare, withdrawing a review, speaker names, segment
  edits, decide. When he prepares, his stamp replaces an assistant's or an unnamed one.
- The existing workspace now sends its actor on `/transcription/` calls, so an assistant's "Review and save" there is
  no longer recorded as his. Nothing he sees changed.
- `study-draft.capture-sources.stop` (human only) appends a "no longer used" entry to the same hash-chained
  added-sources record. Check, the list, the standing and receipts follow: a stopped source is skipped, an earlier
  receipt reads stale, and with no source for quotes left Check is held with "No source to check against yet". A
  stopped source comes back only when he presses "Use for Check again" (`again:true` on that one source); the bulk
  press, a replayed operation and a re-import of the same bytes do not revive it. Records with no stop entry read
  byte for byte as before.
- The screens: in the Sources list, on the subject page, on Check's held state and inside Check's details, a row in
  use reads "Used for Check" with "Stop using for Check"; a stopped row reads "Not used for Check. You stopped it."
  with "Use for Check again". Other row words are listed in `v2-13-screen-review.md`. An assistant's page shows the
  controls and the server's refusal. Before and after pictures were sent to Adrian on 12 November; he has not yet
  answered. Version three loads the same two files and shows the same change.
- The walk (`scripts/review-journey.mjs`) asserts Stop is offered and opens "Show all" on Home before looking for
  the new subject, so a second walk on one demo no longer reports it missing.

**Answered by Adrian on 13 November: "we can go with your recommendations" on all five**

1. A stopped source can be used again by him ("Use for Check again"). Built.
2. A subject with no source whose words changed since its last held check says "No source to check against yet",
   not "Check again", on old drafts too. Built.
3. An assistant's stand-in may still mark reviewed inside its own structure-test copy, never a real subject. Built.
4. The Library's "human review is recorded" label for a file that declares itself reviewed is corrected in a later
   stage. Not built; not yet a stage in the record.
5. A refused attempt at a human-only decision should show in History, as a later stage. Today a refusal at the gate
   records nothing (`runtime/server.mjs`, the gate runs before the actor is set). Not built; not yet a stage in the
   record.

How he asked for this part to feel (13 November): simple and effortless, as few choices for him as possible, and
safe. He mostly brings recordings in as audio files from his microphone or phone ("Add an audio file" in Capture's
Speak) and only sometimes records in the app. The words "stop a transcript" did not make sense to him without the
steps before it explained: a later stage should look at whether Confirm, "Use it for Check" and Stop can become
fewer steps or say more plainly what they are for.

**Open after stage 7**

- Known limits, older than this stage: any caller that claims to be Adrian is believed (the app's own Origin with no
  actor header, or his header); the recording workshop page sends no actor; cutting the newest stop entry off the
  record by file access brings a source back (a test pins this as a known limit; anchoring the newest entry outside
  the file would close it).
- Found in passing, older than this stage: a plain `first-flow.prepare` makes a later material attach answer 409
  for everyone.
- The new control is styled as version two's quiet button (14, on its own line under the row), not the sample's
  warm 13 link; the Sources list is not in the sample.
- A demo server a checker left on port 8865 in the director's container could not be stopped by it; it dies with
  the container.
- The version three thread (session_017kitFe2b6MQFZwy3MNMGpN) is archived; its Write fix (pull request 249) is on
  main and merged here. It was told at the start of this stage; the later notices could not be delivered.

**Open after stage 6**

- For Adrian to decide, not yet asked: whether drafts opened from a vault original should accept added sources;
  Carousels checked from them.
- A note-only subject still cannot unlock Check: only a recording's transcript is a source for quotes. Adrian said
  "not yet" to changing this on 12 November.
- Reviews made before this change carry no name, so they read "not confirmed by you yet" until he confirms again.
- On old drafts a quote can still pass across the join of a source and a context file (unchanged from main; the fix
  made here applies only when sources have been added).
- A damaged added-sources record holds Check and says so; there is no repair.
- On the demo's walk the draft has no quotes, so the real result reads "No supported quotes to check".
- Small: after a successful Confirm keyboard focus is lost and an older error message can stay on screen; pressing
  Confirm still calls the recording's `recover` once.
- Not checked: a real recording through a real transcription engine; a real iOS or Android keyboard in the name box.

**Told to this line by other threads on 12 November (not typed by Adrian; confirm with him before acting)**

- The look he approved for Write, Read and Check is to become its own front, "version three", opening by default,
  built by session_017kitFe2b6MQFZwy3MNMGpN on branch `claude/v2-write-read-check` (plan
  `docs/plans/2026-11-12-write-read-check-build.md` there). Version two stays reachable and working, and its
  addresses must keep working exactly as now because version three opens them where it has no screen yet. That thread
  asked not to change `write.js` on main without telling it (it has split the file on its branch).
- Two faults in Write on main, which that thread's plan corrects: in a conflict "Use the saved version" discards his
  unsaved words and "Keep my words" writes his whole piece over the other version; two tabs on one piece share one
  device key. He was told not to press either button until then.
- Unowned: `docs/reviews/2026-11-10-use-and-interface-review.md` and `docs/reviews/2026-11-11-version-two-journey.md`
  on branch `claude/ar-create-ui-ux-review-71qso6`; one subject with five source lists that disagree; Library and
  "Ask or find" do nothing yet.
- How he asked to be answered: decisions only, each answerable in a word, with a recommendation.

**Found by the walk and corrected (do not redo)**

- An Article can be started inside version two. Add a form offers Article for any subject with no Article, source or
  not; Write's empty page makes the Article from his first saved words (`study-draft.save`, then
  `study.outputs.create` kind article, the same two the existing workspace uses). The page is not rebuilt when the
  Article is made, so letters typed across that moment are kept (a test types 245 through it). For that moment
  (about a fifth of a second on the demo) Enter and Backspace at a paragraph's start do nothing and the saved line
  reads "Starting the Article". Opening Write with words and no Article makes it at once. A 403 is said once and not
  retried; other refusals retry quietly with growing waits. Two tabs agree silently. An assistant creates nothing.
  A subject with another form and no Article gets one only by Add a form, Article (`start=article` in the address).
  Built in six passes and reviewed five times.
- After "Use the transcript" the subject now attaches the transcript through the subject's binding, as the existing
  workspace does, and the row says "Transcript ready, and kept as a source". It reads "kept" from the research brief
  by the job id in the path, because the Library tree leaves out `Transcription/<job id>` on purpose.
- A check held for want of a source: the standing passes a plain fact (held, and none of the check's stored sources
  has the source role); the Check step leads, waits and says "No source to check against yet"; the station stays at
  Create; Home's row and desk card say the same. Other holds, stale and failed checks still say "Check again".
- Write's "mic" and "photo" icons no longer log an error.

**Tried and taken out: do not try it this way again.** One pass made Enter and Backspace act on the page at once
and saved splits and joins as ordinary edits and deletes. It kept plain prose exactly but the server refuses to
delete a paragraph that holds a link, a glossary term or a note (saving then stuck for ever), a join dropped bold,
and Enter re-armed a stopped save. Splits and joins are back on the server's own commands, exactly as on main. A
second small extra ("a paragraph typed back to its pre-save text during a save") doubled a paragraph's words after
type-then-Enter and was also taken out.

**Open in Write, older than this stage**

- Enter in the middle of a saved paragraph while a save is running can reorder letters ("jjoinedoined") and lose the
  break (`write.js`, the split path after a save). The reviewer's advice: keep the server's split and join for saved
  paragraphs, and read the cursor position after the save has settled or hold the box until the split is saved.
- A newline that arrives without an Enter key, as Android keyboards send it, becomes a space, not a split
  (`beforeinput` insertParagraph is not handled). Not tried on a real iOS or Android keyboard.
- The tests for Write type plain text only: nothing covers bold, links, glossary terms or notes through a split,
  a join or Undo, except the one type-then-Enter test on a bold paragraph.

**The walk's "not built yet" list** (each already named in the sections below): in Write, playing a recording and
reading its transcript beside the page, and the list of parts still to write; in Check, comparing versions and
viewing the source beside a finding.

**Small, known, not done**

- The walk's 390 pictures of long pages are cut at 2000 pixels (16 pictures); `journey.json` lists them.
- Step 9's old picture is the subject on its last section in the existing workspace, not a subject overview.
- Home's rows hide the next step at 390, so the hold sentence shows there only on the desk card.
- Not checked: a subject whose only form is a real Carousel (a Post stood in for it in the test); Magazine story
  subjects in the Add a form sheet; leaving the page while the Article is being made.

**The one full check, 12 November, on the stage's branch**: `npm test` 4080 tests, 2 failures, both known (the photo
inspect test; "installed home mode" on a cloud machine). The existing workspace's page tests: 610 tests, 3 failures,
the three known on main. The sideways check on every version two screen at 390, 700, 1000 and 1440, plain and with `--stress`: nothing
scrolls sideways. `npm run verify:package` passes. On a machine where the script cannot find its browser library,
set `AR_CREATE_PLAYWRIGHT=/opt/node-tools/node_modules/playwright/index.mjs`.

## Stage 4, 12 November: what was done about the five, and what is still open

Built on branch `claude/v2-before-starting`, every piece by one model and reviewed by another, the dangerous ones
twice. Seen only on the demo with invented records. **The first thing to do on his Mac after the next release is to
walk this list with his real records.**

**To check on his Mac first**

1. **His Magazine stories on Home.** Each registered, active Magazine story now stands as a subject in
   `subjects.standing` and `subject.standing` (id: the story's own id; the subject carries `origin`, its one Article
   carries `owner` with storyId and pieceId). No record is made, nothing is copied; reading writes nothing (tested by
   hashing data and vault). A story that is already a subject's original shows once. Check: all nine show, none
   twice, with true stations; "Hong Kong Day 1" in particular, which is both a story and a subject. The three test
   stand-ins are his to archive from Home's row menu.
2. **The link from a story into the Magazine.** The existing workspace has no address that opens one story on a cold
   load outside review mode, so every such link says "Open the Magazine in Advanced" and leads to the workspace, not
   to the story. Wanted: an address in the existing workspace that opens one story.
3. **Read and Check for a story** open inside version two (`magazine.working-draft.read`, `magazine.check`, read
   only). Decisions in a story's Check say they are not built (`current-work.read` refuses a story id). The count on
   the subject page comes from the Magazine's check on the draft alone and may differ from the Magazine's own page,
   which passes linked context notes.
4. **A subject's header** shows only the dish he named, else the "Adopted human direction" section, else nothing.
   Check the two subjects that showed raw text ("Hong Kong Day 1 · structure test", "2019 Liubao · Golden Flower").
5. **His three Carousels** on "Let the good tea find you" are told apart by slide count and date, and "Open the
   slides" opens each read only in the studio (`#/slides/<output id>?kind=output&subject=<id>`); changing one is in
   Advanced (Arrange). A Carousel's word count is its own slides' words.
6. **Speed.** A page no longer waits on the full `/api/capabilities` (the shell reads `?only=commands`, 4 ms, and
   keeps it for the browser session by release); the first `subjects.standing` is warmed at start; the settle step
   runs only after a write; a check no longer re-reads the draft. Measured on a demo with long drafts: first read
   2.8 to 3.5 s down to about 2 s cold and milliseconds once warmed. Measure again with his records. One shortcut was
   taken out after review because it made a subject state a wrong station for a few seconds: a read waits for the
   suggestion count again (up to 5 s, then Not known and not kept).
7. **Find** in the top bar (also Ctrl or Cmd with K) finds subjects by name and Library items by their exact words
   (`concept.sources.search`). **To file** on Home lists Library top-folder files no subject, plan or placement uses,
   each with "File in a subject". It reads the whole Library tree (`sources.tree`): watch its time with his Library.
   It cannot tell a capture from any other loose file, and cannot see Magazine or citation uses.

**Write for a Magazine story: built, shipped switched off**

`STORY_EDITING` in `public/v2/screens/write.js` is false: a story's words show read only in Write with a link.
Editing one paragraph at a time through `magazine.working-draft.edit` is built behind the switch and held every
guarantee about held-up words, but the second review changed the story's file in ways he did not type. Before the
switch may be turned on, correct and review again:

- `placeEdit` (the 409 resend and `adopt`): his words can land on a duplicate paragraph (a story with "Yes." twice).
  A paragraph may only match its own block, or the same block with the same neighbours. No test covers it.
- `runtime/reference/mag-edit.mjs` `rebuild`: adding one word to a paragraph moves marks he did not touch (bold to
  the first matching word, glossary `[[term:...]]` links likewise, an inline comment to the paragraph's end), and
  text already in the file as " /a/ " becomes a rework order. Either fix `rebuild` or keep paragraphs with bold,
  glossary links, comments or slash pairs read only.
- `markupIn` lets through "# " after a line break, a line of "--" or "=" under text, and a `<div>` block.
- A resend while another Magazine write holds the lock (8 s or more) or after the 20 s timeout can make the second
  request's 409 delete the first one's committed receipt (`operation()` `rmSync` in the working-draft bridge). No
  words are lost; Undo and history lose that record. Needs a server fix.
- Small: the first click on "Keep my words" does nothing while the cursor is in a box; a leftover device copy whose
  words are already saved shows "Not saved: a newer version exists" with both sides the same.
- There is no command to add, split, join or remove a story's paragraph one at a time (`magazine.working-draft.prepare`
  was not tried). "Rewrite it as mine" does not exist for a story's proposals; Accept replaces the whole file.

**Not done from the five**

- Finding 3: making a new Carousel as an Instagram plan from an old Outputs carousel (no command converts one; a
  carousel's words come from the article, a plan's from transcript lines).
- Finding 4: Research is as empty as his records; "Findings to read" is now said only when findings are known, but
  Home and the CLI cannot know the count and say "Research came back" (the count is not in `gather()`'s research
  facts).
- Finding 5: the draft read itself (`readOwned`, parsing in `ar-project-folders` and `draft-correspondence`) is the
  remaining cost.

**Done from the open corrections below (do not redo)**

Section 7b's five small ones (Write's bar is one row from 320 with tabs that scroll inside it; Check's message when
consent cannot be read; "They are Adrian's to give." removed; Read's "Newer words exist" only after a real change to
the saved words; the grey band on a phone). Section 1: Home's header rounding; Research's count beside its heading
on a phone; the parts list's width on a subject. Section 3: the shell reads desk and needs-you once (34 calls on load
down to 22); a desk chip with no photograph is its name alone. Section 7c: Escape while saving; the sheet says why
it stays; a 60 second clock margin; an assistant is told "Use the transcript" is Adrian's to do; a 409 from
`recordings.source` shows the server's words. Section 8: Find. The earlier small fixes branch
(`claude/v2-small-fixes`) is in: waiting steps of a Carousel, an empty studio, messages inside an open sheet.

**Looked at and left**

- The light theme's grey stays #5e6257: the sample's #686c61 is below 4.5 to 1 on the tinted surfaces (4.38 on
  `--v2-sec`, 4.24 on `--c3-sel`).
- Home's chip widths and the Needs you panel's height differ from the sample only by content (digits, three
  questions against two).
- The Capture line says "the Library, to file later", not "your inbox".
- Find is not reachable on a phone (the bar's button is hidden there; the sample's phone search icon goes to
  Research). A Library result opens the Library in Advanced, not the item.
- The checker against the sample, 12 November (Home, subject, Write, Find, Capture at 1440 and 390, both themes;
  nothing scrolls sideways at 390, 700, 1000, 1440). Older differences it listed, none from this stage: Write heads
  the page with the subject's name where the sample has the piece's title; Write's status reads "Saved 23:40" with no
  date; on a phone a subject's open step card sits under its own row where the sample lists all stations first; the
  suggestions column shows only when there are suggestions.
- Forms still cannot be reordered (no record keeps a hand-set order). Two plans changed in the same second look the
  same.
- `npm run demo` now starts with three invented Magazine stories (Kiln Keeper, Salt Lake Weaver, Bamboo Carver with
  no draft); `npm run demo:plain` is the old demo. demo:fill adds "The lantern night" with an older Carousel.
- The bound on the settle step's wait for a hung write (5 s, `AR_ANNOUNCE_WAIT_MS`) has no test.

## Open corrections, most important first

### 1. The match against the sample

Checked twice by a separate model against the mock-up (`design/2026-11-better-interface/d-four-stations/` on
`claude/ar-create-design-round`) at 1440 and 390 wide, dark and light, with two rounds of corrections. What still
differs:

Left on purpose, because the truth or the contract requires it:

- **Write, Read and Check.** Built (stages 1 and 2). See "Write" and "Read and Check" below.
- **"Advanced" in the bar.** Not in the sample, which was drawn before there were two fronts. It is the quietest
  item, at the far right.
- **No invented content.** The sample's dashed "new" card, prefilled subject name, "Listen · 6 min", likes and
  journey look are not shown. Blocks with no back end sit in the sample's place and say "not built yet": the
  Favourite star, Add a slide and Speak in the studio; "Change it by talking", "Open the folder" and "Tell it more"
  in Looks; answers, chips and "Keep as a note" on a group; "Listen", "Voices it trusts" and "Viewpoints".
- **Find, not Ask.** The Research box has the sample's shape and says "Find": it finds words and cannot answer.
- **No agreement meter** on a topic's claims: a finding is never drawn as a quarrel no record states.
- **Forms carry no drag grip.** No record keeps their order. They are numbered.
- **Words on a slide are read-only** with a way into Write.
- **Kept though the sample lacks them**, as the only way to do the job by keys or touch: New folder, "Archived",
  the row menu on Home, "Not in a group" and a topic's Group, Use for a subject and Let it go row (now on the
  Sources tab).
- **Six type sizes.** The phone bar's labels are 12 where the sample has 11; a topic heading on a phone is 22 where
  the sample has 20.

Small and not yet done:

- Home: chip widths 78 against 86; a header's rounding; the Needs you panel's height at 390; a click on Needs you in
  the bar scrolls to the panel where the sample does nothing; the Capture line's wording with no subject open.
- Research on a phone: a section's "0" count wraps under its heading.
- Subject: the parts list's width; the content width 996 against 972.
- Every screen: grey text in the light theme is #5e6257 where the sample has #686c61 (one shell token).
- Removed to match the sample, and so lost: the studio's "Find a layout" search.
- Not compared at all: hover and focus colours, mouse drag, the studio's filmstrip, the Carousel's step names.
- Seen only on the demo's lack of records, to be checked with real ones: the tint under the bar (needs a look
  recorded on the subject), the "Claude is carrying on" line, covers, the Decide tab's count, claim bars and quotes.

### 2. Where a subject stands

- The first read after a restart of a subject with a current suggestion waits about 2.4 seconds for the suggestions
  owner. Nothing else waits behind it.
- Nothing tells a listener when a "Not known" suggestion count resolves; a screen must ask again. A failed owner
  answer is retried on every read.
- "Published" is never stated, because no record says a piece is out. It needs a per-piece record, for example a
  Magazine story marked published. Until then Publish reads "Not known" and he can still open it.
- A subject whose state is not known still states a station.
- It now reads each subject's list of pieces. Re-measure the cold read at 150 and at 2000 subjects.

### 3. Home

- Any small change re-reads all five lists (cheap today: the summary answers in milliseconds).
- The shell repeats its desk and needs-you reads on load (about 25 of 34 calls).
- The top bar's desk chips show an empty box where a photograph would go.
- Drag by touch was not tried in a browser. The demo has no photographs, so a real cover was never seen.

### 4. Subject

- Forms cannot be reordered: no record keeps a hand-set order of pieces. Needs a small back-end addition.
- "What you have" lists come from the Library tree, the brief and the plans, not from the standing read.
- The Facts tool takes about 1.4 seconds at 136 subjects; it says Reading meanwhile.
- Forms carry no 1 and 2, unlike the sample.

### 5. Research

- Linking a topic takes 1.3 to 2.2 seconds at 150 subjects, inside the Library's own association calls. Reads no
  longer wait behind it.
- An assistant can rename a topic or empty its sources, as the existing inquiries commands already allow.
- A topic can sit in only one group.
- Parts that say "not built yet": sentence answers (need a provider), a group looking for new material, a topic
  looking for more.
- Leave room: the wisdom bank will live inside Research; a pathway there is the same thing as a research topic, and a
  topic will later hold an ordered list of units of one idea. Nothing here invents such a unit.

### 6. Advanced landing

- Fixed 300 ms waits and a second press of the rail when it shows the wrong section. Sturdier: the workspace's own
  call for opening one exact piece in a chosen view.
- If the piece belongs to another subject, the error stops before the section opens.
- The walking script cannot tell two Articles of one subject apart.

### 7. Slide studio and Looks

- Words on a slide are read-only; changing them opens Advanced.
- On a phone the strip sits under the slide's caption and buttons, not directly under the slide.

### 7a. Write (stage 1, merged 11 November)

Adrian was sent three pictures of it beside the sample. He has not yet said yes to it.

- **The page's type is a fallback.** The approved Write page in the existing workspace uses a 16.5px body and a 17px
  semibold title. `tests/v2-shell.test.mjs` forbids sizes outside the six, so version two uses 18 for both (title at
  weight 600, line height 1.58). The sample's 40px title was not taken: the approved page wins on the page itself.
  For Adrian's eyes: either accept 18, or allow the page its two own sizes and change the test on purpose.
- **Say "not built yet"**: playing a recording and reading its transcript beside the page; the "Still to write" list;
  Ask about this piece. No speech button, on purpose.
- **Still open in Advanced**: a suggestion that is a set of opening options, and a stand-in review. The optional note
  on "Not me" per paragraph is not built.
- **Left on purpose**: a quiet "Saved" line under the bar on a phone (the sample has none); the Carousel tab shows
  only when the subject has a Carousel; "Advanced" in the bar.
- **Not compared with the sample after the corrections**: the checker measured the first build only. The measured
  differences were corrected and seen on one contact sheet; hover and focus colours were not compared. A closed
  Sources button on a phone is plain where the sample shows a pill.
- **The shell's command client** leaves `presence.post` and `study-ai.reject` out of the automatic operation id,
  because those commands refuse the field. A screen that calls a command for the first time should try it against
  the real server, not a stub: both faults were hidden by stubbed tests.
- The sideways check for one version two screen needs the demo running on 8854.

### 7b. Read and Check (stage 2, merged 11 November)

Adrian was sent a picture of each beside the existing screen. He has not yet said yes to them.

- **Say "not built yet", with Open in Advanced**: View source on a finding, Open source on a decision, Comparing
  versions. "Earlier original draft" is left out of Read. Answers and release of consent stay in Share (Advanced).
- **A Carousel's Read and Check** still open Advanced. So does a piece whose words are owned elsewhere (a Magazine story).
- **For his eyes**: on a computer the words sit further left on Read and Check than on Write, because Write has the
  Sources panel on the left and Check has its findings on the right; the column is 700 wide on all three. On a phone
  Check shows the findings first and the words below. The Write, Read, Check segment shows on a phone though the
  sample hides it, as the only way between the three there.
- **Small, found by the last review and not done**:
  - Write's bar at 320 and 340 wide drops the full-screen icon alone onto a second row (`write.css`, the 380 block).
    One row from 360 up.
  - When `consent.desk` is refused, Check shows the human-only message, which is wrong for a plain read (`check.js`
    near 352).
  - Check adds "They are Adrian's to give." under People; the existing Check has no such sentence (`check.js` near 371).
  - Read says "Newer words exist" after any failed re-read, even when the words did not change (`read.js` near 91).
  - On a phone a short piece leaves a grey band under Read's page above the phone bar.
- **Not compared**: hover and focus colours; the theme was set by the browser's colour scheme, not the theme button.
- The checker's measure of Write's body as 15px was wrong: `write.css` sets 18, the same as Read and Check.
- A fresh demo has no saved check until "Check saved draft" is pressed on The green gate; The first cup is Held
  because it has no captured source.
- The whole suite on this branch: only the known failures (the photo inspect test, and the three page tests named
  below).

### 7c. Capture (stage 3, merged 11 November)

Adrian was sent pictures of the sheet beside the sample and of the subject page. He has not yet said yes to them.

- **To check on his Mac, first**: the demo has no transcription tools, so three things were seen only against a
  stand-in: a transcript starting after Speak, the states "transcript being made" and "ready" on the subject, and
  "Use the transcript" (`transcript-check.id`, then `recordings.source`, human only). Record a few words in a real
  subject and follow them to a source.
- **No Undo for a recording, photograph or thought**: no command removes a source. A question a human asked has Undo.
- **No inbox**: with no subject open a capture goes to the Library root, "to file later". Nothing in version two
  files it afterwards yet; that is done in Advanced (Library).
- **Filing order**: `study.material.attach` first, then `first-flow.attach` (which answers 409 in the demo unless the
  subject is the server's selected project). The existing workspace uses only `first-flow.attach`.
- **A lost answer**: a saved file is recognised by its content and a capture time no earlier than the attempt. If the
  phone's clock runs ahead of the server's, a real save can look old and a retry saves a second copy (never a loss).
  Allow a small margin. The content hash is worked out on every save; it is needed only after a lost answer.
- **Left on purpose**: the phone's Done button is 44 high (the shell's phone buttons) where the sample has 32; the
  heading is 18 where the sample has 17; a link under the done row; "the Library" where the sample says "your inbox".
- **Small, found by review and not done**:
  - While a save is running, Escape says "Save it, or discard it".
  - Moving to another screen with work unsaved keeps the sheet open but says nothing.
  - An assistant is shown "Use the transcript" and then gets the refusal; a 409 from `recordings.source` reads
    "This changed since it was opened".
  - The subject's Facts count of research topics is right only once the Facts step has read its topics.
  - `recordings` lists every recording and is read again on every `sources*` change; about 11 ms on the demo. Watch
    it with his real records.
  - The 8 MB and 15 minute caps on a recording were read in the code, not reached in a browser.
  - The sheet in a Carousel's studio (`slides/:id`) has no subject, so a capture there goes to the Library.
- **Not compared with the sample after the corrections**: the checker measured the first build only; hover and focus
  colours were not compared.
- A test that lists the shell's files by hand (`tests/v2-home.test.mjs`) must list `shell/capture.js` before
  `shell/shell.js`, as `index.html` does.
- Two throwaway servers a checker started on ports 8863 and 8871 were left running in the cloud container; they end
  with it.

### 8. Not started

- Library and "Ask or find" in the top bar do nothing yet.
- Speaking as dictation: there is no speech-to-words button, on purpose. The browser's speech service would send his
  voice to a remote service. Capture's Speak records on the device and sends the sound only to the app's own server.

## Things to know before trusting a green run

- Under `--stress` the existing workspace's Home cuts its "Needs you" heading by 9 pixels at 390 wide. The files
  behind it are identical to main; it is for the screens thread, not this build.
- In the demo the existing workspace logs errors on load for the synthetic subject "hk" (three 409s, a 404, one
  script error) and its event stream reconnects. Not looked into; not seen on a version two page.

- `npm test` does not include the workspace's own page tests. Run `node --test public/document-study/*.test.mjs` as
  well. Three of them fail on untouched `main`: "public/document-study/collection-app-journey.test.mjs", "shared
  discovery never replaces the fresh exact Carousel registry check at opening", and "advertised Outputs creation, each
  title/next action, own words, scope return and persistent reload use real owners".
- One test fails only on a cloud machine: "installed home mode: config must name the real home…".
- **The automatic check (`ci`): both causes found and corrected on 12 November, on branch `claude/kind-cerf-ucyv55`,
  not yet on main.** Read `git log origin/main` before trusting this line.
  - *The photo inspect test.* The true cause was the keyboard helper added to the existing workspace in pull request
    235 (`keyboardAids` in `public/document-study/combined-navigation.js`). On every repaint it asked for the computed
    style of every control and each of its ancestors. Under jsdom that is so slow that the page had no time left to
    answer its own requests, and the Media step stayed at "Connecting this manuscript's photographs" until the test
    gave up. The helper now looks at a box's size first and asks for the style only of a box of 2 pixels or less, and
    it does nothing on a page that has no layout, where every size reads zero and nothing can be judged. In a real
    browser it marks exactly the same controls as before: compared on all twelve steps of the demo at 1440 and 390
    wide. The test is unchanged and passes in about 20 seconds.
  - *The package check.* A run that is cancelled or times out never reaches its own cleanup, so a server a test
    started lived on and kept its fixture folder in the checkout. `tests/helpers/magazine-fixture.mjs` now records
    every fixture folder and every server a test starts (`ownChild`, `ownDir`) with a small watcher process that
    stops the servers and removes the folders when the test process ends in any way, a kill included
    (`tests/magazine-fixture-orphans.test.mjs` proves it). This stops new leftovers; the three servers left on
    11 November still have to be stopped by hand on the Mac, and `.scratch` deleted in the runner's checkout.
  - *A step that was tried and taken out.* Pull request 251 first carried a step at the start of the `ci` job, on
    the Mac only, that stopped every node process whose working folder was inside the runner's checkout. On its
    first run (13 November, 03:14 UTC) the Mac's runner took the job, reported no step and no log, and was offline
    ten minutes later. Whether the step caused that or the Mac simply slept could not be told from a cloud machine,
    so the step was removed. Do not put it back without watching it run on the Mac, and never without first checking
    that the workspace path is not empty. On the Mac, check that the runner and the app on 8841 are both running.
  - The 12 November thread that was meant to run on the Mac in fact ran on a cloud machine, so the release, the walk
    with real records and the status refresh (items 1 to 3 of `2026-11-12-up-to-date-and-shipped.md`) are still to do.
- Several tests fail only when many suites run at once and pass alone ("failed exact Direction load keeps a discovered
  Collection root held", "working HTML prepares exactly once…"). Run a failure alone before counting it.
- `npm run demo:fill` and `npm run demo:instagram` ignore `AR_CREATE_PORT`. They fill port 8854 unless
  `AR_CREATE_URL` names another server. `-- --large` is slow and can time out near 135 subjects.
- `scripts/review-sideways.mjs --only=v2:home` (or `v2:subject`, `v2:research`, `v2`) checks one screen in about
  thirty seconds; a full run takes over twenty minutes.
- Main has moved since this branch was cut: fixes to broken layouts in the existing workspace were merged there on
  11 November. "The existing workspace looks exactly as before" means as it is on main with those fixes.

## The review's three root problems, as they stand in version two

- **The app did not hold the current subject.** In version two the subject is in the address and in the header of
  every subject screen; the open form and step are in the address too. Not yet walked across a whole journey.
- **One subject had five source lists that disagreed.** Not addressed. The standing read counts material from one
  place and "What you have" reads the Library tree; the back end still has the five.
- **Write meant whichever piece was opened last.** Version two passes subject, piece and section to Advanced, and that
  landing now holds for all 61 addresses checked.
