# Stage 5: the whole journey walked

Read `v2-common.md` first; all of it applies except where this brief says otherwise. You do not need the mock-up.

## The job

One script, `scripts/review-journey.mjs`, that walks one piece from a recording to a checked piece inside version
two on the demo, the way Adrian would with his hands (clicks, typing, the phone bar), and never leaves version two
unless it has to. Where it has to leave (a step that only works in Advanced, a part that says "not built yet", a
control that does nothing, an error), it writes that down as a break and carries on by the shortest honest route.
It must not hide a break by calling a command the screen itself does not call. The one stand-in allowed: the demo
cannot transcribe, so the transcript may be put in place the way Capture's own tests do it; say exactly how.

The steps, each photographed:

1. Home, as it opens.
2. A new subject made from Home.
3. Capture, Speak: a short recording saved to that subject (a fake microphone in the browser is fine).
4. The subject page saying where the recording stands, then "Use the transcript" so it becomes a source, then "Confirm this transcript" (the speaker is named and the words confirmed) and "Use it for Check", each pressed through the real buttons as Adrian.
5. The subject's steps leading to Write for its Article.
6. Write: a few paragraphs typed, saved, a reload showing them still there.
7. Read: the saved words.
8. Check: "Check saved draft" pressed. Because step 4 confirmed the transcript and used it for Check, this ends in a real result (not held); if it is held the walk records that as a break. Capturing from a held Check (the list and its one button) is photographed apart from the walk.
9. Back on the subject and on Home: where the piece now stands.

Walk it four times: 1440 wide and 390 wide, dark and light (the theme button, not the browser's setting). At 390
also assert nothing scrolls sideways on each step.

For each step also photograph the old screen that does the same job in the existing workspace
(`/document-study/index.html`, same subject and piece, same width and theme), reached through `v2.advanced` or the
bar's Advanced. Do not change anything under `public/document-study/`.

## What it leaves behind

- `scripts/review-journey.mjs`, runnable as `AR_CREATE_URL=http://127.0.0.1:<port> node scripts/review-journey.mjs
  --out <folder>`, exiting non-zero only when a step could not be done at all. It prints the list of breaks.
- In `--out`: JPEG pictures no wider than 1440 (phone ones at their own width, quality about 70, each under 250 KB),
  named `<step>-<new|old>-<width>-<theme>.jpg`; `journey.json` (each step, each width and theme, done or broken, the
  break in one plain sentence, the address); and one contact sheet `sheet.jpg` no larger than 1600 by 1600 showing
  the nine new screens at 1440 dark, small.
- A short list in your report of every break and every fault you saw, most important first, each with the screen,
  the width and theme, and what he would see.

## Files you may touch

`scripts/review-journey.mjs` (new) and, if you want one, `tests/review-journey.test.mjs` (new). Nothing else. If the
walk shows a fault in a screen, report it; do not fix it.

## Finish

Do not run the whole `npm test` or the full sideways check; the director runs them once. Run your script to the end
twice from a fresh demo. Stop your demo and confirm the port is free. Do not commit.
