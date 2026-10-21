# Direction B — The Studio

## The idea

AR Create is organised around **subjects**: one origin (a talk, a visit, a harvest) and the many pieces that grow from it. The unit on screen is the subject's constellation, read left to right as Origins → Understanding → Expressions, so one origin turning into several separately edited pieces is the first thing you see, not something you dig for.

## Opening screen

"Studio" home, with no subject chosen. It has three strips:

- **Waiting on you**: each card names the subject, the one thing needed, and goes straight to the right section (for example, Spring Oolong goes to the listing's missing price in Write).
- **Since you left, Claude and Codex did**: each line carries an actor label and a time, and opens the exact record.
- **Subjects**: a tile per subject showing miniatures of its pieces (article first lines, carousel slide strip, listing card), plus "Where you left off" and who touched it last.

"New subject" starts an empty one.

Above the strips, one **Pick up where you left off** card names the exact spot (for example Claude's margin note on ¶3 of an article) and Resume lands there with that passage highlighted.

## How switching works

- **Left list**, always present on desktop: search across subject and piece titles, plus filters for All, Active, Waiting on me and Touched by Claude. Each row shows the title, small marks for the kinds of piece, and one state line (for example "Article: Check ready · Carousel: 3 slides empty"). It collapses to a rail of initials.
- **On a phone** the list becomes a bottom sheet.
- **Choosing a subject** opens its board. "Resume" goes to where you left off.
- **Opening a piece** swaps the main area into the two-pane studio. The breadcrumb (Studio › Subject › Piece) goes back.
- **The twelve sections** sit in a compact tab row that only appears inside a subject. Board comes first, then Gather, Develop, Make and Deliver. Sections about the subject (Material, Source, Research, Direction, Media, Outputs) act on the whole subject. Sections about a piece (Write, Read, Check, Arrange, Audience, Share) carry a piece picker, so you can move between the subject's pieces without going back to the board.

## What it is best at

- **One origin, many outputs (#11)** is the structure itself, not a feature.
- **Carry-forward (#12)** is visible everywhere. Decisions, protected phrases, rejected angles and Source corrections sit as chips on the board and again in the narrow "This piece inherits" column beside every piece. A new piece shows them the moment it is created.
- **Juggling many active projects.** The state line and the "Waiting on you" strip mean you rarely open a subject to find out what it needs.
- **Adrian's own words** have a permanent, obvious place: "Your thoughts" sits in the middle band of every board and on Direction.

## What it costs

- **Two levels of navigation**, subject then piece. A one-off post with no real origin still has to live inside a subject. It could be a subject with one origin, or an "Unfiled" subject.
- **The board is wide.** Three bands need about 1240px. Below that, Origins becomes a full-width row above two columns, and on a phone everything stacks, so the left-to-right "flow" is lost on small screens.
- **The Library and Collections live mainly inside each subject**, as Origins and Understanding. A light cross-subject **Library** view (from the Studio home line, or "Library" at the foot of the subject list) lists every source once with "Used in" links, and every open inquiry as Collections. It is an index, not a workspace: you open an item inside the subject that uses it. Search inside it is not drawn.
- **The tab row is long** (13 items). It scrolls sideways on a phone, and the group labels help but do not remove the length.
- **The piece-level sections need a "current piece".** If a subject has none, those tabs show an empty state that points to "New expression".

## Building it on the current shell

The current shell has a left sidebar with the 12 steps, a work column, and a Margin/Decisions inspector. To build this direction on it:

1. **Swap the left sidebar's job.** It becomes the subject list (search, filters, state line), and the 12 steps move into a compact tab row at the top of the work column, shown only when a subject is open. This is the biggest change, because the steps stop being the main way around the app.
2. **Add a Board view and a Studio home** as new work-column screens. Both read existing records: Projects become subjects, Pieces are expressions, Collections and Concepts feed the Understanding band, and Library items linked to the project become Origins.
3. **Re-purpose the inspector** as the "This piece inherits" column (decisions, protected phrases, rejected angles, corrections, sources used). The current Decisions inspector is most of this already. Margin notes move inside the document grid, beside their paragraphs, so a note can line up with its passage.
4. **Add data.** Each subject needs a derived state line, "last left off" (a piece plus a section), and the last actor with a time. The actor and time probably exist in the audit or provenance fields. "Last left off" needs a small per-subject record.
5. **Add an aggregate "waiting on you" query** across projects, covering open Claude questions, missing required fields, empty slides and unread agent drafts.

## Honest in the prototype

All content is invented sample content.

**Works locally in the tab:**

- Edits to text, slides and listing fields.
- Drag to reorder (pointer-based, so it works on touch too).
- Transcript corrections, which flow into the Corrections lists and into Check.
- Uncertainty markers.
- Adding and removing decisions, phrases and angles.
- Placing media, with "Used in" worked out from the pieces.
- New pieces and new subjects.

**Labelled "not connected" where they appear:**

- Recording playback, and Process.
- Keep/remove review, and the bilingual view.
- AI discussion: a message is kept, and no reply is invented.
- Broad research.
- The full check. Check shows "No check has run on this revision" and only runs simple text matches, labelled as such.
- Export, review links and publishing.

Nothing is saved.

## Critique pass, 21 October

Five fixes made after a critique against the brief:

1. **Resume goes to the exact spot.** The Studio home now opens with a "Pick up where you left off" card, and Resume (there and on the board) opens the piece, selects the margin note and highlights its passage. "Where you left off" updates as you work in this tab.
2. **A way back after a detour.** Leaving a piece for a subject section (Board, Direction, Source, Material…) puts "Back to Write" first in the section row. It returns to the same piece, section and note or scroll position.
3. **The Library has a home across subjects.** A small Library view lists every source once with where it is used, plus open inquiries as Collections. It is labelled honestly: the sample data shares no source between subjects, and search is not connected.
4. **The phone header says where you are.** The brand no longer repeats "Studio" next to the "Studio" crumb. On a phone, inside a subject, the header shows only "‹ Subject › Current" instead of three crushed crumbs.
5. **Source works on a phone.** An inline column width overrode the phone layout, so the transcript collapsed to one word per line. It now stacks properly.

## Same task, counted

Task: resume the last piece where I left off → add my own thought → correct a misheard line in Source → come back to the exact spot → move carousel slide 3 to first → preview it as the audience sees it. Counted from the Studio home on desktop. Each click or drag is one; typing is not counted.

| Step | Clicks | How |
|---|---|---|
| Resume where I left off | 1 | Resume on the "Pick up where you left off" card. The article opens with Claude's ¶3 note highlighted. |
| Add my own thought | 2 | Board tab, then click into "Your thoughts". |
| Correct a misheard line in Source | 3 | Source tab, click the line, then "Keep correction". |
| Come back to the exact spot | 1 | "Back to Write". The same note is highlighted again. |
| Move slide 3 to first | 2 | Choose the carousel in the piece picker, then drag slide 3's handle onto the cover. |
| Preview as the audience | 1 | Audience tab. The phone preview opens on the new first slide. |
| **Total** | **10** | |

Checked by running it in a browser. The note was re-highlighted after the return, the slide order changed, and there were no page errors.

Where it felt awkward: "Your thoughts" belongs to the subject, not the piece, so adding a thought means leaving the piece you are writing. Before this pass there was no way back to the same paragraph. On a phone, Audience sits at the far end of a section row that scrolls sideways.
