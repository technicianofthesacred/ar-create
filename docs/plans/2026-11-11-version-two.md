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
| Stage 2: Read and Check inside version two | Sonnet, two builders, then two fresh ones for corrections | Opus, twice each; Haiku against the sample | In. `#/read/<subject>?piece=<piece>` shows the saved words on Write's page, nothing to edit; `#/check/<subject>?piece=<piece>` runs the saved-draft check, lists findings and marks their words, shows Decisions in this piece and Truth and consent, all read only. Write, Read and Check share one bar and the segment shows on a phone. An Article's Read and Check steps open them; a Carousel's stay in Advanced. The demo has a subject with a real finding (The green gate). Brief: `version-two-briefs/v2-9-read-check.md` |
| Stage 3: Capture inside version two | Sonnet, two builders, then three fresh ones for corrections | Opus, three times; Haiku against the sample | In. Capture opens one sheet anywhere in version two; Speak, Photograph, Write a thought and Ask a question each do their job in place and say where the thing went (the open subject, or the Library to file later; a question goes to Research). Nothing unsaved is dropped by Done, Escape or a lost answer, and a retry does not save twice. The subject's own ways in open the sheet; a recording there says where it stands and a ready transcript has "Use the transcript". Seen only against a stand-in, because the demo cannot transcribe: starting a transcript and using one. Brief and corrections: `version-two-briefs/v2-10-capture.md` |
| Stage 4: What stands between him and starting | Sonnet, nine builders | Opus, each piece once and the speed work and a story's words twice; Haiku against the sample | In. His Magazine stories stand as subjects on Home with no record made; Read and Check open a story; Write shows a story read only (editing is built and switched off until four faults are corrected); a subject's header shows only his sentence; same-named Carousels are told apart and an older one opens in the studio read only; Find in the bar; To file on Home; pages no longer wait on the full capabilities read and the first standing read is warmed. Done and open: "Stage 4" in the open corrections file |
| Stage 5: The whole journey walked, one full check, one page of pictures | Sonnet: one for the walk, one to correct it, seven for what the walk found | Opus, each piece once, starting an Article five times | In. `scripts/review-journey.mjs` walks New subject, Speak, Use the transcript, Write, Read and Check at 1440 and 390, dark and light, on real commands. It found three faults, now corrected: an Article can be started inside Write; "Use the transcript" adds the transcript to the subject and says kept; a check held for want of a source says "No source to check against yet" and the subject stays in Create. One break is left and is Adrian's to decide: a subject begun from New subject has no source in its draft, so Check stays held in both fronts. The full check: only the failures known on main; nothing scrolls sideways on any version two screen, plain or stressed. One page of pictures sent. Open: "Stage 5" in the open corrections file |
| Stage 6: Check can read the sources of a subject begun from New subject | Opus designed; Sonnet, three builders for the command and two for the screens | Fable on the design; Opus, then Fable, on the command; Opus twice on the screens; Haiku against the sample | In. He confirms a transcript on the subject page ("Confirm this transcript"), presses "Use it for Check", and Check reads exactly that copy; the same list and button sit on Check's held state. The command is his alone, the locked record is untouched, only what he confirmed can be captured, and a check made before reads stale. The walk ends in a real check result at 1440 and 390, dark and light. The full check: only the photo inspect failure known on main. Open: "Stage 6" in the open corrections file |
| Stage 7: confirming is his alone, and he can stop a captured source counting | Opus designed; Sonnet, four builders for the commands and two for the screens, two for corrections | Fable on the design; Opus on each service; Fable as an assistant trying to get round it; Opus twice on the screens; Haiku against the sample | In. An assistant that tries to mark material or a transcript reviewed gets 403 by every path and keeps everything else it could do; the existing workspace no longer records an assistant's review as his. He can stop a captured source from the Sources list on the subject page and in Check ("Stop using for Check"), Check then no longer reads it, and only he can bring it back ("Use for Check again"). Old drafts, receipts, forks and structure tests read as before. The full check: only the photo inspect failure known on main. Five one-word questions wait for him. Open: "Stage 7" in the open corrections file |
| 8 Where a subject stands | Opus | Sonnet | In. `subject.standing` and `subjects.standing`, one shared rule; 150 subjects in under two seconds cold and milliseconds warm |
| Advanced lands on the right section | Opus, finished by Sonnet | Opus | In. All 61 addresses land for an Article and a Carousel, with and without a piece |

What is open, piece by piece and most important first: `2026-11-11-version-two-open-corrections.md`.
