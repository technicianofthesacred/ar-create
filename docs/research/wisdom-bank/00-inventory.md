# Wisdom bank, part 0: what already exists

11 November 2026. Read-only fact-finding. Nothing was built or changed apart from this document and four demo screenshots (invented data) in `screens/`.

**Limit of this inventory.** The i64os repository could not be added to this session (the request was denied), so nothing about i64os was read from i64os itself. Its rows below repeat what AR Create's own documents and the 11 November plan say about it, and are marked **unverified**. Everything about AR Create was read from its documents and code.

## What exists

| Thing | What it does today | Unit it stores, and how it is identified and linked | How it gets in | How it gets out or is used | Runs on real material? |
|---|---|---|---|---|---|
| **AR Create: Library** (`library.mjs`, `library-folders.mjs`) | Keeps every source and personal note once, with a permanent identity, and lets you browse by folder, type and search. Search matches words literally; meaning-based search is not built. | A **source** (a file or note) with a UUID and a content hash. Folders and topics are UUID rows that list source ids; one source can sit in several. Originals are never moved or copied. | Add sources, connected folders, scans, recordings, the Simmer intake. | Open the source, use it in a subject, search. "Used in" column shows where it was used. | Code is installed. No status document says how much real material it holds. The demo shows two invented notes. |
| **AR Create: evidence cards** (`library-index.json`, `evidence`) | Lets a passage be pinned from a source. | An **evidence card**: card UUID, source id, source hash, kind, exact quote, start and end position, who made it. If the source hash changes, the card is flagged stale. | Saved from Research or a concept's selected passages. | Shown as Supported or Uncertain evidence in Research; cited by Pieces. | Code and tests; no real-material claim. |
| **AR Create: YouTube captions** (`youtube-captions.mjs`) | Fetches a video's metadata and captions with the external `yt-dlp` tool and keeps the exact caption file with timestamps. Copied from i64os's YouTube extractor. | A source of kind video with URL, title, channel, and the original caption text with its timings. | Paste a link; needs `yt-dlp` on the Mac. | Becomes a normal Library source and can be read, searched and quoted. Nothing is distilled. | Code only as far as the documents say; not walked on a real talk. |
| **AR Create: Collections** (inquiries, 22 commands such as `inquiries.create`, `.references`, `.understanding`) | A reusable topic or question over Library sources, with saved learning and an "understanding" read. Can stand alone, with no piece. | A **Collection** takes the Library collection UUID as its identity. It holds question, notes and references to sources and passages. Relationship types (supports, challenges, explores, used-in) are decided in PRODUCT but the file contract says only "relates-to" exists today. | Created by you or an agent; sources attached by reference. | Read by agents (`collection read`), opened in Research, tied to a Project or Piece. | The file contract says the standalone-inquiry path is prepared and tested but **not installed**. In the demo it is empty ("No Collections yet"). |
| **AR Create: Research** (`research-answer.mjs`, `research-material.mjs`, section 03) | A page to ask what you want to understand, keep saved answers, and build a reusable brief with evidence marked Supported or Uncertain. | A per-project research record with **concepts, claims, accounts, positions and gaps**, each with an id and a source locator. Notes are append-only and attributed. | A typed question, chosen sources, agent notes. | Brief feeds Direction and Write; answers are kept and reopened. Needs a live model to explore a question. | Test-covered. CURRENT says live AI is not connected to every path and nothing here has been walked end to end by eye. |
| **AR Create: Tea Atlas lookup** | Searches an Atlas export you configure on disk. Returns exact article, block, page and hash citations. | Cited passages, not stored by the app. | Needs a configured local export. | Cited in Research; a match is not proof of a fact. | Depends on the export being present. Not stated as running on real material. |
| **AR Create: Simmer boards** | Gathers photos and your exact words into a board, groups them, proposes dishes, records the sentence you choose. | A board layout per project; photos and words stay in Library; the chosen sentence is saved as the project's direction. | `simmer intake` from a chat or folder. | Becomes Direction and then a draft. | Described in START and a skill; no real-run claim found. |
| **AR Create: Subject board** (screen) | One page per subject showing Origins, Understanding and Pieces. | Links to the above; stores nothing of its own. | Add material, Your thoughts. | Open a piece. | Screen exists. |
| **i64os: the shelf at `/read`** (unverified) | Per the plan: 189 real notes, each opens at three depths (summary, analysis, full transcript), with six verdicts and named stacks. | A **note** in the vault with verdict and stack. | Capture and ingest. | Browsed and judged. | Plan says "real notes". Not confirmed. |
| **i64os: Library search over books** (unverified) | Per the plan: book chunks, notebooks and "beliefs by domain". | **Chunks** of books. | Book import. | Search. | Not confirmed. |
| **i64os: Research Hunt** (unverified) | Per the plan: proposes viewpoints, reads widely, sorts each fact as settled, contested or fringe, one pile per topic. | **Claims** in a pile per topic. | A topic you give it. | Linked towards AR Create in a plan file. | Not confirmed. |
| **i64os: capture, ingest and vault conventions** (unverified) | Not read. AR Create's `youtube-captions.mjs` says it was adapted from i64os's YouTube extractor. | Not read. | Not read. | Not read. | Not read. |

## Where they overlap

| Job | Where it lives | Further along |
|---|---|---|
| Keep a source once with a stable identity | AR Create Library (UUID plus hash, rename and move tracking, stale checks). i64os keeps vault notes. | AR Create, as far as the documents show. |
| Capture a YouTube talk | AR Create has the extractor; i64os has the original. | Equal. The code is shared in lineage. |
| Distil a source into short readings and a verdict | i64os shelf (summary, analysis, transcript, verdict). AR Create has no distilling step. | i64os, per the plan. |
| Mark an exact passage with its position | AR Create evidence cards. | AR Create. |
| Sort claims by how well they stand up | i64os Hunt (settled, contested, fringe); AR Create Research (Supported, Uncertain). | Two versions of the same idea. i64os is wider per the plan; AR Create is tied to sources and hashes. |
| A topic that gathers sources | AR Create Collections; i64os stacks and piles. | AR Create has the better design on paper, but it is not installed. |
| Write from it with sources | AR Create Write, Read, Check, Outputs. | AR Create. i64os's own to-do says to stop building writing tools twice. |

## What nothing provides

- **The nugget.** No unit holds one idea as exact words, speaker, moment in the source, a one-line distillation and Adrian's own response kept apart. The closest is the evidence card (exact quote, position, source hash) but it has no speaker field, no distillation, no response, and no links to other cards.
- **Links between nuggets across sources.** The only link type that exists is "relates-to" between Library items. Supports, challenges and explores are decided in writing but not built. Nothing links a nugget in one talk to a nugget in a book.
- **The map.** No screen draws, walks or filters connections. The Subject board is three columns of lists.
- **Returning to it.** Nothing brings a nugget back to you: no daily few, no "what did I keep about this", no reading view of nuggets, no way to ask for the ones tied to what you are making now.
- **Distilling on the way in.** A pasted video becomes a transcript, not nuggets.
- **Search by meaning.** CURRENT says search is literal and large-library speed is not measured.
- **Path out with citations by sentence.** Pieces can cite evidence cards, but there is no flow from a chosen set of nuggets into an article or script.

## Why the screens are not engaging to return to

I looked at four screens with invented data (1440 wide, dark theme, `screens/`).

- **Library** is a table: Title, Type, Date, "Used in". Two rows, both reading "Not used yet". A left panel offers Inbox, All sources, Unsorted, a New folder button and a Collections box that says "No Collections yet." It reads like a file manager. Nothing in it shows what a source says or why it was kept.
- **An opened Library item** shows its text in plain type, a Connections box that says "No saved subject, Collection, folder or tag links", and an Organize box with two paragraphs of rules about what Add to folder and Move do. The page explains the filing system, not the idea.
- **Research** is a heading, one empty box ("What would you like to understand?"), a greyed-out Explore question button and "No saved answers yet." A banner reads "Shared notes belong to another subject". In my run a script error was logged and, on the first try, the Library folder panel showed through behind it. Nothing on the page is something you would want to come back to.
- **Subject board** is three columns: Origins ("No saved source record listed"), Understanding ("No saved research record listed") and Pieces. It lists records and buttons. There is no picture, no quote, no connection drawn.

Across all four: every screen is organised around work stages (Gather, Develop, Make, Deliver) and file operations, not around ideas. Words you kept never appear on the screen unless you open the source itself. Empty states dominate because the demo is nearly empty, so I cannot say how full screens look. The real Library may look better. I did not look at it.

## Details

- **Sources read:** CLAUDE.md, the 11 November plan, START.md, CURRENT.md, PRODUCT.md (the three named decisions), the 18 October connected-library design, FILE-CONTRACT-MAP, section 03, headers of `library.mjs`, `library-folders.mjs`, `youtube-captions.mjs`, `research-material.mjs`, `docs/CAPABILITIES.md`.
- **Not checked:** i64os in full; Simmer and Tea Atlas code; the Collections screen (its button did not open in the demo); light theme and phone widths; any real data.
- **Demo run:** `npm run setup`, `npm run build`, `npm run demo` on 8854. The page logged 409 and 404 responses on load and one script error; I did not investigate them.
- **Screenshots:** `screens/library.png`, `screens/library-item.png`, `screens/research.png`, `screens/subject-board.png`.
