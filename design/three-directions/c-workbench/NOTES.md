# Direction C — The Workbench

## The idea
AR Create is organised around resuming and the next useful move, across every project at once. The twelve sections are tools you pick up from a rack. They are not stations you walk through, so the app always answers two questions: what was I doing, and what is the smartest thing to do next.

## Opening screen — "The bench"
- **Pick up where you left off.** One large card for the last piece you edited. It shows a real excerpt of the paragraph you were in and a "Since you were here" list with actor labels ("Codex drafted slide 4 of the carousel · not accepted", "Claude checked 'thirty-one years' against the recording"). It has one primary button, **Continue at ¶4**, which opens Write with the caret in that paragraph.
- **Next moves.** One queue of verb sentences drawn from every project ("Correct 4 unclear lines in the harbour recording", "Choose between two angles for Spring Oolong", "Review 6 new photos from Claude's import"). Each one opens the right tool at the right item: the line, slide, file or note is scrolled to and flashed. The queue is worked out from live state, so finishing the work removes the move and lowers the count.
- **Everything active.** Every project on one line with its state ("Correcting the recording · 4 in Source, 2 in Material, 6 in Media"). You can filter it and move through it with `j` / `k` / `/` / Enter.

## How switching works
- **Project switcher** sits at the top left as one line. `⌘K` / `Ctrl-K` opens a finder for projects and tools. Choosing a project scopes everything to it: the rack counts, the next moves, the bench card and the understanding column. Choosing **All projects** brings the cross-project view back.
- **Tool rack** on the left lists the twelve tools, grouped Gather / Develop / Make / Deliver. Each tool shows an honest count of what needs you and shows nothing when nothing does. `[` collapses the rack to icons.
- When the scope is **All**, a tool that works on one piece shows a quiet "In:" strip listing the projects that have material for it, each with its count. Material and Media show everything at once, tagged by project.
- **Understanding column** on the right (`]` toggles it) follows the project you are working in. It holds the current understanding, **Your thoughts — Adrian** (a box that only he writes in, plus a quick "Add a thought" from anywhere with `T`), decisions, protected phrases, corrections and rejected angles, each labelled with where it applies.
- **Phone (390px):** the rack becomes a bottom bar (Bench + the four groups). Tapping a group opens a small sheet of its tools. The understanding column becomes a bottom sheet.

## What it is best at
- Coming back after a gap, or juggling six or more pieces at once. The bench costs no orientation and needs no manual.
- Agent work appears where it matters, with the actor named, without asking Adrian to import anything or answer again.
- Carry-forward is visible. Correcting a Source line adds a dated correction to the column. Choosing an angle records a decision and moves the other angle into Rejected angles. Protected phrases are underlined in Write and counted in Check.
- One origin with several outputs is explicit in Outputs: the origin first, then a branch for each output, each with its own state and its own tool.

## What it costs (tradeoffs)
- **It suggests rather than guides.** Nothing tells a newcomer the "right order". That suits Adrian but gives a beginner less scaffolding.
- **Next moves need trustworthy counts.** If a count is wrong or stale, the bench lies. Every count needs a real, cheap query behind it, and agents have to write actor and time on every change.
- **Three columns are dense.** The rack, the work and the understanding column all compete at 1280px. Focus mode and the collapsible rack and column carry the load, and Write at 1100px narrows the margin.
- **The "In:" strip under All** adds a step before a single-piece tool. Pinning a project removes it.
- **Ranking is hand-ordered here.** A real product would need a rule for ordering next moves (age, blocking, agent-made first?), and getting that rule wrong is the main risk.

## What building it on the current shell needs
The current shell is a left sidebar with 12 steps, a work column and a Margin/Decisions inspector. It maps closely:
1. **Sidebar → rack.** Keep the 12 entries but drop the step numbering as an implied order. Add the Gather/Develop/Make/Deliver group labels, an icon-only collapsed state and a per-tool "needs you" count. Each count needs a small count endpoint (or one aggregate call) per project and for all projects together.
2. **New home route, "The bench".** It needs a "last edited position" per piece (piece id + paragraph/slide id + time), a changes-since feed of actor-labelled events (an audit log filtered by `actor != you` since your last edit), and a next-moves query built from the same counts.
3. **Project scope and finder.** A global scope in the shell state (`all | projectId`) that every tool reads, plus a `⌘K` finder over projects and tools. Tools that need one piece need the "In:" chooser when the scope is All.
4. **Inspector → understanding column.** Extend Margin/Decisions to cover current understanding, Adrian's own thoughts (stored as his authored record and never mixed with agent text), protected phrases, corrections and rejected angles, each with a "where it applies" field. Margin notes stay inside Write as the editorial margin. Focus hides the rack, the column and the margin.
5. **Deep links into items.** Each tool must accept a target (`line`, `slide`, `paragraph`, `asset`, `material item`) so a next move lands on the exact thing.
6. **Still not connected (shown honestly in the prototype):** transcription, recording playback, bilingual Source, broad research/retrieval, AI discussion of a point, AI editor help, running a Check, Material keep/remove review, sharing links, export. Every Save says "Prototype — nothing is saved".
