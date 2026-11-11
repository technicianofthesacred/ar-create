# Version two: what is open at the handover

Written 11 November 2026, about 06:40 UTC, when the build moved from the design-round thread to a fresh director
thread. All Opus builders were stopped by the account's usage limit part way through their corrections. Nothing below
has been seen by Adrian on a real screen yet; he has only been sent pictures.

The contract is `2026-11-11-version-two.md`. The briefs each builder worked from are in `version-two-briefs/` (they
name scratch folders of the old thread; read them for what was asked, not for paths).

## Where each piece is

| Piece | Branch | State |
|---|---|---|
| Shell, fuller demo, slide studio, Looks | `claude/direction-d-build` | In, reviewed, green |
| Home | `claude/v2-wip-home` | Built and reviewed once. Corrections part written. **Does not count as working.** |
| Subject | `claude/v2-wip-subject` | Built and reviewed once. Corrections part written; its test file was mid rewrite |
| Research | `claude/v2-wip-research` | Built and reviewed once. All eight corrections written; never built or tested after |
| Advanced lands on the right section | `claude/v2-wip-advanced-link` | Part written, with a walking script `scripts/review-advanced-addresses.mjs` |
| Where a subject stands (one fast read) | none | Brief written (`version-two-briefs/v2-8-standing.md`); nothing built |

The three screen branches were cut from `85a134b`, before the shell's fixes, the page-test repair and the slide studio
went in. Bring each up to the build branch before judging it. Expect small conflicts in `runtime/commands.mjs`,
`runtime/server.mjs`, `agents/cli/ar-create.mjs`, `docs/START.md` and `docs/CAPABILITIES.md` (regenerate the last
with `npm run build`).

## Open corrections, most important first

### 1. The app's own reads are slow above about a hundred subjects

Measured by reviewers on the demo. Adrian has one to two hundred subjects.

- `inquiries.projects` does two authority reads per subject: 4 to 6 seconds at 24 subjects, 84 to 108 seconds at 150,
  and other calls wait behind it. The old limit of 100 subjects on linking a research topic guarded this.
- `study.research.brief`: 1.4 to 3.2 seconds at 158 subjects.
- Home made about 185 calls at 150 subjects (143 separate direction reads) and settled after 28 seconds.
- The Subject page showed its steps after 2 to 3.4 seconds at 158 subjects.

The answer planned: piece 8, one pure rule for where a subject stands, shared by server and browser, with one read
for a subject and one cached summary for all subjects. Home and Subject then read only that.

### 2. Home (`claude/v2-wip-home`)

1. The desk's order and the order inside a folder shared one saved number, so reordering one moved the other. A
   `deskOrder` field was being added to `runtime/services/subject-places.mjs`; a subject filed into another folder
   goes last there.
2. Reordering used a list captured when the page was painted; three quick presses scrambled other cards. Build the
   order from what is on screen at the press, and queue presses.
3. Untrue rows: subjects holding a voice note and notes showed "Add material"; finished Articles showed "Continue
   writing"; a subject with an Article and a chosen Carousel showed only the Article's step. Never show a next step
   that is not known.
4. Do not read every subject's direction on load. Read deeply only for desk cards and rows in view. A station count
   must not change after first paint unless a real change arrives.
5. An answered "Needs you" row should stay where it was, marked answered with "Change it". No command takes an answer
   back, so never say Undo.
6. Archive from Home, with Undo. One quiet line for an empty folder. "+8" when tags do not fit. Arrange as a Graphite
   control.
7. Covers for the five desk cards from the subject's first chosen photograph (`study.photos`, then
   `study.photos.preview`), after first paint.

### 3. Subject (`claude/v2-wip-subject`)

1. Every hand-off must name the right section id for its label; pin the table with a test. Keep passing subject,
   piece and section (the landing fault is in the workspace's link reader, see 5).
2. Never show a state that is not yet known, and never move the open step by itself. Paint in stages; a step still
   being read says "Reading" and is not chosen to open.
3. Speed: nothing slow before first paint, calls in parallel, re-ask only what a change touches, no read that lists
   every subject. All reading behind one `gather(subject)` so piece 8 can replace it.
4. Step states that were untrue: a finished Article (The words done, Check next); a suggestion waiting (The words
   needs him; Check and Publish wait); "photographs in the article" waiting on the wrong thing; "Name the dish" done
   without a named dish; a Carousel-only subject must still reach Write, Read and Check from a real step.
5. Look: the header stays one line with a long name; pills share rows on a phone; several Carousel plans told apart
   by name; the Post pill shows where it goes; done steps carry no note.
6. Forms cannot be reordered: no record keeps a hand-set order of pieces. Needs a small back-end addition.

### 4. Research (`claude/v2-wip-research`)

Written but unverified. Check each before accepting:

1. Linking a topic looks up one subject, never lists them all; nothing the owner waits on takes more than a second at
   150 subjects; no call holds the server.
2. An assistant cannot file a topic as "started by you", and any origin must point at a real record.
3. "Not now" is Adrian's alone. "Put in a group" stays open to assistants.
4. Asking a group searches the ticked sources, ignores capitals, and says exactly what was not searched.
5. The fold control for the rail is hidden on a computer. Thirty groups show as eight and a way to the rest. The group
   page has no column that wraps to single words. His one line on a topic is prose, not a boxed form.

How it is built, which held up in review: a topic is the inquiry the app already links to subjects, plus a small
record for where it came from, its state and its group. A group is a new record. Nothing is copied.

Leave room: a "wisdom bank" (nuggets of exact words, linked across sources) is being specified in another thread and
will most likely live inside Research. Do not invent a unit for one idea here.

### 5. Advanced must land in the right place (`claude/v2-wip-advanced-link`)

With a piece given, `public/document-study/version-two.js` re-opened Write after any section, and Read landed on
Arrange. Subject plus piece plus section must land on that section with that piece, for all fourteen section ids.

### 6. Slide studio and Looks (in)

- Words on a slide are read-only; changing them opens Advanced.
- On a phone the strip sits under the slide's caption and buttons, not directly under the slide.

### 7. Not started

- Piece 7: Write, Read and Check inside version two. They open in Advanced today.
- Capture (adding a recording, note, link or photographs) has no version two screen; it opens Advanced.
- Library and "Ask or find" in the top bar do nothing yet.
- Speaking: there is no speech button, on purpose. The browser's speech service would send his voice to a remote
  service. His phone keyboard's dictation types into the codes line.

## Things to know before trusting a green run

- `npm test` does not include the workspace's own page tests. Run `node --test public/document-study/*.test.mjs` as
  well. Three of them fail on untouched `main`: "public/document-study/collection-app-journey.test.mjs" (also shown
  as "full collection application creates a project…"), "shared discovery never replaces the fresh exact Carousel
  registry check at opening", and "advertised Outputs creation, each title/next action, own words, scope return and
  persistent reload use real owners".
- One test fails only on this cloud machine: "installed home mode: config must name the real home…". "real native
  HTTP photo inspect…" fails here now and then.
- Several tests fail only when many suites run at once and pass alone. Run a failure alone before counting it.
- `scripts/review-sideways.mjs --only=v2:home` (or `Home`, `v2`, and so on) checks one screen in about thirty
  seconds; a full run takes over twenty minutes.
- `npm run demo`, then `npm run demo:fill` (24 invented subjects at every stage; `-- --large` for 150) and
  `npm run demo:instagram` (one invented Carousel). Both refuse anything that is not the invented demo.

## The review's three root problems, as they stand in version two

- **The app did not hold the current subject.** In version two the subject is in the address and in the header of
  every subject screen. Not yet checked across a whole journey.
- **One subject had five source lists that disagreed.** Not addressed. Version two's "What you have" reads one list;
  the back end still has the five.
- **Write meant whichever piece was opened last.** Version two passes subject, piece and section to Advanced, and
  that landing is the fault in item 5.
