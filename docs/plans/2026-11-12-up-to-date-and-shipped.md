# AR Create: what it takes to be fully up to date and shipped in version three

Written 12 November 2026 by the stage 5 director, at Adrian's request, from main and the running threads as they
stood that afternoon. It is a map for the thread that runs on Adrian's Mac (see "The Mac thread" at the end). Read
the owners named here again before acting; this page will age.

## Where things stand

- **Three fronts, one back end.** Version three (`public/v3/`) is the default: the app's address opens it. Version
  two (`public/v2/`) is kept behind the bar's "Version two" link. The existing workspace (`public/document-study/`)
  is "Advanced". Plan: `docs/plans/2026-11-12-write-read-check-build.md` on branch `claude/v2-write-read-check`;
  how a screen plugs in: `public/v3/README.md`.
- **What version three owns today:** its frame (the bar, the phone bar) and Write. Every other screen is still
  version two's file running inside the new frame: Home, the subject page, Read, Check, Research, the slide studio,
  Looks, and the Capture sheet (`public/v3/index.html` is the route table).
- **The journey works on the demo.** New subject, Speak, Confirm this transcript, Use it for Check, Write, Read,
  Check ends in a real result (`scripts/review-journey.mjs`; stages 5 and 6 in `2026-11-11-version-two.md`).
- **Not known from the cloud:** which commit is installed on the Mac. `docs/status/CURRENT.md` still describes the
  10 November install; the open corrections file says version two was installed on 12 November with
  `--no-ci-check`. Read `RELEASE.json` through the installed CLI's `status`.

## Still being built, in cloud threads (do not build in their files)

1. **Stage 7** ("Version two, stage 7: confirming is his alone, and stopping a captured source",
   session_017kitFer7qEhZeah889H6KU): marking reviewed becomes human-only; "Stop using for Check". Touches the
   registry, the first-flow and transcription paths, `subject.js` and `check.js` in marked blocks.
2. **Version three's Write, Read and Check** ("AR Create: Write, Read and Check inside version two (director)",
   session_017kitFe2b6MQFZwy3MNMGpN, branch `claude/v2-write-read-check`): the conflict paragraph by paragraph and
   one device key per tab were under review; Read and Check in the approved look come after. Until that lands, in
   Write "Use the saved version" discards unsaved words and "Keep my words" overwrites the other version whole.

## What is left before everything is in version three and shipped

In order. The first three need the Mac; the rest can be built anywhere.

1. **Release main into the installed app, and keep it current.** `scripts/release.mjs` on the Mac, with Adrian's
   word. It reads the commit's `ci` check, which is red for two reasons that are not version two or three: the photo
   inspect test (the workspace page's photo details panel never opens under jsdom since pull request 235), and the
   package check tripping on `.scratch/magazine-fixtures` in the Mac runner's checkout, kept alive by three orphaned
   test servers from 11 November. Stop those servers, delete the folder, fix the fixture helper so it leaves none,
   and find the true cause of the photo inspect failure, so a release no longer needs `--no-ci-check`.
2. **Walk it with his real records, as an assistant, read only** (`?reviewActor=agent:<name>`, CLI read commands).
   The list is "To check on his Mac first" under Stage 4 in `2026-11-11-version-two-open-corrections.md`: his nine
   Magazine stories on Home, none twice; a subject's header; his three Carousels told apart; speed with his Library;
   Find and To file. Then stage 6 on real records: a real recording transcribed, Confirm this transcript, Use it for
   Check. The cloud has no transcription tools, so these were only ever seen against a stand-in.
3. **Refresh the status pages from a real measurement:** `node scripts/gen-status.mjs` with the installed release
   and a real test run; `TODO.md` and `docs/status/WORKS.md` still describe the app before version two.
4. **The screens version three has not redone**, each in the approved look (`design/2026-11-write/`, NOTES.md
   binds; the earlier sample `design/2026-11-better-interface/d-four-stations/` for screens that design does not
   draw): Read and Check (the cloud thread above), then Home, the subject page, Capture, Research, the slide studio,
   Looks. Each takes its route over in `public/v3/index.html`; version two's files do not change.
5. **Parts that say "not built yet" or lead to Advanced** (each named in the open corrections file): a Carousel's
   Read and Check; words on a slide; a new Carousel from an older Outputs one; editing a Magazine story in Write
   (built, switched off behind `STORY_EDITING` until four faults are corrected); playing a recording beside the
   page; Still to write; comparing versions; Library and "Ask or find" in the bar; sentence answers in Research;
   filing a Library capture into a subject; reordering forms; a record that says a piece is published.
6. **Older faults in Write** listed under Stage 5 in the open corrections file (Enter during a save, an Android
   newline), unless the version three Write thread has already closed them: check its branch first.
7. **One subject, five source lists that disagree** (the first review's second root problem): not addressed.
8. **Housekeeping:** finished branches Adrian agreed can go (`claude/direction-d-build`, `claude/v2-wip-*`,
   `claude/v2-small-fixes`, `claude/v2-journey-walk`, `claude/ar-create-screens`); the cloud cannot delete branches.

## The Mac thread

Adrian asked on 12 November for a new thread on his own computer, so that transcription, the installed app, the
release and the runner are all at hand. Its goal: AR Create is useful from start to finish in version three, a real
recording to a checked, finished piece, in the installed app. It works through the list above in order, starting
with items 1 to 3, which only the Mac can do. It follows `CLAUDE.md` without exception: code only in a fresh worktree
cut from `origin/main`; never edit the home, never a server on 8841, never read `data/` or `backups/` directly,
never write the vault; the release and anything in his live tabs need his word; agents propose, Adrian decides.
