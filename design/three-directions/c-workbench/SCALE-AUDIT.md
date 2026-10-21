# Workbench scale audit

Read from the prototype code and the product notes. Nothing here was run at volume; the prototype holds 7 projects and a handful of items, so every "breaks" below is read from how the screen is built, not measured.

## The root problem

The Workbench has no place where a thousand sources live. Material is a flat list inside one project, and the rack starts at "Material". The product plan already has a Library (all sources, once) and Collections (topics that gather sources) above Projects and Pieces, but the Workbench never draws them. So "how do I sort 1,000 articles and videos into articles" has no screen. Everything below follows from that gap plus the habit of rendering every item as a full-size row or card.

## Breaks (unusable at realistic size)

**Material (1,000+ sources).** One tall list, every row fully drawn, no search, no filter, no sort, no select. Only per-row buttons. At 1,000 rows it is a scroll of hundreds of screens and the page will lag. Fix: a Library table (virtualised, so only visible rows render) with columns for type, title, date, state and which Collection or piece uses it; faceted filters (type, state, unused, source site, date); saved views; multi-select with bulk actions (add to Collection, mark kept, set aside, tag); a "needs sorting" inbox.

**Sorting sources into pieces.** There is no action for it. Fix: AI proposes groupings ("these 34 videos and articles look like one topic: oolong roasting"), shown as a card with a preview of members; Adrian accepts all, removes a few, or renames. Bulk accept per group, drag or multi-select to move individual sources between groups. Unsorted stays one count, not a pile.

**Media (2,000 photos).** One grid of every card with no paging, and "Keep all" on the new batch is blind at 600 photos. Fix: virtualised thumbnail grid, filters (new, unused, used in, date, person/place), grouped by import batch or day and collapsed, drag-select ranges, bulk keep or set aside, a duplicates/near-duplicates group, and a compare-and-pick view for bursts.

**Understanding drawer, 100 decisions.** Decisions, protected phrases, corrections and rejected angles are four flat lists in a 380px drawer. At 100 decisions it is an unread wall. Fix: one searchable list with filter chips (kind, applies-to, recent), grouped by the piece or topic they apply to, collapsed by default with counts, pin the few that are live. Protected phrases that are not in the open piece fold away.

**Source (long recordings).** Every transcript line is a full DOM row. A two-hour recording is about 2,000 lines. Fix: virtualise, add a jump list (unclear lines only, speakers, chapters), search within, and "next unclear" navigation. Fixing unclear lines one by one needs a batch review queue.

## Gets painful

**Project switcher and finder.** The top-left switcher and the Cmd-K finder list projects flat. At 50 it is a long scroll but searchable. Fix: recents and pinned first (cap about 7), then search, with type and status chips; archive projects out of the default list.

**"Everything active" on the bench.** One row per project, all shown. At 50 it scrolls past the fold and buries the cards above. Fix: show pinned and recent only, "Show all 50" opens a table with sort by updated, status and owner; group by stage (collecting, drafting, ready to ship).

**Bench next moves.** One queue across all projects. With 200 pieces and 1,000 sources the queue becomes hundreds of items and the count loses meaning. Fix: cap at 5 visible, rank by one stated rule, group the rest ("23 unclear lines in 4 recordings") with one action that opens a batch queue, snooze and dismiss.

**Rack counts.** Fine as numbers, but a count of "412" says nothing. Fix: show counts only when they are actionable, cap display ("99+"), and make the number open the filtered list.

**Research.** The points list shows every point and the first unsure one auto-opens. At several hundred points it needs search and grouping. Fix: group by level (disputed first), by piece and by source; filter chips; a "points the open piece leans on" scope as default.

**Direction.** Angles are shown as cards side by side. Fine for two to four; at 15 candidate angles from many sources it sprawls. Fix: a ranked shortlist with pin and reject, rejected folded away, and a link to the evidence behind each.

**Write margin notes (300).** Notes sit beside their paragraphs, so a dense paragraph with many notes stacks and overflows, and 300 notes lose any overview. Fix: collapse to a dot per paragraph with a count, filter by author (you, Claude, Codex) and status (open, resolved), a "next open note" key, and resolved notes hidden.

**Pieces (200).** There is no piece list at all; Write opens one piece per project. Fix: a Pieces table (type, state, last edit, collection) with saved views, filtered by status, and "recent pieces" in the finder.

**Audience and Outputs.** Fine for 3 pieces. With 200 pieces each choosing audiences and outputs, review is one by one. Fix: a table of outputs with state and filters, bulk assign an audience, and a "ready to release" view.

**Check.** Local text checks list every protected phrase and correction. At 100 each, the list is long. Fix: show only misses and risks by default; ticks collapsed to a count.

**History (the changes feed).** One reverse-chronological feed. With agents writing constantly it floods. Fix: group by day and actor, collapse bursts ("Claude imported 600 photos"), filter by piece and actor, and show only changes since you last looked.

## Fine

**Arrange / Carousel.** A carousel has about 5 to 12 slides; the drag canvas is right. The only scale issue is choosing a photo from 2,000, which should use the same filtered media picker as above, not the whole grid.

**Read, Share, a single piece's Write body.** Scale with length, not count. Fine.

**Rack itself.** Twelve tools never grow.

## Top 8 changes, in order

1. Add the Library as the first tool: a virtualised table with search, faceted filters, saved views and a "needs sorting" inbox. This is the missing home for 1,000 sources.
2. Add multi-select with bulk actions everywhere lists appear (Library, Media, Research, notes).
3. Add AI-proposed grouping into Collections and pieces, with preview and bulk accept or edit. This answers Adrian's question directly.
4. Add a Collections layer between Library and Pieces, with a Collection page showing members, understanding and the pieces drawn from it.
5. Virtualise and add search, filters and date or batch grouping to Media; use that same picker in Arrange.
6. Add a Pieces list with status filters and saved views, so 200 pieces are findable without opening projects.
7. Switch the switcher, finder and "Everything active" to pinned, recent and capped, with an All table behind them.
8. Make the bench queue grouped and capped with one stated ranking, and fold the understanding drawer, margin notes and history into searchable, filterable, collapsed-by-default lists.
