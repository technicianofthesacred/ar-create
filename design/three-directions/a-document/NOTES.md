# Direction A — The Document

## The idea

The piece is the screen: one continuous, well-set text document fills the viewport, and everything else comes to it — notes, decisions and sources in a margin beside the passage they concern, the twelve sections as sheets that slide over the document and drop you back on the same line. You never "go to" Write; you are always in the work, and the rest of the process visits.

## Opening screen

The last piece opens at the exact paragraph Adrian left off, with an inline marker in the text: "Left off here · 2 days ago — next: tighten the ending" (dismissible). The margin's first line says what changed while he was away: "Since you left: Claude added 3 source notes" → "Show them" flashes those three in Sources. Nothing to read before working; the first thing on screen is the sentence he was on.

## How switching works

- **Projects:** the project name at top-left (or Cmd/Ctrl-K) opens a finder: type to filter, recent first, each row shows its pieces and "Left off at … — next: …". Click a piece tag to open that piece directly. "All work" is the Home view: a readable list of every project with its left-off line and any agent activity.
- **Pieces from one origin:** sibling tabs on the same thin line (Article · Carousel · Listing, "from Conversation with Mei Lin"). Each is edited independently; protected phrases and decisions carry across all of them.
- **Sections:** the slim left rail holds the document outline (and "Left off here") above the twelve sections grouped Gather / Develop / Make / Deliver. Write and Read are modes of the document itself; the other ten open as a large sheet from the left with the document dimmed behind. Esc or "Back to the article" returns to the exact scroll position.
- **Phone (390px):** rail becomes a menu drawer; margin becomes a bottom sheet with its tabs always visible; sheets go full-width.

## What is real in the prototype

Margin notes ↔ passages both ways (click a note to light and scroll to its passage; click an underlined passage to find its note). Focus hides the margin. "Your words": select text (floating button) or use the top button / "Add your words" — the note is anchored to the selection and visibly authored by Adrian (serif, sand edge, "Your words · Adrian") versus agent notes ("Claude · agent note"). Decisions tab: decisions, protected phrases highlighted inline with a live intact/changed check, corrections, rejected angles struck through. Sources tab: quotes with "Open in Source" landing on the exact transcript line. Carousel: all six 4:5 slides in one vertical strip, typed on in place, reordered by dragging the grip. Material: drop or choose files (listed, not stored), drag items between topics (or tap item then topic), preview. Source: speakers, timestamps, click a line to correct it → the correction appears in Decisions. Research: points, evidence, Sure/Unsure/Disputed marker, a one-point discussion thread. Direction: Adrian's own words box first, Claude's interpretation labelled Provisional/Sample with Adopt and Reject (rejection carries into Decisions). Media: each asset's "Used in" links jump to that paragraph or slide. Check is computed from the current text. Arrange reorders the actual document; Audience shows reader frames (phone + web, or a swipeable carousel); Outputs lists export formats.

**Honest stubs:** recording playback, AI discussion replies, broad research, Material keep/remove review, share links, fact checking and exports all say "Not connected yet" or "Prototype — nothing is saved/exported". Only Porcelain and Tea is drawn in full; the other projects open a labelled Sample document.

## What it is best at

Long writing and revision. The text is never more than one Esc away, the margin keeps editorial context next to the passage it concerns, and "where I left off" is a place in the text, not a status card. It is the calmest of the possible shapes and the most like a good editor's desk.

## What it costs (tradeoffs)

- **Gather/Develop work feels secondary.** Material, Source and Research are visitors over the document; a day spent sorting a big intake or working through research lives in sheets, not a home of its own. A project with no piece yet has no document to land on (it would need a "concept brief" document as the default).
- **Overview is thin.** There is no single view of all pieces' state for one project beyond the sibling tabs and Home's list.
- **Margin density.** With many agent notes the margin gets long; it would need filtering (mine / agents / open) at real volume.
- **Sheets hide the document.** Comparing a transcript line with a paragraph side by side is not possible except via the Sources tab quotes.

## Building it on the current shell

The current shell is a left sidebar with 12 steps + a work column + a Margin/Decisions inspector shown in Write/Read. Needed:

1. **Make Write the resting state.** Opening a project lands in the last piece's Write view at a stored position (`piece + block id + updated_at`), not on a step page. Needs a per-piece "left off" record and the next-step line.
2. **Collapse the 12-step sidebar into the rail:** outline of the current piece on top, the 12 steps compact below. Steps other than Write/Read render inside one shared slide-over sheet component that preserves the document's scroll and focus on close.
3. **Promote the inspector to a permanent margin** with three tabs (Notes / Decisions / Sources) visible in every piece, not only Write/Read; add note ↔ anchor linking (anchors stored as block id + text offsets or a quoted span) and an author field so Adrian's notes and agent notes render differently.
4. **Thin top line:** project switcher with a filterable finder (needs a recent-projects query with left-off lines) and sibling-piece tabs (needs pieces grouped by origin).
5. **Carousel editor** as a vertical strip of editable slides with drag reorder, replacing one-slide-per-click.
6. **Media "used in"** requires a reverse index from asset → piece/block/slide.
7. **Agent activity summary** ("Since you left …") needs agent writes stamped with actor + time and a "last opened by Adrian" timestamp per project.

## Same task, counted

"Resume the last piece where I left off → add my own thought → correct a misheard line in Source → come back to the exact spot → reorder carousel slide 3 to first → preview it as the audience sees it." Clicks and keystrokes to reach each step, not counting typing. Desktop, from a cold open; walked in Playwright.

1. **Resume where I left off: 0.** The app opens on the left-off paragraph, with the next step and "Where it stands" in the marker. (From All work or the finder it is 1 click.)
2. **Add my own thought: 2.** "Your words" in the top line (or on the selected text), then "Add to margin". The note is anchored to the left-off paragraph.
3. **Correct a misheard line in Source: 3.** Rail "02 Source", click the line, "Save correction". Finding the line means scrolling the transcript, unless you come from a margin quote: Sources tab, then "Open in Source" lands on the line (4 clicks).
4. **Come back to the exact spot: 1.** Esc, or "Back to the article". The scroll position is restored to the same pixel (checked: 744 before and after).
5. **Reorder carousel slide 3 to first: 2.** The Carousel tab, then one drag of slide 3's grip.
6. **Preview as the audience sees it: 1.** Rail "10 Audience".

**Total: 9 on desktop, 11 on a 390px phone** (the rail is a drawer there, so Source and Audience each need the menu first).

**Where it felt awkward:** moving slide 3 to the top of a vertical strip of tall 4:5 slides is a drag of about two slide heights that relies on edge auto-scroll. A compact strip of thumbnails while dragging would make it one short move.

## Critique fixes (21 Oct)

- Must-have 4 was missing "current understanding": the left-off marker now also shows "Where it stands", taken from the chosen direction. It updates live when that is edited in Direction, and links there.
- Phone: piece tabs show their names instead of bare icons, "Your words" stays visible in the margin's bottom bar, and the extra margin-toggle icon is gone.
- Anchored passages had solid underlines and read like links across whole paragraphs. They now have a faint dotted underline that turns solid on hover or when lit. Protected phrases show a tint only.
- Honesty: invented agent activity (Since you left, Claude/Codex notes, new source quotes) carries a "Sample" tag.
- The theme icon gets a "Light / dark" tooltip, and the left-off dismiss button gets a "Dismiss" tooltip.
