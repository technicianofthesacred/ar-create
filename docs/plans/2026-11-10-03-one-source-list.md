# Plan 3: one source list for each subject

**Goal.** A subject has one list of its sources. Material attached in any place shows in every place, under its own name, for Adrian and for agents.

**Findings covered.** U5, U6, U7, U8, U9, U10, U11, U24, A1, A2. Root problem R2.

This is the largest change to how the parts connect. It touches the runtime services, so it starts with a written design, not with code.

## The problem in one table

One note was attached to one subject. Five places answered differently:

| Place | Said | Read from |
|---|---|---|
| Library item, "Use in a subject" | Attached (counted twice) | `/api/first-flow` |
| The subject's Source | "No sessions to read yet" | `/api/source-sessions` |
| Research, "Change sources" | "No sources are connected" | `/api/study/research` |
| Write side panel | The note, selectable | `/api/study-ai/read` |
| Agent `project read` | `sourceConnections: []` | `/api/concept` |

## What Adrian will see

- **Adding material confirms it**: what was added and one next step ("Use in <subject>", "Open").
- From inside a subject, **attaching takes one press** on the row or on the confirmation.
- The **subject's Source** lists everything attached to it: notes, links, photos and recordings. Recordings keep their session view with speakers and times.
- **Research's source choices** and **Write's side panel** show the same list, by the same names. Each step may tick a subset for its own use.
- A source shows as attached **once**, by the subject's name. "Open in Source" opens it inside that subject. "Remove from this subject" sits on the same row, with Undo.
- Labels are plain: "Your note", "Transcript", "Your page". No internal codes.
- A button that is off says why, beside it.

## What must not change

- Sources are stored once in Library with a permanent identity. Attaching never copies or alters the original.
- Source speech, Adrian's own reflection, outside evidence and AI proposals stay visibly different.
- "Reading never approves": a transcript's review state is separate from being attached.
- Adding material never regenerates approved text.
- Source text is data, not instructions, for every agent.

## Where the work is

| Piece | Files |
|---|---|
| Attach, "Used in", "Open in Source" | `public/document-study/folder-browser.js` lines 279 to 297; `runtime/services/first-flow.mjs` |
| The role string shown as a label | `runtime/services/first-flow.mjs` line 110 |
| Source screen and its empty state | `source-imported.js`, `source-continuation.js`, `empty-states.js` line 23; `/api/source-sessions` |
| Source side panel from Write, "Unsupported original project" | `runtime/services/study-originals.mjs` line 127 |
| Research sources, "Explore question" | `research-tab.js` lines 26 to 37, `research-standard.js` |
| Write side panel sources | `study-ai-proposals.js`; `/api/study-ai/read` |
| Agent reads | `runtime/services/concept-work.mjs` (`concept-list.v1`, `sourceConnections`) |
| Material confirmation | `material-intake.js` |

## Steps

1. **Design note first** (one page, reviewed before any code): which record is the truth for "sources of a subject", and how each of the five readers gets it. The suggestion is that the attachment made in Library is the truth, because it is the only one Adrian makes on purpose; Source, Research and Write read it; each step keeps only its own ticks; `project read` reports it. Name what happens to subjects that came from the vault, whose sources are found another way today.
2. **Confirm two things on real subjects before building** (they may be demo-only): whether Research can be asked a question at all (U11), and whether a new subject's Research ever asks for another subject's record (the demo request carried `parentStudyId=hk` for a different subject).
3. **Tests first**: attach one note; expect it by name in Source, in Research's choices, in Write's panel and in `project read`; detach; expect it gone from all four.
4. **One reader** that all five places call. Keep each old address answering, so nothing else breaks.
5. **Source shows all kinds**, not recordings only. The side panel from Write shows the same list as the full page.
6. **Attach in one press** from inside a subject (needs plan 1's kept subject), **detach with Undo**, count once, and make "Open in Source" open the item.
7. **Plain labels** and **reasons beside disabled buttons**.
8. **Agents**: `project list` lists every subject, flagging those with no concept yet (A1); `project read` says what exists: sources, pieces and their state, last check (A2).
9. Walk the Part 1 journey. Before and after screenshots for Adrian.

## Finish checks

- One attached note is visible, by the same name, in the subject's Source, in Research's source choices, in Write's side panel and in `project read`.
- Attach from inside a subject in two presses without opening the item. Detach in one, and Undo brings it back.
- "Used in" shows one row per subject; its link lands on the item inside the subject; a reload shows the same.
- No hyphenated internal role and no "Unsupported original project" appears on screen.
- `project list` and Home list the same subjects.
- Existing subjects show the same sources they showed before. This is checked on invented data shaped like the vault-origin demo subjects, and then by Adrian on one real subject.
- `npm test` passes with the new tests.

## Decisions needed first

- Source from Write: keep the side panel and make it show the same sources as the full page (suggested), or always open the full page. (Review decision 3.)
- The design note's choice of which record is the truth.

## Not in this plan

"Where this came from" (from a sentence to its source line and back). This plan makes it possible; it is listed under function ideas in the review.
