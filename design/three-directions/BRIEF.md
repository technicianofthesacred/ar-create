# Three UI/UX directions — shared brief

Branch `claude/ar-create-three-directions`, started from `origin/main` at `ad90ccc` (21 October 2026).
Design prototypes only. Nothing here touches `public/`, `runtime/`, the installed home or private data.

Each direction is ONE self-contained interactive file: `design/three-directions/<dir>/index.html`
(inline CSS + JS, no build, no external requests except Google Fonts if wanted). Invented content only —
no private manuscripts, photos or transcripts. Project names may be generic (e.g. "Porcelain and Tea",
"Harbour Night Market", "An Cha — three parts", "Spring Oolong listing").

## The product (same in every direction)

- **Library**: curated sources and personal notes, each once.
- **Collections**: reusable inquiries — questions, evidence, evolving understanding.
- **Concepts / Direction**: Adrian's own thoughts, questions, feelings, interpretations, chosen direction.
- **Pieces**: independently edited expressions — article, carousel, post, product listing, script, shared note.
- **Projects**: optional connections between Collections and Pieces.
- Work can start anywhere: a conversation, recording, idea, photo, product or existing writing.
- Claude/Codex are equal entrances to the same records. Show agent-created work with its actor
  ("Claude added 3 source notes · 2h ago") without asking Adrian to import or re-answer.

Twelve sections, grouped, all reachable, never compulsory:
Gather — 01 Material, 02 Source · Develop — 03 Research, 04 Direction ·
Make — 05 Write, 06 Read, 07 Check, 08 Media, 09 Arrange · Deliver — 10 Audience, 11 Share, 12 Outputs.

## Must be visible / workable in every direction

1. Where am I, what can I do — without a manual. Inviting, productive opening.
2. Many active projects: easy find + switch.
3. An obvious place for Adrian's own thoughts and words.
4. "Where I left off" and the current understanding.
5. Material = active intake (bring in, organise, preview, process). Source = understand + correct what was said (distinct).
6. Research: explore points, inspect evidence, mark uncertainty, discuss ONE point with AI.
7. Write feels like a good text document. Visible editorial margin; Focus hides it. Clicking a margin note highlights its passage.
8. Carousel edited as a whole sequence (all slides visible together), not one slide per click.
9. Media: photos + video; each asset shows where it is used.
10. Arrange (compose) vs Audience (preview as reader) vs Export — three distinct purposes.
11. One origin → several independently edited outputs.
12. Decisions, protected phrases, corrections and rejected angles visibly carry forward.
13. Avoid stacked headers, repeated notices, unexplained buttons, compulsory steps, extra sidebars.

## Honesty rules (hard)

Never fabricate a working AI response, research result, save, export, approval or publication.
Unconnected tools appear in place with a short honest state, e.g. "Not connected yet — your note is kept here"
or a clearly labelled "Sample" tag. A Save in the prototype says "Prototype — nothing is saved".
Known unconnected today: broad AI research/retrieval, AI editor assistance, device sync, Material keep/remove
review, bilingual Source view, voice/expression sheet, parts of the Magazine single-writer path.

## Look (keep the family resemblance to the installed app)

Dark default with a light toggle. Tokens:
dark  `--bg:#141310 --paper:#1d1b16 --ink:#e7e1d3 --dim:#a39e8e --line:#2d2a23 --warm:#c9a874 --rail:#191813 --lift:#191813 --sel:#2c2a22 --good:#8fb08a --warnc:#d9a95a --bad:#e08a74`
light `--bg:#efede6 --paper:#fffefb --ink:#2d302a --dim:#686c61 --line:#e2e0d8 --warm:#7a5a30 --rail:#f7f5ef --sel:#e9e4d7 --good:#3f6146 --warnc:#94600f --bad:#a23b2a`
Interface font Plus Jakarta Sans (Google Fonts ok); manuscript in system sans ~16–17px/1.6, ~700px measure;
Source/Research quotes may use a serif (Lora). Controls 13–15px. No gradients-as-decoration, no glass,
no pill-everything, no cream-on-cream cards stacked in cards, no emoji icons (inline SVG line icons).
Quiet sand scrollbars. Visible sand focus ring. Must work at 390px phone width with no sideways scroll.
Reordering is drag and drop, never arrow buttons.

## Done means

- File opens directly in a browser and every top-level control does something (navigates, toggles, highlights,
  reveals an honest "not connected" note).
- All twelve sections reachable; at least Home/opening, Material, Source, Research, Direction, Write (with margin
  + Focus), Carousel sequence, Media used-where, Arrange / Audience / Export distinction are real screens.
- A short `NOTES.md` beside it: the idea in two sentences, the opening screen, how switching works, what it is
  best at, what it costs (tradeoffs), and what would be needed to build it on the current shell.
