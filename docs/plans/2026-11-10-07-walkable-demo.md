# Plan 7: a demo that walks the whole chain

**Goal.** `npm run demo` holds enough invented material that anyone, on any machine, can walk AR Create from a recording to a finished, checked piece, with no Mac, no private data and no account.

**Why first.** The review could not test the chain that matters most: spoken words becoming checked writing. The demo has no recording, no transcript, no AI answers and no working photos, and the only place those exist is Adrian's Mac. Every later plan would share that blind spot. This plan removes it and changes nothing in his installed app.

**Findings covered.** The review's "Not checked" list; scouting item 1; the "demo only?" doubts on U11, U12 and U18; Part 4's point that a cloud agent can see the software and nothing of the work.

## What the demo should hold

All invented, and marked as invented on screen (it already says "Synthetic fixture only").

| In the demo | So this can be walked | Today |
|---|---|---|
| One short recording with an invented two-speaker transcript, already transcribed | Material, Source with speakers and times, transcript correction, "Words to check" | No recording. `runtime/recording-workshop-fixture.mjs` already makes tones with authored captions for tests |
| A stand-in AI that answers from a fixed script | Research answers, Direction options, AI proposals in Write, their review, accept and reject, "Needs you" | "Live AI is not connected". Tests already replace the runner (`spawnChild` in `tests/execution-readiness.test.mjs` and others) |
| Three invented photos (generated shapes, no real images) in a working photo folder | Media, the photo picker, a photo on a Carousel slide, export | The picker fails with "invalid source identities" for an app-made subject (U12) |
| A subject at each stage: just material; with a transcript and research; with writing and pending proposals; with an Article and a Carousel ready for Audience | Home with real variety; "Pick up here"; coming back to work in progress | Two near-empty subjects |
| One subject made the way the app makes them (not from the vault-style catalogue) | The path a new subject actually takes | Only catalogue subjects, which are wired differently |
| One held consent and one answered | Share's hold and release, and the 423 answer on export | Empty |
| An agent's question waiting on Home, one answered, one applied by default | "Needs you" | "Nothing needs you right now" |
| Twenty extra subjects and two hundred Library items behind a switch (`--large`) | Finding, filing, speed | None |

## What must not change

- The demo stays disposable: a temporary folder outside Git, port 8854, never 8841.
- No real names, words, photos or recordings. `npm run verify:package` keeps refusing private content; invented photos are generated at start, not committed as files.
- The stand-in AI is plainly labelled on screen ("Stand-in answers for the demo") so no screenshot can be mistaken for a real model run. It exists only when the demo starts it and cannot be configured for a real home.
- Nothing in the runtime behaves differently for a real home.

## Where the work is

| Piece | Files |
|---|---|
| The demo's folder and configuration | `scripts/demo.mjs` (`syntheticHome`) |
| Invented subjects shown in the browser | `fixtures/synthetic-study-data.js`, `fixture-overlay.mjs` |
| An invented recording with captions | `runtime/recording-workshop-fixture.mjs` |
| Where the AI runner is chosen | `config.mjs` (`execution`, `tools.codex`), `runtime/services/artifact-execution.mjs` |
| Photo roots | `config.mjs` (`studyOriginalRoots`, `sourceRoots`), `runtime/services/library.mjs` |
| Consent and "Needs you" records | `docs/START.md`, "Where data lives" (`consent-desk/`, the needs list) |

## Steps

1. **Seed through the app's own entrances, not by writing files.** After the demo server starts, a seeding script calls the same commands an agent or the page would (`agents/cli/ar-create.mjs`): add material, create subjects, save writing as the demo author, raise a "Needs you" question. This keeps the seed honest: if the seed cannot do something, neither can a user. Where a step is human-only, the seed acts as the demo's author, which is acceptable only because the home is invented and disposable.
2. **The recording**: reuse the workshop fixture to add one recording with its authored transcript, so Source shows sessions with speakers and times.
3. **The stand-in AI**: a small local program the demo names as its runner. It returns fixed, clearly invented answers for a research question, direction options and a paragraph proposal, and can be told to fail or be slow so those states can be seen.
4. **Photos**: generate three plain images at start, in a photo folder the demo configures, and attach them to one subject.
5. **Subjects at each stage**, including one made through "New subject".
6. **The large switch**: `npm run demo -- --large`.
7. **A journey test** that walks the seeded demo from the recording to an exported Carousel, at desktop and phone width. This becomes the test that plans 1 to 5 extend.
8. Update `scripts/review-screens.mjs` to visit the populated subjects, and note in `docs/START.md` what the demo holds.

## Finish checks

- From a clean clone on a machine that is not a Mac: `npm run setup`, `npm run build`, `npm run demo`, then walk recording, transcript, research answer, direction, writing with a proposal accepted and one rejected, Check with a real comparison, a photo on a slide, Audience, a held and then released Share, and an export, with no step blocked for want of data.
- Each of U11, U12 and U18 is settled: either it reproduces on the seeded demo (a real fault) or it does not (it was the old demo's emptiness), and the review is updated.
- The stand-in AI's label is visible wherever its answers appear.
- `npm run verify:package` and `npm test` pass.

## Decisions needed first

None. It touches only invented data and the demo script. It still needs Adrian's yes to the plan, as every plan does.
