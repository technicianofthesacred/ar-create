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
- `docs/plans/2026-11-11-version-two.md`: version two under `public/v2/`. The shell and a fuller demo are in. Home,
  Subject, Slides and Looks, and Research are built and in review. Still to do: bring the four screens together,
  link them, a full check, pictures for Adrian, and bringing Write, Read and Check inside version two.

To see it: `npm run setup && npm run build && npm run demo`, then `npm run demo:fill`, and open the address the demo
prints. Nothing is released; a release to the running app and its real data is Adrian's.

## What a fresh thread should read

1. This file, then `README.md` and `BUILD-PLAN.md` beside it.
2. `d-four-stations/app.js`, `studio.js` and the later blocks of `app.css` for the look and behaviour.
3. On the build branch: the two contracts above and `public/v2/README.md`.
4. `CLAUDE.md`, `docs/START.md` and `docs/product/LOOK.md` for the rules of the app.
