# AR Create: start here

Read [AGENTS.md](../AGENTS.md) first. This page is enough to act. Intent lives in [product/PRODUCT.md](product/PRODUCT.md); what works today is in [status/CURRENT.md](status/CURRENT.md).

## The product in one view

**Library** holds every source and personal note once, with a permanent identity. **Collections** are reusable inquiries over Library sources: questions, evidence, evolving understanding. **Pieces** are independently edited expressions (article, carousel, script, post, shared note). **Projects** optionally connect Collections and Pieces. Twelve **sections** are entrances to that work, never gates. Groups: Gather (01-02), Develop (03-04), Make (05-09), Deliver (10-12).

### Sections: one name each

| ID | Canonical label | Aliases in older text and code | Brief |
|---|---|---|---|
| 01 | Material | Intake | [01](product/sections/01-material.md) |
| 02 | Source | Transcripts & sources, Transcript | [02](product/sections/02-transcripts.md) |
| 03 | Research | Learning | [03](product/sections/03-research.md) |
| 04 | Direction | Pick, Concept | [04](product/sections/04-direction.md) |
| 05 | Write | Draft | [05](product/sections/05-draft.md) |
| 06 | Read | Read & refine | [06](product/sections/06-read-refine.md) |
| 07 | Check | Check changes, Checked | [07](product/sections/07-check-changes.md) |
| 08 | Media | Photos | [08](product/sections/08-media.md) |
| 09 | Arrange | Placed | [09](product/sections/09-arrange.md) |
| 10 | Audience | Review & release, Look | [10](product/sections/10-review-release.md) |
| 11 | Share | Share & celebrate, Feedback | [11](product/sections/11-share-celebrate.md) |
| 12 | Outputs | Published & complete, Confirmed | [12](product/sections/12-published-complete.md) |

### Code names to product concepts

| Code name | Product concept |
|---|---|
| `study`, `document-study`, `donor/study` | The app itself. The page is `/document-study/index.html`; `runtime/` is the server. |
| `donor` | Code copied in from other projects (`mag`, `study`, `teajia`, `wordforge`); not product vocabulary. |
| `wordforge` | A markdown bridge copied from i64os. Unrelated to i64os's oracle writing tool. |
| `mag`, `magazine` | The Teajia magazine services, being folded into AR Create as one writer over the vault. |
| `first-flow` | The original Magazine first-run flow: project binding and research preparation. Still routed; its commands sit under Research. |
| `shared-article`, `shared-carousel` | Pieces of kind article and carousel (the proposal and accept path). |
| `pieces` (API, data) | The saved technical workspace records, not the product term. Pieces are expressions. |
| `inquiry`, `inquiries` (API) | A Collection with its own learning record. |
| `concept`, `concepts` (API, CLI `project`) | The shared Markdown brief of a Project: your thoughts, provisional ideas, source links, saved as human direction. |
| `collection` (Library) | A named grouping of sources, a UUID in `library-index.json`. Not an inquiry. |
| `collection` (`create-collection`, "authored collection root") | The pre-output project folder. Same thing as the **working root** below. |
| `project`, `parentStudyId` | A Project's identity in the older APIs. Agents pass `parentStudyId`. |
| working root | `study-draft-copies/copies/<bindingUUID>/workflow/Workflow/`, holding `DEV - Collection.md` and the Piece's working text. |

## The screen: approved workbench direction

The current design authority is the approved [C workbench preview](../design/three-directions/c-workbench/index.html) and its [revisions 2–5 and final notes](../design/three-directions/c-workbench/NOTES.md). The navigation is unnumbered: a 66px icon rail sits beside a 240px current-owner panel when that section has places to navigate, then the work area. On phones, navigation becomes group sheets. Do not imply that the twelve product sections form a numbered or compulsory sequence.

Use Plus Jakarta Sans throughout the interface with the approved 13/15/16/17px scale, shared A−/A+ sizing, and Lora only for speech. Read and Write share the same document geometry. This is the approved design direction. The Workbench is installed in bounded scope; full functional and visual acceptance remains open. Exact installed revisions, later candidates and their evidence are recorded in [CURRENT](status/CURRENT.md).

## Where data lives

All paths are under the home's `data/`. Read them through the CLI, never directly.

| Folder or file | Holds |
|---|---|
| `library/`, `library-index.json` | Sources, personal notes, Library collections, evidence cards |
| `study-project-bindings/`, `pieces/`, `state.json` | Project and piece identities and saved workspace state |
| `study-draft-copies/` | Working roots and the Piece's working text |
| `workspaces/<projectId>/` | `HUMAN-DIRECTION.md` (the concept brief), its history |
| `articles/`, `carousels/`, `native-outputs/` | Output wording, editions, exports |
| `source-history/`, transcript owner | Transcript sessions and corrections |
| `journal/<yyyy-mm>.jsonl`, `leases/<kind>/<id>.json` | Who did what; who holds what |
| `provenance/`, `*-requests/` | Actor stamps, proposals awaiting a human |

## Actors, leases, journal

Actor values: `human:adrian`, `agent:claude-code|codex|claude-design|hermes|grok|chatgpt`, `cron:<name>`, `import:<source>`, `release:<sha>`. They are honest labels on this Mac, not authentication. Clients: `ui`, `cli`, `mcp`, `http`, `file`.

- **Lease**: `lease acquire --input '{"scope":{"kind":"project","id":"<parentStudyId>"},"reason":"..."}'`. Fifteen minutes, renewable. A live foreign lease answers 423 with the holder. Scope kinds: project, collection, draft, output, piece, source, share, concept, research, media, library.
- **Journal**: every committed, rejected or conflicting write is one line. `history` reads it.
- **Handoff**: `handoff --input '{"scope":{...},"to":"human:adrian","summary":"<=280 chars"}'` when you stop.
- **Ask**: `ask --input '{"scope":{...},"question":"<=280 chars","options":["a","b"]}'` for a decision only Adrian can make; it shows in the app.
- **Events**: `events --input '{"since":<cursor>}'` and the status `editor` field tell you whether Adrian has unsaved words.

## Recipe: read a project and save a concept note

With `AR_CREATE_URL`, `AR_CREATE_ACTOR` and `CLI` set as in AGENTS.md:

```sh
node "$CLI" status
node "$CLI" project list
echo '{"parentStudyId":"<id>"}' | node "$CLI" project read --input -
echo '{"parentStudyId":"<id>","query":"<words>","limit":5}' | node "$CLI" library search --input -
echo '{"scope":{"kind":"project","id":"<id>"},"reason":"saving a concept note"}' | node "$CLI" lease acquire --input -
echo '{"parentStudyId":"<id>","operationId":"<new uuid>","expectedRevision":<n>,"expectedHash":"<hash>","authorThoughts":"<Adrian's words, exact>","aiInterpretation":"<yours, provisional>","suggestions":"","sourceSelections":[]}' | node "$CLI" project save --input -
echo '{"scope":{"kind":"project","id":"<id>"}}' | node "$CLI" lease release --input -
```

`project list` shows only projects that already have a concept. If `<id>` is missing, `project read` answers 404: run `project create` with `{"parentStudyId","title","operationId"}` first. Copy `expectedRevision` and `expectedHash` from the read. If the read says `structured:false`, save the exact text as `body` instead of the four fields. A `sourceSelections` entry needs `sourceId`, `sourceHash`, `quote` and `start` copied from `library read`. Exit codes: 3 is 409 (re-read), 4 is 423, 5 is 403. Concept saves without an actor answer 400.

## Releasing

`node scripts/release.mjs --home <dir> --dry-run`, then without `--dry-run`. It refuses a dirty tree or a stale `source-manifest.json` (refresh with `node scripts/refresh-manifest.mjs`), copies the manifest files only, builds, swaps `service/`, keeps `service.prev/`, writes `RELEASE.json`. `--rollback` and `--verify` exist. It never touches `data/`, `config/` or `state/`, and never restarts anything. Whoever runs it is recorded in `builtBy`.

## Rules that do not bend

Keep Adrian's exact words, protections and rejection reasons. Never last-write-wins; keep both versions. Shared origins, independent expressions: a change flags other outputs and never rewrites them. Stale, dirty or unsupported work refuses to save. No new engine, database, provider or publication from docs alone. Present, connected, verified and human-accepted are four different states.

**Order of authority** (stated here once). For intent: the latest dated decision, then PRODUCT, the section brief, LOOK. For what is true today: CURRENT.md, then the code, which always wins over any document.
