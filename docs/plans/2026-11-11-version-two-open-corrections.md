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

Adrian has seen four pictures of Home and has been given a demo to click through and one page of pictures of every
screen. He has not yet said yes to any screen. On 11 November he asked that every screen be checked against the sample he approved and, once it matches and
works, that it be shipped without asking again (a pull request merged into main). The release to his installed app is
run on his Mac.

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
- **The automatic check (`ci`) is red, and not because of version two.** "real native HTTP photo inspect and exact
  persisted lookup do not write, and restart preserves identities" gives the workspace's page 30 seconds to boot in
  jsdom. Measured 11 November: the boot takes about 38 seconds on a cloud machine on main and on this branch alike
  (about 20 of them matching roughly 1 MB of stylesheets), and the same test failed on the Mac runner on a branch
  that does not carry version two. The honest fix is a faster boot of the existing workspace, not a longer wait.
  The package check then stops on `.scratch/magazine-fixtures/19f486e4-…/data/word-library/state.json`, a stale
  scratch file sitting in the Mac runner's checkout; it has tripped every recent run on every branch. Delete that
  folder on the runner. `scripts/release.mjs` reads the `ci` check of the commit it installs.
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
