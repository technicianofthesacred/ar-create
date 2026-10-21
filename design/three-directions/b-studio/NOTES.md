# Direction B — The Studio

## The idea

AR Create is organised around **subjects**: one origin (a talk, a visit, a harvest) and the many pieces that grow from it. The unit on screen is the subject's constellation, read left to right as Origins → Understanding → Expressions, so one origin turning into several separately edited pieces is the first thing you see, not something you dig for.

## Opening screen

"Studio" home, with no subject chosen. It has three strips:

- **Waiting on you**: each card names the subject, the one thing needed, and goes straight to the right section (for example, Spring Oolong goes to the listing's missing price in Write).
- **Since you left, Claude and Codex did**: each line carries an actor label and a time, and opens the exact record.
- **Subjects**: a tile per subject showing miniatures of its pieces (article first lines, carousel slide strip, listing card), plus "Where you left off" and who touched it last.

"New subject" starts an empty one.

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
- **The Library and Collections are folded into "Origins" and "Understanding" per subject.** A source or inquiry reused across subjects has no home of its own in this direction. Searching it across subjects would need a separate Library view, which this direction does not draw.
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
