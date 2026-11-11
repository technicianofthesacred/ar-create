# Wisdom bank at full size, zoom first: handoff

11 November 2026. Plan 12 in `docs/plans/2026-11-11-manager-handoff.md`; the brief is `docs/plans/2026-11-11-12-wisdom-bank-zoom-brief.md`. A mock-up only: one standalone page, nothing in the app changed.

- Published for Adrian's phone: https://claude.ai/artifact/23ou4as7hxG7DzVB2W6ALz (private to him until he shares it).
- The page: `design/2026-11-wisdom-bank/zoom/index.html`. It is joined from three parts by `build.sh` (no other build step): `head.html` (styles and layout), `a-data.js` (the invented bank), `b-app.js` (the map).
- This thread was started by the coordinating thread without Adrian's explicit yes to a zoom plan. He was sent a five-line plan first and told he could redirect at any point.

## What each depth shows, and why

The whole screen is one map. How close you are decides what is drawn; nothing is switched by hand.

1. **Far away: the twelve traditions as regions.** Each has its name and its counts. No lines. The only other marks are small warm points, one for each of the brightest concepts, so the first thing seen at this depth is where resonance sits. Why: the survey says the whole graph as a front door fails, and a transit map cannot be read at this size.
2. **Closer: one tradition with its research topics as coloured lines.** Intersections are small rings. The brightest lines are named first and drawn strongest. A line that leaves the region for a neighbouring tradition is drawn as one long stretch between them; this is where the huge maps join. A missing step in a line is a dashed stretch.
3. **Closer: the stops on a line.** Each stop is a concept, drawn as a ring on the line; an intersection wears a second ring. The concepts that are not on any line gather round the stop they belong to, each held by a short mark: solid for explains, dotted for echoes, dashed for contrasts. Names appear brightest first and never on top of each other.
4. **Closest: one concept.** It is the one at the centre of the screen, so dragging walks from concept to concept. Its lines to neighbours are drawn strongly; a neighbour that is far away is shown as a short ray to the edge with its name, which can be touched to travel there. One connection carries a small knot that opens (kind, reason, his words, the same pattern elsewhere). No other connection between connections is drawn.
5. **The distillation deepens in the same gesture.** Reaching a concept raises a card with the Glance. Keep moving in and it becomes Medium, then Full; move out and it steps back. The three buttons on the card do the same. Each depth is labelled "Distillation". Full reads downward in the order Adrian gave the earlier thread: What it is, What you do with it, How you embody it, Understanding it more deeply, How it can be misunderstood, with their exact words inside the sections on their own surface and "Add your voice here" under each.

**Works and concepts.** The switch at the top right is always there. Works turns the same twelve regions into the works they hold: each work is a circle sized by how many concepts it has, and inside it are its parts, and inside them its concepts. A concept that other works also hold wears a ring. When a work is in front of you, dotted rays point to the works it shares most with, and its card lists them. Switching with a concept in front of you lands on the same concept on the other side. Switching from a work to Concepts shows that work's concepts on the concept map with the rest faded.

**Moving.** Drag and pinch (wheel and drag on a computer), double tap to go closer, momentum after a drag, a ring where you arrive, a ripple on every tap. The trail under the top bar always says where you are and each step goes back out. It opens where he last was (kept in his browser). "Back to where I was" appears after any jump.

**Honing in.** The field at the top left takes a feeling or a name and lists concepts, lines, works and traditions; touching one flies there. "Narrow" fades everything outside a tradition, below a brightness, or of a kind of line. Touching a line narrows to it. "Path from here" on a concept, then touching or finding another, draws the path and lists its steps with the kind of each.

**What you can do at a concept** is said by its controls: brightness, Glance, Medium, Full, Respond, Add to a line, Path from here, In its works (or On the concept map), each neighbour as a row that travels, and at Full "Open the full reading", which links to the first mock-ups.

## What is invented

Everything, from one fixed seed, so it is the same every time.

- 12 traditions, 300 research topics, 20,000 concepts, 2,000 works, 226,835 passages. 29 works hold a hundred concepts or more; the largest holds 167.
- Tradition names are made up (Stillwater, Ember Path and so on). No real tradition is named.
- No person is named. A work's speaker is a role and a made-up place ("The gardener of Thornby Lake").
- Concept names are plain statements made from a list of everyday words ("Rest is not laziness", "Kindness comes before effort"). Twelve were written by hand, one per tradition, at its busiest intersection ("Everything is perfect as it is", "You are already whole").
- Distillations, passages and reasons are made from a small set of sentence patterns. They read plainly but repeat, and they are not teachings. The passage records are real records (concept, work, page or minute); their words are made when a concept is opened.
- Brightness is random, weighted so that most things are dim and a few shine. What he sets is kept in his browser.

## Measurements

Taken in a headless browser on this machine, at phone size (390 by 844, two pixels per point), with the processor slowed four times to stand in for a phone. The browser draws in software, so real phones with a graphics chip should do better on the last column. Not measured on a real phone.

| Where | Things drawn | Script time per frame (typical, worst 5%) | Time between frames (typical, worst 5%) |
|---|---|---|---|
| Far away | 12 regions, about 800 points | 2 ms, 4 ms | 17 ms, 17 ms |
| One tradition, lines | about 30 lines | 1 ms, 3 ms | 17 ms, 33 ms |
| Stops on a line | 60 to 500 concepts | under 1 ms, 3 ms | 17 ms, 17 ms |
| One concept | about 40 | 1 ms, 3 ms | 17 ms, 17 ms |
| Zooming from far to close without stopping | | 1 ms, 4 ms | 17 ms, 33 ms |
| Works, one tradition | about 250 works | 1 ms, 2 ms | 50 ms, 50 ms |
| Works, one work | about 190 concepts | 2 ms, 4 ms | 33 ms, 50 ms |
| Works, concepts in a part | about 15 | 1 ms, 3 ms | 17 ms, 17 ms |

17 ms between frames is 60 a second, 33 ms is 30, 50 ms is 20. The bank takes about half a second to build on the slowed machine and uses about 11 MB. A search takes 16 ms; a path takes 3 ms. At 1440 wide with no slowing every depth held 17 ms except one work (33 ms).

**Ten times larger** (200,000 concepts, 20,000 works, 2.27 million passages; the page can be opened this way from a local copy with `?x=10`): building takes 4.4 seconds and 97 MB. Close depths are unchanged, because only what is in view is visited. Far away slows to 17 to 50 ms between frames, one tradition's lines to 50 to 67 ms, and the works side of one tradition to 100 to 117 ms. A search takes 139 ms.

## What breaks first as it grows

1. **The works side at the depth of one tradition.** It is already the slowest view at real size (20 frames a second in the slowed test) and falls to about 9 at ten times. A tradition with 2,000 works needs a depth between tradition and work (shelves, or years), or small works drawn as a ready-made picture.
2. **One tradition's lines as a picture.** At real size a region holds about 25 lines and reads well. At ten times it holds 250 and is a tangle, however fast it draws. It needs a depth between tradition and line, the "bigger concepts" layer of the concept page. This is a design gap, not a speed gap.
3. **Building the bank in the page.** Four seconds at ten times. A real bank would be stored and fetched by region, which is what the foundations note is for.
4. **Search** reads every name on each keystroke. Fine at 20,000, noticeable at 200,000.
5. Close depths do not break: their cost follows what is on screen, not the size of the bank.

## What I was unsure of

- **A feeling is matched by its words only.** "everything is perfect" finds names that contain "perfect". The real thing must match meaning. The page cannot show that.
- **The wording.** Adrian told the earlier thread that the sample concepts read as written for AI, that length must be set by understanding and not by space, and that the small view must state the idea itself. I rewrote the generated names as plain statements and ordered the Full reading his way, but 20,000 generated concepts cannot show whether real distillations will land. Only the first mock-ups' "Read" screen, and real sources, can.
- **Glance is short.** It is one or two plain sentences under the name. He had not settled the small view when the brief was written; he has since chosen a plain statement of the idea.
- **Most concepts are not on any line.** About 3,500 are stops; the other 16,500 gather round a stop. That is my reading of "the AI lays out the stops, you draw the lines". If he expects every concept on a line, the middle depth changes.
- **The first opening** lands at the stops depth on a busy intersection, not on the far view, because the survey says to open local. After that it opens where he was.
- **Narrow covers the lower half of the phone** while it is open, so the fading is seen in the top half only.
- **Pinching on the reading card** to step back out is attempted but may be taken by the browser as a scroll. The three depth buttons and the trail always work.
- **Regions are the same shape on both sides** (Concepts and Works), so place is kept when switching, but a work whose concepts come from several traditions is shown only in its home one.
- **Join rays between works** show the seven works that share most. Every other join is reachable only through a concept's "Also in" list.
- "Respond", "Add to a line", "Make it a question" and "Add your voice here" answer but keep nothing after the page is closed. The microphone is not used; a published page cannot use it.
- Not checked: a real phone, a screen reader, widths between 390 and 1440. The map itself is one picture and is not readable by a screen reader; the trail, search and cards are.
- Pictures looked at: 390 wide dark at every depth on both sides, 390 light for the reading depths, 1440 dark for far, tradition and concept. 1440 light was looked at once, on a line.

## Asked by the coordinating thread and not done here

Six messages from the coordinating thread were read only after the page was published. Most of what they carry (plain wording, length set by understanding, the small view as a plain statement of the idea, the five-part reading order, his voice at each depth, the link to the Read screen) was already taken in from the earlier thread's handoff. Three things they ask for are not done, and this thread has passed the size at which it should stop:

1. **A hand-written landing area.** A few works written in full with real care, including one book of about a hundred concepts and the topics that cross them, so that what he lands in and reads is not generated. Only twelve concept names are hand-written here; every distillation, passage and reason is generated from sentence patterns.
2. **The first mock-ups' nine rewritten concepts, with a short map name beside a full plain name.** Not carried in. Names on this map are the full statements, which is why some are cut short at the edge.
3. **The interaction between works' maps made large and central, and his learning marks (met, understand, practising, can teach) shown on the map.** The joins between works are there (rings on shared concepts, rays to the seven works that share most, "Also in" on a concept) but they are a detail of the Works side, not the centre of the page. Learning marks are not drawn.

The reading page is not redrawn here, as the last message asked: "Open the full reading" at the Full depth links to the first mock-ups, where the Read screen lives.

## Adrian's reaction

Not yet given. To be recorded here in his words.
