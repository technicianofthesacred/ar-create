# Version two: the main app, with the existing workspace as Advanced

Approved by Adrian on 11 November 2026. Version two is the interface he chose by eye in the design round (the mock-up
"Direction D: Gather, Research, Create, Share", in `design/2026-11-better-interface/d-four-stations/` on branch
`claude/ar-create-design-round`, with its README and BUILD-PLAN). It becomes the main app and opens by default. The
existing workspace stays exactly as it is and is reached as **Advanced**. One director; workers on other models; each
piece reviewed by a second model before it is kept. This file is the contract and the running record.

## The shape

- **Two fronts, one back end.** Version two is a new set of plain pages under `public/v2/`. The existing workspace
  stays at `/document-study/index.html`, untouched apart from one link back. Both use only the commands in the one
  registry (`runtime/commands.mjs`) and the same records, so they cannot drift apart. Version two never reads or
  writes a file directly and never keeps a private copy of a record.
- **Default.** The app's own address opens version two. Every address that opens the existing workspace today keeps
  working, including the links assistants are given.
- **Each opens the other.** Version two has "Advanced" in its top bar, and "Open in Advanced" on any step it has not
  rebuilt, landing on the matching section of the existing workspace for the same subject and piece. The existing
  workspace gets one quiet link, "Version two".
- **Only real records.** Version two shows what the home holds. It never shows sample or invented content as if it
  were his. Where a part has no back end yet, the control is left out or says plainly that it is not built yet.
- **No framework and no build step** for version two: plain script files, one per screen, that register themselves
  with a small shell (router, command client, top bar, phone bar, theme). Styles come from the app's own tokens
  (`c3-theme.css`, Graphite controls), not copies of them.

## Rules of the look (from Adrian's reviews of the mock-up)

- Nothing scrolls sideways, at 390, 700, 1000 or 1440 wide. Rows wrap; long words break.
- It must be obvious what to do next without reading instructions. Detail stays out of the way until it is needed.
- Slim and quiet: six type sizes at most (12, 13, 14, 15, 18, 22), one interface face, Lora only for spoken words.
  Write keeps its approved page.
- The four stations are Gather, Research, Create, Share. A single ring shows how far a subject is. No sentences that
  describe the screen back to him ("It stands in Create").
- Home holds a hundred or two hundred subjects with five in hand: "Needs you", "On your desk", "Everything" by
  folder, tag, station or recent. Desk cards, rows, folders and forms reorder by dragging, and by Move up and Move
  down where there is no mouse. Folders are real places, shown with their path.
- A subject shows its forms in order (Article for the magazine, Carousel for Instagram, and so on). Each form brings
  its own steps; one step is open at a time with its tool; steps that wait say what they wait for.
- Each brand tints the app a little (the look's accent) so he knows where he is.
- Words on screen are plain and use the names the app already shows. No em dash.
- Everything he can do in a screen, an assistant can do through a command, and the screen shows it when it happens.

## Rules for every worker

The rules in `docs/plans/2026-11-11-direction-d-build.md` ("Rules for every worker") all apply. In addition:

- Work only in your own folder and only in the files your brief names. The shell's files and `public/v2/index.html`
  belong to the shell piece; a screen piece changes only its own screen files.
- Never change a file under `public/document-study/` unless your brief says so. The existing workspace must look and
  behave exactly as before.
- Use the shell's command client for every call (it carries the actor, the operation id, revision checks and the
  plain message when something is held or refused). Human-only decisions stay human-only.
- Phone first, both themes, keyboard reachable, and run `scripts/review-sideways.mjs` on your screen plain and with
  `--stress` before you report.
- Take pictures of your screen in the demo at 1440 and 390 wide, dark and light, for Adrian.

## The pieces

1. **Shell.** `public/v2/`: the page, router, command client, top bar and phone bar, theme, brand tint, the frame
   every screen registers into, stubs for every screen below, the default address, the two links between the fronts,
   and the sideways check taught to visit version two.
2. **A fuller demo.** One command that fills the running demo with invented subjects at every stage, in folders, with
   tags, pins, pieces and a few things that need him, so version two can be walked and photographed.
3. **Home.** Needs you, On your desk, Everything, folders, tags, stations, reorder, New subject.
4. **Subject.** Header, forms in order, steps, one step open; each step either its own small tool or Open in
   Advanced; Add a form.
5. **Slides and Looks.** The slide studio full screen for a Carousel, and the Looks page (looks, accounts, assets,
   templates), on the commands built on 10 November.
6. **Research.** Topics that outlive one subject, groups of sources, where each topic came from, and the screens for
   them, built on the research records the app already keeps. Parts that need an engine not yet chosen say so.
7. **Write and the rest.** Version two opens the approved Write, Read and Check for a piece; later pieces bring
   them inside.

## Record

| Piece | Built by | Reviewed by | State |
|---|---|---|---|
| 1 Shell | Opus | Sonnet | In. The app's address opens version two; top bar, phone bar, theme, tint, command client, change stream, a stub for every screen, Advanced both ways. A screen written from the README alone worked first time |
| 2 A fuller demo | Sonnet | director | In. `npm run demo:fill` makes 24 invented subjects at every stage; `-- --large` makes 150 |
| 3 Home | Opus, finished by Sonnet | Sonnet, then Opus | In. Reads where every subject stands from the one fast read; all seven corrections made and reviewed; Adrian was sent four pictures on 11 November |
| 4 Subject | Opus, finished by Sonnet | Sonnet, then Opus | In. Every step and state comes from the one fast read; corrections after review made. Forms cannot be reordered yet (no record keeps a hand-set order) |
| 5 Slides and Looks | Sonnet | Opus | In. The studio and the Looks page work end to end on the commands, by mouse, touch and keys; sized to the mock-up after review; waits for Adrian's eyes. Words on a slide are read-only here |
| 6 Research | Opus, finished by Sonnet | Sonnet, then Opus | In. Topics, groups and where each topic came from; eight corrections after review made, the four that mattered being re-checked. Sentence answers and looking for new material say they are not built yet |
| 7 Write and the rest | | | Split into the stages below |
| Stage 1: Write inside version two | Sonnet, four passes | Opus, three times; Haiku against the sample | In. `#/write/<subject>?piece=<piece>` reads and saves the real draft; split, join and delete in place with Undo; an assistant's suggestions are accepted, rejected or rewritten as his by him alone; no word lost through slow saves, reloads or a closed tab; an assistant's page is read only. Brief and corrections: `version-two-briefs/v2-7-write.md` |
| Stage 2: Read and Check inside version two | | | Not started |
| Stage 3: Capture inside version two | | | Not started |
| Stage 4: What stands between him and starting | | | Not started |
| Stage 5: The whole journey walked, one full check, one page of pictures | | | Not started |
| 8 Where a subject stands | Opus | Sonnet | In. `subject.standing` and `subjects.standing`, one shared rule; 150 subjects in under two seconds cold and milliseconds warm |
| Advanced lands on the right section | Opus, finished by Sonnet | Opus | In. All 61 addresses land for an Article and a Carousel, with and without a piece |

What is open, piece by piece and most important first: `2026-11-11-version-two-open-corrections.md`.
