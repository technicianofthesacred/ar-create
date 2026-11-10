# Design round: a noticeably better interface (November 2026)

Mock-ups for Adrian to choose from by eye. **Nothing in the app has changed.** The brief is
`docs/plans/2026-11-10-08-a-noticeably-better-interface.md`.

## What is here

| Folder | Direction | In one line |
|---|---|---|
| `a-the-board/` | A. The board | Today's frame finished: the sidebar becomes a path, Home a desk of subject cards, the Subject board the centre of each subject |
| `b-the-path/` | B. The path | No sidebar. Each subject is a line with four stations (Gather, Develop, Make, Deliver); Home shows the lines side by side, a subject page is its line upright |
| `c-the-work/` | C. The work itself | No bars. Subjects are covers, pieces are shown large, a floating dock carries the controls, proposals arrive as changes marked in the writing |
| `kit/` | Shared | The invented story, the palette and Graphite controls copied from the app, generated pictures, and the small behaviours (answer, accept, Undo, capture) |

Each direction has five screens, reached by clicking or from the dashed strip at the top (the strip is not part of any design):
Home, the subject page, a brand new subject, Write with a source beside the words and proposals waiting, and Write in plain focus.

## How to look

Open `index.html` in a browser, or any direction's `index.html`. They are static pages; no server and no build is needed.
The fonts load from `runtime/public/assets/fonts`, so open them from inside the repository.
`build-shareable.mjs` packs one direction into a single file with everything inlined, for sending.

## The story (all invented)

One tea subject, "Mrs. Oda's shaded garden": a 42 minute recording with a two-speaker transcript, three notes, six
photographs, half an Article ("Twenty days of shade") with two proposals waiting, a five-slide Carousel, and one question
that needs Adrian. Four other subjects at other stages, and one published. Photographs and slides are drawn shapes.

## Rules of use each direction shows

- The subject's name is on every screen.
- A new subject opens as itself with one first step (Add material, or Start writing).
- Article, Carousel and Video are always listed together; Write means the writing.
- One list of sources, shown the same on the subject page and beside the writing; attaching takes one press, with Undo.
- Every screen offers the next step.
- Accepting, putting away and answering can each be undone where it was done.
- All twelve sections stay reachable: in A under the path in the sidebar, in B along the line beside each station, in C from "Sections" in the dock.
- A tool that is not connected says so where it is met, quietly (Video, posting).

## Rough size to build

Judged from how the look modules sit on top of the existing markup (`docs/product/LOOK.md`).

- **A: medium.** The frame, rail, Home and Subject board exist; this restyles and refills them and needs plans 1 to 3 for the data.
- **B: large.** The sidebar goes, so navigation moves, and the subject page becomes a new screen that gathers parts of all twelve sections.
- **C: largest.** New navigation (crumb and dock), covers that need a lead picture per subject, and proposals marked inside the writing, which touches the editor.
