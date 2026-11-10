# Design round: a noticeably better interface (November 2026)

Mock-ups for Adrian to choose from by eye. **Nothing in the app has changed.** The brief is
`docs/plans/2026-11-10-08-a-noticeably-better-interface.md`.

## Second round: direction D (10 November, later the same day)

After seeing A, B and C, Adrian asked for the B and C mix with Research treated as learning in its own right, and for the
design to be checked against his i64os research work (the Research Machine, Scout, the Study room, WordForge) and against
everything AR Create is meant to do. He confirmed three things: the four stations are **Gather, Research, Create, Share**;
a research topic is separate from a subject, so one topic can feed many subjects; and Simmer sits on the subject page
between Research and Create.

`d-four-stations/` is that one direction. Seven screens: Home, the subject page, a brand new subject, a research topic,
the Research home, Write, and Write in focus. What it adds to A, B and C:

- **Research has its own home.** Topics outlive pieces and only speak when they are ripe, contested or stalled. "Ask across everything" answers from what he has kept and says plainly what his sources cannot answer.
- **A research topic reads like Write.** Sources and Scout on the left, a briefing that teaches and claims in four bands (settled, contested, what goes wrong, fringe) in the middle, and his own side on the right: "you first", learning notes Claude never writes in, his position, what is still open, and an honest receipt of the visit.
- **Claims, not summaries.** Each claim shows who backs it, who disputes it and who says nothing, and a contested claim says why they disagree. One person's telling is kept whole and apart.
- **Simmer** between Research and Create: the board, the possible dishes, and the dish named in his words.
- **Needs you in two kinds:** what only he can decide, and what Claude carries on with unless he changes it.
- **Before you release:** the consent hold, shown where it blocks.
- **One read-through in Write.** Claude's draft stays dim until he rewrites it or marks it Not me, then he finishes. A change to one passage still has Accept and Dismiss. A question thrown to Research comes back beside its paragraph.
- **Four origins kept distinct** with a word and a mark, never colour alone: their words, his reflection, outside evidence, Claude's proposal.
- **Formats that do not exist yet are choices under New piece**, not empty rows.

Corrections to A, B and C that D carries: the mode is Write (not Edit); no accept button on each drafted paragraph; no
"Video, not started" row.

## What is here

| Folder | Direction | In one line |
|---|---|---|
| `a-the-board/` | A. The board | Today's frame finished: the sidebar becomes a path, Home a desk of subject cards, the Subject board the centre of each subject |
| `b-the-path/` | B. The path | No sidebar. Each subject is a line with four stations (Gather, Develop, Make, Deliver); Home shows the lines side by side, a subject page is its line upright |
| `c-the-work/` | C. The work itself | No bars. Subjects are covers, pieces are shown large, a floating dock carries the controls, proposals arrive as changes marked in the writing |
| `d-four-stations/` | D. Gather, Research, Create, Share | The second round: one direction, with Research and Simmer drawn in full |
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
