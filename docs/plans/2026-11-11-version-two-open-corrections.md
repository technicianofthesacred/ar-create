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
| Write, Read and Check inside version two (piece 7) | Not started. They open in Advanced |

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

## Open corrections, most important first

### 1. The match against the sample

Checked twice by a separate model against the mock-up (`design/2026-11-better-interface/d-four-stations/` on
`claude/ar-create-design-round`) at 1440 and 390 wide, dark and light, with two rounds of corrections. What still
differs:

Left on purpose, because the truth or the contract requires it:

- **Write.** The sample has its own Write screen; version two opens Write, Read and Check in Advanced (piece 7).
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

### 8. Not started

- Piece 7: Write, Read and Check inside version two.
- Capture has no version two screen; it opens Advanced.
- Library and "Ask or find" in the top bar do nothing yet.
- Speaking: there is no speech button, on purpose. The browser's speech service would send his voice to a remote
  service.

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
