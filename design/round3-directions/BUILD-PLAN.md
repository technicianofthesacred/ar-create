# Chosen direction — build plan

Decision (Adrian, 20 October 2026): **"go with B, A's pages and C's Where used"**.
Prototype: `Chosen.dc.html` on the canvas https://claude.ai/artifact/WCibjsYNREMrVdaToKWGpR.

What that means in one line: B's studio frame (sidebar of inquiries, projects and pieces, plus a project map), A's centred document pages with a margin for Source, Research, Write, Read and Check, and C's "Where used" panel docked beside a Library you can open from any screen.

Rules for every step: press the existing owners (see the handler map on the canvas), no new store, no new history system, no new dependency, never on port 8841, keep all twelve checkpoints and the C3 hooks (`.workflowStep`, `OWN`, `TOOLS`, `STEPS`), no sideways scrolling, drag and drop for reordering. Each step is its own branch and pull request and lands before the next starts.

## Order (lowest risk first)

1. **A's pages inside today's app.** Centre Source, Research and Write/Read/Check at ~720px with the existing notes column as the margin; keep the bottom bar (save status, A−/A+). Look modules only, like C3. Uses only working owners. About half a day.
2. **Docked side panel: Library + Where used.** One right-hand panel, two tabs. Library uses `material-resource-browser.js` and the literal concept search. Where used reads `GET /api/study/media-usage` (photos), source-session turn references and `/api/inquiries/references` (passages). Shows known links only and says when coverage is unknown. About a day.
3. **Studio sidebar.** Home, Library, Inquiries, Projects with their pieces, built from `projectLibrary`, `homeTabs` and the output overview; keep the open-piece tabs. Collapses to a menu on a phone. Needs standalone Collections installed (prepared candidate). About a day once Collections land.
4. **Checkpoints split by owner.** Project tabs (Map, Material, Source, Research, Direction, Outputs) and piece tabs (Write to Share), still the same twelve `viewPhase` steps underneath. About half a day.
5. **Project map.** Origins → Understanding → Direction → Pieces with click-to-highlight. Needs typed references and scoped inheritance installed (prepared). About a day after those land.
6. **Pick up here and Since you left.** From `/api/work-continuity/*` (prepared). Says so plainly when visit tracking is unavailable.
7. **History tab.** Session-grouped history from existing receipts, read-only preview, restore as a new guarded operation (accepted, unbuilt).

Steps 1 and 2 can start now. Steps 3 to 7 wait on the prepared candidates being installed by the integrator.
