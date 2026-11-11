# Handoff: the design round and what it became

Written 11 November 2026 so a fresh thread can pick this up without the long conversation behind it.

## The directions

| Direction | Folder | Page | Where it stands |
|---|---|---|---|
| A, The Board | `a-the-board/` | https://claude.ai/artifact/JJcBtSaeCiqcopXL9SJNt7 | Round one. Not chosen. |
| B, The Path | `b-the-path/` | https://claude.ai/artifact/BvFzZzTSEvepCXNTgVSm3S | Round one. Its line of stations went into D. |
| C, The Work | `c-the-work/` | https://claude.ai/artifact/9aKsWsAntRGLoQVZrL6XJA | Round one. Its large pieces went into D. |
| D, Gather, Research, Create, Share | `d-four-stations/` | https://claude.ai/artifact/WX8P39n9Gxd8k5L9uB7otD | **Chosen.** Seven passes. Being built as version two. |

`kit/` holds what A, B and C share. `README.md` records every pass on D. `BUILD-PLAN.md` lists what was not drawn.

## What Adrian said, and what he chose

- He asked for a mix of B and C, with research given real weight: "the goal's not just to create these articles, the
  goal is to learn."
- The stations are Gather, Research, Create, Share: "Instead of make, it's create." A research topic is separate from
  a subject.
- Home: "I might have a hundred or even two hundred things I'm working on. Sometimes maybe I'll be working on five at
  once." He liked the desk and Everything, and asked for drag and drop, tags as well as folders, and folders that
  mirror the real file structure.
- Research: the first version was "super text heavy" and "overwhelming". He wants it slim, few sizes, one font,
  topics that "self-create", and groups of sources "like NotebookLM".
- Subject page: it must be clear "what I need to do to get to the next step" without reading. Forms are plug-ins with
  their own steps. A single ring, not four dots. No sentences that describe the screen back to him.
- Slides: all of his own Carousel layouts, many options, logos and graphics that can be placed, templates that keep
  growing, a code on every design ("use C1, 2 and 5"), a look per brand as a DESIGN.md, accounts apart from looks.
- No sideways scrolling anywhere.
- One back end and many doors: the app and any assistant update the same records.
- On 11 November he chose: version two (Direction D) is the main app and opens by default; the existing workspace
  stays as Advanced; build all of it. The director is the strongest model and only directs; Opus and Sonnet build
  and review each other.

References he gave: his Teajia Instagram guide and system canvas (named in `editorial/brands/teajia.md`), NotebookLM
for research groups, his own i64os research and writing notes, and the DESIGN.md files of his projects. No other
references for look or taste were recorded in this thread.

## Where the build is

Branch `claude/direction-d-build`, cut from `main`. Two contracts, each with a record table of what is done:

- `docs/plans/2026-11-11-direction-d-build.md`: codes, looks, accounts, placed things and templates, the studio's
  Made section, subject filing on the server, the sideways check. All in.
- `docs/plans/2026-11-11-version-two.md`: version two under `public/v2/`. In and reviewed: the shell, a fuller demo,
  the slide studio and the Looks page. Built, reviewed once and stopped part way through their corrections: Home,
  Subject and Research, each on its own branch and not merged. Not started: one fast read of where a subject stands,
  and bringing Write, Read and Check inside version two.
- `docs/plans/2026-11-11-version-two-open-corrections.md`: everything still open, most important first, and what to
  know before trusting a green test run. The briefs each builder worked from are in `docs/plans/version-two-briefs/`.

To see it: `npm run setup && npm run build && npm run demo`, then `npm run demo:fill`, and open the address the demo
prints. Nothing is released; a release to the running app and its real data is Adrian's.

## What a fresh thread should read

1. This file, then `README.md` and `BUILD-PLAN.md` beside it.
2. `d-four-stations/app.js`, `studio.js` and the later blocks of `app.css` for the look and behaviour.
3. On the build branch: the two contracts above and `public/v2/README.md`.
4. `CLAUDE.md`, `docs/START.md` and `docs/product/LOOK.md` for the rules of the app.

## Adrian's review of version two

He has not yet reviewed any version two screen. He has been sent first-look pictures of Home, Subject, the slide
studio, Looks and Research, and has not commented on any of them. Nothing in version two is approved by eye.

What he has said about version two as a whole, in his words:

- After the first night he opened the demo and saw the existing workspace: "it's the old version". The first night
  had built the back end and one section inside the existing Instagram studio, and a fresh demo had nothing to open.
- "I do like the idea of keeping that sidebar. Maybe I could use it as an advanced mode or not completely scrapping
  what I have."
- "Perhaps the new version we can call version two."
- "Two should be the main one, the one that you're building now, and the other one should be the advanced version.
  Default to the one that you're building now. And yes, I want you to build all of them."
- He wants it joined to "the real live data that I already have so I don't have to see this sample or template".
  That needs a release to the running app, which is his to make.

Corrections still open, most important first. These come from the second-model reviews, not from him. The full list
is in `docs/plans/2026-11-11-version-two-open-corrections.md` on the build branch.

1. The app's own reads are slow above about a hundred subjects, and he has one to two hundred. Home took 28 seconds
   to settle at 150 subjects. One fast, shared read of where a subject stands is planned and not started.
2. Home showed untrue next steps for some subjects, and reordering the desk also moved the order inside folders.
3. Subject showed step states before it knew them, and some were wrong (a finished Article, a suggestion waiting).
4. Research has all its corrections written and none checked.
5. "Open in Advanced" with a piece lands on Write whatever section was asked for.
6. Write, Read, Check and adding material still open in Advanced. Library and "Ask or find" do nothing yet.

## Unpushed work

Nothing is unpushed. Finished work is on `claude/direction-d-build`. Unfinished work is on four branches, not merged
into it and not reviewed: `claude/v2-wip-home`, `claude/v2-wip-subject`, `claude/v2-wip-research` and
`claude/v2-wip-advanced-link`. The design round is on `claude/ar-create-design-round`.
