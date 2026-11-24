# First transcript correction calibration · 24 November 2026

This records the first accuracy measurement for the transcript check, the step where a model proposes corrections and Adrian decides. It is one invented, hinted text example. It has no audio and makes no claim about accuracy across real recordings.

## What was run

A separate local experiment on `main` at `643113e`, in a clean checkout, ran the production `suggestionPrompt`, `executeClaude` (Sonnet) and `validateSuggestions` once. The experiment retained its synthetic scoring results locally without writing an AR Create transcript or review record. The provider was not run again for this note.

The invented fixture:

- Title: *Tea and bread by the river*. Vocabulary: Yixing, oolong.
- Six lines starting at 0, 5, 10, 15, 20 and 25 seconds, each four seconds long.
- Three word entries were marked uncertain (probability 0.35): *you shing*, *bred*, and *fifteen*. The first entry contains two words. *Fifteen* is correctly transcribed, so the check also had to leave an uncertain but correct word alone.

| Line | Transcript given to the check | Reference, fixed before the call |
| --- | --- | --- |
| 0 | I poured the tea into a you shing teapot. | I poured the tea into a Yixing teapot. |
| 1 | The bred came out of the oven. | The bread came out of the oven. |
| 2 | We sat by the river till it got dark. | (same) |
| 3 | I set the timer for fifteen minutes. | (same) |
| 4 | And, um, I kind of liked it like that. | (same) |
| 5 | The oolong was floral, but the water was a little cold. | (same) |

## Result

The check returned two **sure** proposals and nothing else:

- “I poured the tea into a you shing teapot.” → “I poured the tea into a Yixing teapot.”
- “The bred came out of the oven.” → “The bread came out of the oven.”

The four clean lines were left unchanged, including the uncertain but correct *fifteen* and the spoken filler “um”. Validation dropped no proposals.

## Scoring

Each line is compared with its reference by word edit distance (insertions, deletions and substitutions), after lower-casing and removing punctuation. The reference has 51 words.

- **Before:** 3/51. *you shing* against *Yixing* costs 2, *bred* against *bread* costs 1.
- **After applying both proposals (hypothetically; nothing was saved):** 0/51.

## Independent checks for this note

- The scoring was recomputed with a separate script, written fresh, that builds the fixture above, passes the two recorded proposals through the production `validateSuggestions` (two kept, both sure, none dropped), applies them and scores each line. It gave 51 reference words, 3 before and 0 after. It also confirmed that the production `suggestionPrompt` shows *you shing*, *bred* and *fifteen* as unsure on their lines. The provider was not called.
- The existing transcript check tests pass: `npm run setup`, `npm run build`, `node --test tests/transcript-check.test.mjs` (9 of 9).

## What this does and does not show

It shows that, on one short example with the right word in the vocabulary hint, the check fixed both errors, left an uncertain but correct word and a filler word alone, and proposed nothing extra. It does not show how the check does on real audio, without a vocabulary hint, on longer recordings, or across many recordings. One run of one example cannot.

## Recommendation

Before adding an extra grading pass, test ambiguity: lines where the right fix is unclear, the hint is missing or misleading, or a plausible respelling would change the meaning. That will show whether the check correctly files such lines as ear checks rather than sure fixes, which is the case a grading pass would be meant to catch.
