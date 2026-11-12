# Version three: where it stands and how to carry on

Written 12 November 2026 by the thread that designed the look of Write, Read and Check with Adrian and built the
first of it. That thread has stopped building. A fresh thread starts from this page, the plan beside it
(`2026-11-12-write-read-check-build.md`) and the approved sample (`design/2026-11-write/`), without needing the
conversation.

## The three fronts

- **Version three** (`public/v3/`): the default. The app's own address opens it, at every level. It is the look
  Adrian approved and the direction for the whole app.
- **Version two** (`public/v2/`): kept exactly as it is, reachable through the link "Version two" in version three,
  with "Version three" leading back. Adrian: "there needs to be a way to access all the old so that when things are
  going I can pull from the old as well". Change it only to protect his words.
- **Advanced** (`public/document-study/`): the original workspace, reachable from both.

All three use the commands in `runtime/commands.mjs` and the same records.

## What version three has

- Its own frame (`public/v3/shell/frame.js`, `frame.css`): one solid header band, the phone bottom bar, the theme
  switch, the links to the other fronts. It is the only shell loaded and gives screens the same names version two's
  shell does.
- Its own **Write** (`public/v3/screens/write.js`, `write-page.js`, `write-margin.js`, `write-versions.js`,
  `write.css`): the approved page; each paragraph a plain-text editable element that answers like a text box, so the
  save loop is version two's; a failed-save panel with Try again and Copy all my words; Undo that takes back only the
  latest saved change and always offers Put back; when two versions meet, both versions of a paragraph are kept in
  place until he chooses; words recovered after a crash are shown in place.
- Every other screen is **borrowed**: version two's screen file runs unchanged inside version three's frame. A screen
  version three builds takes over its route by being listed in `public/v3/index.html`; the frame refuses two files
  claiming one route. `public/v3/README.md` explains how.

## What version three lacks, in the order to build it

Each one look first where the sample does not already show it, his approval, then the machinery. The plan gives files,
commands and tests for each.

1. **Read** in the approved look (borrowed today; it does not have the sheet).
2. **Quotes and sources**: the sources column with the recording and its transcript, quoting a source, the mark on a
   quote. Adrian was shown four marks (`design/2026-11-write/pictures/sheet-quote-options.png`, page
   `quote-options.html` if it was committed) and has not chosen. A dotted underline is recommended; he said the ring
   "still gets in the way of the reading".
3. **Proposals** with before and after and a word count. His words: "the most important thing is for me to understand
   what is changing".
4. **Start from your own words**, for a subject with nothing written.
5. **Earlier versions**, after Google Docs: what changed first, then time and who; the version shown in the page;
   Restore at the top. `write-versions.js` is an empty registration waiting for it.
6. **Check**, each finding showing his sentence beside the source's, buttons that name their result. Stage 6 and 7 of
   the version two line added "Sources" and "Use it for Check" to version two's Check; carry them across.
7. **The Carousel**, written on its slides in their layouts; one place with the slide studio, not two.
8. **Speak**, to its edge (no speech engine is chosen). **Finished**, and the hand to Share.
9. Then the rest of the app in the new look: Home, the subject page, Research, Capture, Looks.

## What was learned about the look, in his words

- "I don't like how things shift when I mouse over them." Nothing moves on hover or focus. Prove it by script.
- "I don't like when a bar gets dropped from one single line to two." No bar changes its number of lines.
- "Your UI significantly reduces the amount of text because of the multiple buffers and barriers." Words get the
  width: no rails, indents or time columns; side text within about 12 pixels of the edge.
- "I don't need numbers in the middle of the writing … It should not interfere with it looking like a writing."
- "How many different fonts and colors and shapes and sizes you put here, how the header blurs in with the writing,
  and how you don't have clear delineations." Two faces, two interface sizes, three button kinds, one corner for
  controls; a solid band; each item its own piece of paper on the desk.
- "When icons can be used they should be. When words can be wider, with better stack design, they should be."
- "I'm not sure what all of the buttons do." A button names its result; evidence is shown in place.
- "We're not just looking for words, we're looking for whole layout and whole structure." A Carousel is designed on
  its slides.
- "If there's a saving problem, there should be a button to try to fix it."
- "Remember we're in the business of preserving the human element."
- How to work with him: "Give me links don't tell me what to do." Lead with a link or a picture; bring him decisions,
  not updates; never ask him to judge something he cannot see.

The system of styles is written at the top of `design/2026-11-write/NOTES.md`.

## Things to know before trusting or changing Write

- Not tried in Safari, Firefox or on a real phone keyboard: only Chromium is available on a cloud machine. Dictation,
  autocorrect, Return, joining with Backspace, paste and Copy all my words need a try on his own iPhone.
- Words he does not keep when two versions meet are set aside on the app by `study-draft.set-aside` (human only).
  Version three lists them under Versions and in Copy all my words. **Version two cannot show them.** Nothing can
  remove them yet, and Undo's taken-back copies on the device are never removed either, so Copy all my words grows.
  Both need a tidy-up rule that he decides.
- A crashed tab's kept words are offered to another tab some seconds later, and only after that tab has saved its own
  unsaved words. Nothing says words are waiting meanwhile. They are safe on the device.
- "Put this paragraph back" puts it at the end of the page, not where it was.
- Undo takes back only the latest automatic save. Typing that spanned two saves is only partly taken back.
- The borrowed Read and Check do not mention words kept on the device by version three's Write.
- The saving code is copied between the fronts on purpose. `tests/words-promises.test.mjs` runs the same promises
  against both so they cannot drift. A fix to saving goes into both.
- Two serious faults were found by reviewers and fixed by the reviewers themselves in this stage (two Undos in a row;
  words typed into a paragraph removed elsewhere). Each has a test that fails without the fix, but neither fix had a
  third pair of eyes.

## The automatic check, and what a release needs

- The `ci` check runs only on a pull request, never on a push to main. On #245 and #246 it ended **cancelled**:
  with no Mac runner idle the job goes to GitHub's machine, where it is stopped at its 15 minute limit before the
  suite finishes. Both were merged at Adrian's word ("Ship all") on the strength of the same suite run here.
- To make it green: have the Mac runner idle when the pull request opens (it has 25 minutes), delete the stale
  `.scratch/magazine-fixtures/` folder in the runner's checkout (it trips the package check), and expect
  "real native HTTP photo inspect and exact persisted lookup do not write, and restart preserves identities" to need
  the old workspace's page to boot within 30 seconds in jsdom, which it does not on a cloud machine.
- On a cloud machine the whole `npm test` has that one failure always and "installed home mode: config must name the
  real home…" sometimes. The old workspace's page tests (`node --test public/document-study/*.test.mjs`, not part of
  `npm test`) have three known failures: "full collection application…", "shared discovery never replaces the fresh
  exact Carousel registry check at opening", "advertised Outputs creation…".
- A tracked file whose path contains `before-` fails the package test.
- The release to his installed app is run only on his Mac, by `scripts/release.mjs`, which reads the `ci` check of the
  commit it installs.
